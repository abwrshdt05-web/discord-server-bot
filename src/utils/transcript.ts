export function buildTranscript(messages: Array<{ author: string; content: string; timestamp: number }>) {
  const lines = messages.map((m) => `[${new Date(m.timestamp).toISOString()}] ${m.author}: ${m.content}`);
  return lines.join('\n');
}
