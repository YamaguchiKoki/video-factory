/**
 * Tests for video-worker S3 infrastructure (s3.ts).
 * Written TDD-first — s3.ts does not exist yet.
 *
 * Design contract:
 *   createS3ClientConfig(): S3ClientConfig
 *     S3_ENDPOINT_URL unset → {}
 *     S3_ENDPOINT_URL set   → { endpoint: url, forcePathStyle: true }
 *
 *   createS3Client(): S3Client
 *     — wraps S3Client constructor with createS3ClientConfig()
 *
 *   downloadToFile(client, bucket, key, localPath): ResultAsync<void, S3Error>
 *     — sends GetObjectCommand with correct Bucket/Key
 *     — writes response body to localPath
 *     — Err when S3 rejects
 *     — Err when Body is undefined
 *
 *   uploadFromFile(client, bucket, key, localPath, contentType): ResultAsync<void, S3Error>
 *     — reads file at localPath and sends PutObjectCommand
 *     — PutObjectCommand includes correct Bucket, Key, ContentType
 *     — Ok(void) on success
 *     — Err when S3 rejects
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  rm,
  writeFile as fsWriteFile,
} from "node:fs/promises";

// ============================================
// Mock @aws-sdk/client-s3
// ============================================

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(function () {
    return { send: mockSend };
  }),
  GetObjectCommand: vi.fn(function (args: unknown) {
    return args;
  }),
  PutObjectCommand: vi.fn(function (args: unknown) {
    return args;
  }),
}));

import {
  createS3ClientConfig,
  downloadToFile,
  uploadFromFile,
} from "./s3";

// ============================================
// createS3ClientConfig
// ============================================

describe("createS3ClientConfig", () => {
  afterEach(() => {
    delete process.env["S3_ENDPOINT_URL"];
  });

  it("returns empty object when S3_ENDPOINT_URL is not set", () => {
    // Given
    delete process.env["S3_ENDPOINT_URL"];

    // When
    const config = createS3ClientConfig();

    // Then
    expect(config).toEqual({});
  });

  it("returns endpoint and forcePathStyle:true when S3_ENDPOINT_URL is set", () => {
    // Given
    process.env["S3_ENDPOINT_URL"] = "http://rustfs:9000";

    // When
    const config = createS3ClientConfig();

    // Then
    expect(config).toEqual({
      endpoint: "http://rustfs:9000",
      region: "ap-northeast-1",
      forcePathStyle: true,
    });
  });

  it("preserves the full URL without modification", () => {
    // Given
    const url = "http://localhost:9000";
    process.env["S3_ENDPOINT_URL"] = url;

    // When
    const config = createS3ClientConfig();

    // Then
    expect(config).toMatchObject({ endpoint: url });
  });
});

// ============================================
// downloadToFile
// ============================================

describe("downloadToFile", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `video-worker-s3-test-${randomUUID()}`);
    await mkdir(testDir, { recursive: true });
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("sends GetObjectCommand with the correct Bucket and Key", async () => {
    // Given
    const bodyBytes = new Uint8Array([1, 2, 3]);
    mockSend.mockResolvedValueOnce({
      Body: { transformToByteArray: vi.fn().mockResolvedValue(bodyBytes) },
    });
    const localPath = join(testDir, "output.json");

    // When
    await downloadToFile(
      { send: mockSend } as never,
      "video-factory",
      "tts-worker/script.json",
      localPath,
    );

    // Then
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: "video-factory",
        Key: "tts-worker/script.json",
      }),
    );
  });

  it("writes the response body bytes to the local file", async () => {
    // Given
    const content = Buffer.from("hello enriched script");
    const bodyBytes = new Uint8Array(content);
    mockSend.mockResolvedValueOnce({
      Body: {
        transformToByteArray: vi.fn().mockResolvedValue(bodyBytes),
      },
    });
    const localPath = join(testDir, "script.json");

    // When
    const result = await downloadToFile(
      { send: mockSend } as never,
      "video-factory",
      "tts-worker/script.json",
      localPath,
    );

    // Then
    expect(result.isOk()).toBe(true);
    const written = await readFile(localPath);
    expect(written).toEqual(content);
  });

  it("returns Err when S3 send rejects", async () => {
    // Given
    mockSend.mockRejectedValueOnce(new Error("NoSuchKey"));
    const localPath = join(testDir, "output.bin");

    // When
    const result = await downloadToFile(
      { send: mockSend } as never,
      "video-factory",
      "missing/key",
      localPath,
    );

    // Then
    expect(result.isErr()).toBe(true);
  });

  it("returns Err when response Body is undefined", async () => {
    // Given
    mockSend.mockResolvedValueOnce({ Body: undefined });
    const localPath = join(testDir, "output.bin");

    // When
    const result = await downloadToFile(
      { send: mockSend } as never,
      "video-factory",
      "tts-worker/audio.wav",
      localPath,
    );

    // Then
    expect(result.isErr()).toBe(true);
  });
});

// ============================================
// uploadFromFile
// ============================================

describe("uploadFromFile", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `video-worker-s3-test-${randomUUID()}`);
    await mkdir(testDir, { recursive: true });
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("sends PutObjectCommand with the correct Bucket, Key, and ContentType", async () => {
    // Given
    mockSend.mockResolvedValueOnce({});
    const localPath = join(testDir, "video.mp4");
    await fsWriteFile(localPath, Buffer.from("mock video data"));

    // When
    await uploadFromFile(
      { send: mockSend } as never,
      "video-factory",
      "video-worker/video.mp4",
      localPath,
      "video/mp4",
    );

    // Then
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: "video-factory",
        Key: "video-worker/video.mp4",
        ContentType: "video/mp4",
      }),
    );
  });

  it("includes the file content as the request Body", async () => {
    // Given
    const fileContent = Buffer.from("video content bytes");
    mockSend.mockResolvedValueOnce({});
    const localPath = join(testDir, "video.mp4");
    await fsWriteFile(localPath, fileContent);

    // When
    await uploadFromFile(
      { send: mockSend } as never,
      "video-factory",
      "video-worker/video.mp4",
      localPath,
      "video/mp4",
    );

    // Then
    const callArgs = mockSend.mock.calls[0]?.[0] as {
      Body: Buffer;
      [key: string]: unknown;
    };
    expect(callArgs.Body).toEqual(fileContent);
  });

  it("returns Ok void on successful upload", async () => {
    // Given
    mockSend.mockResolvedValueOnce({});
    const localPath = join(testDir, "video.mp4");
    await fsWriteFile(localPath, Buffer.from("data"));

    // When
    const result = await uploadFromFile(
      { send: mockSend } as never,
      "video-factory",
      "video-worker/video.mp4",
      localPath,
      "video/mp4",
    );

    // Then
    expect(result.isOk()).toBe(true);
  });

  it("returns Err when S3 send rejects", async () => {
    // Given
    mockSend.mockRejectedValueOnce(new Error("AccessDenied"));
    const localPath = join(testDir, "video.mp4");
    await fsWriteFile(localPath, Buffer.from("data"));

    // When
    const result = await uploadFromFile(
      { send: mockSend } as never,
      "video-factory",
      "video-worker/video.mp4",
      localPath,
      "video/mp4",
    );

    // Then
    expect(result.isErr()).toBe(true);
  });

  it("returns Err when the local file does not exist", async () => {
    // Given
    mockSend.mockResolvedValueOnce({});
    const nonExistentPath = join(testDir, "does-not-exist.mp4");

    // When
    const result = await uploadFromFile(
      { send: mockSend } as never,
      "video-factory",
      "video-worker/video.mp4",
      nonExistentPath,
      "video/mp4",
    );

    // Then
    expect(result.isErr()).toBe(true);
  });
});
