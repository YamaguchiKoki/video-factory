/**
 * Logger infrastructure
 * Structured JSON logging for CloudWatch Logs
 */

export interface Logger {
  debug: (message: string, context?: Record<string, unknown>) => void;
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  error: (
    message: string,
    error: Error | null,
    context?: Record<string, unknown>
  ) => void;
}

/**
 * Log level type
 */
type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

/**
 * Get log level from environment variable
 * @returns Log level (default: INFO)
 */
const getLogLevel = (): LogLevel => {
  const level = process.env.LOG_LEVEL?.toUpperCase();
  if (level === "DEBUG" || level === "INFO" || level === "WARN" || level === "ERROR") {
    return level;
  }
  return "INFO";
};

/**
 * Check if a log level should be logged based on current log level
 */
const shouldLog = (level: LogLevel, currentLevel: LogLevel): boolean => {
  const levels: LogLevel[] = ["DEBUG", "INFO", "WARN", "ERROR"];
  const levelIndex = levels.indexOf(level);
  const currentLevelIndex = levels.indexOf(currentLevel);
  return levelIndex >= currentLevelIndex;
};

/**
 * Create a structured logger instance
 * @param requestId - Unique request ID for traceability
 * @returns Logger instance
 */
export const createLogger = (requestId: string): Logger => {
  const logLevel = getLogLevel();

  const log = (
    level: LogLevel,
    message: string,
    error: Error | null = null,
    context?: Record<string, unknown>
  ): void => {
    if (!shouldLog(level, logLevel)) {
      return;
    }

    const logObject = {
      timestamp: new Date().toISOString(),
      level,
      message,
      requestId,
      ...(context && { context }),
      ...(error && { error: error.message, stack: error.stack }),
    };

    console.log(JSON.stringify(logObject));
  };

  return {
    debug: (message, context) => log("DEBUG", message, null, context),
    info: (message, context) => log("INFO", message, null, context),
    warn: (message, context) => log("WARN", message, null, context),
    error: (message, err, context) => log("ERROR", message, err, context),
  };
};
