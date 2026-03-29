import { err, ok, type Result } from "neverthrow";
import type { WavError } from "./errors.js";

type WavHeader = {
  readonly numChannels: number;
  readonly sampleRate: number;
  readonly bitsPerSample: number;
  readonly dataSize: number;
  readonly dataOffset: number;
};

export const parseWavHeader = (
  buffer: ArrayBuffer,
): Result<WavHeader, WavError> => {
  if (buffer.byteLength < 44) {
    return err({
      type: "INVALID_HEADER",
      message: "Buffer too small for WAV header",
    });
  }

  const view = new DataView(buffer);

  if (readFourCC(view, 0) !== "RIFF") {
    return err({ type: "INVALID_HEADER", message: "Missing RIFF marker" });
  }
  if (readFourCC(view, 8) !== "WAVE") {
    return err({ type: "INVALID_HEADER", message: "Missing WAVE marker" });
  }
  if (readFourCC(view, 12) !== "fmt ") {
    return err({ type: "INVALID_HEADER", message: "Missing fmt chunk" });
  }

  const numChannels = view.getUint16(22, true);
  const sampleRate = view.getUint32(24, true);
  const bitsPerSample = view.getUint16(34, true);

  return findDataChunk(view, buffer.byteLength).map(
    ({ dataOffset, dataSize }) => ({
      numChannels,
      sampleRate,
      bitsPerSample,
      dataSize,
      dataOffset,
    }),
  );
};

export const getWavDurationSec = (
  buffer: ArrayBuffer,
): Result<number, WavError> =>
  parseWavHeader(buffer).map(
    ({ sampleRate, numChannels, bitsPerSample, dataSize }) => {
      const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
      return dataSize / byteRate;
    },
  );

export const concatenateWavs = (
  buffers: readonly ArrayBuffer[],
): Result<ArrayBuffer, WavError> => {
  if (buffers.length === 0) {
    return err({
      type: "EMPTY_INPUT",
      message: "No WAV buffers to concatenate",
    });
  }

  return buffers
    .reduce(
      (acc: Result<WavHeader[], WavError>, buffer) =>
        acc.andThen((hs) => parseWavHeader(buffer).map((h) => [...hs, h])),
      ok<WavHeader[], WavError>([]),
    )
    .andThen((headers) => {
      // biome-ignore lint/style/noNonNullAssertion: headers is guaranteed non-empty (EMPTY_INPUT check above)
      const first = headers[0]!;

      const mismatchIdx = headers.findIndex(
        (h) =>
          h.sampleRate !== first.sampleRate ||
          h.numChannels !== first.numChannels ||
          h.bitsPerSample !== first.bitsPerSample,
      );
      if (mismatchIdx !== -1) {
        // biome-ignore lint/style/noNonNullAssertion: mismatchIdx is a valid index from findIndex (!== -1)
        const h = headers[mismatchIdx]!;
        return err<ArrayBuffer, WavError>({
          type: "FORMAT_MISMATCH",
          message: `Buffer ${mismatchIdx} has different format: ${h.sampleRate}Hz/${h.numChannels}ch/${h.bitsPerSample}bit vs ${first.sampleRate}Hz/${first.numChannels}ch/${first.bitsPerSample}bit`,
        });
      }

      const totalDataSize = headers.reduce((sum, h) => sum + h.dataSize, 0);
      const output = new ArrayBuffer(44 + totalDataSize);
      const outputView = new DataView(output);

      writeWavHeader(
        outputView,
        totalDataSize,
        first.sampleRate,
        first.numChannels,
        first.bitsPerSample,
      );

      const outputBytes = new Uint8Array(output);
      headers.reduce((writeOffset, h, i) => {
        // biome-ignore lint/style/noNonNullAssertion: i is a valid index from headers.reduce
        const srcBytes = new Uint8Array(buffers[i]!);
        outputBytes.set(
          srcBytes.subarray(h.dataOffset, h.dataOffset + h.dataSize),
          writeOffset,
        );
        return writeOffset + h.dataSize;
      }, 44);

      return ok(output);
    });
};

const readFourCC = (view: DataView, offset: number): string =>
  String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );

// VOICEVOX may insert additional chunks (e.g., "fact") before "data".
const findDataChunkFrom = (
  view: DataView,
  bufferSize: number,
  pos: number,
): Result<{ dataOffset: number; dataSize: number }, WavError> => {
  if (pos + 8 > bufferSize) {
    return err({ type: "INVALID_HEADER", message: "data chunk not found" });
  }
  const chunkId = readFourCC(view, pos);
  const chunkSize = view.getUint32(pos + 4, true);
  if (chunkId === "data") {
    return ok({ dataOffset: pos + 8, dataSize: chunkSize });
  }
  return findDataChunkFrom(view, bufferSize, pos + 8 + chunkSize);
};

const findDataChunk = (
  view: DataView,
  bufferSize: number,
): Result<{ dataOffset: number; dataSize: number }, WavError> => {
  if (bufferSize < 20) {
    return err({
      type: "INVALID_HEADER",
      message: "Buffer too small to read fmt chunk",
    });
  }
  const subchunk1Size = view.getUint32(16, true);
  const searchStart = 12 + 4 + 4 + subchunk1Size;
  return findDataChunkFrom(view, bufferSize, searchStart);
};

const writeWavHeader = (
  view: DataView,
  totalDataSize: number,
  sampleRate: number,
  numChannels: number,
  bitsPerSample: number,
): void => {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);

  view.setUint8(0, 0x52);
  view.setUint8(1, 0x49);
  view.setUint8(2, 0x46);
  view.setUint8(3, 0x46);
  view.setUint32(4, 36 + totalDataSize, true);
  view.setUint8(8, 0x57);
  view.setUint8(9, 0x41);
  view.setUint8(10, 0x56);
  view.setUint8(11, 0x45);
  view.setUint8(12, 0x66);
  view.setUint8(13, 0x6d);
  view.setUint8(14, 0x74);
  view.setUint8(15, 0x20);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  view.setUint8(36, 0x64);
  view.setUint8(37, 0x61);
  view.setUint8(38, 0x74);
  view.setUint8(39, 0x61);
  view.setUint32(40, totalDataSize, true);
};
