// Tests for WAV binary utilities (wav.ts).
// This module does not exist yet; tests are written TDD-first.
//
// Design contract:
//   parseWavHeader(buffer): Result<WavHeader, WavError>
//   getWavDurationSec(buffer): Result<number, WavError>
//   concatenateWavs(buffers): Result<ArrayBuffer, WavError>
//   WavError = { type: "INVALID_HEADER" | "FORMAT_MISMATCH" | "EMPTY_INPUT"; message: string }

import { it as itProp } from "@fast-check/vitest";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { concatenateWavs, getWavDurationSec, parseWavHeader } from "../wav";

// ============================================
// Test helper: builds a minimal valid WAV ArrayBuffer
// Standard PCM WAV format (44-byte header + PCM data)
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

  // "RIFF"
  view.setUint8(0, 0x52);
  view.setUint8(1, 0x49);
  view.setUint8(2, 0x46);
  view.setUint8(3, 0x46);
  view.setUint32(4, 36 + dataSize, true); // ChunkSize
  // "WAVE"
  view.setUint8(8, 0x57);
  view.setUint8(9, 0x41);
  view.setUint8(10, 0x56);
  view.setUint8(11, 0x45);
  // "fmt "
  view.setUint8(12, 0x66);
  view.setUint8(13, 0x6d);
  view.setUint8(14, 0x74);
  view.setUint8(15, 0x20);
  view.setUint32(16, 16, true); // Subchunk1Size = 16 for PCM
  view.setUint16(20, 1, true); // AudioFormat = 1 (PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, numChannels * (bitsPerSample / 8), true); // BlockAlign
  view.setUint16(34, bitsPerSample, true);
  // "data"
  view.setUint8(36, 0x64);
  view.setUint8(37, 0x61);
  view.setUint8(38, 0x74);
  view.setUint8(39, 0x61);
  view.setUint32(40, dataSize, true);
  // PCM data bytes remain zeroed

  return buffer;
};

// ============================================
// parseWavHeader
// ============================================

describe("parseWavHeader", () => {
  it("returns Ok with parsed header for a valid WAV buffer", () => {
    // Arrange
    const buffer = buildWavBuffer(44100, 1, 16, 1.0);

    // Act
    const result = parseWavHeader(buffer);

    // Assert
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.sampleRate).toBe(44100);
      expect(result.value.numChannels).toBe(1);
      expect(result.value.bitsPerSample).toBe(16);
    }
  });

  it("returns Ok with correct dataSize for known WAV", () => {
    // Arrange — 44100 Hz, mono, 16-bit, 1.0 s → dataSize = 88200
    const buffer = buildWavBuffer(44100, 1, 16, 1.0);

    // Act
    const result = parseWavHeader(buffer);

    // Assert
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.dataSize).toBe(88200);
    }
  });

  it("returns Ok with dataOffset pointing just after 'data' chunk size field", () => {
    // Arrange — standard 44-byte header: dataOffset = 44
    const buffer = buildWavBuffer(44100, 1, 16, 0.5);

    // Act
    const result = parseWavHeader(buffer);

    // Assert
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.dataOffset).toBe(44);
    }
  });

  it("returns Err INVALID_HEADER when buffer does not start with RIFF", () => {
    // Arrange
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);
    view.setUint8(0, 0x58); // "X" instead of "R"

    // Act
    const result = parseWavHeader(buffer);

    // Assert
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("INVALID_HEADER");
    }
  });

  it("returns Err INVALID_HEADER when WAVE marker is missing", () => {
    // Arrange — valid RIFF header but wrong format
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);
    // "RIFF"
    view.setUint8(0, 0x52);
    view.setUint8(1, 0x49);
    view.setUint8(2, 0x46);
    view.setUint8(3, 0x46);
    // Wrong format marker: "AIFF" instead of "WAVE"
    view.setUint8(8, 0x41);
    view.setUint8(9, 0x49);
    view.setUint8(10, 0x46);
    view.setUint8(11, 0x46);

    // Act
    const result = parseWavHeader(buffer);

    // Assert
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("INVALID_HEADER");
    }
  });

  it("returns Err INVALID_HEADER when buffer is too small", () => {
    // Arrange — 10 bytes is not enough for a WAV header
    const buffer = new ArrayBuffer(10);

    // Act
    const result = parseWavHeader(buffer);

    // Assert
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("INVALID_HEADER");
    }
  });
});

// ============================================
// getWavDurationSec
// ============================================

describe("getWavDurationSec", () => {
  it("returns 1.0 second for 44100 Hz mono 16-bit 1-second WAV", () => {
    // Arrange — dataSize = 44100 * 1 * 2 = 88200, byteRate = 88200
    const buffer = buildWavBuffer(44100, 1, 16, 1.0);

    // Act
    const result = getWavDurationSec(buffer);

    // Assert
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBeCloseTo(1.0, 5);
    }
  });

  it("returns 0.5 second for half-second WAV", () => {
    // Arrange
    const buffer = buildWavBuffer(44100, 1, 16, 0.5);

    // Act
    const result = getWavDurationSec(buffer);

    // Assert
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBeCloseTo(0.5, 5);
    }
  });

  it("returns correct duration for stereo 48000 Hz 24-bit audio", () => {
    // Arrange
    const buffer = buildWavBuffer(48000, 2, 24, 2.0);

    // Act
    const result = getWavDurationSec(buffer);

    // Assert
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBeCloseTo(2.0, 5);
    }
  });

  it("returns Err INVALID_HEADER for invalid WAV buffer", () => {
    // Arrange
    const buffer = new ArrayBuffer(10);

    // Act
    const result = getWavDurationSec(buffer);

    // Assert
    expect(result.isErr()).toBe(true);
  });
});

// ============================================
// getWavDurationSec — property-based test
// ============================================

describe("getWavDurationSec property", () => {
  // it.prop([arb1, arb2, ...])(name, fn) — @fast-check/vitest API
  itProp.prop([
    fc.integer({ min: 8000, max: 96000 }), // sampleRate
    fc.constantFrom(1, 2), // numChannels
    fc.constantFrom(8, 16, 24), // bitsPerSample
    // fast-check v4 requires 32-bit floats for fc.float constraints
    fc.float({ min: Math.fround(0.1), max: Math.fround(5.0), noNaN: true }), // durationSec
  ])(
    "duration = dataSize / byteRate for any valid WAV parameters",
    (
      sampleRate: number,
      numChannels: number,
      bitsPerSample: number,
      durationSec: number,
    ) => {
      // Arrange
      const buffer = buildWavBuffer(
        sampleRate,
        numChannels,
        bitsPerSample,
        durationSec,
      );
      const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
      const dataSize = Math.floor(byteRate * durationSec);
      const expectedDuration = dataSize / byteRate;

      // Act
      const result = getWavDurationSec(buffer);

      // Assert
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBeCloseTo(expectedDuration, 5);
      }
    },
  );
});

// ============================================
// concatenateWavs
// ============================================

describe("concatenateWavs", () => {
  it("returns Err EMPTY_INPUT when given an empty array", () => {
    // Act
    const result = concatenateWavs([]);

    // Assert
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("EMPTY_INPUT");
    }
  });

  it("returns Ok for a single WAV buffer", () => {
    // Arrange
    const buffer = buildWavBuffer(44100, 1, 16, 1.0);

    // Act
    const result = concatenateWavs([buffer]);

    // Assert
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBeInstanceOf(ArrayBuffer);
    }
  });

  it("returns Ok ArrayBuffer whose data size equals the sum of input data sizes", () => {
    // Arrange — two 0.5-second buffers → concatenated should be ~1.0 second
    const bufA = buildWavBuffer(44100, 1, 16, 0.5);
    const bufB = buildWavBuffer(44100, 1, 16, 0.5);
    const expectedDataSize = Math.floor(44100 * 1 * 2 * 0.5) * 2;

    // Act
    const result = concatenateWavs([bufA, bufB]);

    // Assert
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      // Verify the combined WAV duration
      const durationResult = getWavDurationSec(result.value);
      expect(durationResult.isOk()).toBe(true);
      if (durationResult.isOk()) {
        // Combined duration should equal sum of individual data sizes / byteRate
        const byteRate = 44100 * 1 * 2;
        expect(durationResult.value).toBeCloseTo(
          expectedDataSize / byteRate,
          5,
        );
      }
    }
  });

  it("returns Err FORMAT_MISMATCH when sample rates differ", () => {
    // Arrange — different sample rates cannot be concatenated
    const bufA = buildWavBuffer(44100, 1, 16, 0.5);
    const bufB = buildWavBuffer(48000, 1, 16, 0.5); // different sample rate

    // Act
    const result = concatenateWavs([bufA, bufB]);

    // Assert
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("FORMAT_MISMATCH");
    }
  });

  it("returns Err FORMAT_MISMATCH when channel counts differ", () => {
    // Arrange — mono vs stereo cannot be concatenated
    const bufA = buildWavBuffer(44100, 1, 16, 0.5); // mono
    const bufB = buildWavBuffer(44100, 2, 16, 0.5); // stereo

    // Act
    const result = concatenateWavs([bufA, bufB]);

    // Assert
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("FORMAT_MISMATCH");
    }
  });

  it("returns Err FORMAT_MISMATCH when bits per sample differ", () => {
    // Arrange
    const bufA = buildWavBuffer(44100, 1, 16, 0.5); // 16-bit
    const bufB = buildWavBuffer(44100, 1, 24, 0.5); // 24-bit

    // Act
    const result = concatenateWavs([bufA, bufB]);

    // Assert
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("FORMAT_MISMATCH");
    }
  });

  it("produces a valid WAV header in the concatenated output", () => {
    // Arrange
    const bufA = buildWavBuffer(44100, 1, 16, 0.3);
    const bufB = buildWavBuffer(44100, 1, 16, 0.7);

    // Act
    const result = concatenateWavs([bufA, bufB]);

    // Assert — the combined output must be parseable as a valid WAV
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const parseResult = parseWavHeader(result.value);
      expect(parseResult.isOk()).toBe(true);
      if (parseResult.isOk()) {
        expect(parseResult.value.sampleRate).toBe(44100);
        expect(parseResult.value.numChannels).toBe(1);
        expect(parseResult.value.bitsPerSample).toBe(16);
      }
    }
  });

  it("concatenates three WAV buffers without error", () => {
    // Arrange
    const bufA = buildWavBuffer(44100, 1, 16, 0.5);
    const bufB = buildWavBuffer(44100, 1, 16, 0.5);
    const bufC = buildWavBuffer(44100, 1, 16, 0.5);

    // Act
    const result = concatenateWavs([bufA, bufB, bufC]);

    // Assert
    expect(result.isOk()).toBe(true);
  });
});
