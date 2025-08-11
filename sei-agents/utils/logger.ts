// Logger Utility
import winston from 'winston';
import path from 'path';

const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6
};

// Create custom format
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  })
);

// Console format with colors
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} ${level}: ${message}`;
    if (Object.keys(metadata).length > 0 && metadata.stack) {
      msg += `\n${metadata.stack}`;
    }
    return msg;
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels: logLevels,
  format: customFormat,
  defaultMeta: { service: 'nexus-ai' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat
    })
  ]
});

// Add file transport in production
if (process.env.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  );
  
  logger.add(
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  );
}

// Logger class for instantiation
export class Logger {
  private context: string;
  private winston: winston.Logger;

  constructor(context?: string) {
    this.context = context || 'App';
    this.winston = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      levels: logLevels,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json(),
        winston.format.printf(({ timestamp, level, message, ...metadata }) => {
          let msg = `${timestamp} [${level.toUpperCase()}] [${this.context}]: ${message}`;
          if (Object.keys(metadata).length > 0) {
            msg += ` ${JSON.stringify(metadata)}`;
          }
          return msg;
        })
      ),
      defaultMeta: { service: 'nexus-ai', context: this.context },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({ format: 'HH:mm:ss' }),
            winston.format.printf(({ timestamp, level, message, ...metadata }) => {
              let msg = `${timestamp} ${level} [${this.context}]: ${message}`;
              if (Object.keys(metadata).length > 0 && metadata.stack) {
                msg += `\n${metadata.stack}`;
              }
              return msg;
            })
          )
        })
      ]
    });

    // Add file transport in production
    if (process.env.NODE_ENV === 'production') {
      this.winston.add(
        new winston.transports.File({
          filename: path.join('logs', 'error.log'),
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      );
      
      this.winston.add(
        new winston.transports.File({
          filename: path.join('logs', 'combined.log'),
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      );
    }
  }

  error(message: string, ...meta: any[]) {
    this.winston.error(message, ...meta);
  }

  warn(message: string, ...meta: any[]) {
    this.winston.warn(message, ...meta);
  }

  info(message: string, ...meta: any[]) {
    this.winston.info(message, ...meta);
  }

  http(message: string, ...meta: any[]) {
    this.winston.http(message, ...meta);
  }

  verbose(message: string, ...meta: any[]) {
    this.winston.verbose(message, ...meta);
  }

  debug(message: string, ...meta: any[]) {
    this.winston.debug(message, ...meta);
  }

  silly(message: string, ...meta: any[]) {
    this.winston.silly(message, ...meta);
  }
}

// Export convenience methods
export default {
  error: (message: string, ...meta: any[]) => logger.error(message, ...meta),
  warn: (message: string, ...meta: any[]) => logger.warn(message, ...meta),
  info: (message: string, ...meta: any[]) => logger.info(message, ...meta),
  http: (message: string, ...meta: any[]) => logger.http(message, ...meta),
  verbose: (message: string, ...meta: any[]) => logger.verbose(message, ...meta),
  debug: (message: string, ...meta: any[]) => logger.debug(message, ...meta),
  silly: (message: string, ...meta: any[]) => logger.silly(message, ...meta)
};