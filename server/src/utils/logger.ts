import winston from 'winston';

const isProduction = process.env.NODE_ENV === 'production';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    isProduction
      ? winston.format.json()
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ level, message, timestamp, ...meta }) => {
            // Clean, single-line output for dev
            const time = (timestamp as string).slice(11, 19); // HH:MM:SS only
            const keys = Object.keys(meta);
            if (!keys.length) return `${time} [${level}] ${message}`;
            // Show only key values inline, skip large objects
            const parts = keys
              .filter((k) => typeof meta[k] !== 'object' || Array.isArray(meta[k]))
              .map((k) => {
                const v = meta[k];
                if (Array.isArray(v)) return `${k}=${v.length > 3 ? `[${v.slice(0, 3).join(', ')}... +${v.length - 3}]` : `[${v.join(', ')}]`}`;
                return `${k}=${v}`;
              });
            return `${time} [${level}] ${message}${parts.length ? '  ' + parts.join(' | ') : ''}`;
          })
        )
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
});

export default logger;
