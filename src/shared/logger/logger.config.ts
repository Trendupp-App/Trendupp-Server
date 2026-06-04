import { format, transports } from 'winston';
import { Logtail } from '@logtail/node';
import { LogtailTransport } from '@logtail/winston';

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

  if (env === 'production' && logtailSourceToken) {
    const logtail = new Logtail(logtailSourceToken);
    logTransports.push(new LogtailTransport(logtail));
  }

  return {
    level: env === 'production' ? 'info' : 'debug',
    transports: logTransports,
  };
};
