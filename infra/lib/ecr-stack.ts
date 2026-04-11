import * as ecr from "aws-cdk-lib/aws-ecr";
import * as iam from "aws-cdk-lib/aws-iam";
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

  // Lambda系リポジトリ (script-generator / metadata-generator) は、
  // VideoFactoryStack 側の `lambda.DockerImageCode.fromEcr` が CDK の自動
  // grant で resource policy に `Principal: lambda.amazonaws.com` だけを
  // 許可する statement を追加する。resource policy が存在するリポジトリに
  // 対し ECR は一部 API (BatchCheckLayerAvailability 等) で principal に
  // 含まれない caller を 403 にするため、identity-based AdministratorAccess
  // を持つ GitHub Actions ロールからの push も弾かれてしまう。
  //
  // これを解消するため、アカウント root 経由の push を明示的に許可する
  // statement を同じ policy にマージする。これにより identity policy を
  // 持つ IAM principal (= GitHub Actions ロール) からの push が通るように
  // なる。ECS系リポジトリ (tts-worker / video-worker) は ECS task role
  // 経由で identity policy のみで pull するため resource policy 自体が
  // 作られず、本 statement も不要。
  for (const repo of [scriptGeneratorEcrRepo, metadataGeneratorEcrRepo]) {
    repo.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "AllowAccountPush",
        effect: iam.Effect.ALLOW,
        principals: [new iam.AccountRootPrincipal()],
        actions: [
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:BatchCheckLayerAvailability",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
        ],
      }),
    );
  }

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
