import { bundle } from "@remotion/bundler";
import { ResultAsync } from "neverthrow";
import { createRenderError, type RenderError } from "../core/errors";

const toBundleError = (e: unknown): RenderError => {
  const cause = e instanceof Error ? e : null;
  const message = e instanceof Error ? e.message : String(e);
  return createRenderError("RENDER_FAILED", message, cause, {});
};

export const bundleComposition = (
  entryPoint: string,
  publicDir: string,
): ResultAsync<string, RenderError> =>
  ResultAsync.fromPromise(bundle({ entryPoint, publicDir }), toBundleError);
