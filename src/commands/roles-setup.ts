import { SlashCommandBuilder, ChatInputCommandInteraction as CommandInteraction, PermissionFlagsBits, Guild, RoleCreateOptions } from 'discord.js';

type RoleSpec = {
  name: string;
  options?: Partial<RoleCreateOptions>;
};

const staffRoles: RoleSpec[] = [
  { name: 'المالك', options: { permissions: ['Administrator'] as any, color: 'DarkRed' } },
  { name: 'نائب المالك', options: { permissions: ['ManageGuild', 'ManageRoles', 'ManageChannels', 'ViewAuditLog', 'KickMembers', 'BanMembers'] as any, color: 'DarkRed' } },
  { name: 'مدير السيرفر', options: { permissions: ['ManageGuild', 'ManageRoles', 'ManageChannels', 'ViewAuditLog', 'KickMembers', 'BanMembers'] as any, color: 'DarkOrange' } },
  { name: 'رئيس الإدارة', options: { permissions: ['ManageGuild', 'ManageChannels', 'ManageRoles', 'ViewAuditLog'] as any, color: 'Orange' } },
  { name: 'مدير', options: { permissions: ['ManageChannels', 'ManageRoles', 'ManageMessages'] as any, color: 'Gold' } },
  { name: 'كبير المشرفين', options: { permissions: ['ManageMessages', 'ModerateMembers', 'KickMembers'] as any, color: 'Yellow' } },
  { name: 'مشرف', options: { permissions: ['ManageMessages', 'ModerateMembers'] as any, color: 'Yellow' } },
  { name: 'مشرف شات', options: { permissions: ['ManageMessages'] as any, color: '#FFB347' } },
  { name: 'فريق الدعم', options: { permissions: [] as any, color: 'Green' } },
  { name: 'مراقب تجريبي', options: { permissions: [] as any, color: 'Grey' } },
  { name: 'مدير البوت', options: { permissions: [] as any, color: 'Blue' } },
  { name: 'مدير السجلات', options: { permissions: ['ViewAuditLog', 'ManageMessages'] as any, color: 'Purple' } },
];

const eventRoles: RoleSpec[] = [
  { name: 'مدير الفعاليات', options: { permissions: [] as any, color: 'DarkVividPink' } },
  { name: 'منظم الفعاليات', options: { permissions: [] as any, color: 'DarkVividPink' } },
  { name: 'منظم المسابقات', options: { permissions: [] as any, color: 'DarkVividPink' } },
  { name: 'مسؤول الجوائز', options: { permissions: [] as any, color: 'DarkGold' } },
  { name: 'مُعلن الفعاليات', options: { permissions: [] as any, color: 'DarkAqua' } },
  { name: 'فائز الفعالية', options: { permissions: [] as any, color: 'DarkGreen' } },
  { name: 'مشارك الفعالية', options: { permissions: [] as any, color: 'Grey' } },
];

const memberRoles: RoleSpec[] = [
  { name: 'لاعب', options: { color: 'DarkGreen' } },
  { name: 'مصمم', options: { color: 'DarkVividPink' } },
  { name: 'صانع محتوى', options: { color: 'DarkGold' } },
  { name: 'محب الموسيقى', options: { color: 'DarkBlue' } },
  { name: 'إشعارات الفعاليات', options: { color: 'Green' } },
  { name: 'إشعارات المسابقات', options: { color: 'Green' } },
  { name: 'إشعارات السحوبات', options: { color: 'Green' } },
  { name: 'عضو نشط', options: { color: 'Blue' } },
];

export default {
  data: new SlashCommandBuilder()
    .setName('اعداد-الرتب')
    .setDescription('إنشاء رتب الطاقم والفعاليات والأدوار التفاعلية (يتحقق من وجودها أولًا)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: CommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ هذا الأمر يعمل داخل السيرفر فقط.', ephemeral: true });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: '❌ أنت لا تملك صلاحية إنشاء الرتب. (تحتاج Manage Guild)', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild as Guild;
    const report: string[] = [];
    await guild.roles.fetch().catch((error) => {
      report.push(`- ⚠️ تعذر تحديث قائمة الرتب: ${(error as Error).message}`);
    });

    const createRoles = async (roles: RoleSpec[]) => {
      for (const spec of roles) {
        try {
          const existing = guild.roles.cache.find((r) => r.name === spec.name);
          if (existing) {
            report.push(`- ✅ موجود بالفعل: ${spec.name}`);
            continue;
          }

          await guild.roles.create({ name: spec.name, ...spec.options, reason: 'إنشاء رتب حسب طلب المسؤول' });
          report.push(`- ➕ تم الإنشاء: ${spec.name}`);
        } catch (error: any) {
          report.push(`- ❌ فشل إنشاء ${spec.name}: ${error.message || String(error)}`);
        }
      }
    };

    await createRoles(staffRoles);
    await createRoles(eventRoles);
    await createRoles(memberRoles);
    const output = report.join('\n');
    await interaction.editReply(
      `${output.slice(0, 1700)}\n\n` +
        'لم أعدّل صلاحيات الرتب الموجودة أو ترتيب الرتب الحالية. ضع الرتب الجديدة تحت رتبة البوت، ثم رتّبها حسب التسلسل في إعدادات السيرفر.',
    );
  },
};
