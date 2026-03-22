import type { Speaker } from "./schema.js";

export const SPEAKER_IDS = {
  A: 0,
  B: 1,
} as const satisfies Record<Speaker, number>;

export const getSpeakerId = (speaker: Speaker): number => SPEAKER_IDS[speaker];
