import type * as ecr from "aws-cdk-lib/aws-ecr";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import type * as s3 from "aws-cdk-lib/aws-s3";
import type * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as cdk from "aws-cdk-lib/core";

export type LambdaFunctions = {
  readonly scriptGeneratorLambda: lambda.IFunction;
  readonly metadataGeneratorLambda: lambda.IFunction;
  readonly uploadLambda: lambda.IFunction;
};

type LambdaFunctionsInput = {
  readonly bucket: s3.Bucket;
  readonly tavilySecret: secretsmanager.Secret;
  readonly googleDriveSecret: secretsmanager.Secret;
  readonly scriptGeneratorEcrRepo: ecr.Repository;
  readonly metadataGeneratorEcrRepo: ecr.Repository;
  readonly uploaderEcrRepo: ecr.Repository;
  readonly imageTag: string;
};

export const createLambdaFunctions = (
  stack: cdk.Stack,
  input: LambdaFunctionsInput,
): LambdaFunctions => {
  const {
    bucket,
    tavilySecret,
    googleDriveSecret,
    scriptGeneratorEcrRepo,
    metadataGeneratorEcrRepo,
    uploaderEcrRepo,
    imageTag,
  } = input;

  const scriptGeneratorLambda = createScriptGeneratorLambda(stack, {
    bucket,
    tavilySecret,
    scriptGeneratorEcrRepo,
    imageTag,
  });

  const metadataGeneratorLambda = createMetadataGeneratorLambda(stack, {
    bucket,
    metadataGeneratorEcrRepo,
    imageTag,
  });

  const uploadLambda = createUploadLambda(stack, {
    bucket,
    youtubeSecret: googleDriveSecret,
    uploaderEcrRepo,
    imageTag,
  });

  return { scriptGeneratorLambda, metadataGeneratorLambda, uploadLambda };
};

type ScriptGeneratorInput = {
  readonly bucket: s3.Bucket;
  readonly tavilySecret: secretsmanager.Secret;
  readonly scriptGeneratorEcrRepo: ecr.Repository;
  readonly imageTag: string;
};

const createScriptGeneratorLambda = (
  stack: cdk.Stack,
  input: ScriptGeneratorInput,
): lambda.DockerImageFunction => {
  const { bucket, tavilySecret, scriptGeneratorEcrRepo, imageTag } = input;

  const fn = new lambda.DockerImageFunction(stack, "ScriptGeneratorLambda", {
    code: lambda.DockerImageCode.fromEcr(scriptGeneratorEcrRepo, {
      tagOrDigest: imageTag,
    }),
    memorySize: 2048,
    timeout: cdk.Duration.minutes(15),
    environment: {
      S3_BUCKET: bucket.bucketName,
      TAVILY_SECRET_ARN: tavilySecret.secretArn,
    },
  });

  bucket.grantReadWrite(fn);
  tavilySecret.grantRead(fn);

  fn.addToRolePolicy(bedrockInvokePolicy());

  return fn;
};

type MetadataGeneratorInput = {
  readonly bucket: s3.Bucket;
  readonly metadataGeneratorEcrRepo: ecr.Repository;
  readonly imageTag: string;
};

const createMetadataGeneratorLambda = (
  stack: cdk.Stack,
  input: MetadataGeneratorInput,
): lambda.DockerImageFunction => {
  const { bucket, metadataGeneratorEcrRepo, imageTag } = input;

  const fn = new lambda.DockerImageFunction(stack, "MetadataGeneratorLambda", {
    code: lambda.DockerImageCode.fromEcr(metadataGeneratorEcrRepo, {
      tagOrDigest: imageTag,
    }),
    memorySize: 2048,
    timeout: cdk.Duration.minutes(15),
    environment: {
      S3_BUCKET: bucket.bucketName,
    },
  });

  bucket.grantReadWrite(fn);
  fn.addToRolePolicy(bedrockInvokePolicy());

  return fn;
};

// Bedrock cross-region inference profiles (us.*) route requests across
// us-east-1 / us-east-2 / us-west-2, so we must allow all three regions.
// Shared by every Lambda that talks to Bedrock (text + image generation).
const bedrockInvokePolicy = (): iam.PolicyStatement =>
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
    resources: [
      "arn:aws:bedrock:us-east-1::foundation-model/*",
      "arn:aws:bedrock:us-east-2::foundation-model/*",
      "arn:aws:bedrock:us-west-2::foundation-model/*",
      "arn:aws:bedrock:us-east-1:*:inference-profile/*",
      "arn:aws:bedrock:us-east-2:*:inference-profile/*",
      "arn:aws:bedrock:us-west-2:*:inference-profile/*",
    ],
  });

type UploadInput = {
  readonly bucket: s3.Bucket;
  readonly youtubeSecret: secretsmanager.Secret;
  readonly uploaderEcrRepo: ecr.Repository;
  readonly imageTag: string;
};

// 動画本体を読み込んで YouTube に送るため、メモリは他の Lambda より多めに取る。
// 生成される MP4 は 8〜9 分で 30MB 前後だが、base64 化されないバイト列を
// そのまま扱うので実測に対して余裕を持たせている。
const UPLOADER_MEMORY_MB = 2048;

const createUploadLambda = (
  stack: cdk.Stack,
  input: UploadInput,
): lambda.DockerImageFunction => {
  const { bucket, youtubeSecret, uploaderEcrRepo, imageTag } = input;

  const fn = new lambda.DockerImageFunction(stack, "UploadLambda", {
    code: lambda.DockerImageCode.fromEcr(uploaderEcrRepo, {
      tagOrDigest: imageTag,
    }),
    memorySize: UPLOADER_MEMORY_MB,
    timeout: cdk.Duration.minutes(15),
    environment: {
      S3_BUCKET: bucket.bucketName,
      YOUTUBE_SECRET_ARN: youtubeSecret.secretArn,
      // 既定は private。チャンネル未確認だと API 経由のアップロードは
      // どのみち非公開になるうえ、公開前に人が中身を見る余地を残す。
      YOUTUBE_PRIVACY_STATUS: "private",
    },
  });

  bucket.grantRead(fn);
  youtubeSecret.grantRead(fn);

  return fn;
};
