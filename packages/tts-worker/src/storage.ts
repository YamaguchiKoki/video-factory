import type { ResultAsync } from "neverthrow";
import type { Script, EnrichedScript } from "./schema.js";
import type { S3Error } from "./errors.js";

export type StorageDeps = {
  readonly getScript: (key: string) => ResultAsync<Script, S3Error>;
  readonly uploadWav: (key: string, data: ArrayBuffer) => ResultAsync<void, S3Error>;
  readonly uploadEnrichedScript: (data: EnrichedScript) => ResultAsync<void, S3Error>;
  readonly buildOutputKey: (date: string, title: string) => string;
};
