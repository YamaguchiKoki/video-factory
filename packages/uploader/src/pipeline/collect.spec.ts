import { Cause, Effect, type Exit, Option } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { collectPayload } from "./collect";

const expectTypedFailureMessage = (
  exit: Exit.Exit<unknown, { readonly message: string }>,
  expected: string,
): void => {
  expect(exit._tag).toBe("Failure");
  if (exit._tag !== "Failure") return;
  const error = Cause.findErrorOption(exit.cause);
  expect(Option.isSome(error)).toBe(true);
  if (Option.isSome(error)) expect(error.value.message).toContain(expected);
};

const encode = (s: string): Uint8Array => new TextEncoder().encode(s);

const SCRIPT = JSON.stringify({
  title: "今週の経済ニュース解説",
  newsItems: [],
  sections: [],
});

const buildDownload = (overrides: Record<string, Uint8Array | Error> = {}) =>
  vi.fn((_bucket: string, key: string) => {
    const override = overrides[key];
    if (override instanceof Error)
      return Effect.fail({ message: override.message });
    if (override) return Effect.succeed(override);

    const defaults: Record<string, Uint8Array> = {
      "script-generator/script.json": encode(SCRIPT),
      "metadata-generator/description.json": encode(
        JSON.stringify({ text: "概要欄です" }),
      ),
      "metadata-generator/comment.json": encode(
        JSON.stringify({ text: "初コメです" }),
      ),
      "metadata-generator/thumbnail.png": encode("PNGBYTES"),
      "video-worker/video.mp4": encode("MP4BYTES"),
    };
    const value = defaults[key];
    if (!value) return Effect.fail({ message: `unexpected key ${key}` });
    return Effect.succeed(value);
  });

describe("collectPayload", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should assemble the payload from the five S3 objects", async () => {
    // Arrange
    const download = buildDownload();

    // Act
    const payload = await Effect.runPromise(
      collectPayload(download as never)("my-bucket"),
    );

    // Assert
    expect(payload.title).toBe("今週の経済ニュース解説");
    expect(payload.description).toBe("概要欄です");
    expect(payload.firstComment).toBe("初コメです");
    expect(new TextDecoder().decode(payload.video)).toBe("MP4BYTES");
    expect(new TextDecoder().decode(payload.thumbnail)).toBe("PNGBYTES");
  });

  it("should read every object from the given bucket", async () => {
    // Arrange
    const download = buildDownload();

    // Act
    await Effect.runPromise(collectPayload(download as never)("my-bucket"));

    // Assert — 5点すべてを同じバケットから取る
    expect(download).toHaveBeenCalledTimes(5);
    for (const call of download.mock.calls) {
      expect(call[0]).toBe("my-bucket");
    }
  });

  it("should fail when the video is missing", async () => {
    // Arrange
    const download = buildDownload({
      "video-worker/video.mp4": new Error("NoSuchKey"),
    });

    // Act
    const exit = await Effect.runPromiseExit(
      collectPayload(download as never)("my-bucket"),
    );

    // Assert
    expectTypedFailureMessage(exit, "NoSuchKey");
  });

  it("should fail when the script JSON does not match the schema", async () => {
    // Arrange — title が無い
    const download = buildDownload({
      "script-generator/script.json": encode(JSON.stringify({ foo: "bar" })),
    });

    // Act
    const exit = await Effect.runPromiseExit(
      collectPayload(download as never)("my-bucket"),
    );

    // Assert
    expectTypedFailureMessage(exit, "script-generator/script.json");
  });

  it("should fail when the description JSON is not valid JSON", async () => {
    // Arrange
    const download = buildDownload({
      "metadata-generator/description.json": encode("not json"),
    });

    // Act
    const exit = await Effect.runPromiseExit(
      collectPayload(download as never)("my-bucket"),
    );

    // Assert
    expectTypedFailureMessage(exit, "metadata-generator/description.json");
  });
});
