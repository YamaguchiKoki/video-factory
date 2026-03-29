import { fromPromise, type ResultAsync } from "neverthrow";
import { toError, type VoicevoxError } from "./errors.js";
import { fetchArrayBuffer, fetchJson } from "./http.js";

export const VOICEVOX_URL =
  process.env.VOICEVOX_URL ?? "http://localhost:50021";

export const audioQuery = (
  text: string,
  speakerId: number,
): ResultAsync<unknown, VoicevoxError> =>
  fromPromise(
    fetchJson(
      `${VOICEVOX_URL}/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`,
      { method: "POST" },
    ),
    (e): VoicevoxError => ({
      type: "AUDIO_QUERY_ERROR",
      message: toError(e).message,
    }),
  );

export const synthesis = (
  speakerId: number,
  query: unknown,
): ResultAsync<ArrayBuffer, VoicevoxError> =>
  fromPromise(
    fetchArrayBuffer(`${VOICEVOX_URL}/synthesis?speaker=${speakerId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(query),
    }),
    (e): VoicevoxError => ({
      type: "SYNTHESIS_ERROR",
      message: toError(e).message,
    }),
  );
