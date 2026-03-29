/**
 * Mock data loader tests
 * Tests for loading mock script and audio files
 */

import { errAsync, okAsync } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFileSystemError } from "../core/errors";
import * as fs from "./file-system";
import { loadMockAudio, loadMockScript } from "./mock-data";

vi.mock("./file-system");

describe("loadMockScript()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load mock script from mock-data/script.json", async () => {
    // Mock readFile to return sample script content
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

    vi.mocked(fs.readFile).mockReturnValue(okAsync(mockContent));

    const result = await loadMockScript();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toContain("Test");
    }
    expect(fs.readFile).toHaveBeenCalledWith("mock-data/script.json");
  });

  it("should return FileSystemError when mock file is not found", async () => {
    const error = createFileSystemError("IO_ERROR", "File not found", null, {
      path: "mock-data/script.json",
    });

    vi.mocked(fs.readFile).mockReturnValue(errAsync(error));

    const result = await loadMockScript();

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("IO_ERROR");
    }
  });
});

describe("loadMockAudio()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load mock audio from mock-data/audio.wav", async () => {
    const mockAudioBuffer = Buffer.from([0x52, 0x49, 0x46, 0x46]); // "RIFF" header

    vi.mocked(fs.readFile).mockReturnValue(okAsync(mockAudioBuffer));

    const result = await loadMockAudio();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBeInstanceOf(Buffer);
    }
    expect(fs.readFile).toHaveBeenCalledWith("mock-data/audio.wav");
  });

  it("should return FileSystemError when mock audio file is not found", async () => {
    const error = createFileSystemError("IO_ERROR", "File not found", null, {
      path: "mock-data/audio.wav",
    });

    vi.mocked(fs.readFile).mockReturnValue(errAsync(error));

    const result = await loadMockAudio();

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("IO_ERROR");
    }
  });
});
