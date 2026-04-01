import type * as ecr from "aws-cdk-lib/aws-ecr";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import type * as s3 from "aws-cdk-lib/aws-s3";
import type * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as cdk from "aws-cdk-lib/core";

export type LambdaFunctions = {
  readonly scriptGeneratorLambda: lambda.IFunction;
  readonly uploadLambda: lambda.IFunction;
};

type LambdaFunctionsInput = {
  readonly bucket: s3.Bucket;
  readonly tavilySecret: secretsmanager.Secret;
  readonly googleDriveSecret: secretsmanager.Secret;
  readonly scriptGeneratorEcrRepo: ecr.Repository;
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
    imageTag,
  } = input;

  const scriptGeneratorLambda = createScriptGeneratorLambda(stack, {
    bucket,
    tavilySecret,
    scriptGeneratorEcrRepo,
    imageTag,
  });

  const uploadLambda = createUploadLambda(stack, {
    bucket,
    googleDriveSecret,
  });

  return { scriptGeneratorLambda, uploadLambda };
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

  // Bedrock calls are made to us-east-1 from this Lambda
  fn.addToRolePolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
      resources: [
        "arn:aws:bedrock:us-east-1::foundation-model/*",
        "arn:aws:bedrock:us-east-1:*:inference-profile/*",
      ],
    }),
  );

  return fn;
};

type UploadInput = {
  readonly bucket: s3.Bucket;
  readonly googleDriveSecret: secretsmanager.Secret;
};

const createUploadLambda = (
  stack: cdk.Stack,
  input: UploadInput,
): lambda.Function => {
  const { bucket, googleDriveSecret } = input;

  const fn = new lambda.Function(stack, "UploadLambda", {
    runtime: lambda.Runtime.NODEJS_22_X,
    code: lambda.Code.fromInline(
      'exports.handler = async (event) => { console.log(JSON.stringify(event)); return { status: "ok" }; }',
    ),
    handler: "index.handler",
    timeout: cdk.Duration.minutes(15),
    environment: {
      S3_BUCKET: bucket.bucketName,
      GOOGLE_DRIVE_SECRET_ARN: googleDriveSecret.secretArn,
    },
  });

  bucket.grantRead(fn);
  googleDriveSecret.grantRead(fn);

  return fn;
};
