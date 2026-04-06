// Tests for the S3 storage layer (s3.ts).
//
// Design contract:
//   createStorageServiceLive(bucket, outputWavKey, outputScriptKey, envConfig?)
//     → Layer<StorageService>
//   extractDateFromKey(key): string

import { Effect, Result } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StorageService } from "../storage";

// ============================================
// Mock @aws-sdk/client-s3
// ============================================

const { mockS3Send } = vi.hoisted(() => ({
  mockS3Send: vi.fn(),
}));

vi.mock("@aws-sdk/client-s3", () => ({
  // biome-ignore lint/complexity/useArrowFunction: constructor mock requires `function` for `new`
  S3Client: vi.fn(function () {
    return { send: mockS3Send };
  }),
  // biome-ignore lint/complexity/useArrowFunction: constructor mock requires `function` for `new`
  GetObjectCommand: vi.fn(function (args: unknown) {
    return args;
  }),
  // biome-ignore lint/complexity/useArrowFunction: constructor mock requires `function` for `new`
  PutObjectCommand: vi.fn(function (args: unknown) {
    return args;
  }),
}));

import { createStorageServiceLive, extractDateFromKey } from "../s3";

// ============================================
// Test helpers
// ============================================

const buildValidScript = () => ({
  title: "今日のラジオ 2026年3月21日号",
  newsItems: [
    { id: "news-1", title: "ニュース1" },
    { id: "news-2", title: "ニュース2" },
    { id: "news-3", title: "ニュース3" },
  ],
  sections: [
    {
      type: "intro" as const,
      greeting: [{ speaker: "A", text: "こんにちは" }],
      newsOverview: [{ speaker: "A", text: "今日のニュース" }],
    },
    {
      type: "discussion" as const,
      newsId: "news-1",
      blocks: [
        { phase: "summary" as const, lines: [{ speaker: "A", text: "概要" }] },
        {
          phase: "background" as const,
          lines: [{ speaker: "B", text: "背景" }],
        },
        {
          phase: "deepDive" as const,
          lines: [{ speaker: "A", text: "深掘り" }],
        },
      ],
    },
    {
      type: "discussion" as const,
      newsId: "news-2",
      blocks: [
        { phase: "summary" as const, lines: [{ speaker: "A", text: "概要" }] },
        {
          phase: "background" as const,
          lines: [{ speaker: "B", text: "背景" }],
        },
        {
          phase: "deepDive" as const,
          lines: [{ speaker: "A", text: "深掘り" }],
        },
      ],
    },
    {
      type: "discussion" as const,
      newsId: "news-3",
      blocks: [
        { phase: "summary" as const, lines: [{ speaker: "A", text: "概要" }] },
        {
          phase: "background" as const,
          lines: [{ speaker: "B", text: "背景" }],
        },
        {
          phase: "deepDive" as const,
          lines: [{ speaker: "A", text: "深掘り" }],
        },
      ],
    },
    {
      type: "outro" as const,
      recap: [{ speaker: "A", text: "まとめ" }],
      closing: [{ speaker: "B", text: "さようなら" }],
    },
  ],
});

const runWithLayer = <A, E>(effect: Effect.Effect<A, E, StorageService>) =>
  Effect.runPromise(
    Effect.result(
      effect.pipe(
        Effect.provide(
          createStorageServiceLive(
            "my-bucket",
            "audio/output.wav",
            "script/output.json",
          ),
        ),
      ),
    ),
  );

// ============================================
// StorageService.getScript
// ============================================

describe("StorageService.getScript", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns parsed Script on success", async () => {
    const validScript = buildValidScript();
    mockS3Send.mockResolvedValueOnce({
      Body: {
        transformToString: vi
          .fn()
          .mockResolvedValue(JSON.stringify(validScript)),
      },
    });

    const result = await runWithLayer(
      Effect.gen(function* () {
        const storage = yield* StorageService;
        return yield* storage.getScript("scripts/2026-03-21.json");
      }),
    );

    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.success.title).toBe(validScript.title);
    }
  });

  it("fails with S3GetObjectError when S3 send rejects", async () => {
    mockS3Send.mockRejectedValueOnce(new Error("AccessDenied"));

    const result = await runWithLayer(
      Effect.gen(function* () {
        const storage = yield* StorageService;
        return yield* storage.getScript("scripts/2026-03-21.json");
      }),
    );

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("S3GetObjectError");
      expect(result.failure.message).toContain("AccessDenied");
    }
  });

  it("fails with S3GetObjectError when Body is undefined", async () => {
    mockS3Send.mockResolvedValueOnce({ Body: undefined });

    const result = await runWithLayer(
      Effect.gen(function* () {
        const storage = yield* StorageService;
        return yield* storage.getScript("scripts/2026-03-21.json");
      }),
    );

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("S3GetObjectError");
    }
  });

  it("fails with S3ValidationError when JSON is invalid", async () => {
    mockS3Send.mockResolvedValueOnce({
      Body: {
        transformToString: vi.fn().mockResolvedValue("not-json-{{{"),
      },
    });

    const result = await runWithLayer(
      Effect.gen(function* () {
        const storage = yield* StorageService;
        return yield* storage.getScript("scripts/2026-03-21.json");
      }),
    );

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("S3ValidationError");
    }
  });

  it("fails with S3ValidationError when JSON structure does not match Script schema", async () => {
    const invalidScript = { title: "ラジオ" }; // missing newsItems, sections
    mockS3Send.mockResolvedValueOnce({
      Body: {
        transformToString: vi
          .fn()
          .mockResolvedValue(JSON.stringify(invalidScript)),
      },
    });

    const result = await runWithLayer(
      Effect.gen(function* () {
        const storage = yield* StorageService;
        return yield* storage.getScript("scripts/2026-03-21.json");
      }),
    );

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("S3ValidationError");
    }
  });
});

// ============================================
// StorageService.uploadWav
// ============================================

describe("StorageService.uploadWav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("succeeds on successful upload", async () => {
    mockS3Send.mockResolvedValueOnce({});
    const wavData = new ArrayBuffer(1024);

    const result = await runWithLayer(
      Effect.gen(function* () {
        const storage = yield* StorageService;
        return yield* storage.uploadWav("audio/2026-03-21/ラジオ.wav", wavData);
      }),
    );

    expect(Result.isSuccess(result)).toBe(true);
  });

  it("fails with S3PutObjectError when S3 send rejects", async () => {
    mockS3Send.mockRejectedValueOnce(new Error("NoSuchBucket"));
    const wavData = new ArrayBuffer(1024);

    const result = await runWithLayer(
      Effect.gen(function* () {
        const storage = yield* StorageService;
        return yield* storage.uploadWav("audio/2026-03-21/ラジオ.wav", wavData);
      }),
    );

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("S3PutObjectError");
      expect(result.failure.message).toContain("NoSuchBucket");
    }
  });

  it("uploads with audio/wav Content-Type", async () => {
    mockS3Send.mockResolvedValueOnce({});
    const wavData = new ArrayBuffer(512);

    await runWithLayer(
      Effect.gen(function* () {
        const storage = yield* StorageService;
        return yield* storage.uploadWav("audio/2026-03-21/ラジオ.wav", wavData);
      }),
    );

    expect(mockS3Send).toHaveBeenCalledWith(
      expect.objectContaining({ ContentType: "audio/wav" }),
    );
  });
});

// ============================================
// StorageService.buildOutputKey
// ============================================

describe("StorageService.buildOutputKey", () => {
  it("always returns the fixed outputWavKey regardless of date/title", async () => {
    const layer = createStorageServiceLive(
      "video-factory",
      "custom/audio.wav",
      "tts-worker/script.json",
    );

    const key = await Effect.runPromise(
      Effect.gen(function* () {
        const storage = yield* StorageService;
        return storage.buildOutputKey("2026-03-24", "タイトル");
      }).pipe(Effect.provide(layer)),
    );

    expect(key).toBe("custom/audio.wav");
  });

  it("returns the fixed key for any date and title", async () => {
    const layer = createStorageServiceLive(
      "video-factory",
      "custom/audio.wav",
      "tts-worker/script.json",
    );

    const results = await Effect.runPromise(
      Effect.gen(function* () {
        const storage = yield* StorageService;
        return [
          storage.buildOutputKey("", ""),
          storage.buildOutputKey("any-date", "any-title"),
        ];
      }).pipe(Effect.provide(layer)),
    );

    expect(results[0]).toBe("custom/audio.wav");
    expect(results[1]).toBe("custom/audio.wav");
  });
});

// ============================================
// extractDateFromKey — pure function
// ============================================

describe("extractDateFromKey", () => {
  it("extracts the date from a standard script key", () => {
    expect(extractDateFromKey("scripts/2026-03-21.json")).toBe("2026-03-21");
  });

  it("extracts filename without extension when there is no path separator", () => {
    expect(extractDateFromKey("script.json")).toBe("script");
  });

  it("extracts only the last segment when there are multiple path components", () => {
    expect(extractDateFromKey("a/b/c/2025-12-31.json")).toBe("2025-12-31");
  });

  it("handles keys without .json extension (returns filename as-is)", () => {
    expect(extractDateFromKey("scripts/2026-03-21")).toBe("2026-03-21");
  });
});
