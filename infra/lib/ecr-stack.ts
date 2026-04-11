import * as ecr from "aws-cdk-lib/aws-ecr";
import * as cdk from "aws-cdk-lib/core";

export type EcrRepositories = {
  readonly ttsEcrRepo: ecr.Repository;
  readonly videoEcrRepo: ecr.Repository;
  readonly scriptGeneratorEcrRepo: ecr.Repository;
  readonly metadataGeneratorEcrRepo: ecr.Repository;
};

export type EcrStackOutput = {
  readonly stack: cdk.Stack;
  readonly repositories: EcrRepositories;
};

export const createEcrStack = (scope: cdk.App): EcrStackOutput => {
  const stack = new cdk.Stack(scope, "EcrStack", {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: "ap-northeast-1",
    },
  });

  const ttsEcrRepo = new ecr.Repository(stack, "TtsWorkerRepo", {
    repositoryName: "tts-worker",
    imageScanOnPush: true,
    emptyOnDelete: true,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
  });

  const videoEcrRepo = new ecr.Repository(stack, "VideoWorkerRepo", {
    repositoryName: "video-worker",
    imageScanOnPush: true,
    emptyOnDelete: true,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
  });

  const scriptGeneratorEcrRepo = new ecr.Repository(
    stack,
    "ScriptGeneratorRepo",
    {
      repositoryName: "script-generator",
      imageScanOnPush: true,
      emptyOnDelete: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    },
  );

  const metadataGeneratorEcrRepo = new ecr.Repository(
    stack,
    "MetadataGeneratorRepo",
    {
      repositoryName: "metadata-generator",
      imageScanOnPush: true,
      emptyOnDelete: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    },
  );

  return {
    stack,
    repositories: {
      ttsEcrRepo,
      videoEcrRepo,
      scriptGeneratorEcrRepo,
      metadataGeneratorEcrRepo,
    },
  };
};
