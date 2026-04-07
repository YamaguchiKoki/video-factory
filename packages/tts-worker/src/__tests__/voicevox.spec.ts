// Tests for the VOICEVOX service (voicevox.ts).
//
// Design contract:
//   VoicevoxService.audioQuery(text, speakerId): Effect<unknown, VoicevoxError>
//   VoicevoxService.synthesis(speakerId, query): Effect<ArrayBuffer, VoicevoxError>

import { it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { afterEach, beforeEach, describe, expect, vi } from "vitest";
import { VoicevoxService, VoicevoxServiceLive } from "../voicevox";

const testLayer = VoicevoxServiceLive;

describe("VoicevoxService.audioQuery", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.effect("returns the query JSON on success", () =>
    Effect.gen(function* () {
      const queryJson = { speedScale: 1.0, pitchScale: 0.0 };
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(queryJson), { status: 200 }),
      );
      const service = yield* VoicevoxService;
      const result = yield* service.audioQuery("こんにちは", 0);
      expect(result).toEqual(queryJson);
    }).pipe(Effect.provide(testLayer)),
  );

  it.effect("fails with AudioQueryError when fetch rejects", () =>
    Effect.gen(function* () {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
        new Error("Network error"),
      );
      const service = yield* VoicevoxService;
      const error = yield* service
        .audioQuery("こんにちは", 0)
        .pipe(Effect.flip);
      expect(error._tag).toBe("AudioQueryError");
      expect(typeof error.message).toBe("string");
    }).pipe(Effect.provide(testLayer)),
  );

  it.effect(
    "fails with AudioQueryError when response is not ok (HTTP 422)",
    () =>
      Effect.gen(function* () {
        vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
          new Response("Unprocessable Entity", { status: 422 }),
        );
        const service = yield* VoicevoxService;
        const error = yield* service
          .audioQuery("こんにちは", 0)
          .pipe(Effect.flip);
        expect(error._tag).toBe("AudioQueryError");
      }).pipe(Effect.provide(testLayer)),
  );

  it.effect("calls fetch with URL-encoded text parameter", () =>
    Effect.gen(function* () {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(JSON.stringify({}), { status: 200 }),
        );
      const text = "こんにちは";
      const service = yield* VoicevoxService;
      yield* service.audioQuery(text, 0);
      expect(fetchSpy).toHaveBeenCalledOnce();
      const calledUrl = (fetchSpy.mock.calls[0] as [string, RequestInit])[0];
      expect(calledUrl).toContain(`text=${encodeURIComponent(text)}`);
    }).pipe(Effect.provide(testLayer)),
  );

  it.effect("calls fetch with speaker id in query string", () =>
    Effect.gen(function* () {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(JSON.stringify({}), { status: 200 }),
        );
      const service = yield* VoicevoxService;
      yield* service.audioQuery("テスト", 1);
      const calledUrl = (fetchSpy.mock.calls[0] as [string, RequestInit])[0];
      expect(calledUrl).toContain("speaker=1");
    }).pipe(Effect.provide(testLayer)),
  );

  it.effect("calls fetch with POST method", () =>
    Effect.gen(function* () {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(JSON.stringify({}), { status: 200 }),
        );
      const service = yield* VoicevoxService;
      yield* service.audioQuery("テスト", 0);
      const calledOptions = (
        fetchSpy.mock.calls[0] as [string, RequestInit]
      )[1];
      expect(calledOptions?.method).toBe("POST");
    }).pipe(Effect.provide(testLayer)),
  );
});

describe("VoicevoxService.synthesis", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.effect("returns Ok with ArrayBuffer on success", () =>
    Effect.gen(function* () {
      const wavData = new ArrayBuffer(100);
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(wavData, { status: 200 }),
      );
      const service = yield* VoicevoxService;
      const result = yield* service.synthesis(0, { speedScale: 1.0 });
      expect(result).toBeInstanceOf(ArrayBuffer);
    }).pipe(Effect.provide(testLayer)),
  );

  it.effect("fails with SynthesisError when fetch rejects", () =>
    Effect.gen(function* () {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
        new Error("Connection refused"),
      );
      const service = yield* VoicevoxService;
      const error = yield* service.synthesis(0, {}).pipe(Effect.flip);
      expect(error._tag).toBe("SynthesisError");
      expect(typeof error.message).toBe("string");
    }).pipe(Effect.provide(testLayer)),
  );

  it.effect(
    "fails with SynthesisError when response is not ok (HTTP 500)",
    () =>
      Effect.gen(function* () {
        vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
          new Response("Internal Server Error", { status: 500 }),
        );
        const service = yield* VoicevoxService;
        const error = yield* service.synthesis(0, {}).pipe(Effect.flip);
        expect(error._tag).toBe("SynthesisError");
      }).pipe(Effect.provide(testLayer)),
  );

  it.effect("calls fetch with speaker id in query string", () =>
    Effect.gen(function* () {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(new ArrayBuffer(50), { status: 200 }),
        );
      const service = yield* VoicevoxService;
      yield* service.synthesis(1, { speedScale: 1.0 });
      const calledUrl = (fetchSpy.mock.calls[0] as [string, RequestInit])[0];
      expect(calledUrl).toContain("speaker=1");
    }).pipe(Effect.provide(testLayer)),
  );

  it.effect("sends query JSON as request body", () =>
    Effect.gen(function* () {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(new ArrayBuffer(50), { status: 200 }),
        );
      const query = { speedScale: 1.5, pitchScale: 0.1 };
      const service = yield* VoicevoxService;
      yield* service.synthesis(0, query);
      const calledOptions = (
        fetchSpy.mock.calls[0] as [string, RequestInit]
      )[1];
      expect(calledOptions?.body).toBe(JSON.stringify(query));
    }).pipe(Effect.provide(testLayer)),
  );

  it.effect("calls fetch with POST method and JSON Content-Type", () =>
    Effect.gen(function* () {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(new ArrayBuffer(50), { status: 200 }),
        );
      const service = yield* VoicevoxService;
      yield* service.synthesis(0, {});
      const calledOptions = (
        fetchSpy.mock.calls[0] as [string, RequestInit]
      )[1];
      expect(calledOptions?.method).toBe("POST");
      expect(
        (calledOptions?.headers as Record<string, string>)?.["Content-Type"],
      ).toBe("application/json");
    }).pipe(Effect.provide(testLayer)),
  );
});

// ============================================
// Layer composition test
// ============================================

describe("VoicevoxServiceLive", () => {
  it.effect("provides VoicevoxService through the Live layer", () =>
    Effect.gen(function* () {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
      const service = yield* VoicevoxService;
      expect(typeof service.audioQuery).toBe("function");
      expect(typeof service.synthesis).toBe("function");
    }).pipe(
      Effect.provide(
        Layer.succeed(VoicevoxService, {
          audioQuery: () => Effect.succeed({ ok: true }),
          synthesis: () => Effect.succeed(new ArrayBuffer(0)),
        }),
      ),
    ),
  );
});
