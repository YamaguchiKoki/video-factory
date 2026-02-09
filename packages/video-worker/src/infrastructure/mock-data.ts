/**
 * Mock data loader
 * Loads mock script and audio files for local testing
 */

import type { ResultAsync } from "neverthrow";
import type { FileSystemError } from "../core/errors";
import { readFile } from "./file-system";

const MOCK_SCRIPT_PATH = "mock-data/script.json";
const MOCK_AUDIO_PATH = "mock-data/audio.wav";

/**
 * Load mock script from mock-data/script.json
 * @returns ResultAsync with script content as string on success, FileSystemError on failure
 */
export const loadMockScript = (): ResultAsync<string, FileSystemError> => {
  return readFile(MOCK_SCRIPT_PATH).map((buffer) => buffer.toString("utf-8"));
};

/**
 * Load mock audio from mock-data/audio.wav
 * @returns ResultAsync with audio buffer on success, FileSystemError on failure
 */
export const loadMockAudio = (): ResultAsync<Buffer, FileSystemError> => {
  return readFile(MOCK_AUDIO_PATH);
};
