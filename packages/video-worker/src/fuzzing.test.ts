/**
 * Property-Based Testing and Fuzzing
 * Task 10.4: Verify robustness with random inputs
 *
 * Requirements:
 * - 2.6: Script validation robustness
 * - 8.3: Performance under extreme conditions
 * - Invariant testing with random data
 */

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { buildRenderConfig } from "./core/render-config";
import { parseScript } from "./core/script-parser";
import type { ParsedScript, Segment, Speaker } from "./core/script-types";

// Skip fuzzing tests unless explicitly enabled
const shouldRunFuzzing = process.env.RUN_FUZZING_TESTS === "true";
const describeFuzz = shouldRunFuzzing ? describe : describe.skip;

/**
 * Arbitraries for generating test data
 */
const speakerArbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  role: fc.constantFrom("agent" as const, "questioner" as const),
  avatarPath: fc.string({ minLength: 1, maxLength: 100 }),
});

describeFuzz("Task 10.4: Property-Based Testing", () => {
  describe("Script parsing invariants", () => {
    it("should always sort segments by startTime", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 600 }), // duration
          fc.array(speakerArbitrary, { minLength: 1, maxLength: 5 }),
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 20 }),
              speakerId: fc.string({ minLength: 1, maxLength: 20 }),
              text: fc.string({ minLength: 1, maxLength: 500 }),
              startTime: fc.integer({ min: 0, max: 600 }),
              endTime: fc.integer({ min: 1, max: 600 }),
            }),
            { minLength: 1, maxLength: 20 },
          ),
          (duration: number, speakers: Speaker[], segments: Segment[]) => {
            const speakerIds = speakers.map((s: Speaker) => s.id);

            // Filter segments to have valid timestamps and speaker IDs
            const validSegments = segments
              .filter(
                (seg: Segment) =>
                  seg.startTime < seg.endTime && seg.endTime <= duration,
              )
              .map((seg: Segment) => ({
                ...seg,
                speakerId: speakerIds[0] || "speaker1",
              }));

            if (validSegments.length === 0) {
              return; // Skip this test case
            }

            const script = JSON.stringify({
              metadata: {
                title: "Test",
                createdAt: new Date().toISOString(),
                durationSeconds: duration,
              },
              speakers,
              segments: validSegments,
            });

            const result = parseScript(script);

            if (result.isOk()) {
              const parsed = result.value;

              // Invariant: segments must be sorted by startTime
              for (let i = 0; i < parsed.segments.length - 1; i++) {
                expect(parsed.segments[i].startTime).toBeLessThanOrEqual(
                  parsed.segments[i + 1].startTime,
                );
              }
            }
          },
        ),
        { numRuns: 50 }, // Run 50 random test cases
      );
    });

    it("should reject overlapping timestamps", () => {
      fc.assert(
        fc.property(
          fc.array(speakerArbitrary, { minLength: 1, maxLength: 3 }),
          (speakers: Speaker[]) => {
            const speakerIds = speakers.map((s: Speaker) => s.id);

            // Create intentionally overlapping segments
            const segments = [
              {
                id: "seg1",
                speakerId: speakerIds[0],
                text: "First",
                startTime: 0,
                endTime: 10,
              },
              {
                id: "seg2",
                speakerId: speakerIds[0],
                text: "Second",
                startTime: 5, // Overlaps with seg1
                endTime: 15,
              },
            ];

            const script = JSON.stringify({
              metadata: {
                title: "Overlap Test",
                createdAt: new Date().toISOString(),
                durationSeconds: 20,
              },
              speakers,
              segments,
            });

            const result = parseScript(script);

            // Invariant: overlapping timestamps must be rejected
            expect(result.isErr()).toBe(true);
          },
        ),
        { numRuns: 20 },
      );
    });

    it("should reject invalid speaker references", () => {
      fc.assert(
        fc.property(
          fc.array(speakerArbitrary, { minLength: 1, maxLength: 3 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          (speakers, invalidSpeakerId) => {
            // Ensure invalidSpeakerId is not in speakers
            const validIds = speakers.map((s) => s.id);
            if (validIds.includes(invalidSpeakerId)) {
              return; // Skip this test case
            }

            const segments = [
              {
                id: "seg1",
                speakerId: invalidSpeakerId, // Invalid reference
                text: "Test",
                startTime: 0,
                endTime: 5,
              },
            ];

            const script = JSON.stringify({
              metadata: {
                title: "Invalid Ref Test",
                createdAt: new Date().toISOString(),
                durationSeconds: 10,
              },
              speakers,
              segments,
            });

            const result = parseScript(script);

            // Invariant: invalid speaker references must be rejected
            expect(result.isErr()).toBe(true);
          },
        ),
        { numRuns: 30 },
      );
    });
  });

  describe("Render config invariants", () => {
    it("should always calculate correct durationInFrames", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 3600 }), // 1 second to 1 hour
          (durationSeconds) => {
            const script: ParsedScript = {
              metadata: {
                title: "Test",
                createdAt: new Date().toISOString(),
                durationSeconds,
              },
              speakers: [
                {
                  id: "speaker1",
                  name: "Speaker",
                  role: "agent",
                  avatarPath: "avatar.png",
                },
              ],
              segments: [
                {
                  id: "seg1",
                  speakerId: "speaker1",
                  text: "Test",
                  startTime: 0,
                  endTime: durationSeconds,
                },
              ],
            };

            const result = buildRenderConfig(script, "/tmp/audio.wav");

            if (result.isOk()) {
              const config = result.value;

              // Invariant: durationInFrames = ceil(durationSeconds * fps)
              const expectedFrames = Math.ceil(durationSeconds * 30);
              expect(config.composition.durationInFrames).toBe(expectedFrames);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should always use correct video dimensions", () => {
      fc.assert(
        fc.property(fc.integer({ min: 10, max: 600 }), (durationSeconds) => {
          const script: ParsedScript = {
            metadata: {
              title: "Test",
              createdAt: new Date().toISOString(),
              durationSeconds,
            },
            speakers: [
              {
                id: "speaker1",
                name: "Speaker",
                role: "agent",
                avatarPath: "avatar.png",
              },
            ],
            segments: [
              {
                id: "seg1",
                speakerId: "speaker1",
                text: "Test",
                startTime: 0,
                endTime: durationSeconds,
              },
            ],
          };

          const result = buildRenderConfig(script, "/tmp/audio.wav");

          if (result.isOk()) {
            const config = result.value;

            // Invariant: Always 1920x1080 @ 30fps
            expect(config.composition.width).toBe(1920);
            expect(config.composition.height).toBe(1080);
            expect(config.composition.fps).toBe(30);
          }
        }),
        { numRuns: 50 },
      );
    });
  });

  describe("Extreme edge cases", () => {
    it("should handle extremely long script text", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10000, maxLength: 50000 }),
          (longText) => {
            const script = JSON.stringify({
              metadata: {
                title: "Long Text Test",
                createdAt: new Date().toISOString(),
                durationSeconds: 60,
              },
              speakers: [
                {
                  id: "speaker1",
                  name: "Speaker",
                  role: "agent",
                  avatarPath: "avatar.png",
                },
              ],
              segments: [
                {
                  id: "seg1",
                  speakerId: "speaker1",
                  text: longText,
                  startTime: 0,
                  endTime: 60,
                },
              ],
            });

            const result = parseScript(script);

            // Should either succeed or fail gracefully
            // (not throw unhandled error)
            if (result.isOk()) {
              expect(result.value.segments[0].text).toBe(longText);
            } else {
              expect(result.error.type).toBeDefined();
            }
          },
        ),
        { numRuns: 10 },
      );
    });

    it("should handle very short durations", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }), // Very short videos
          (durationSeconds) => {
            const script: ParsedScript = {
              metadata: {
                title: "Short Video",
                createdAt: new Date().toISOString(),
                durationSeconds,
              },
              speakers: [
                {
                  id: "speaker1",
                  name: "Speaker",
                  role: "agent",
                  avatarPath: "avatar.png",
                },
              ],
              segments: [
                {
                  id: "seg1",
                  speakerId: "speaker1",
                  text: "Quick",
                  startTime: 0,
                  endTime: durationSeconds,
                },
              ],
            };

            const result = buildRenderConfig(script, "/tmp/audio.wav");

            // Should handle short videos gracefully
            if (result.isOk()) {
              expect(result.value.composition.durationInFrames).toBeGreaterThan(
                0,
              );
            }
          },
        ),
        { numRuns: 20 },
      );
    });

    it("should handle maximum segment count", () => {
      const maxSegments = 5000;

      const speakers = [
        {
          id: "speaker1",
          name: "Speaker",
          role: "agent" as const,
          avatarPath: "avatar.png",
        },
      ];

      // Generate many short segments
      const segments = Array.from({ length: maxSegments }, (_, i) => ({
        id: `seg-${i}`,
        speakerId: "speaker1",
        text: `Segment ${i}`,
        startTime: i * 2,
        endTime: i * 2 + 1,
      }));

      const script = JSON.stringify({
        metadata: {
          title: "Max Segments Test",
          createdAt: new Date().toISOString(),
          durationSeconds: maxSegments * 2,
        },
        speakers,
        segments,
      });

      const result = parseScript(script);

      // Should either succeed or fail with validation error
      if (result.isOk()) {
        expect(result.value.segments.length).toBe(maxSegments);
      } else {
        expect(result.error.type).toBe("VALIDATION_ERROR");
      }
    });

    it("should reject zero or negative durations", () => {
      fc.assert(
        fc.property(fc.integer({ min: -100, max: 0 }), (invalidDuration) => {
          const script: ParsedScript = {
            metadata: {
              title: "Invalid Duration",
              createdAt: new Date().toISOString(),
              durationSeconds: invalidDuration,
            },
            speakers: [
              {
                id: "speaker1",
                name: "Speaker",
                role: "agent",
                avatarPath: "avatar.png",
              },
            ],
            segments: [],
          };

          const result = buildRenderConfig(script, "/tmp/audio.wav");

          // Invariant: zero or negative duration must be rejected
          expect(result.isErr()).toBe(true);
        }),
        { numRuns: 20 },
      );
    });
  });

  describe("Unicode and special characters", () => {
    it("should handle various unicode characters in text", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 100 }),
          (unicodeText: string) => {
            const script = JSON.stringify({
              metadata: {
                title: "Unicode Test",
                createdAt: new Date().toISOString(),
                durationSeconds: 10,
              },
              speakers: [
                {
                  id: "speaker1",
                  name: "Speaker",
                  role: "agent",
                  avatarPath: "avatar.png",
                },
              ],
              segments: [
                {
                  id: "seg1",
                  speakerId: "speaker1",
                  text: unicodeText,
                  startTime: 0,
                  endTime: 10,
                },
              ],
            });

            const result = parseScript(script);

            // Should handle unicode gracefully
            if (result.isOk()) {
              expect(result.value.segments[0].text).toBe(unicodeText);
            } else {
              // If it fails, should be a validation error, not a crash
              expect(result.error.type).toBeDefined();
            }
          },
        ),
        { numRuns: 30 },
      );
    });

    it("should handle emoji in speaker names and text", () => {
      const script = JSON.stringify({
        metadata: {
          title: "Emoji Test 🎥",
          createdAt: new Date().toISOString(),
          durationSeconds: 10,
        },
        speakers: [
          {
            id: "speaker1",
            name: "AI Agent 🤖",
            role: "agent",
            avatarPath: "avatar.png",
          },
        ],
        segments: [
          {
            id: "seg1",
            speakerId: "speaker1",
            text: "Hello! 👋 Welcome to the news 📰",
            startTime: 0,
            endTime: 5,
          },
        ],
      });

      const result = parseScript(script);

      // Should handle emoji correctly
      expect(result.isOk()).toBe(true);

      if (result.isOk()) {
        expect(result.value.metadata.title).toContain("🎥");
        expect(result.value.speakers[0].name).toContain("🤖");
        expect(result.value.segments[0].text).toContain("👋");
      }
    });
  });
});
