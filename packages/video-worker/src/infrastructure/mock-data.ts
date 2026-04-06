import { Effect } from "effect";
import type { FileSystemError } from "../core/errors";
import { readFile } from "./file-system";

const MOCK_SCRIPT_PATH = "mock-data/script.json";
const MOCK_AUDIO_PATH = "mock-data/audio.wav";

export const loadMockScript = (): Effect.Effect<string, FileSystemError> =>
  readFile(MOCK_SCRIPT_PATH).pipe(
    Effect.map((buffer) => buffer.toString("utf-8")),
  );

export const loadMockAudio = (): Effect.Effect<Buffer, FileSystemError> =>
  readFile(MOCK_AUDIO_PATH);
