import type { Effect } from "effect";
import { ServiceMap } from "effect";
import type { S3Error } from "./errors.js";
import type { EnrichedScript, Script } from "./schema.js";

interface StorageServiceShape {
  readonly getScript: (key: string) => Effect.Effect<Script, S3Error>;
  readonly uploadWav: (
    key: string,
    data: ArrayBuffer,
  ) => Effect.Effect<void, S3Error>;
  readonly uploadEnrichedScript: (
    data: EnrichedScript,
  ) => Effect.Effect<void, S3Error>;
  readonly buildOutputKey: (date: string, title: string) => string;
}

export class StorageService extends ServiceMap.Service<
  StorageService,
  StorageServiceShape
>()("video-factory/tts-worker/StorageService") {}
