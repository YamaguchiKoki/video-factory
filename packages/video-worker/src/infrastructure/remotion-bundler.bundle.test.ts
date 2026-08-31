/**
 * 実際に webpack バンドルを走らせる統合テスト。@remotion/bundler をモックしない。
 *
 * なぜ必要か:
 * Remotion の `remotion.config.ts` は CLI 経由でしか読まれず、Node API
 * （`bundle()`）を直接呼ぶ経路では無視される。そのため `webpackOverride` を
 * 渡し忘れると、`extensionAlias` が効かず `@video-factory/shared` の
 * `./effect-interop.js` 形式の re-export を解決できずにバンドルが失敗する。
 *
 * この経路は既存の e2e テストでしか通らず、それらは RUN_E2E_TESTS=true の
 * ときだけ実行されるため、2026-04-11 に壊れてから4か月以上検出されなかった。
 * 本テストは既定で実行され、バンドルが通ることだけを数秒で確認する。
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { bundleComposition } from "./remotion-bundler";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const entryPoint = path.resolve(currentDir, "../remotion/index.ts");
const publicDir = path.resolve(currentDir, "../../public");

describe("bundleComposition", () => {
  it("should bundle the real remotion entry point without module resolution errors", async () => {
    // Act
    const bundleDir = await Effect.runPromise(
      bundleComposition(entryPoint, publicDir),
    );

    // Assert — バンドル先のディレクトリパスが返る
    expect(bundleDir).toBeTruthy();
    expect(path.isAbsolute(bundleDir)).toBe(true);
  }, 180_000);
});
