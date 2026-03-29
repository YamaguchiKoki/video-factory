import {
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { fromPromise, type ResultAsync } from "neverthrow";
import type { Script } from "../schema";

type S3Error = {
  readonly type: "PUT_OBJECT_ERROR";
  readonly message: string;
};

export type S3EnvConfig = {
  readonly S3_ENDPOINT_URL?: string;
  readonly S3_ACCESS_KEY_ID?: string;
  readonly S3_SECRET_ACCESS_KEY?: string;
};

export const createS3ClientConfig = (env: S3EnvConfig = {}): S3ClientConfig => {
  const endpointUrl = env.S3_ENDPOINT_URL;
  if (!endpointUrl) {
    return {};
  }
  const accessKeyId = env.S3_ACCESS_KEY_ID;
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY;
  return {
    endpoint: endpointUrl,
    region: "ap-northeast-1",
    forcePathStyle: true,
    ...(accessKeyId && secretAccessKey
      ? { credentials: { accessKeyId, secretAccessKey } }
      : {}),
  };
};

const s3 = new S3Client(createS3ClientConfig());

const toMessage = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

export const uploadScriptToS3 = (
  bucket: string,
  key: string,
  script: Script,
): ResultAsync<void, S3Error> =>
  fromPromise(
    s3
      .send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: Buffer.from(JSON.stringify(script)),
          ContentType: "application/json",
        }),
      )
      .then(() => undefined),
    (e): S3Error => ({ type: "PUT_OBJECT_ERROR", message: toMessage(e) }),
  );
