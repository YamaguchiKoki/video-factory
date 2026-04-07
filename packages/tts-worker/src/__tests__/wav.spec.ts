// Tests for WAV binary utilities (wav.ts).
//
// Design contract:
//   parseWavHeader(buffer): Effect<WavHeader, WavError>
//   getWavDurationSec(buffer): Effect<number, WavError>
//   concatenateWavs(buffers): Effect<ArrayBuffer, WavError>

import { it as itProp } from "@fast-check/vitest";
import { Effect, Result } from "effect";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { WavError } from "../errors";
import { concatenateWavs, getWavDurationSec, parseWavHeader } from "../wav";

// ============================================
// Test helper: builds a minimal valid WAV ArrayBuffer
// ============================================

const buildWavBuffer = (
  sampleRate: number,
  numChannels: number,
  bitsPerSample: number,
  durationSec: number,
): ArrayBuffer => {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const dataSize = Math.floor(byteRate * durationSec);
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  view.setUint8(0, 0x52); // "RIFF"
  view.setUint8(1, 0x49);
  view.setUint8(2, 0x46);
  view.setUint8(3, 0x46);
  view.setUint32(4, 36 + dataSize, true);
  view.setUint8(8, 0x57); // "WAVE"
  view.setUint8(9, 0x41);
  view.setUint8(10, 0x56);
  view.setUint8(11, 0x45);
  view.setUint8(12, 0x66); // "fmt "
  view.setUint8(13, 0x6d);
  view.setUint8(14, 0x74);
  view.setUint8(15, 0x20);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, numChannels * (bitsPerSample / 8), true);
  view.setUint16(34, bitsPerSample, true);
  view.setUint8(36, 0x64); // "data"
  view.setUint8(37, 0x61);
  view.setUint8(38, 0x74);
  view.setUint8(39, 0x61);
  view.setUint32(40, dataSize, true);

  return buffer;
};

const run = <A>(effect: Effect.Effect<A, WavError>) =>
  Effect.runPromise(Effect.result(effect));

// ============================================
// parseWavHeader
// ============================================

describe("parseWavHeader", () => {
  it("returns Success with parsed header for a valid WAV buffer", async () => {
    const buffer = buildWavBuffer(44100, 1, 16, 1.0);
    const result = await run(parseWavHeader(buffer));
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.success.sampleRate).toBe(44100);
      expect(result.success.numChannels).toBe(1);
      expect(result.success.bitsPerSample).toBe(16);
    }
  });

  it("returns Success with correct dataSize for known WAV", async () => {
    const buffer = buildWavBuffer(44100, 1, 16, 1.0);
    const result = await run(parseWavHeader(buffer));
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.success.dataSize).toBe(88200);
    }
  });

  it("returns Success with dataOffset pointing just after data chunk size field", async () => {
    const buffer = buildWavBuffer(44100, 1, 16, 0.5);
    const result = await run(parseWavHeader(buffer));
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.success.dataOffset).toBe(44);
    }
  });

  it("returns Failure with InvalidHeaderError when buffer does not start with RIFF", async () => {
    const buffer = new ArrayBuffer(44);
    new DataView(buffer).setUint8(0, 0x58);
    const result = await run(parseWavHeader(buffer));
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("InvalidHeaderError");
    }
  });

  it("returns Failure with InvalidHeaderError when WAVE marker is missing", async () => {
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);
    view.setUint8(0, 0x52);
    view.setUint8(1, 0x49);
    view.setUint8(2, 0x46);
    view.setUint8(3, 0x46);
    view.setUint8(8, 0x41);
    view.setUint8(9, 0x49);
    view.setUint8(10, 0x46);
    view.setUint8(11, 0x46);
    const result = await run(parseWavHeader(buffer));
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("InvalidHeaderError");
    }
  });

  it("returns Failure with InvalidHeaderError when buffer is too small", async () => {
    const buffer = new ArrayBuffer(10);
    const result = await run(parseWavHeader(buffer));
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("InvalidHeaderError");
    }
  });
});

// ============================================
// getWavDurationSec
// ============================================

describe("getWavDurationSec", () => {
  it("returns 1.0 second for 44100 Hz mono 16-bit 1-second WAV", async () => {
    const buffer = buildWavBuffer(44100, 1, 16, 1.0);
    const result = await run(getWavDurationSec(buffer));
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.success).toBeCloseTo(1.0, 5);
    }
  });

  it("returns 0.5 second for half-second WAV", async () => {
    const buffer = buildWavBuffer(44100, 1, 16, 0.5);
    const result = await run(getWavDurationSec(buffer));
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.success).toBeCloseTo(0.5, 5);
    }
  });

  it("returns correct duration for stereo 48000 Hz 24-bit audio", async () => {
    const buffer = buildWavBuffer(48000, 2, 24, 2.0);
    const result = await run(getWavDurationSec(buffer));
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.success).toBeCloseTo(2.0, 5);
    }
  });

  it("returns Failure for invalid WAV buffer", async () => {
    const buffer = new ArrayBuffer(10);
    const result = await run(getWavDurationSec(buffer));
    expect(Result.isFailure(result)).toBe(true);
  });
});

// ============================================
// getWavDurationSec — property-based test
// ============================================

describe("getWavDurationSec property", () => {
  itProp.prop([
    fc.integer({ min: 8000, max: 96000 }),
    fc.constantFrom(1, 2),
    fc.constantFrom(8, 16, 24),
    fc.float({ min: Math.fround(0.1), max: Math.fround(5.0), noNaN: true }),
  ])(
    "duration = dataSize / byteRate for any valid WAV parameters",
    async (
      sampleRate: number,
      numChannels: number,
      bitsPerSample: number,
      durationSec: number,
    ) => {
      const buffer = buildWavBuffer(
        sampleRate,
        numChannels,
        bitsPerSample,
        durationSec,
      );
      const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
      const dataSize = Math.floor(byteRate * durationSec);
      const expectedDuration = dataSize / byteRate;

      const result = await run(getWavDurationSec(buffer));
      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        expect(result.success).toBeCloseTo(expectedDuration, 5);
      }
    },
  );
});

// ============================================
// concatenateWavs
// ============================================

describe("concatenateWavs", () => {
  it("returns Failure with EmptyInputError when given an empty array", async () => {
    const result = await run(concatenateWavs([]));
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("EmptyInputError");
    }
  });

  it("returns Success for a single WAV buffer", async () => {
    const buffer = buildWavBuffer(44100, 1, 16, 1.0);
    const result = await run(concatenateWavs([buffer]));
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.success).toBeInstanceOf(ArrayBuffer);
    }
  });

  it("returns Success ArrayBuffer whose data size equals the sum of input data sizes", async () => {
    const bufA = buildWavBuffer(44100, 1, 16, 0.5);
    const bufB = buildWavBuffer(44100, 1, 16, 0.5);
    const expectedDataSize = Math.floor(44100 * 1 * 2 * 0.5) * 2;
    const result = await run(concatenateWavs([bufA, bufB]));
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      const durationResult = await run(getWavDurationSec(result.success));
      expect(Result.isSuccess(durationResult)).toBe(true);
      if (Result.isSuccess(durationResult)) {
        const byteRate = 44100 * 1 * 2;
        expect(durationResult.success).toBeCloseTo(
          expectedDataSize / byteRate,
          5,
        );
      }
    }
  });

  it("returns Failure with FormatMismatchError when sample rates differ", async () => {
    const bufA = buildWavBuffer(44100, 1, 16, 0.5);
    const bufB = buildWavBuffer(48000, 1, 16, 0.5);
    const result = await run(concatenateWavs([bufA, bufB]));
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("FormatMismatchError");
    }
  });

  it("returns Failure with FormatMismatchError when channel counts differ", async () => {
    const bufA = buildWavBuffer(44100, 1, 16, 0.5);
    const bufB = buildWavBuffer(44100, 2, 16, 0.5);
    const result = await run(concatenateWavs([bufA, bufB]));
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("FormatMismatchError");
    }
  });

  it("returns Failure with FormatMismatchError when bits per sample differ", async () => {
    const bufA = buildWavBuffer(44100, 1, 16, 0.5);
    const bufB = buildWavBuffer(44100, 1, 24, 0.5);
    const result = await run(concatenateWavs([bufA, bufB]));
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("FormatMismatchError");
    }
  });

  it("produces a valid WAV header in the concatenated output", async () => {
    const bufA = buildWavBuffer(44100, 1, 16, 0.3);
    const bufB = buildWavBuffer(44100, 1, 16, 0.7);
    const result = await run(concatenateWavs([bufA, bufB]));
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      const parseResult = await run(parseWavHeader(result.success));
      expect(Result.isSuccess(parseResult)).toBe(true);
      if (Result.isSuccess(parseResult)) {
        expect(parseResult.success.sampleRate).toBe(44100);
        expect(parseResult.success.numChannels).toBe(1);
        expect(parseResult.success.bitsPerSample).toBe(16);
      }
    }
  });

  it("concatenates three WAV buffers without error", async () => {
    const bufA = buildWavBuffer(44100, 1, 16, 0.5);
    const bufB = buildWavBuffer(44100, 1, 16, 0.5);
    const bufC = buildWavBuffer(44100, 1, 16, 0.5);
    const result = await run(concatenateWavs([bufA, bufB, bufC]));
    expect(Result.isSuccess(result)).toBe(true);
  });
});
