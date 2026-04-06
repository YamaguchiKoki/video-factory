import { Effect, Layer, ServiceMap } from "effect";
import {
  AudioQueryError,
  SynthesisError,
  type VoicevoxError,
} from "./errors.js";
import { fetchArrayBuffer, fetchJson } from "./http.js";

const VOICEVOX_URL = process.env.VOICEVOX_URL ?? "http://localhost:50021";

// Opaque type for VOICEVOX audio query response.
// The exact shape is an internal VOICEVOX detail; we only need to pass it through as JSON.
export type VoicevoxAudioQuery = Record<string, unknown>;

// ============================================
// Service Definition
// ============================================

interface VoicevoxServiceShape {
  readonly audioQuery: (
    text: string,
    speakerId: number,
  ) => Effect.Effect<VoicevoxAudioQuery, VoicevoxError>;
  readonly synthesis: (
    speakerId: number,
    query: VoicevoxAudioQuery,
  ) => Effect.Effect<ArrayBuffer, VoicevoxError>;
}

export class VoicevoxService extends ServiceMap.Service<
  VoicevoxService,
  VoicevoxServiceShape
>()("video-factory/tts-worker/VoicevoxService") {}

// ============================================
// Live Layer
// ============================================

const audioQuery = (
  text: string,
  speakerId: number,
): Effect.Effect<VoicevoxAudioQuery, VoicevoxError> =>
  Effect.tryPromise({
    try: async () => {
      const data = await fetchJson(
        `${VOICEVOX_URL}/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`,
        { method: "POST" },
      );
      return data as VoicevoxAudioQuery;
    },
    catch: (e) =>
      new AudioQueryError({
        message: e instanceof Error ? e.message : String(e),
        cause: e,
      }),
  });

const synthesis = (
  speakerId: number,
  query: VoicevoxAudioQuery,
): Effect.Effect<ArrayBuffer, VoicevoxError> =>
  Effect.tryPromise({
    try: () =>
      fetchArrayBuffer(`${VOICEVOX_URL}/synthesis?speaker=${speakerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(query),
      }),
    catch: (e) =>
      new SynthesisError({
        message: e instanceof Error ? e.message : String(e),
        cause: e,
      }),
  });

export const VoicevoxServiceLive = Layer.succeed(VoicevoxService, {
  audioQuery,
  synthesis,
});
