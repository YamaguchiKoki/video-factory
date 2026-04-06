import fs from "node:fs/promises";
import path from "node:path";
import { Effect, Layer, Schema } from "effect";
import {
  S3GetObjectError,
  S3PutObjectError,
  S3ValidationError,
} from "./errors.js";
import { type EnrichedScript, Script } from "./schema.js";
import { StorageService } from "./storage.js";

const readScriptFromFile = (filePath: string) =>
  Effect.tryPromise({
    try: () => fs.readFile(filePath, "utf-8"),
    catch: (e) =>
      new S3GetObjectError({
        message: e instanceof Error ? e.message : String(e),
        cause: e,
      }),
  }).pipe(
    Effect.flatMap((jsonStr) =>
      Effect.try({
        try: () => JSON.parse(jsonStr) as unknown,
        catch: (e) =>
          new S3ValidationError({
            message: e instanceof Error ? e.message : String(e),
            cause: e,
          }),
      }),
    ),
    Effect.flatMap((raw) =>
      Schema.decodeUnknownEffect(Script)(raw).pipe(
        Effect.mapError((e) => new S3ValidationError({ message: String(e) })),
      ),
    ),
  );

const writeToFile = (filePath: string, data: Buffer | string) =>
  Effect.tryPromise({
    try: () =>
      fs
        .mkdir(path.dirname(filePath), { recursive: true })
        .then(() => fs.writeFile(filePath, data)),
    catch: (e) =>
      new S3PutObjectError({
        message: e instanceof Error ? e.message : String(e),
        cause: e,
      }),
  });

const buildLocalOutputKey = (date: string, title: string): string =>
  `output/${date}/${title}.wav`;

export const createLocalStorageLayer = (baseDir: string) =>
  Layer.succeed(StorageService, {
    getScript: (key: string) => readScriptFromFile(path.resolve(baseDir, key)),
    uploadWav: (key: string, data: ArrayBuffer) =>
      writeToFile(path.resolve(baseDir, key), Buffer.from(data)),
    uploadEnrichedScript: (data: EnrichedScript) =>
      writeToFile(
        path.resolve(baseDir, "output/enriched-script.json"),
        JSON.stringify(data, null, 2),
      ),
    buildOutputKey: buildLocalOutputKey,
  });
