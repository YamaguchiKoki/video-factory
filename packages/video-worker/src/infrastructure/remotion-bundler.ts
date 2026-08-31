import { bundle } from "@remotion/bundler";
import { Effect } from "effect";
import { RenderError } from "../core/errors";
import { webpackOverride } from "./webpack-override";

// webpackOverride を渡すのは必須。remotion.config.ts は CLI 経由でしか
// 読まれないため、ここで渡さないと extensionAlias も Tailwind も効かない。
export const bundleComposition = (
  entryPoint: string,
  publicDir: string,
): Effect.Effect<string, RenderError> =>
  Effect.tryPromise({
    try: () => bundle({ entryPoint, publicDir, webpackOverride }),
    catch: (e) =>
      new RenderError({
        message: e instanceof Error ? e.message : String(e),
        cause: e instanceof Error ? e : undefined,
      }),
  });
