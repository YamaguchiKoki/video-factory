import type { S3ClientConfig } from "@aws-sdk/client-s3";

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
