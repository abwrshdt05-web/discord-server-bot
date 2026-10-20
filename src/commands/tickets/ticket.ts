import {
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
} from 'discord.js';
import { prisma } from '../../db/client';
import {
  canManageTicket,
  closeTicketRecord,
  claimTicketRecord,
  findTicketByChannelId,
  generateTicketTranscript,
  getStaffRoleIds,
  getTicketConfig,
  makeTicketTranscriptAttachment,
  reopenTicketRecord,
  sendTicketLog,
} from '../../services/ticketService';
import { buildTicketPanelComponents, closeTicket, reopenTicket } from '../../events/ticketInteractions';
import { logger } from '../../utils/logger';
import { isTicketType, type TicketType } from '../../utils/ticketUtils';

const command = new SlashCommandBuilder()
  .setName('ticket')
  .setDescription('إعداد وإدارة نظام التذاكر')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('setup')
      .setDescription('إنشاء لوحة التذاكر أو تحديثها')
      .addChannelOption((option) =>
        option
          .setName('category')
          .setDescription('تصنيف قنوات التذاكر')
          .addChannelTypes(ChannelType.GuildCategory)
          .setRequired(false),
      )
      .addRoleOption((option) =>
        option.setName('staff-role').setDescription('رتبة فريق التذاكر').setRequired(false),
      )
      .addChannelOption((option) =>
        option
          .setName('log-channel')
          .setDescription('قناة لوق التذاكر')
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setRequired(false),
      )
      .addBooleanOption((option) =>
        option.setName('allow-duplicates').setDescription('السماح بأكثر من تذكرة مفتوحة من النوع نفسه').setRequired(false),
      )
      .addBooleanOption((option) =>
        option.setName('log-messages').setDescription('تسجيل رسائل التذاكر في قناة اللوق').setRequired(false),
      )
      .addBooleanOption((option) =>
        option.setName('transcripts').setDescription('إرفاق ترانسكريبت عند إغلاق التذكرة').setRequired(false),
      ),
  )
  .addSubcommand((subcommand) => subcommand.setName('close').setDescription('إغلاق التذكرة الحالية'))
  .addSubcommand((subcommand) => subcommand.setName('reopen').setDescription('إعادة فتح التذكرة الحالية'))
  .addSubcommand((subcommand) => subcommand.setName('claim').setDescription('استلام التذكرة الحالية'))
  .addSubcommand((subcommand) => subcommand.setName('transcript').setDescription('إنشاء ترانسكريبت للتذكرة الحالية'));

async function ensureCategory(
  guild: NonNullable<ChatInputCommandInteraction['guild']>,
  currentId: string | null,
  names: readonly string[],
  reason: string,
) {
  if (currentId) {
    const configured = await guild.channels.fetch(currentId).catch(() => null);
    if (configured?.type === ChannelType.GuildCategory) return configured;
  }

  const existing = guild.channels.cache.find(
    (channel) => channel.type === ChannelType.GuildCategory && names.includes(channel.name),
  );
  if (existing?.type === ChannelType.GuildCategory) return existing;

  return guild.channels.create({
    name: names[0],
    type: ChannelType.GuildCategory,
    reason,
  });
}

function getPrivateLogOverwrites(
  guild: NonNullable<ChatInputCommandInteraction['guild']>,
  staffRoleIds: readonly string[],
) {
  const overwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    ...staffRoleIds.map((id) => ({
      id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    })),
  ];
  const botId = guild.client.user?.id;
  if (botId) {
    overwrites.push({
      id: botId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
      ],
    });
  }
  return overwrites;
}

function canEveryoneView(
  guild: NonNullable<ChatInputCommandInteraction['guild']>,
  channel: TextChannel,
) {
  return channel.permissionsFor(guild.roles.everyone)?.has(PermissionFlagsBits.ViewChannel) ?? true;
}

async function allowStaffOnTicketLogs(
  guild: NonNullable<ChatInputCommandInteraction['guild']>,
  channel: TextChannel,
  staffRoleIds: readonly string[],
) {
  for (const roleId of staffRoleIds) {
    if (!guild.roles.cache.has(roleId) || roleId === guild.roles.everyone.id) continue;
    await channel.permissionOverwrites.edit(roleId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
    });
  }
  const botId = guild.client.user?.id;
  if (botId) {
    await channel.permissionOverwrites.edit(botId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      ManageChannels: true,
    });
  }
  return channel;
}

async function ensureLogChannel(
  guild: NonNullable<ChatInputCommandInteraction['guild']>,
  configuredId: string | null,
  selectedChannel: ReturnType<ChatInputCommandInteraction['options']['getChannel']>,
  categoryId: string,
  staffRoleIds: readonly string[],
) {
  if (selectedChannel) {
    if (selectedChannel.type !== ChannelType.GuildText && selectedChannel.type !== ChannelType.GuildAnnouncement) {
      throw new Error('اختَر قناة نصية للوق التذاكر.');
    }
    const textChannel = selectedChannel as TextChannel;
    if (canEveryoneView(guild, textChannel)) {
      throw new Error('قناة اللوق المحددة ظاهرة للجميع. اختر قناة خاصة بفريق الإدارة.');
    }
    return allowStaffOnTicketLogs(guild, textChannel, staffRoleIds);
  }

  if (configuredId) {
    const configured = await guild.channels.fetch(configuredId).catch(() => null);
    if (configured?.type === ChannelType.GuildText || configured?.type === ChannelType.GuildAnnouncement) {
      const textChannel = configured as TextChannel;
      if (!canEveryoneView(guild, textChannel)) {
        return allowStaffOnTicketLogs(guild, textChannel, staffRoleIds);
      }
    }
  }

  const aliases = new Set(['لوق-التكتات', 'لوق التكتات', 'سجلات-التكتات', 'سجلات التكتات']);
  const existing = guild.channels.cache.find(
    (channel) => aliases.has(channel.name) && channel.type === ChannelType.GuildText,
  );
  if (existing?.type === ChannelType.GuildText && !canEveryoneView(guild, existing)) {
    return allowStaffOnTicketLogs(guild, existing, staffRoleIds);
  }

  const privateName = existing ? 'لوق-التكتات-خاص' : 'لوق-التكتات';
  const created = await guild.channels.create({
    name: privateName,
    type: ChannelType.GuildText,
    parent: categoryId,
    permissionOverwrites: getPrivateLogOverwrites(guild, staffRoleIds),
    reason: 'إنشاء قناة خاصة للوق التذاكر',
  });
  return allowStaffOnTicketLogs(guild, created, staffRoleIds);
}

async function setupTicketPanel(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  if (
    !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) &&
    !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
  ) {
    await interaction.reply({ content: '❌ تحتاج صلاحية إدارة السيرفر لإعداد التذاكر.', ephemeral: true });
    return;
  }
  if (!interaction.channel || interaction.channel.type !== ChannelType.GuildText) {
    await interaction.reply({ content: '❌ استخدم الأمر داخل قناة نصية عامة لوضع لوحة التذاكر.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  const config = await getTicketConfig(guild.id);
  const categoryOption = interaction.options.getChannel('category');
  const selectedRole = interaction.options.getRole('staff-role');
  const duplicateOption = interaction.options.getBoolean('allow-duplicates');
  const messageLogOption = interaction.options.getBoolean('log-messages');
  const transcriptOption = interaction.options.getBoolean('transcripts');

  try {
    let staffRoleIds = getStaffRoleIds(guild, config.ticketStaffRoleIds);
    if (selectedRole?.id === guild.roles.everyone.id) {
      throw new Error('لا يمكن استخدام @everyone كرتبة لفريق التذاكر.');
    }
    if (selectedRole) staffRoleIds = [...new Set([...staffRoleIds, selectedRole.id])];

    const openCategory = categoryOption?.type === ChannelType.GuildCategory
      ? categoryOption
      : await ensureCategory(guild, config.ticketCategoryId, ['الدعم الفني', 'الدعم-الفني'], 'إعداد تصنيف التذاكر');
    const closedCategory = await ensureCategory(
      guild,
      config.ticketClosedCategoryId,
      ['التكتات-المغلقة', 'التكتات المغلقة'],
      'إعداد تصنيف التذاكر المغلقة',
    );
    const logChannel = await ensureLogChannel(
      guild,
      config.ticketLogChannelId,
      interaction.options.getChannel('log-channel'),
      openCategory.id,
      staffRoleIds,
    );

    const panelEmbed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('🎫 مركز التذاكر')
      .setDescription(
        'اختر نوع التذكرة المناسب من الأزرار أدناه. ستكون قناتك خاصة بك وبفريق الدعم المخوّل فقط.\n\n' +
          '🎫 **عام** — استفسارات عامة\n' +
          '🛠️ **الدعم** — مساعدة تقنية\n' +
          '🚨 **بلاغ** — الإبلاغ عن مشكلة أو مخالفة\n' +
          '⚖️ **اعتراض** — طلب مراجعة إجراء إداري',
      )
      .setFooter({ text: 'يرجى عدم إرسال كلمات المرور أو بيانات الدفع' });

    let panelMessage: Awaited<ReturnType<TextChannel['send']>> | null = null;
    if (config.ticketPanelChannelId && config.ticketPanelMessageId) {
      const oldChannel = await guild.channels.fetch(config.ticketPanelChannelId).catch(() => null);
      if (oldChannel?.type === ChannelType.GuildText) {
        panelMessage = await oldChannel.messages.fetch(config.ticketPanelMessageId).catch(() => null);
        if (panelMessage) {
          await panelMessage.edit({ embeds: [panelEmbed], components: buildTicketPanelComponents() });
        }
      }
    }

    if (!panelMessage) {
      panelMessage = await interaction.channel.send({
        embeds: [panelEmbed],
        components: buildTicketPanelComponents(),
        allowedMentions: { parse: [] },
      });
    }

    const updatedConfig = await prisma.guildConfig.update({
      where: { guildId: guild.id },
      data: {
        ticketCategoryId: openCategory.id,
        ticketClosedCategoryId: closedCategory.id,
        ticketLogChannelId: logChannel.id,
        ticketPanelChannelId: panelMessage.channelId,
        ticketPanelMessageId: panelMessage.id,
        ticketStaffRoleIds: staffRoleIds,
        ...(duplicateOption !== null ? { allowDuplicateTickets: duplicateOption } : {}),
        ...(messageLogOption !== null ? { ticketMessageLoggingEnabled: messageLogOption } : {}),
        ...(transcriptOption !== null ? { ticketTranscriptEnabled: transcriptOption } : {}),
      },
    });

    await prisma.logSetting.upsert({
      where: { guildId: guild.id },
      update: { ticketChannelId: logChannel.id },
      create: { guildId: guild.id, ticketChannelId: logChannel.id },
    });

    await interaction.editReply(
      `✅ تم تحديث إعداد التذاكر دون تكرار اللوحة.\n` +
        `**اللوحة:** <#${panelMessage.channelId}>\n` +
        `**تصنيف التذاكر:** <#${updatedConfig.ticketCategoryId}>\n` +
        `**اللوق الخاص:** <#${logChannel.id}>\n` +
        `**رتب الفريق:** ${staffRoleIds.length ? staffRoleIds.map((id) => `<@&${id}>`).join('، ') : 'مالك السيرفر ومديرو السيرفر'}`,
    );
  } catch (error) {
    logger.error({ err: error, guildId: guild.id }, 'Ticket setup failed');
    const detail = error instanceof Error ? ` ${error.message}` : '';
    await interaction.editReply(`❌ فشل إعداد التذاكر. تحقق من صلاحيات البوت وإمكانية إرسال الرسائل وإدارة القنوات.${detail}`);
  }
}

export default {
  data: command,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ هذا الأمر يعمل داخل السيرفر فقط.', ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'setup') {
      await setupTicketPanel(interaction);
      return;
    }

    if (!interaction.channel || interaction.channel.type !== ChannelType.GuildText) {
      await interaction.reply({ content: '❌ استخدم هذا الأمر داخل قناة التذكرة.', ephemeral: true });
      return;
    }

    const guild = interaction.guild;
    const channel = interaction.channel;
    const ticket = await findTicketByChannelId(guild.id, channel.id);
    if (!ticket) {
      await interaction.reply({ content: '❌ هذه القناة ليست تذكرة مسجلة.', ephemeral: true });
      return;
    }

    const config = await getTicketConfig(guild.id);
    const member = await guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member) {
      await interaction.reply({ content: '❌ تعذر التحقق من عضويتك في السيرفر.', ephemeral: true });
      return;
    }
    const staff = canManageTicket(member, guild, config.ticketStaffRoleIds);
    const creator = ticket.creatorId === interaction.user.id;

    if (subcommand === 'close') {
      if (!staff && !creator) {
        await interaction.reply({ content: '❌ لا تملك صلاحية إغلاق هذه التذكرة.', ephemeral: true });
        return;
      }
      await interaction.deferReply({ ephemeral: true });
      const result = await closeTicket(guild, channel, ticket, interaction.user.id);
      await interaction.editReply(result.message);
      return;
    }

    if (subcommand === 'claim') {
      if (!staff) {
        await interaction.reply({ content: '❌ استلام التذاكر متاح لفريق الدعم فقط.', ephemeral: true });
        return;
      }
      if (ticket.status !== 'open') {
        await interaction.reply({ content: '❌ لا يمكن استلام تذكرة مغلقة.', ephemeral: true });
        return;
      }
      const updated = await claimTicketRecord(ticket.id, interaction.user.id);
      await sendTicketLog(
        guild,
        '🙋 تم استلام التذكرة',
        `**التذكرة:** <#${channel.id}> (#${ticket.number})\n**الموظف:** <@${interaction.user.id}>`,
      );
      await interaction.reply({
        content: `✅ تم استلام التذكرة${updated.assigneeId ? ` بواسطة <@${updated.assigneeId}>` : ''}.`,
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'reopen') {
      if (!staff) {
        await interaction.reply({ content: '❌ إعادة فتح التذاكر متاحة لفريق الدعم فقط.', ephemeral: true });
        return;
      }
      await interaction.deferReply({ ephemeral: true });
      const result = await reopenTicket(guild, channel, ticket, interaction.user.id);
      await interaction.editReply(result.message);
      return;
    }

    if (subcommand === 'transcript') {
      if (!staff && !creator) {
        await interaction.reply({ content: '❌ لا تملك صلاحية الاطلاع على هذه التذكرة.', ephemeral: true });
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
  },
};
