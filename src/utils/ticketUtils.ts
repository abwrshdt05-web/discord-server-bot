export const TICKET_TYPES = ['general', 'support', 'report', 'appeal'] as const;

export type TicketType = (typeof TICKET_TYPES)[number];

const ticketTypeLabels: Record<TicketType, { title: string; channelSegment: string; description: string }> = {
  general: {
    title: 'استفسار عام',
    channelSegment: 'عام',
    description: 'اكتب استفسارك بالتفصيل، وسيرد عليك فريق الإدارة في أقرب وقت.',
  },
  support: {
    title: 'الدعم الفني',
    channelSegment: 'الدعم',
    description: 'اشرح المشكلة التقنية وأرفق ما يساعد على فهمها.',
  },
  report: {
    title: 'بلاغ',
    channelSegment: 'بلاغ',
    description: 'أرسل تفاصيل البلاغ والأدلة ذات الصلة. ستبقى التذكرة خاصة.',
  },
  appeal: {
    title: 'اعتراض',
    channelSegment: 'اعتراض',
    description: 'وضّح الإجراء الذي تعترض عليه وسبب طلب المراجعة.',
  },
};

export function isTicketType(value: string): value is TicketType {
  return (TICKET_TYPES as readonly string[]).includes(value);
}

export function getTicketTypeInfo(type: TicketType) {
  return ticketTypeLabels[type];
}

export function ticketOpenKey(guildId: string, creatorId: string, type: TicketType) {
  return `${guildId}:${creatorId}:${type}`;
}

export function sanitizeChannelSegment(value: string) {
  const normalized = value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u0600-\u06ff_-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');

  return normalized.slice(0, 35) || 'عضو';
}

export function ticketChannelName(type: TicketType, username: string, number: number) {
  const name = `تكت-${ticketTypeLabels[type].channelSegment}-${sanitizeChannelSegment(username)}-${String(number).padStart(4, '0')}`;
  return name.slice(0, 100).replace(/-+$/g, '');
}

export function isTicketStaff({
  userId,
  ownerId,
  hasAdministrator,
  hasManageGuild,
  roleIds,
  staffRoleIds,
}: {
  userId: string;
  ownerId: string;
  hasAdministrator: boolean;
  hasManageGuild: boolean;
  roleIds: readonly string[];
  staffRoleIds: readonly string[];
}) {
  if (userId === ownerId || hasAdministrator || hasManageGuild) return true;
  const authorizedRoles = new Set(staffRoleIds);
  return roleIds.some((roleId) => authorizedRoles.has(roleId));
}

export type TicketTranscriptEntry = {
  author: string;
  content: string;
  timestamp: number | Date;
  attachments?: readonly string[];
};

export function buildTicketTranscript(entries: readonly TicketTranscriptEntry[]) {
  const sorted = [...entries].sort(
    (left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
  );

  if (sorted.length === 0) return 'لا توجد رسائل في هذه التذكرة.';

  return sorted
    .map((entry) => {
      const timestamp = new Date(entry.timestamp).toISOString();
      const content = entry.content.trim() || '[رسالة بدون نص]';
      const attachments = entry.attachments?.length
        ? `\nالمرفقات: ${entry.attachments.join(' | ')}`
        : '';
      return `[${timestamp}] ${entry.author}: ${content}${attachments}`;
    })
    .join('\n\n');
}
