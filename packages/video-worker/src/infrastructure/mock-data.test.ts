import { Effect, Result } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FileSystemError } from "../core/errors";
import * as fs from "./file-system";
import { loadMockAudio, loadMockScript } from "./mock-data";

vi.mock("./file-system");

const run = <A>(effect: Effect.Effect<A, FileSystemError>) =>
  Effect.runPromise(Effect.result(effect));

describe("loadMockScript()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load mock script from mock-data/script.json", async () => {
    const mockContent = Buffer.from(
      JSON.stringify({
        metadata: {
          title: "Test",
          createdAt: "2026-02-09T00:00:00Z",
          durationSeconds: 10,
        },
        speakers: [
          {
            id: "s1",
            name: "Speaker 1",
            role: "agent",
            avatarPath: "avatar1.png",
          },
        ],
        segments: [
          {
            id: "seg1",
            speakerId: "s1",
            text: "Hello",
            startTime: 0,
            endTime: 2,
          },
        ],
      }),
    );

    vi.mocked(fs.readFile).mockReturnValue(Effect.succeed(mockContent));

    const result = await run(loadMockScript());

    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.success).toContain("Test");
    }
    expect(fs.readFile).toHaveBeenCalledWith("mock-data/script.json");
  });

  it("should return FileSystemError when mock file is not found", async () => {
    const error = new FileSystemError({ message: "File not found" });

    vi.mocked(fs.readFile).mockReturnValue(Effect.fail(error));

    const result = await run(loadMockScript());

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("FileSystemError");
    }
  });
});

describe("loadMockAudio()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load mock audio from mock-data/audio.wav", async () => {
    const mockAudioBuffer = Buffer.from([0x52, 0x49, 0x46, 0x46]);

    vi.mocked(fs.readFile).mockReturnValue(Effect.succeed(mockAudioBuffer));

    const result = await run(loadMockAudio());

    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.success).toBeInstanceOf(Buffer);
    }
    expect(fs.readFile).toHaveBeenCalledWith("mock-data/audio.wav");
  });

  it("should return FileSystemError when mock audio file is not found", async () => {
    const error = new FileSystemError({ message: "File not found" });

    vi.mocked(fs.readFile).mockReturnValue(Effect.fail(error));

    const result = await run(loadMockAudio());

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("FileSystemError");
    }
  });
});
