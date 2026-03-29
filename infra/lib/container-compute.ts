import * as cdk from "aws-cdk-lib/core";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as s3 from "aws-cdk-lib/aws-s3";

export type EcsResources = {
  readonly cluster: ecs.Cluster;
  readonly ttsTaskDef: ecs.FargateTaskDefinition;
  readonly videoTaskDef: ecs.FargateTaskDefinition;
};

type EcsResourcesInput = {
  readonly bucket: s3.Bucket;
  readonly vpc: ec2.IVpc;
  readonly ttsEcrRepo: ecr.Repository;
  readonly videoEcrRepo: ecr.Repository;
};

export const createEcsResources = (
  stack: cdk.Stack,
  input: EcsResourcesInput,
): EcsResources => {
  const { bucket, vpc, ttsEcrRepo, videoEcrRepo } = input;

  const cluster = new ecs.Cluster(stack, "VideoFactoryCluster", {
    vpc,
    enableFargateCapacityProviders: true,
  });

  cluster.addDefaultCapacityProviderStrategy([
    { capacityProvider: "FARGATE_SPOT", weight: 1 },
    { capacityProvider: "FARGATE", weight: 0, base: 0 },
  ]);

  const ttsTaskDef = createTtsTaskDef(stack, {
    id: "TtsWorkerTaskDef",
    containerName: "tts-worker",
    ecrRepo: ttsEcrRepo,
    bucket,
    streamPrefix: "tts-worker",
  });

  const videoTaskDef = createWorkerTaskDef(stack, {
    id: "VideoWorkerTaskDef",
    containerName: "video-worker",
    ecrRepo: videoEcrRepo,
    bucket,
    streamPrefix: "video-worker",
  });

  return { cluster, ttsTaskDef, videoTaskDef };
};

type WorkerTaskDefInput = {
  readonly id: string;
  readonly containerName: string;
  readonly ecrRepo: ecr.Repository;
  readonly bucket: s3.Bucket;
  readonly streamPrefix: string;
};

const createWorkerTaskDef = (
  stack: cdk.Stack,
  input: WorkerTaskDefInput,
): ecs.FargateTaskDefinition => {
  const { id, containerName, ecrRepo, bucket, streamPrefix } = input;

  const taskDef = new ecs.FargateTaskDefinition(stack, id, {
    cpu: 2048,
    memoryLimitMiB: 4096,
  });

  bucket.grantReadWrite(taskDef.taskRole);

  taskDef.addContainer(containerName, {
    image: ecs.ContainerImage.fromEcrRepository(ecrRepo, "latest"),
    essential: true,
    environment: {
      S3_BUCKET: bucket.bucketName,
    },
    logging: ecs.LogDrivers.awsLogs({ streamPrefix }),
  });

  return taskDef;
};

const VOICEVOX_PORT = 50021;

const createTtsTaskDef = (
  stack: cdk.Stack,
  input: WorkerTaskDefInput,
): ecs.FargateTaskDefinition => {
  const { id, ecrRepo, bucket, streamPrefix } = input;

  const taskDef = new ecs.FargateTaskDefinition(stack, id, {
    cpu: 2048,
    memoryLimitMiB: 4096,
  });

  bucket.grantReadWrite(taskDef.taskRole);

  const voicevox = taskDef.addContainer("voicevox-engine", {
    image: ecs.ContainerImage.fromRegistry("voicevox/voicevox_engine:latest"),
    essential: true,
    portMappings: [{ containerPort: VOICEVOX_PORT }],
    logging: ecs.LogDrivers.awsLogs({ streamPrefix: `${streamPrefix}-voicevox` }),
    healthCheck: {
      command: ["CMD-SHELL", `curl -f http://localhost:${VOICEVOX_PORT}/version || exit 1`],
      interval: cdk.Duration.seconds(10),
      timeout: cdk.Duration.seconds(5),
      retries: 5,
      startPeriod: cdk.Duration.seconds(30),
    },
  });

  const ttsWorker = taskDef.addContainer("tts-worker", {
    image: ecs.ContainerImage.fromEcrRepository(ecrRepo, "latest"),
    essential: true,
    environment: {
      S3_BUCKET: bucket.bucketName,
      VOICEVOX_URL: `http://localhost:${VOICEVOX_PORT}`,
    },
    logging: ecs.LogDrivers.awsLogs({ streamPrefix }),
  });

  ttsWorker.addContainerDependencies({
    container: voicevox,
    condition: ecs.ContainerDependencyCondition.HEALTHY,
  });

  return taskDef;
};
