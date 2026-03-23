import { fromPromise } from "neverthrow";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { handler } from "./handler";

export const OUTPUT_SCRIPT_KEY = "script-generator/script.json";

export const createS3ClientConfig = () => {
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

const toMessage = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

export const run = async (): Promise<void> => {
  const bucket = process.env["S3_BUCKET"];
  if (!bucket) {
    console.error("S3_BUCKET environment variable is not set");
    process.exit(1);
  }

  const s3 = new S3Client(createS3ClientConfig());

  const result = await fromPromise(
    handler({ genre: "technology" }),
    (e) => ({ type: "HANDLER_ERROR" as const, message: toMessage(e) }),
  ).andThen((script) =>
    fromPromise(
      s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: OUTPUT_SCRIPT_KEY,
          Body: Buffer.from(JSON.stringify(script)),
          ContentType: "application/json",
        }),
      ),
      (e) => ({ type: "UPLOAD_ERROR" as const, message: toMessage(e) }),
    ),
  );

  if (result.isErr()) {
    console.error(`Failed [${result.error.type}]:`, result.error.message);
    process.exit(1);
  }
};
