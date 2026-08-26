import { fc, it } from "@fast-check/vitest";
import { Result } from "effect";
import { describe, expect } from "vitest";
import { z } from "zod";
import { parseStructuredOutput } from "./structured-output.js";

// Mastra の structuredOutput は、正しい JSON を
//   1. そのままオブジェクトで返す（正常）
//   2. JSON 文字列で返す
//   3. 単一キーのオブジェクトに文字列として包んで返す（実際に観測された {"$schema": "..."} 形式）
// のいずれかの形で返してくる。1〜3 はすべて同じ値として解釈できなければならない。

const TopicSchema = z.object({
  id: z.string(),
  title: z.string(),
  count: z.number(),
});

describe("parseStructuredOutput", () => {
  it("should parse a plain object that already matches the schema", () => {
    // Arrange
    const value = { id: "news-1", title: "見出し", count: 3 };

    // Act
    const result = parseStructuredOutput(TopicSchema, value);

    // Assert
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) expect(result.success).toEqual(value);
  });

  it("should recover a JSON string", () => {
    // Arrange
    const value = { id: "news-1", title: "見出し", count: 3 };

    // Act
    const result = parseStructuredOutput(TopicSchema, JSON.stringify(value));

    // Assert
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) expect(result.success).toEqual(value);
  });

  it("should recover a value wrapped in a single-key object", () => {
    // Arrange — 2026-08-09 に実際に観測された形
    const value = { id: "news-1", title: "見出し", count: 3 };
    const wrapped = { $schema: JSON.stringify(value) };

    // Act
    const result = parseStructuredOutput(TopicSchema, wrapped);

    // Assert
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) expect(result.success).toEqual(value);
  });

  it("should fail for undefined", () => {
    // Act
    const result = parseStructuredOutput(TopicSchema, undefined);

    // Assert
    expect(Result.isFailure(result)).toBe(true);
  });

  it("should report the original zod error when nothing can be recovered", () => {
    // Act
    const result = parseStructuredOutput(TopicSchema, { id: "news-1" });

    // Assert
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result))
      expect(result.failure).toContain("Structured output validation failed");
  });

  it("should fail for a single-key object whose value is not JSON", () => {
    // Act
    const result = parseStructuredOutput(TopicSchema, { $schema: "not json" });

    // Assert
    expect(Result.isFailure(result)).toBe(true);
  });

  it("should not unwrap an object with more than one key", () => {
    // Arrange — 複数キーのオブジェクトは復旧対象にしない
    const value = { id: "news-1", title: "見出し", count: 3 };
    const result = parseStructuredOutput(TopicSchema, {
      $schema: JSON.stringify(value),
      extra: "x",
    });

    // Assert
    expect(Result.isFailure(result)).toBe(true);
  });

  it.prop([
    fc.record({
      id: fc.string(),
      title: fc.string(),
      count: fc.integer(),
    }),
  ])("should give the same result for all three encodings", (value) => {
    // Act — 素／JSON文字列／単一キー包みの3形態
    const plain = parseStructuredOutput(TopicSchema, value);
    const asString = parseStructuredOutput(TopicSchema, JSON.stringify(value));
    const wrapped = parseStructuredOutput(TopicSchema, {
      $schema: JSON.stringify(value),
    });

    // Assert — 3形態すべてが復旧できることを無条件にアサートする
    expect(Result.isSuccess(plain)).toBe(true);
    expect(Result.isSuccess(asString)).toBe(true);
    expect(Result.isSuccess(wrapped)).toBe(true);
    if (Result.isSuccess(plain)) expect(plain.success).toEqual(value);
    if (Result.isSuccess(asString)) expect(asString.success).toEqual(value);
    if (Result.isSuccess(wrapped)) expect(wrapped.success).toEqual(value);
  });

  it.prop([fc.integer()])("should always fail for a bare number", (n) => {
    // Assert — スキーマに合わない値は必ず失敗する
    expect(Result.isFailure(parseStructuredOutput(TopicSchema, n))).toBe(true);
  });

  it("should recover a double-wrapped value", () => {
    // Arrange — 単一キー包みがネストしても MAX_UNWRAP_DEPTH の範囲内なら復旧できる
    const value = { id: "news-1", title: "見出し", count: 3 };
    const singleWrapped = { $schema: JSON.stringify(value) };
    const doubleWrapped = { $schema: JSON.stringify(singleWrapped) };

    // Act
    const result = parseStructuredOutput(TopicSchema, doubleWrapped);

    // Assert
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) expect(result.success).toEqual(value);
  });

  it("should fail beyond the unwrap depth limit", () => {
    // Arrange — 3重に包まれた値は MAX_UNWRAP_DEPTH を超えるため復旧できない
    const value = { id: "news-1", title: "見出し", count: 3 };
    const singleWrapped = { $schema: JSON.stringify(value) };
    const doubleWrapped = { $schema: JSON.stringify(singleWrapped) };
    const tripleWrapped = { $schema: JSON.stringify(doubleWrapped) };

    // Act
    const result = parseStructuredOutput(TopicSchema, tripleWrapped);

    // Assert
    expect(Result.isFailure(result)).toBe(true);
  });

  it("should fail cleanly for a wrapped JSON null", () => {
    // Arrange — JSON.parse("null") は null を返すため、unwrap/parseJson が
    // 使う undefined センチネルと衝突しないことを確認する
    const result = parseStructuredOutput(TopicSchema, { $schema: "null" });

    // Assert
    expect(Result.isFailure(result)).toBe(true);
  });
});
