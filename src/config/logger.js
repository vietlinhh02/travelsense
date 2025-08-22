const winston = require('winston');
const config = require('./config');

const enumerateErrorFormat = winston.format((info) => {
    if (info instanceof Error) {
        info.message = info.message;
        info.stack = info.stack;
    }
    return info;
});

const logger = winston.createLogger({
    level: config.log.level,
    format: winston.format.combine(
        enumerateErrorFormat(),
        config.env === 'development' ? winston.format.colorize() : winston.format.uncolorize(),
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [${level}]: ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'error.log', level: 'error' })
    ]
});

module.exports = logger;
