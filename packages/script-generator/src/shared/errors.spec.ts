import { describe, expect, it } from "vitest";
import { toError } from "./errors";

describe("toError", () => {
  it("returns the same Error instance when given an Error", () => {
    const original = new Error("original");
    const result = toError(original);
    expect(result).toBe(original);
  });

  it("wraps a string in a new Error", () => {
    const result = toError("something went wrong");
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("something went wrong");
  });

  it("wraps a number in a new Error via String()", () => {
    const result = toError(42);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("42");
  });

  it("wraps null in a new Error via String()", () => {
    const result = toError(null);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("null");
  });
});
