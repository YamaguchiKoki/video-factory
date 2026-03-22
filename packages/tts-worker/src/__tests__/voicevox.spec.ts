// Tests for the VOICEVOX API client (voicevox.ts).
// This module does not exist yet; tests are written TDD-first.
//
// Design contract:
//   audioQuery(text, speakerId): ResultAsync<unknown, VoicevoxError>
//   synthesis(speakerId, query): ResultAsync<ArrayBuffer, VoicevoxError>
//   VoicevoxError = { type: "AUDIO_QUERY_ERROR" | "SYNTHESIS_ERROR"; message: string }

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { audioQuery, synthesis } from "../voicevox";

describe("audioQuery", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns Ok with the query JSON on success", async () => {
    // Arrange
    const queryJson = { speedScale: 1.0, pitchScale: 0.0, intonationScale: 1.0 };
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(queryJson), { status: 200 }),
    );

    // Act
    const result = await audioQuery("こんにちは", 0);

    // Assert
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual(queryJson);
    }
  });

  it("returns Err with type AUDIO_QUERY_ERROR when fetch rejects", async () => {
    // Arrange
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("Network error"),
    );

    // Act
    const result = await audioQuery("こんにちは", 0);

    // Assert
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("AUDIO_QUERY_ERROR");
      expect(typeof result.error.message).toBe("string");
    }
  });

  it("returns Err with type AUDIO_QUERY_ERROR when response is not ok (HTTP 422)", async () => {
    // Arrange
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Unprocessable Entity", { status: 422 }),
    );

    // Act
    const result = await audioQuery("こんにちは", 0);

    // Assert
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("AUDIO_QUERY_ERROR");
    }
  });

  it("calls fetch with URL-encoded text parameter", async () => {
    // Arrange
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 }),
      );
    const text = "こんにちは";

    // Act
    await audioQuery(text, 0);

    // Assert
    expect(fetchSpy).toHaveBeenCalledOnce();
    const calledUrl = (fetchSpy.mock.calls[0] as [string, RequestInit])[0];
    expect(calledUrl).toContain(`text=${encodeURIComponent(text)}`);
  });

  it("calls fetch with speaker id in query string", async () => {
    // Arrange
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 }),
      );

    // Act
    await audioQuery("テスト", 1);

    // Assert
    const calledUrl = (fetchSpy.mock.calls[0] as [string, RequestInit])[0];
    expect(calledUrl).toContain("speaker=1");
  });

  it("calls fetch with POST method", async () => {
    // Arrange
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 }),
      );

    // Act
    await audioQuery("テスト", 0);

    // Assert
    const calledOptions = (fetchSpy.mock.calls[0] as [string, RequestInit])[1];
    expect(calledOptions?.method).toBe("POST");
  });
});

describe("synthesis", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns Ok with ArrayBuffer on success", async () => {
    // Arrange
    const wavData = new ArrayBuffer(100);
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(wavData, { status: 200 }),
    );
    const mockQuery = { speedScale: 1.0 };

    // Act
    const result = await synthesis(0, mockQuery);

    // Assert
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBeInstanceOf(ArrayBuffer);
    }
  });

  it("returns Err with type SYNTHESIS_ERROR when fetch rejects", async () => {
    // Arrange
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("Connection refused"),
    );

    // Act
    const result = await synthesis(0, {});

    // Assert
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("SYNTHESIS_ERROR");
      expect(typeof result.error.message).toBe("string");
    }
  });

  it("returns Err with type SYNTHESIS_ERROR when response is not ok (HTTP 500)", async () => {
    // Arrange
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Internal Server Error", { status: 500 }),
    );

    // Act
    const result = await synthesis(0, {});

    // Assert
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("SYNTHESIS_ERROR");
    }
  });

  it("calls fetch with speaker id in query string", async () => {
    // Arrange
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(new ArrayBuffer(50), { status: 200 }),
      );

    // Act
    await synthesis(1, { speedScale: 1.0 });

    // Assert
    const calledUrl = (fetchSpy.mock.calls[0] as [string, RequestInit])[0];
    expect(calledUrl).toContain("speaker=1");
  });

  it("sends query JSON as request body", async () => {
    // Arrange
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(new ArrayBuffer(50), { status: 200 }),
      );
    const query = { speedScale: 1.5, pitchScale: 0.1 };

    // Act
    await synthesis(0, query);

    // Assert
    const calledOptions = (fetchSpy.mock.calls[0] as [string, RequestInit])[1];
    expect(calledOptions?.body).toBe(JSON.stringify(query));
  });

  it("calls fetch with POST method and JSON Content-Type", async () => {
    // Arrange
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(new ArrayBuffer(50), { status: 200 }),
      );

    // Act
    await synthesis(0, {});

    // Assert
    const calledOptions = (fetchSpy.mock.calls[0] as [string, RequestInit])[1];
    expect(calledOptions?.method).toBe("POST");
    expect((calledOptions?.headers as Record<string, string>)?.["Content-Type"]).toBe(
      "application/json",
    );
  });
});
