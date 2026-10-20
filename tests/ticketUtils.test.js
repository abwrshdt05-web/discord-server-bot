const test = require('node:test');
const assert = require('node:assert/strict');
const {
  TICKET_TYPES,
  buildTicketTranscript,
  isTicketStaff,
  isTicketType,
  sanitizeChannelSegment,
  ticketChannelName,
  ticketOpenKey,
} = require('../dist/utils/ticketUtils');
const { normalizeChannelName } = require('../dist/services/channelCleanupService');

test('ticket types and Arabic channel naming are stable', () => {
  assert.deepEqual(TICKET_TYPES, ['general', 'support', 'report', 'appeal']);
  assert.equal(isTicketType('support'), true);
  assert.equal(isTicketType('unknown'), false);
  assert.equal(ticketChannelName('support', 'Abdullah | 🔐', 12), 'تكت-الدعم-abdullah-0012');
});

test('ticket channel segments remove unsupported characters and stay bounded', () => {
  assert.equal(sanitizeChannelSegment('عبدالله ✨ / Test!'), 'عبدالله-test');
  assert.ok(sanitizeChannelSegment('a'.repeat(100)).length <= 35);
});

test('open ticket key uniquely identifies a member, guild, and type', () => {
  assert.equal(ticketOpenKey('g1', 'u1', 'report'), 'g1:u1:report');
  assert.notEqual(ticketOpenKey('g1', 'u1', 'report'), ticketOpenKey('g1', 'u1', 'support'));
});

test('only owner, authorized staff roles, or managers pass the ticket staff check', () => {
  const base = {
    userId: 'member',
    ownerId: 'owner',
    hasAdministrator: false,
    hasManageGuild: false,
    roleIds: ['member-role'],
    staffRoleIds: ['support-role'],
  };
  assert.equal(isTicketStaff(base), false);
  assert.equal(isTicketStaff({ ...base, userId: 'owner' }), true);
  assert.equal(isTicketStaff({ ...base, roleIds: ['support-role'] }), true);
  assert.equal(isTicketStaff({ ...base, hasManageGuild: true }), true);
});

test('ticket transcripts are chronological and preserve attachment links', () => {
  const transcript = buildTicketTranscript([
    { author: 'B', content: 'بعد', timestamp: '2026-01-02T00:00:00Z' },
    { author: 'A', content: 'قبل', timestamp: '2026-01-01T00:00:00Z', attachments: ['https://example.test/file.png'] },
  ]);
  assert.ok(transcript.indexOf('A: قبل') < transcript.indexOf('B: بعد'));
  assert.match(transcript, /https:\/\/example\.test\/file\.png/);
  assert.equal(buildTicketTranscript([]), 'لا توجد رسائل في هذه التذكرة.');
});

test('channel matching ignores separators and decorative emoji', () => {
  assert.equal(normalizeChannelName('📑・لوق-التكتات'), normalizeChannelName('لوق التكتات'));
});
