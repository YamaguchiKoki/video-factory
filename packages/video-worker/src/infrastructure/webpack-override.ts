import { enableTailwind } from "@remotion/tailwind-v4";

type WebpackConfiguration = Parameters<typeof enableTailwind>[0];

/**
 * Remotion の webpack 設定。CLI（`remotion.config.ts`）とプログラム API
 * （`bundle()`）の両方から使う。
 *
 * `remotion.config.ts` は CLI 経由でしか読まれないため、`bundle()` を直接
 * 呼ぶ側にも同じ設定を渡さないと片方だけ壊れる。実際 2026-04 から
 * 2026-08 まで、プログラム側だけ設定が効かず動画生成が失敗し続けていた。
 * 二重管理でその再発を招かないよう、定義はここ1箇所に置く。
 *
 * `extensionAlias` が必要な理由: `@video-factory/shared` は ESM 流儀で
 * `./effect-interop.js` のように拡張子付きで re-export するが、実体は
 * `.ts` である。webpack は既定でこの読み替えをしない。
 */
export const webpackOverride = (
  currentConfiguration: WebpackConfiguration,
): WebpackConfiguration => {
  const withTailwind = enableTailwind(currentConfiguration);

  return {
    ...withTailwind,
    resolve: {
      ...withTailwind.resolve,
      extensionAlias: {
        ".js": [".ts", ".tsx", ".js"],
        ".mjs": [".mts", ".mjs"],
      },
    },
  };
};
