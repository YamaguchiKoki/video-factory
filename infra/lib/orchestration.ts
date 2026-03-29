import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as events from "aws-cdk-lib/aws-events";
import * as eventsTargets from "aws-cdk-lib/aws-events-targets";
import type * as lambda from "aws-cdk-lib/aws-lambda";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as sfnTasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import type * as cdk from "aws-cdk-lib/core";
import { SCHEDULE_UTC_HOUR } from "./constants";

type StateMachineInput = {
  readonly cluster: ecs.Cluster;
  readonly vpc: ec2.IVpc;
  readonly ttsTaskDef: ecs.FargateTaskDefinition;
  readonly videoTaskDef: ecs.FargateTaskDefinition;
  readonly scriptGeneratorLambda: lambda.IFunction;
  readonly uploadLambda: lambda.IFunction;
};

export const createStateMachine = (
  stack: cdk.Stack,
  input: StateMachineInput,
): sfn.StateMachine => {
  const {
    cluster,
    vpc,
    ttsTaskDef,
    videoTaskDef,
    scriptGeneratorLambda,
    uploadLambda,
  } = input;

  const scriptGeneratorTask = new sfnTasks.LambdaInvoke(
    stack,
    "ScriptGeneratorTask",
    {
      lambdaFunction: scriptGeneratorLambda,
      integrationPattern: sfn.IntegrationPattern.REQUEST_RESPONSE,
    },
  );

  const publicSubnets = vpc.selectSubnets({
    subnetType: ec2.SubnetType.PUBLIC,
  });

  const fargateSpotTarget = new sfnTasks.EcsFargateLaunchTarget({
    platformVersion: ecs.FargatePlatformVersion.LATEST,
  });

  const ttsTask = new sfnTasks.EcsRunTask(stack, "TtsWorkerTask", {
    cluster,
    taskDefinition: ttsTaskDef,
    launchTarget: fargateSpotTarget,
    integrationPattern: sfn.IntegrationPattern.RUN_JOB,
    subnets: publicSubnets,
    assignPublicIp: true,
  });

  const videoTask = new sfnTasks.EcsRunTask(stack, "VideoWorkerTask", {
    cluster,
    taskDefinition: videoTaskDef,
    launchTarget: fargateSpotTarget,
    integrationPattern: sfn.IntegrationPattern.RUN_JOB,
    subnets: publicSubnets,
    assignPublicIp: true,
  });

  const uploadTask = new sfnTasks.LambdaInvoke(stack, "UploadTask", {
    lambdaFunction: uploadLambda,
    integrationPattern: sfn.IntegrationPattern.REQUEST_RESPONSE,
  });

  const chain = scriptGeneratorTask
    .next(ttsTask)
    .next(videoTask)
    .next(uploadTask);

  return new sfn.StateMachine(stack, "VideoFactoryStateMachine", {
    definitionBody: sfn.DefinitionBody.fromChainable(chain),
  });
};

export const createScheduledTrigger = (
  stack: cdk.Stack,
  stateMachine: sfn.StateMachine,
): void => {
  const rule = new events.Rule(stack, "DailySchedule", {
    schedule: events.Schedule.expression(
      `cron(0 ${SCHEDULE_UTC_HOUR} * * ? *)`,
    ),
  });

  rule.addTarget(
    new eventsTargets.SfnStateMachine(stateMachine, {
      input: events.RuleTargetInput.fromObject({ genre: "政治経済" }),
    }),
  );
};
