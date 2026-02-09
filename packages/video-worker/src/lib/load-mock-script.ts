/**
 * Load mock script data for Remotion Studio
 * This function is used by calculateMetadata to dynamically load script.json
 */

import { staticFile } from "remotion";
import type { ParsedScript } from "../core/script-types";

export const loadMockScript = async (): Promise<ParsedScript> => {
  const response = await fetch(staticFile("script.json"));
  const data = await response.json();
  return data as ParsedScript;
};
