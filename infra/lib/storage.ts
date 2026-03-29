import * as s3 from "aws-cdk-lib/aws-s3";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as cdk from "aws-cdk-lib/core";

export type StorageResources = {
  readonly bucket: s3.Bucket;
  readonly tavilySecret: secretsmanager.Secret;
  readonly googleDriveSecret: secretsmanager.Secret;
};

export const createStorageResources = (stack: cdk.Stack): StorageResources => {
  const bucket = new s3.Bucket(stack, "VideoFactoryBucket", {
    removalPolicy: cdk.RemovalPolicy.RETAIN,
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  });

  const tavilySecret = new secretsmanager.Secret(stack, "TavilyApiKey", {
    secretName: "video-factory/tavily-api-key",
  });

  const googleDriveSecret = new secretsmanager.Secret(
    stack,
    "GoogleDriveCredentials",
    {
      secretName: "video-factory/google-drive-credentials",
    },
  );

  return { bucket, tavilySecret, googleDriveSecret };
};
