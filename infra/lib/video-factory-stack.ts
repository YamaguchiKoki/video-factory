import * as cdk from "aws-cdk-lib/core";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { EcrRepositories } from "./ecr-stack";
import { createStorageResources } from "./storage";
import { createEcsResources } from "./container-compute";
import { createLambdaFunctions } from "./lambda-compute";
import { createStateMachine, createScheduledTrigger } from "./orchestration";

type VideoFactoryStackInput = {
  readonly repositories: EcrRepositories;
};

export const createVideoFactoryStack = (
  scope: cdk.App,
  input: VideoFactoryStackInput,
): cdk.Stack => {
  const { repositories } = input;
  const { ttsEcrRepo, videoEcrRepo, scriptGeneratorEcrRepo } = repositories;

  const stack = new cdk.Stack(scope, "VideoFactoryStack", {
    env: {
      account: process.env["CDK_DEFAULT_ACCOUNT"],
      region: "ap-northeast-1",
    },
  });

  const imageTag = scope.node.tryGetContext("imageTag") ?? "latest";

  const { bucket, tavilySecret, googleDriveSecret } =
    createStorageResources(stack);

  const vpc = ec2.Vpc.fromLookup(stack, "DefaultVpc", { isDefault: true });

  const { cluster, ttsTaskDef, videoTaskDef } = createEcsResources(stack, {
    bucket,
    vpc,
    ttsEcrRepo,
    videoEcrRepo,
    imageTag,
  });

  const { scriptGeneratorLambda, uploadLambda } = createLambdaFunctions(
    stack,
    {
      bucket,
      tavilySecret,
      googleDriveSecret,
      scriptGeneratorEcrRepo,
      imageTag,
    },
  );

  const stateMachine = createStateMachine(stack, {
    cluster,
    vpc,
    ttsTaskDef,
    videoTaskDef,
    scriptGeneratorLambda,
    uploadLambda,
  });

  createScheduledTrigger(stack, stateMachine);

  return stack;
};
