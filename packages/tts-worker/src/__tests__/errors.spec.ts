// Tests for the toError utility (errors.ts).
// This module does not exist yet; tests are written TDD-first.

import { describe, expect, it } from "vitest";
import { toError } from "../errors";

describe("toError", () => {
  it("returns the same Error instance when given an Error", () => {
    // Arrange
    const original = new Error("original message");

    // Act
    const result = toError(original);

    // Assert
    expect(result).toBe(original);
  });

  it("wraps a string in a new Error", () => {
    // Arrange
    const message = "something went wrong";

    // Act
    const result = toError(message);

    // Assert
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe(message);
  });

  it("wraps a number in a new Error via String()", () => {
    // Arrange
    const code = 42;

    // Act
    const result = toError(code);

    // Assert
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("42");
  });

  it("wraps null in a new Error via String()", () => {
    // Act
    const result = toError(null);

    // Assert
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("null");
  });

  it("wraps undefined in a new Error via String()", () => {
    // Act
    const result = toError(undefined);

    // Assert
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("undefined");
  });

  it("wraps a plain object in a new Error via String()", () => {
    // Arrange
    const obj = { code: 500 };

    // Act
    const result = toError(obj);

    // Assert
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("[object Object]");
  });
});
