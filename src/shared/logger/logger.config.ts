import { format, transports } from 'winston';
import { Logtail } from '@logtail/node';
import { LogtailTransport } from '@logtail/winston';

const circularReplacer = () => {
  const seen = new WeakSet();
  return (_key: string, value: unknown) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    return value;
  };
};

const safeJsonFormat = format((info: any) => {
  /* eslint-disable @typescript-eslint/no-unsafe-return */
  try {
    return JSON.parse(JSON.stringify(info, circularReplacer()));
  } catch {
    return info;
  }
  /* eslint-enable @typescript-eslint/no-unsafe-return */
});

export const getLoggerConfig = (env: string, logtailSourceToken: string) => {
  const logTransports: any[] = [
    new transports.Console({
      format: format.combine(
        format.timestamp(),
        format.ms(),
        format.colorize(),
        format.printf(
          (info: {
            timestamp: string;
            level: string;
            message: string;
            context?: string;
            ms: string;
          }) => {
            const ctx = info.context ?? 'App';
            return `[Trendupp] ${info.timestamp} ${info.level} [${ctx}] ${info.message} ${info.ms}`;
          },
        ),
      ),
    }),
  ];

  const isProd = env === 'production' || env === 'staging';

  if (isProd && logtailSourceToken) {
    const logtail = new Logtail(logtailSourceToken);
    logTransports.push(
      new LogtailTransport(logtail, {
        format: format.combine(safeJsonFormat()),
      }),
    );
  }

  return {
    level: isProd ? 'info' : 'debug',
    transports: logTransports,
  };
};
