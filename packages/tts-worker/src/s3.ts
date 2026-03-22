import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { err, fromPromise, fromThrowable, ok, type ResultAsync } from "neverthrow";
import { ScriptSchema, type Script } from "./schema.js";
import { toError, type S3Error } from "./errors.js";

const s3 = new S3Client({});

export const getScriptFromS3 = (
  bucket: string,
  key: string,
): ResultAsync<Script, S3Error> =>
  fromPromise(
    s3.send(new GetObjectCommand({ Bucket: bucket, Key: key })),
    (e): S3Error => ({ type: "GET_OBJECT_ERROR", message: toError(e).message }),
  )
    .andThen((response) => {
      if (!response.Body) {
        return err<string, S3Error>({
          type: "GET_OBJECT_ERROR",
          message: "S3 response body is empty",
        });
      }
      return fromPromise(
        response.Body.transformToString(),
        (e): S3Error => ({ type: "GET_OBJECT_ERROR", message: toError(e).message }),
      );
    })
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

export const uploadWavToS3 = (
  bucket: string,
  key: string,
  data: ArrayBuffer,
): ResultAsync<void, S3Error> =>
  fromPromise(
    s3
      .send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: Buffer.from(data),
          ContentType: "audio/wav",
        }),
      )
      .then(() => undefined),
    (e): S3Error => ({ type: "PUT_OBJECT_ERROR", message: toError(e).message }),
  );

export const buildOutputWavKey = (date: string, title: string): string =>
  `audio/${date}/${title}.wav`;
