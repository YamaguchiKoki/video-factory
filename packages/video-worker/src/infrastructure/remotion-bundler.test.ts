import { Effect, Result } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bundleComposition } from "./remotion-bundler";

// ---------------------------------------------------------------------------
// Mock @remotion/bundler
// ---------------------------------------------------------------------------

vi.mock("@remotion/bundler", () => ({
  bundle: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

const run = (entryPoint: string, publicDir: string) =>
  Effect.runPromise(Effect.result(bundleComposition(entryPoint, publicDir)));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("bundleComposition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系", () => {
    it("bundle() 成功時に Success(bundleUrl) を返す", async () => {
      const { bundle } = await import("@remotion/bundler");
      const bundleUrl = "http://localhost:3000/bundle/index.html";
      vi.mocked(bundle).mockResolvedValue(bundleUrl);

      const result = await run(
        "/path/to/src/remotion/index.ts",
        "/path/to/public",
      );

      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        expect(result.success).toBe(bundleUrl);
      }
    });

    it("bundle() を正しいパラメータで呼び出す", async () => {
      const { bundle } = await import("@remotion/bundler");
      vi.mocked(bundle).mockResolvedValue("http://localhost:3000/bundle");

      const entryPoint = "/app/src/remotion/index.ts";
      const publicDir = "/app/public";

      await run(entryPoint, publicDir);

      expect(bundle).toHaveBeenCalledWith(
        expect.objectContaining({
          entryPoint,
          publicDir,
        }),
      );
    });

    it("束ねた URL が文字列として返される", async () => {
      const { bundle } = await import("@remotion/bundler");
      vi.mocked(bundle).mockResolvedValue("/tmp/remotion-bundle-12345");

      const result = await run("/entry.ts", "/public");

      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        expect(typeof result.success).toBe("string");
        expect(result.success.length).toBeGreaterThan(0);
      }
    });
  });

  describe("異常系", () => {
    it("bundle() がエラーをスローしたとき Failure(RenderError) を返す", async () => {
      const { bundle } = await import("@remotion/bundler");
      const originalError = new Error("Webpack build failed");
      vi.mocked(bundle).mockRejectedValue(originalError);

      const result = await run("/entry.ts", "/public");

      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure._tag).toBe("RenderError");
        expect(result.failure.cause).toBe(originalError);
      }
    });

    it("エラーメッセージが RenderError.message に含まれる", async () => {
      const { bundle } = await import("@remotion/bundler");
      vi.mocked(bundle).mockRejectedValue(new Error("Module not found: react"));

      const result = await run("/entry.ts", "/public");

      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure.message).toContain("Module not found");
      }
    });

    it("Error インスタンス以外のスローでも Failure を返す", async () => {
      const { bundle } = await import("@remotion/bundler");
      vi.mocked(bundle).mockRejectedValue("string error");

      const result = await run("/entry.ts", "/public");

      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure._tag).toBe("RenderError");
      }
    });
  });
});
