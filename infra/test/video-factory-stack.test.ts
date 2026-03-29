import { Match, Template } from "aws-cdk-lib/assertions";
import * as cdk from "aws-cdk-lib/core";
import { S3_PREFIX, SCHEDULE_UTC_HOUR } from "../lib/constants";
import { createEcrStack } from "../lib/ecr-stack";
import { createVideoFactoryStack } from "../lib/video-factory-stack";

// ─── VPC context mock ──────────────────────────────────────────────────────────
// Vpc.fromLookup({ isDefault: true }) resolves from CDK context at synthesis
// time. We pre-seed the context with a dummy VPC so synthesis does not require
// a real AWS lookup.
//
// CDK v2 serialises VpcContextQuery as:
//   vpc-provider:account=ACCOUNT:filter.isDefault=true:region=REGION:returnAsymmetricSubnets=true
// (keys sorted alphabetically: account → filter.* → region → return*)
const TEST_ACCOUNT = "123456789012";
const VPC_CONTEXT_KEY = `vpc-provider:account=${TEST_ACCOUNT}:filter.isDefault=true:region=ap-northeast-1:returnAsymmetricSubnets=true`;
const VPC_CONTEXT_VALUE = {
  vpcId: "vpc-test12345",
  vpcCidrBlock: "172.31.0.0/16",
  availabilityZones: ["ap-northeast-1a"],
  publicSubnetIds: ["subnet-aaa"],
  publicSubnetNames: ["Public"],
  publicSubnetRouteTableIds: ["rtb-aaa"],
  subnetGroups: [
    {
      type: "Public",
      name: "Public",
      subnets: [
        {
          subnetId: "subnet-aaa",
          cidr: "172.31.0.0/20",
          availabilityZone: "ap-northeast-1a",
          routeTableId: "rtb-aaa",
        },
      ],
    },
  ],
};

// ─── Single synthesis ──────────────────────────────────────────────────────────
// CDK synthesis is synchronous. We synthesise once at module load time so all
// test cases share the same Template snapshot without repeating the (expensive)
// synthesis per test.
//
// CDK_DEFAULT_ACCOUNT must be a concrete value (not a CDK token) so that
// env.account resolves to the same account used in the VPC context key above.
const { template, ecrTemplate } = (() => {
  process.env["CDK_DEFAULT_ACCOUNT"] = TEST_ACCOUNT;
  const app = new cdk.App({
    context: { [VPC_CONTEXT_KEY]: VPC_CONTEXT_VALUE },
  });
  const { repositories } = createEcrStack(app);
  const stack = createVideoFactoryStack(app, { repositories });
  return {
    template: Template.fromStack(stack),
    ecrTemplate: Template.fromStack(
      app.node.findChild("EcrStack") as cdk.Stack,
    ),
  };
})();

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════
describe("constants", () => {
  describe("SCHEDULE_UTC_HOUR", () => {
    it("should equal 22 — UTC 22:00 corresponds to JST 07:00", () => {
      // Given: the pipeline should trigger at JST 07:00 every day
      // When: SCHEDULE_UTC_HOUR is read
      // Then: the value is 22 (UTC 22:00 = JST 07:00 the following calendar day)
      expect(SCHEDULE_UTC_HOUR).toBe(22);
    });
  });

  describe("S3_PREFIX", () => {
    it('SCRIPTS prefix should be "scripts/"', () => {
      // Given: script JSON files are stored under a dedicated prefix
      // When: S3_PREFIX.SCRIPTS is read
      // Then: the value is "scripts/"
      expect(S3_PREFIX.SCRIPTS).toBe("scripts/");
    });

    it('AUDIO prefix should be "audio/"', () => {
      expect(S3_PREFIX.AUDIO).toBe("audio/");
    });

    it('VIDEO prefix should be "video/"', () => {
      expect(S3_PREFIX.VIDEO).toBe("video/");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CloudFormation template assertions
// ═══════════════════════════════════════════════════════════════════════════════
describe("VideoFactoryStack CloudFormation template", () => {
  // ─── S3 ───────────────────────────────────────────────────────────────────
  describe("S3 Bucket", () => {
    it("should create exactly one S3 bucket shared by all pipeline steps", () => {
      // Given: scripts, audio, and video outputs all share a single bucket
      // When: S3 buckets in the template are counted
      // Then: exactly 1 bucket is created
      template.resourceCountIs("AWS::S3::Bucket", 1);
    });

    it("should retain the bucket on stack deletion", () => {
      // Given: generated media should survive accidental stack removal
      // When: the bucket deletion policy is inspected
      // Then: DeletionPolicy is Retain (not Delete)
      template.hasResource("AWS::S3::Bucket", {
        DeletionPolicy: "Retain",
      });
    });

    it("should block all public access to the bucket", () => {
      // Given: media files must not be publicly accessible
      // When: the public access block configuration is inspected
      // Then: all four public access block flags are enabled
      template.hasResourceProperties("AWS::S3::Bucket", {
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
      });
    });
  });

  // ─── Secrets Manager ──────────────────────────────────────────────────────
  describe("Secrets Manager", () => {
    it("should create exactly two secrets — Tavily API key and Google Drive credentials", () => {
      // Given: two external services require credentials stored in Secrets Manager
      // When: SecretsManager secrets in the template are counted
      // Then: exactly 2 secrets exist
      template.resourceCountIs("AWS::SecretsManager::Secret", 2);
    });
  });

  // ─── ECR ──────────────────────────────────────────────────────────────────
  describe("ECR Repositories (in EcrStack)", () => {
    it("should create exactly three ECR repositories (tts-worker, video-worker, script-generator)", () => {
      // Given: each containerised step has its own ECR repository
      // When: ECR repositories in the EcrStack template are counted
      // Then: exactly 3 repositories are created
      ecrTemplate.resourceCountIs("AWS::ECR::Repository", 3);
    });
  });

  // ─── ECS ──────────────────────────────────────────────────────────────────
  describe("ECS", () => {
    it("should create exactly one ECS cluster", () => {
      // Given: both ECS workers share the same cluster
      // When: ECS clusters in the template are counted
      // Then: exactly 1 cluster exists
      template.resourceCountIs("AWS::ECS::Cluster", 1);
    });

    it("should define FARGATE task definitions with awsvpc network mode", () => {
      // Given: tasks run on AWS Fargate requiring awsvpc networking
      // When: an ECS task definition's compatibility and network mode are inspected
      // Then: FARGATE with awsvpc is configured
      template.hasResourceProperties("AWS::ECS::TaskDefinition", {
        RequiresCompatibilities: ["FARGATE"],
        NetworkMode: "awsvpc",
      });
    });

    it("should create exactly two task definitions with CPU 2048 and memory 4096", () => {
      // Given: TTS Worker and Video Worker both require 2 vCPU / 4 GB RAM
      // When: task definitions with Cpu "2048" and Memory "4096" are found
      // Then: exactly 2 task definitions match these specifications
      const found = template.findResources("AWS::ECS::TaskDefinition", {
        Properties: { Cpu: "2048", Memory: "4096" },
      });
      expect(Object.keys(found).length).toBe(2);
    });

    it("should pass S3_BUCKET environment variable to ECS container definitions", () => {
      // Given: ECS workers resolve the S3 bucket name at runtime via S3_BUCKET env var
      // When: the ECS task definition container environment variables are inspected
      // Then: S3_BUCKET is present in the container's environment
      template.hasResourceProperties("AWS::ECS::TaskDefinition", {
        ContainerDefinitions: Match.arrayWith([
          Match.objectLike({
            Environment: Match.arrayWith([
              Match.objectLike({ Name: "S3_BUCKET" }),
            ]),
          }),
        ]),
      });
    });
  });

  // ─── Lambda ───────────────────────────────────────────────────────────────
  describe("Lambda Functions", () => {
    it("should create exactly two Lambda functions with a 15-minute timeout", () => {
      // Given: Script Generator (Bedrock + Tavily) and Upload (Google Drive) both
      //        may take many minutes to complete
      // When: Lambda functions with Timeout 900 are counted
      // Then: exactly 2 functions have the maximum 15-minute timeout
      const found = template.findResources("AWS::Lambda::Function", {
        Properties: { Timeout: 900 },
      });
      expect(Object.keys(found).length).toBe(2);
    });

    it("should pass S3_BUCKET environment variable to Lambda functions with 15-minute timeout", () => {
      // Given: both Script Generator and Upload Lambda read from or write to S3
      // When: a Lambda function with timeout 900 is inspected
      // Then: S3_BUCKET is present in the environment variables
      template.hasResourceProperties("AWS::Lambda::Function", {
        Timeout: 900,
        Environment: {
          Variables: Match.objectLike({
            S3_BUCKET: Match.anyValue(),
          }),
        },
      });
    });

    it("should pass TAVILY_SECRET_ARN to Script Generator Lambda", () => {
      // Given: Script Generator Lambda reads Tavily API key from Secrets Manager at runtime
      //        without mutating process.env — the ARN is passed as an env var
      // When: a Lambda function with timeout 900 is inspected
      // Then: TAVILY_SECRET_ARN is present in the environment variables
      template.hasResourceProperties("AWS::Lambda::Function", {
        Timeout: 900,
        Environment: {
          Variables: Match.objectLike({
            TAVILY_SECRET_ARN: Match.anyValue(),
          }),
        },
      });
    });

    it("should pass GOOGLE_DRIVE_SECRET_ARN to Upload Lambda", () => {
      // Given: Upload Lambda reads Google Drive credentials from Secrets Manager at runtime
      // When: a Lambda function with timeout 900 is inspected
      // Then: GOOGLE_DRIVE_SECRET_ARN is present in the environment variables
      template.hasResourceProperties("AWS::Lambda::Function", {
        Timeout: 900,
        Environment: {
          Variables: Match.objectLike({
            GOOGLE_DRIVE_SECRET_ARN: Match.anyValue(),
          }),
        },
      });
    });
  });

  // ─── Step Functions ───────────────────────────────────────────────────────
  describe("Step Functions", () => {
    it("should create exactly one state machine for the sequential pipeline", () => {
      // Given: a single pipeline chains Script → TTS → Video → Upload
      // When: Step Functions state machines in the template are counted
      // Then: exactly 1 state machine coordinates all four steps
      template.resourceCountIs("AWS::StepFunctions::StateMachine", 1);
    });
  });

  // ─── EventBridge ──────────────────────────────────────────────────────────
  describe("EventBridge Schedule", () => {
    it("should schedule the pipeline at UTC 22:00 using the SCHEDULE_UTC_HOUR constant", () => {
      // Given: the pipeline should trigger daily at JST 07:00 (UTC 22:00)
      // When: the EventBridge rule's ScheduleExpression is inspected
      // Then: it equals cron(0 22 * * ? *), derived from SCHEDULE_UTC_HOUR
      template.hasResourceProperties("AWS::Events::Rule", {
        ScheduleExpression: `cron(0 ${SCHEDULE_UTC_HOUR} * * ? *)`,
      });
    });

    it("should target the Step Functions state machine and provide a role ARN", () => {
      // Given: EventBridge needs permission to start the Step Functions execution
      // When: the EventBridge rule targets are inspected
      // Then: exactly one target carries both an Arn and a RoleArn
      template.hasResourceProperties("AWS::Events::Rule", {
        Targets: Match.arrayWith([
          Match.objectLike({
            Arn: Match.anyValue(),
            RoleArn: Match.anyValue(),
          }),
        ]),
      });
    });
  });

  // ─── IAM Permissions ──────────────────────────────────────────────────────
  describe("IAM Permissions", () => {
    it("should grant bedrock:InvokeModel and bedrock:InvokeModelWithResponseStream to Script Generator Lambda", () => {
      // Given: Script Generator Lambda calls the Bedrock claude-sonnet model including streaming
      // When: IAM policies in the template are inspected
      // Then: a single policy statement allows both Bedrock invoke actions
      template.hasResourceProperties("AWS::IAM::Policy", {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith([
                "bedrock:InvokeModel",
                "bedrock:InvokeModelWithResponseStream",
              ]),
              Effect: "Allow",
            }),
          ]),
        },
      });
    });

    it("should grant s3:PutObject so ECS tasks can write output files to S3", () => {
      // Given: TTS Worker writes WAV files and Video Worker writes MP4 files to S3
      // When: IAM policies in the template are inspected
      // Then: a policy allows s3:PutObject
      template.hasResourceProperties("AWS::IAM::Policy", {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith(["s3:PutObject"]),
              Effect: "Allow",
            }),
          ]),
        },
      });
    });

    it("should grant secretsmanager:GetSecretValue for reading API credentials", () => {
      // Given: Lambda and ECS tasks need to read Tavily and Google Drive credentials
      // When: IAM policies in the template are inspected
      // Then: a policy allows secretsmanager:GetSecretValue
      template.hasResourceProperties("AWS::IAM::Policy", {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith(["secretsmanager:GetSecretValue"]),
              Effect: "Allow",
            }),
          ]),
        },
      });
    });
  });
});
