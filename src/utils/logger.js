const winston = require("winston");
const path = require("path");
require("dotenv").config();

const isWindows = process.platform === "win32";

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    let output = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0 && meta.service) {
      output += " " + JSON.stringify(meta);
    }
    return output;
  }),
);

const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(new winston.transports.Console({ format: consoleFormat }));
}

module.exports = logger;
