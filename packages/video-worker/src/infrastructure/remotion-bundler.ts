import { bundle } from "@remotion/bundler";
import { Effect } from "effect";
import { RenderError } from "../core/errors";

export const bundleComposition = (
  entryPoint: string,
  publicDir: string,
): Effect.Effect<string, RenderError> =>
  Effect.tryPromise({
    try: () => bundle({ entryPoint, publicDir }),
    catch: (e) =>
      new RenderError({
        message: e instanceof Error ? e.message : String(e),
        cause: e instanceof Error ? e : undefined,
      }),
  });
