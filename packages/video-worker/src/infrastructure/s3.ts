import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { err, fromPromise, type ResultAsync } from "neverthrow";
import { readFile, writeFile } from "node:fs/promises";

export type S3Error = {
  readonly type: "GET_OBJECT_ERROR" | "PUT_OBJECT_ERROR";
  readonly message: string;
};

export const createS3ClientConfig = (): S3ClientConfig => {
  const endpointUrl = process.env["S3_ENDPOINT_URL"];
  if (!endpointUrl) {
    return {};
  }
  const accessKeyId = process.env["S3_ACCESS_KEY_ID"];
  const secretAccessKey = process.env["S3_SECRET_ACCESS_KEY"];
  return {
    endpoint: endpointUrl,
    region: "ap-northeast-1",
    forcePathStyle: true,
    ...(accessKeyId && secretAccessKey
      ? { credentials: { accessKeyId, secretAccessKey } }
      : {}),
  };
};

export const createS3Client = (): S3Client =>
  new S3Client(createS3ClientConfig());

const toMessage = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

export const downloadToFile = (
  client: S3Client,
  bucket: string,
  key: string,
  localPath: string,
): ResultAsync<void, S3Error> =>
  fromPromise(
    client.send(new GetObjectCommand({ Bucket: bucket, Key: key })),
    (e): S3Error => ({ type: "GET_OBJECT_ERROR", message: toMessage(e) }),
  ).andThen((response) => {
    if (!response.Body) {
      return err<void, S3Error>({
        type: "GET_OBJECT_ERROR",
        message: "S3 response body is empty",
      });
    }
    return fromPromise(
      response.Body.transformToByteArray().then((bytes) => writeFile(localPath, bytes)),
      (e): S3Error => ({ type: "GET_OBJECT_ERROR", message: toMessage(e) }),
    );
  });

export const uploadFromFile = (
  client: S3Client,
  bucket: string,
  key: string,
  localPath: string,
  contentType: string,
): ResultAsync<void, S3Error> =>
  fromPromise(
    readFile(localPath),
    (e): S3Error => ({ type: "PUT_OBJECT_ERROR", message: toMessage(e) }),
  ).andThen((body) =>
    fromPromise(
      client
        .send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: contentType,
          }),
        )
        .then(() => undefined),
      (e): S3Error => ({ type: "PUT_OBJECT_ERROR", message: toMessage(e) }),
    ),
  );
