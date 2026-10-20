import pino from 'pino';

const baseLogger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  },
});

type LogLevel = 'info' | 'warn' | 'error';

function write(level: LogLevel, args: unknown[]) {
  const method = baseLogger[level].bind(baseLogger) as (...values: unknown[]) => void;
  if (typeof args[0] === 'string' && args.length > 1) {
    const [message, ...details] = args;
    const err = details.find((detail) => detail instanceof Error);
    method(err ? { err, details } : { details }, message);
    return;
  }
  method(...args);
}

export const logger = {
  info: (...args: unknown[]) => write('info', args),
  warn: (...args: unknown[]) => write('warn', args),
  error: (...args: unknown[]) => write('error', args),
};
