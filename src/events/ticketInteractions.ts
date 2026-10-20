import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  Guild,
  Message,
  TextChannel,
} from 'discord.js';
import { prisma } from '../db/client';
import {
  canManageTicket,
  claimTicketRecord,
  closeTicketRecord,
  createTicketChannel,
  createTicketRecord,
  findOpenTicketForMember,
  findTicketByChannelId,
  generateTicketTranscript,
  getNextTicketNumber,
  getTicketConfig,
  isTicketTextChannel,
  logTicketMessage,
  makeTicketTranscriptAttachment,
  reopenTicketRecord,
  sendTicketLog,
} from '../services/ticketService';
import { getTicketTypeInfo, isTicketType, type TicketType } from '../utils/ticketUtils';
import { logger } from '../utils/logger';

export function buildTicketPanelComponents() {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket:open:general')
      .setLabel('عام')
      .setEmoji('🎫')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('ticket:open:support')
      .setLabel('الدعم')
      .setEmoji('🛠️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('ticket:open:report')
      .setLabel('بلاغ')
      .setEmoji('🚨')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('ticket:open:appeal')
      .setLabel('اعتراض')
      .setEmoji('⚖️')
      .setStyle(ButtonStyle.Success),
  );
  return [row];
}

export function buildTicketControlComponents() {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket:close')
      .setLabel('إغلاق التذكرة')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('ticket:claim')
      .setLabel('استلام التذكرة')
      .setEmoji('🙋')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('ticket:manage')
      .setLabel('إدارة')
      .setEmoji('⚙️')
      .setStyle(ButtonStyle.Secondary),
  );
  return [row];
}

function buildManageComponents(ticketStatus: string) {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket:manage:transcript')
      .setLabel('تنزيل الترانسكريبت')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(ticketStatus === 'open' ? 'ticket:manage:claim' : 'ticket:manage:reopen')
      .setLabel(ticketStatus === 'open' ? 'استلام التذكرة' : 'إعادة فتح')
      .setStyle(ticketStatus === 'open' ? ButtonStyle.Primary : ButtonStyle.Success),
  );
  return [row];
}

function buildWelcomeEmbed(type: TicketType, number: number, userId: string) {
  const info = getTicketTypeInfo(type);
  return new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle(`🎫 ${info.title} — التذكرة #${number}`)
    .setDescription(`${info.description}\n\n**صاحب التذكرة:** <@${userId}>\n**الرقم:** #${number}`)
    .addFields({
      name: 'ملاحظة',
      value: 'اكتب التفاصيل هنا، ولا ترسل كلمات مرور أو معلومات دفع.',
    })
    .setTimestamp();
}

async function replyEphemeral(interaction: ButtonInteraction, content: string) {
  if (interaction.deferred || interaction.replied) {
    await interaction.followUp({ content, ephemeral: true }).catch(() => undefined);
  } else {
    await interaction.reply({ content, ephemeral: true }).catch(() => undefined);
  }
}

async function getTicketContext(interaction: ButtonInteraction) {
  if (!interaction.guild || !interaction.channel || !isTicketTextChannel(interaction.channel)) {
    await replyEphemeral(interaction, '❌ يجب استخدام هذا الإجراء داخل قناة تذكرة نصية.');
    return null;
  }

  const ticket = await findTicketByChannelId(interaction.guild.id, interaction.channel.id);
  if (!ticket) {
    await replyEphemeral(interaction, '❌ هذه القناة غير مسجلة كتذكرة.');
    return null;
  }

  const config = await getTicketConfig(interaction.guild.id);
  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member) {
    await replyEphemeral(interaction, '❌ تعذر التحقق من عضويتك في السيرفر.');
    return null;
  }

  return {
    guild: interaction.guild,
    channel: interaction.channel,
    ticket,
    config,
    member,
    staff: canManageTicket(member, interaction.guild, config.ticketStaffRoleIds),
    creator: ticket.creatorId === interaction.user.id,
  };
}

async function createFromPanel(interaction: ButtonInteraction, value: string) {
  if (!interaction.guild) {
    await replyEphemeral(interaction, '❌ لا يمكن فتح تذكرة خارج السيرفر.');
    return;
  }
  if (!isTicketType(value)) {
    await replyEphemeral(interaction, '❌ نوع التذكرة غير معروف.');
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const type = value as TicketType;
  const config = await getTicketConfig(interaction.guild.id);

  if (!config.allowDuplicateTickets) {
    const existing = await findOpenTicketForMember(interaction.guild, interaction.user.id, type);
    if (existing) {
      await interaction.editReply(`لديك تذكرة مفتوحة من هذا النوع: ${existing.channel}`);
      return;
    }
  }

  const number = await getNextTicketNumber(interaction.guild.id);
  const category = config.ticketCategoryId
    ? await interaction.guild.channels.fetch(config.ticketCategoryId).catch(() => null)
    : null;
  const categoryId = category?.type === ChannelType.GuildCategory ? category.id : undefined;
  let channel: TextChannel | null = null;

  try {
    channel = await createTicketChannel({
      guild: interaction.guild,
      creator: interaction.user,
      type,
      categoryId,
      staffRoleIds: config.ticketStaffRoleIds,
      number,
    });

    let ticket;
    try {
      ticket = await createTicketRecord({
        guildId: interaction.guild.id,
        channelId: channel.id,
        creatorId: interaction.user.id,
        ticketType: type,
        number,
        allowDuplicate: config.allowDuplicateTickets,
      });
    } catch (error) {
      await channel.delete('إلغاء قناة تذكرة لم يتمكن النظام من تسجيلها').catch(() => undefined);
      channel = null;

      if ((error as { code?: string })?.code === 'P2002' && !config.allowDuplicateTickets) {
        const existing = await findOpenTicketForMember(interaction.guild, interaction.user.id, type);
        await interaction.editReply(
          existing
            ? `لديك تذكرة مفتوحة من هذا النوع: ${existing.channel}`
            : 'لديك تذكرة مفتوحة بالفعل. أعد المحاولة بعد لحظات.',
        );
        return;
      }
      throw error;
    }

    await channel.send({
      embeds: [buildWelcomeEmbed(type, number, interaction.user.id)],
      components: buildTicketControlComponents(),
      allowedMentions: { users: [interaction.user.id], parse: [] },
    });

    await sendTicketLog(
      interaction.guild,
      '🎫 تم إنشاء تذكرة',
      `**التذكرة:** <#${channel.id}> (#${ticket.number})\n**النوع:** ${getTicketTypeInfo(type).title}\n**العضو:** <@${interaction.user.id}>`,
    );
    await interaction.editReply(`✅ تم فتح تذكرتك الخاصة: ${channel}`);
  } catch (error) {
    logger.error({ err: error, guildId: interaction.guild.id, userId: interaction.user.id }, 'Ticket creation failed');
    if (channel) {
      await prisma.ticket.updateMany({
        where: { channelId: channel.id, status: 'open' },
        data: { status: 'closed', openKey: null, closedAt: new Date() },
      }).catch(() => undefined);
    }
    await interaction.editReply('❌ تعذر إنشاء التذكرة. تحقق من صلاحيات البوت وحاول مرة أخرى.');
  }
}

export async function closeTicket(
  guild: Guild,
  channel: TextChannel,
  ticket: { id: string; number: number; creatorId: string; status: string },
  actorId: string,
) {
  if (ticket.status !== 'open') return { ok: false, message: 'هذه التذكرة مغلقة بالفعل.' };

  let transcriptFile;
  const config = await getTicketConfig(guild.id);
  if (config.ticketTranscriptEnabled) {
    try {
      const transcript = await generateTicketTranscript(channel);
      transcriptFile = makeTicketTranscriptAttachment(transcript, ticket.number);
    } catch (error) {
      logger.warn({ err: error, channelId: channel.id }, 'Ticket transcript generation failed');
    }
  }

  await closeTicketRecord(ticket.id);
  let channelUpdateFailed = false;

  try {
    await channel.permissionOverwrites.edit(ticket.creatorId, {
      ViewChannel: false,
      SendMessages: false,
      ReadMessageHistory: false,
    });
  } catch (error) {
    channelUpdateFailed = true;
    logger.warn({ err: error, channelId: channel.id }, 'Could not hide closed ticket from its creator');
  }

  if (config.ticketClosedCategoryId) {
    const closedCategory = await guild.channels.fetch(config.ticketClosedCategoryId).catch(() => null);
    if (closedCategory?.type === ChannelType.GuildCategory) {
      await channel.setParent(closedCategory.id, { lockPermissions: false }).catch((error) => {
        channelUpdateFailed = true;
        logger.warn({ err: error, channelId: channel.id }, 'Could not move closed ticket');
      });
    }
  }

  if (!channel.name.startsWith('مغلق-')) {
    await channel.setName(`مغلق-${channel.name}`.slice(0, 100)).catch((error) => {
      channelUpdateFailed = true;
      logger.warn({ err: error, channelId: channel.id }, 'Could not rename closed ticket');
    });
  }

  await sendTicketLog(
    guild,
    '🔒 تم إغلاق التذكرة',
    `**التذكرة:** <#${channel.id}> (#${ticket.number})\n**بواسطة:** <@${actorId}>${channelUpdateFailed ? '\n⚠️ تعذر تطبيق أحد تحديثات القناة؛ راجع صلاحيات البوت.' : ''}`,
    transcriptFile,
  );

  return {
    ok: true,
    message: channelUpdateFailed
      ? 'تم تسجيل إغلاق التذكرة، لكن تعذر تطبيق تحديث كامل للقناة. تحقق من صلاحيات البوت.'
      : '✅ تم إغلاق التذكرة وإخفاؤها عن صاحبها.',
  };
}

export async function reopenTicket(
  guild: Guild,
  channel: TextChannel,
  ticket: { id: string; number: number; creatorId: string; guildId: string; ticketType: string; status: string },
  actorId: string,
) {
  const config = await getTicketConfig(guild.id);
  if (ticket.status === 'open') {
    return { ok: false, message: 'هذه التذكرة مفتوحة بالفعل.' };
  }
  try {
    await reopenTicketRecord(ticket.id, config.allowDuplicateTickets);
  } catch (error) {
    if ((error as { code?: string })?.code === 'P2002') {
      return { ok: false, message: 'لدى صاحب التذكرة تذكرة أخرى مفتوحة من النوع نفسه؛ أغلقها أولًا.' };
    }
    throw error;
  }

  try {
    await channel.permissionOverwrites.edit(ticket.creatorId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AttachFiles: true,
    });
    if (config.ticketCategoryId) {
      const openCategory = await guild.channels.fetch(config.ticketCategoryId).catch(() => null);
      if (openCategory?.type === ChannelType.GuildCategory) {
        await channel.setParent(openCategory.id, { lockPermissions: false });
      }
    }
    if (channel.name.startsWith('مغلق-')) {
      await channel.setName(channel.name.slice('مغلق-'.length).slice(0, 100));
    }
  } catch (error) {
    await closeTicketRecord(ticket.id).catch((rollbackError) => {
      logger.error({ err: rollbackError, ticketId: ticket.id }, 'Could not roll back failed ticket reopen');
    });
    await channel.permissionOverwrites
      .edit(ticket.creatorId, { ViewChannel: false, SendMessages: false, ReadMessageHistory: false })
      .catch(() => undefined);
    if (config.ticketClosedCategoryId) {
      const closedCategory = await guild.channels.fetch(config.ticketClosedCategoryId).catch(() => null);
      if (closedCategory?.type === ChannelType.GuildCategory) {
        await channel.setParent(closedCategory.id, { lockPermissions: false }).catch(() => undefined);
      }
    }
    if (!channel.name.startsWith('مغلق-')) {
      await channel.setName(`مغلق-${channel.name}`.slice(0, 100)).catch(() => undefined);
    }
    logger.error({ err: error, channelId: channel.id }, 'Could not apply ticket reopen changes');
    return { ok: false, message: '❌ تعذر إعادة فتح التذكرة؛ أُعيدت الحالة إلى مغلقة.' };
  }
  await sendTicketLog(
    guild,
    '🔓 تم إعادة فتح التذكرة',
    `**التذكرة:** <#${channel.id}> (#${ticket.number})\n**بواسطة:** <@${actorId}>`,
  );
  return { ok: true, message: '✅ تمت إعادة فتح التذكرة.' };
}

export async function handleTicketButtonInteraction(interaction: ButtonInteraction) {
  const [namespace, action, value] = interaction.customId.split(':');
  if (namespace !== 'ticket') return;

  if (action === 'open') {
    await createFromPanel(interaction, value ?? '');
    return;
  }
  if (action === 'manage' && value) {
    await handleTicketManageButton(interaction);
    return;
  }

  const context = await getTicketContext(interaction);
  if (!context) return;
  const { guild, channel, ticket, config, staff, creator } = context;

  if (action === 'close') {
    if (!staff && !creator) {
      await replyEphemeral(interaction, '❌ لا تملك صلاحية إغلاق هذه التذكرة.');
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    const result = await closeTicket(guild, channel, ticket, interaction.user.id);
    await interaction.editReply(result.message);
    return;
  }

  if (action === 'claim') {
    if (!staff) {
      await replyEphemeral(interaction, '❌ استلام التذاكر متاح لفريق الدعم فقط.');
      return;
    }
    if (ticket.status !== 'open') {
      await replyEphemeral(interaction, '❌ لا يمكن استلام تذكرة مغلقة.');
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    const updated = await claimTicketRecord(ticket.id, interaction.user.id);
    await sendTicketLog(
      guild,
      '🙋 تم استلام التذكرة',
      `**التذكرة:** <#${channel.id}> (#${ticket.number})\n**الموظف:** <@${interaction.user.id}>`,
    );
    await interaction.editReply(
      updated.assigneeId === interaction.user.id
        ? '✅ أصبحت هذه التذكرة باسمك.'
        : `✅ تم تحديث الموظف المسؤول إلى <@${updated.assigneeId}>.`,
    );
    return;
  }

  if (action === 'manage') {
    if (!staff) {
      await replyEphemeral(interaction, '❌ أدوات الإدارة متاحة لفريق الدعم فقط.');
      return;
    }
    await interaction.reply({
      content: `إدارة التذكرة #${ticket.number}:`,
      components: buildManageComponents(ticket.status),
      ephemeral: true,
    });
    return;
  }

}

export async function handleTicketManageButton(interaction: ButtonInteraction) {
  const [, , action] = interaction.customId.split(':');
  const context = await getTicketContext(interaction);
  if (!context) return;
  const { guild, channel, ticket, staff, creator } = context;

  if (action === 'transcript') {
    if (!staff && !creator) {
      await replyEphemeral(interaction, '❌ لا تملك صلاحية الاطلاع على هذا الترانسكريبت.');
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    const transcript = await generateTicketTranscript(channel);
    await interaction.editReply({
      content: '📄 نسخة الترانسكريبت مرفقة.',
      files: [makeTicketTranscriptAttachment(transcript, ticket.number)],
    });
    return;
  }

  if (action === 'reopen') {
    if (!staff) {
      await replyEphemeral(interaction, '❌ إعادة فتح التذكرة متاحة لفريق الدعم فقط.');
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    const result = await reopenTicket(guild, channel, ticket, interaction.user.id);
    await interaction.editReply(result.message);
    return;
  }

  if (action === 'claim') {
    if (!staff) {
      await replyEphemeral(interaction, '❌ استلام التذاكر متاح لفريق الدعم فقط.');
      return;
    }
    if (ticket.status !== 'open') {
      await replyEphemeral(interaction, '❌ لا يمكن استلام تذكرة مغلقة.');
      return;
    }
    const updated = await claimTicketRecord(ticket.id, interaction.user.id);
    await sendTicketLog(
      guild,
      '🙋 تم استلام التذكرة',
      `**التذكرة:** <#${channel.id}> (#${ticket.number})\n**الموظف:** <@${interaction.user.id}>`,
    );
    await interaction.reply({
      content: `✅ تم استلام التذكرة بواسطة <@${updated.assigneeId}>.`,
      ephemeral: true,
    });
  }
}

export async function handleTicketMessage(message: Message) {
  if (!message.guild || !isTicketTextChannel(message.channel)) return;
  await logTicketMessage(message.guild, message.channel, message);
}
