import { Cause, Effect, type Exit, Option } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UploadPayload } from "../schema";
import { uploadToYouTube } from "./youtube";

// 失敗が型付き Fail であることまで確認する。exit._tag だけでは
// Effect.die（想定外の例外）も Failure として通ってしまう。
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

const buildPayload = (): UploadPayload => ({
  title: "今週の経済ニュース解説",
  description: "概要欄のテキスト",
  firstComment: "初コメントです",
  video: new Uint8Array([1, 2, 3]),
  thumbnail: new Uint8Array([4, 5, 6]),
});

const buildClient = (overrides?: {
  insert?: ReturnType<typeof vi.fn>;
  setThumbnail?: ReturnType<typeof vi.fn>;
  insertComment?: ReturnType<typeof vi.fn>;
}) => ({
  videos: {
    insert:
      overrides?.insert ??
      vi.fn().mockResolvedValue({ data: { id: "abc123" } }),
  },
  thumbnails: {
    set: overrides?.setThumbnail ?? vi.fn().mockResolvedValue({ data: {} }),
  },
  commentThreads: {
    insert: overrides?.insertComment ?? vi.fn().mockResolvedValue({ data: {} }),
  },
});

describe("uploadToYouTube", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should upload the video and return its id and url", async () => {
    // Arrange
    const client = buildClient();

    // Act
    const result = await Effect.runPromise(
      uploadToYouTube(client as never)(buildPayload(), "private"),
    );

    // Assert
    expect(result.videoId).toBe("abc123");
    expect(result.videoUrl).toBe("https://www.youtube.com/watch?v=abc123");
    expect(result.privacyStatus).toBe("private");
    expect(result.thumbnailSet).toBe(true);
    expect(result.commentPosted).toBe(true);
  });

  it("should send the title, description and privacy status to videos.insert", async () => {
    // Arrange
    const insert = vi.fn().mockResolvedValue({ data: { id: "abc123" } });
    const client = buildClient({ insert });

    // Act
    await Effect.runPromise(
      uploadToYouTube(client as never)(buildPayload(), "unlisted"),
    );

    // Assert
    const args = insert.mock.calls[0]?.[0] as {
      requestBody: {
        snippet: { title: string; description: string };
        status: { privacyStatus: string };
      };
    };
    expect(args.requestBody.snippet.title).toBe("今週の経済ニュース解説");
    expect(args.requestBody.snippet.description).toBe("概要欄のテキスト");
    expect(args.requestBody.status.privacyStatus).toBe("unlisted");
  });

  it("should set the thumbnail against the uploaded video id", async () => {
    // Arrange
    const setThumbnail = vi.fn().mockResolvedValue({ data: {} });
    const client = buildClient({ setThumbnail });

    // Act
    await Effect.runPromise(
      uploadToYouTube(client as never)(buildPayload(), "private"),
    );

    // Assert
    const args = setThumbnail.mock.calls[0]?.[0] as { videoId: string };
    expect(args.videoId).toBe("abc123");
  });

  it("should post the first comment against the uploaded video id", async () => {
    // Arrange
    const insertComment = vi.fn().mockResolvedValue({ data: {} });
    const client = buildClient({ insertComment });

    // Act
    await Effect.runPromise(
      uploadToYouTube(client as never)(buildPayload(), "private"),
    );

    // Assert
    const { requestBody: body } = insertComment.mock.calls[0]?.[0] as {
      requestBody: {
        snippet: {
          videoId: string;
          topLevelComment: { snippet: { textOriginal: string } };
        };
      };
    };
    expect(body.snippet.videoId).toBe("abc123");
    expect(body.snippet.topLevelComment.snippet.textOriginal).toBe(
      "初コメントです",
    );
  });

  it("should fail when videos.insert returns no id", async () => {
    // Arrange
    const insert = vi.fn().mockResolvedValue({ data: {} });
    const client = buildClient({ insert });

    // Act
    const exit = await Effect.runPromiseExit(
      uploadToYouTube(client as never)(buildPayload(), "private"),
    );

    // Assert
    expectTypedFailureMessage(exit, "no video id");
  });

  it("should fail when videos.insert rejects", async () => {
    // Arrange
    const insert = vi.fn().mockRejectedValue(new Error("quotaExceeded"));
    const client = buildClient({ insert });

    // Act
    const exit = await Effect.runPromiseExit(
      uploadToYouTube(client as never)(buildPayload(), "private"),
    );

    // Assert
    expectTypedFailureMessage(exit, "quotaExceeded");
  });

  it("should still return the video id when the thumbnail fails", async () => {
    // Arrange — 動画は上がっているので、サムネ失敗で全体を失敗にはしない。
    // やり直すと動画が二重に上がるうえ 1600 ユニットを再消費する。
    const setThumbnail = vi.fn().mockRejectedValue(new Error("forbidden"));
    const client = buildClient({ setThumbnail });

    // Act
    const result = await Effect.runPromise(
      uploadToYouTube(client as never)(buildPayload(), "private"),
    );

    // Assert
    expect(result.videoId).toBe("abc123");
    expect(result.thumbnailSet).toBe(false);
    expect(result.commentPosted).toBe(true);
  });

  it("should still return the video id when the comment fails", async () => {
    // Arrange
    const insertComment = vi.fn().mockRejectedValue(new Error("forbidden"));
    const client = buildClient({ insertComment });

    // Act
    const result = await Effect.runPromise(
      uploadToYouTube(client as never)(buildPayload(), "private"),
    );

    // Assert
    expect(result.videoId).toBe("abc123");
    expect(result.thumbnailSet).toBe(true);
    expect(result.commentPosted).toBe(false);
  });
});
