export type VoicevoxError = {
  readonly type: "AUDIO_QUERY_ERROR" | "SYNTHESIS_ERROR";
  readonly message: string;
};

export type WavError = {
  readonly type: "INVALID_HEADER" | "FORMAT_MISMATCH" | "EMPTY_INPUT";
  readonly message: string;
};

export type S3Error = {
  readonly type: "GET_OBJECT_ERROR" | "PUT_OBJECT_ERROR" | "VALIDATION_ERROR";
  readonly message: string;
};

export const toError = (e: unknown): Error =>
  e instanceof Error ? e : new Error(String(e));
