/**
 * Unit tests for buildRenderConfig function
 * Tests the creation of Remotion rendering configuration from parsed script data
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { buildRenderConfig } from "./render-config";
import type { ParsedScript } from "./script-types";

describe("buildRenderConfig", () => {
  // Valid test data
  const validScript: ParsedScript = {
    metadata: {
      title: "Test Video",
      createdAt: "2026-02-09T09:00:00.000Z",
      durationSeconds: 60,
    },
    speakers: [
      {
        id: "agent",
        name: "AI Agent",
        role: "agent",
        avatarPath: "assets/agent.png",
      },
      {
        id: "man",
        name: "Test Man",
        role: "questioner",
        avatarPath: "assets/man.png",
      },
    ],
    segments: [
      {
        id: "seg-001",
        speakerId: "man",
        text: "Hello",
        startTime: 0,
        endTime: 3,
      },
      {
        id: "seg-002",
        speakerId: "agent",
        text: "Hi there",
        startTime: 3,
        endTime: 6,
      },
    ],
  };

  const audioPath = "/path/to/audio.wav";

  describe("正常系: 有効なスクリプトからの正しいRenderConfig生成", () => {
    it("should generate correct composition settings", () => {
      const result = buildRenderConfig(validScript, audioPath);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const config = result.value;
        expect(config.composition.id).toBe("RadioVideo");
        expect(config.composition.width).toBe(1920);
        expect(config.composition.height).toBe(1080);
        expect(config.composition.fps).toBe(30);
      }
    });

    it("should calculate durationInFrames correctly (fps * durationSeconds)", () => {
      const result = buildRenderConfig(validScript, audioPath);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const config = result.value;
        const expectedFrames = Math.ceil(60 * 30); // durationSeconds * fps
        expect(config.composition.durationInFrames).toBe(expectedFrames);
      }
    });

    it("should set codec and encoding settings correctly", () => {
      const result = buildRenderConfig(validScript, audioPath);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const config = result.value;
        expect(config.codec).toBe("h264");
        expect(config.crf).toBe(23);
        expect(config.imageFormat).toBe("jpeg");
      }
    });

    it("should set timeout and concurrency settings correctly", () => {
      const result = buildRenderConfig(validScript, audioPath);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const config = result.value;
        expect(config.timeoutInMilliseconds).toBe(900000); // 15 minutes
        expect(config.concurrency).toBe(2);
        expect(config.enableMultiProcessOnLinux).toBe(true);
      }
    });

    it("should include inputProps with audioPath, segments, and speakers", () => {
      const result = buildRenderConfig(validScript, audioPath);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const config = result.value;
        expect(config.inputProps.audioPath).toBe(audioPath);
        expect(config.inputProps.segments).toEqual(validScript.segments);
        expect(config.inputProps.speakers).toEqual(validScript.speakers);
      }
    });
  });

  describe("異常系: durationSecondsが0以下の場合のエラーハンドリング", () => {
    it("should return error when durationSeconds is 0", () => {
      const invalidScript: ParsedScript = {
        ...validScript,
        metadata: {
          ...validScript.metadata,
          durationSeconds: 0,
        },
      };

      const result = buildRenderConfig(invalidScript, audioPath);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        const error = result.error;
        expect(error.type).toBe("SCHEMA_VALIDATION_ERROR");
        expect(error.message).toContain("durationSeconds");
        expect(error.message).toContain("positive");
      }
    });

    it("should return error when durationSeconds is negative", () => {
      const invalidScript: ParsedScript = {
        ...validScript,
        metadata: {
          ...validScript.metadata,
          durationSeconds: -10,
        },
      };

      const result = buildRenderConfig(invalidScript, audioPath);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        const error = result.error;
        expect(error.type).toBe("SCHEMA_VALIDATION_ERROR");
        expect(error.message).toContain("durationSeconds");
      }
    });
  });

  describe("Property-based testing: ランダムなdurationSecondsで計算式の不変条件検証", () => {
    it("should always calculate durationInFrames as Math.ceil(durationSeconds * fps)", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 3600 }), // 1秒〜1時間の範囲
          (durationSeconds) => {
            const testScript: ParsedScript = {
              ...validScript,
              metadata: {
                ...validScript.metadata,
                durationSeconds,
              },
            };

            const result = buildRenderConfig(testScript, audioPath);

            if (result.isOk()) {
              const expectedFrames = Math.ceil(durationSeconds * 30);
              expect(result.value.composition.durationInFrames).toBe(
                expectedFrames,
              );
            }
          },
        ),
      );
    });

    it("should maintain invariant: durationInFrames > 0 for all valid durationSeconds", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 3600 }),
          (durationSeconds) => {
            const testScript: ParsedScript = {
              ...validScript,
              metadata: {
                ...validScript.metadata,
                durationSeconds,
              },
            };

            const result = buildRenderConfig(testScript, audioPath);

            if (result.isOk()) {
              expect(result.value.composition.durationInFrames).toBeGreaterThan(
                0,
              );
            }
          },
        ),
      );
    });
  });

  describe("極端に長い動画（60分以上）の検証", () => {
    it("should handle very long videos (60 minutes)", () => {
      const longScript: ParsedScript = {
        ...validScript,
        metadata: {
          ...validScript.metadata,
          durationSeconds: 3600, // 60 minutes
        },
      };

      const result = buildRenderConfig(longScript, audioPath);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const config = result.value;
        const expectedFrames = Math.ceil(3600 * 30);
        expect(config.composition.durationInFrames).toBe(expectedFrames);
      }
    });

    it("should handle extremely long videos (2 hours)", () => {
      const veryLongScript: ParsedScript = {
        ...validScript,
        metadata: {
          ...validScript.metadata,
          durationSeconds: 7200, // 120 minutes
        },
      };

      const result = buildRenderConfig(veryLongScript, audioPath);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const config = result.value;
        const expectedFrames = Math.ceil(7200 * 30);
        expect(config.composition.durationInFrames).toBe(expectedFrames);
      }
    });
  });

  describe("Edge cases: 境界値テスト", () => {
    it("should handle minimum valid duration (1 second)", () => {
      const minScript: ParsedScript = {
        ...validScript,
        metadata: {
          ...validScript.metadata,
          durationSeconds: 1,
        },
      };

      const result = buildRenderConfig(minScript, audioPath);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.composition.durationInFrames).toBe(30);
      }
    });

    it("should handle fractional seconds correctly with Math.ceil", () => {
      const fractionalScript: ParsedScript = {
        ...validScript,
        metadata: {
          ...validScript.metadata,
          durationSeconds: 1.5,
        },
      };

      const result = buildRenderConfig(fractionalScript, audioPath);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        // Math.ceil(1.5 * 30) = Math.ceil(45) = 45
        expect(result.value.composition.durationInFrames).toBe(45);
      }
    });
  });
});
