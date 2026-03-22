import { describe, expect, it, vi, beforeEach } from "vitest";
import { bundleComposition } from "./remotion-bundler";
import type { RenderError } from "../core/errors";

// ---------------------------------------------------------------------------
// Mock @remotion/bundler
// ---------------------------------------------------------------------------

vi.mock("@remotion/bundler", () => ({
  bundle: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("bundleComposition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系", () => {
    it("bundle() 成功時に Ok(bundleUrl) を返す", async () => {
      const { bundle } = await import("@remotion/bundler");
      const bundleUrl = "http://localhost:3000/bundle/index.html";
      vi.mocked(bundle).mockResolvedValue(bundleUrl);

      const result = await bundleComposition(
        "/path/to/src/remotion/index.ts",
        "/path/to/public",
      );

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(bundleUrl);
      }
    });

    it("bundle() を正しいパラメータで呼び出す", async () => {
      const { bundle } = await import("@remotion/bundler");
      vi.mocked(bundle).mockResolvedValue("http://localhost:3000/bundle");

      const entryPoint = "/app/src/remotion/index.ts";
      const publicDir = "/app/public";

      await bundleComposition(entryPoint, publicDir);

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

      const result = await bundleComposition("/entry.ts", "/public");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(typeof result.value).toBe("string");
        expect(result.value.length).toBeGreaterThan(0);
      }
    });
  });

  describe("異常系", () => {
    it("bundle() がエラーをスローしたとき Err(RenderError) を返す", async () => {
      const { bundle } = await import("@remotion/bundler");
      const originalError = new Error("Webpack build failed");
      vi.mocked(bundle).mockRejectedValue(originalError);

      const result = await bundleComposition("/entry.ts", "/public");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        const error: RenderError = result.error;
        expect(error.type).toBe("RENDER_FAILED");
        expect(error.cause).toBe(originalError);
      }
    });

    it("エラーメッセージが RenderError.message に含まれる", async () => {
      const { bundle } = await import("@remotion/bundler");
      vi.mocked(bundle).mockRejectedValue(new Error("Module not found: react"));

      const result = await bundleComposition("/entry.ts", "/public");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain("Module not found");
      }
    });

    it("Error インスタンス以外のスローでも Err を返す", async () => {
      const { bundle } = await import("@remotion/bundler");
      vi.mocked(bundle).mockRejectedValue("string error");

      const result = await bundleComposition("/entry.ts", "/public");

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("RENDER_FAILED");
      }
    });
  });
});
