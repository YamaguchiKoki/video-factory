/**
 * Logger tests
 * Tests for structured logging functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createLogger } from "./logger";

describe("createLogger()", () => {
  const originalEnv = process.env.LOG_LEVEL;
  const originalLog = console.log;

  beforeEach(() => {
    vi.clearAllMocks();
    console.log = vi.fn();
  });

  afterEach(() => {
    process.env.LOG_LEVEL = originalEnv;
    console.log = originalLog;
  });

  it("should create a logger with the given requestId", () => {
    const logger = createLogger("test-request-id");

    expect(logger).toHaveProperty("debug");
    expect(logger).toHaveProperty("info");
    expect(logger).toHaveProperty("warn");
    expect(logger).toHaveProperty("error");
  });

  it("should log INFO messages with correct structure", () => {
    const logger = createLogger("test-request-id");
    logger.info("Test message", { key: "value" });

    expect(console.log).toHaveBeenCalledTimes(1);
    const logOutput = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const parsed = JSON.parse(logOutput);

    expect(parsed).toMatchObject({
      level: "INFO",
      message: "Test message",
      requestId: "test-request-id",
      context: { key: "value" },
    });
    expect(parsed).toHaveProperty("timestamp");
  });

  it("should log ERROR messages with error details", () => {
    const logger = createLogger("test-request-id");
    const testError = new Error("Test error");
    logger.error("Error occurred", testError, { step: "test" });

    expect(console.log).toHaveBeenCalledTimes(1);
    const logOutput = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const parsed = JSON.parse(logOutput);

    expect(parsed).toMatchObject({
      level: "ERROR",
      message: "Error occurred",
      requestId: "test-request-id",
      error: "Test error",
      context: { step: "test" },
    });
    expect(parsed).toHaveProperty("stack");
  });

  it("should respect LOG_LEVEL environment variable", () => {
    process.env.LOG_LEVEL = "WARN";
    const logger = createLogger("test-request-id");

    logger.debug("Debug message");
    logger.info("Info message");
    logger.warn("Warn message");

    // Only WARN should be logged (DEBUG and INFO filtered out)
    expect(console.log).toHaveBeenCalledTimes(1);
    const logOutput = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const parsed = JSON.parse(logOutput);

    expect(parsed.level).toBe("WARN");
  });

  it("should default to INFO level when LOG_LEVEL is not set", () => {
    delete process.env.LOG_LEVEL;
    const logger = createLogger("test-request-id");

    logger.debug("Debug message");
    logger.info("Info message");

    // Only INFO should be logged (DEBUG filtered out)
    expect(console.log).toHaveBeenCalledTimes(1);
    const logOutput = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const parsed = JSON.parse(logOutput);

    expect(parsed.level).toBe("INFO");
  });

  it("should handle DEBUG level correctly", () => {
    process.env.LOG_LEVEL = "DEBUG";
    const logger = createLogger("test-request-id");

    logger.debug("Debug message");
    logger.info("Info message");

    // Both DEBUG and INFO should be logged
    expect(console.log).toHaveBeenCalledTimes(2);

    const logs = (console.log as ReturnType<typeof vi.fn>).mock.calls.map((call) =>
      JSON.parse(call[0])
    );

    expect(logs[0].level).toBe("DEBUG");
    expect(logs[1].level).toBe("INFO");
  });
});
