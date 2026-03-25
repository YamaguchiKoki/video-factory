import fs from "node:fs/promises";
import path from "node:path";
import { err, fromPromise, fromThrowable, ok } from "neverthrow";
import { ScriptSchema, type Script, type EnrichedScript } from "./schema.js";
import { toError, type S3Error } from "./errors.js";
import type { StorageDeps } from "./storage.js";

const readScriptFromFile = (filePath: string) =>
  fromPromise(
    fs.readFile(filePath, "utf-8"),
    (e): S3Error => ({ type: "GET_OBJECT_ERROR", message: toError(e).message }),
  )
    .andThen((jsonStr) =>
      fromThrowable(
        JSON.parse,
        (e): S3Error => ({ type: "VALIDATION_ERROR", message: toError(e).message }),
      )(jsonStr),
    )
    .andThen((raw) => {
      const parsed = ScriptSchema.safeParse(raw);
      if (!parsed.success) {
        return err<Script, S3Error>({
          type: "VALIDATION_ERROR",
          message: parsed.error.message,
        });
      }
      return ok<Script, S3Error>(parsed.data);
    });

const writeToFile = (filePath: string, data: Buffer | string) =>
  fromPromise(
    fs.mkdir(path.dirname(filePath), { recursive: true }).then(() =>
      fs.writeFile(filePath, data),
    ),
    (e): S3Error => ({ type: "PUT_OBJECT_ERROR", message: toError(e).message }),
  );

const buildLocalOutputKey = (date: string, title: string): string =>
  `output/${date}/${title}.wav`;

export const createLocalStorage = (baseDir: string): StorageDeps => ({
  getScript: (key) => readScriptFromFile(path.resolve(baseDir, key)),
  uploadWav: (key, data) => writeToFile(path.resolve(baseDir, key), Buffer.from(data)),
  uploadEnrichedScript: (data: EnrichedScript) =>
    writeToFile(
      path.resolve(baseDir, "output/enriched-script.json"),
      JSON.stringify(data, null, 2),
    ),
  buildOutputKey: buildLocalOutputKey,
});
