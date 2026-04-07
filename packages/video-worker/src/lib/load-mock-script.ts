/**
 * Load mock script data for Remotion Studio
 * This function is used by calculateMetadata to dynamically load script.json
 */

import { staticFile } from "remotion";
import { type ParsedScript, parsedScriptSchema } from "../core/script-types";

export const loadMockScript = async (): Promise<ParsedScript> => {
  const response = await fetch(staticFile("script.json"));
  const data: unknown = await response.json();
  const result = parsedScriptSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid mock script: ${result.error.message}`);
  }
  return result.data;
};
