# Video Factory Infrastructure

## Overview

毎日定時にラジオ風動画を自動生成するパイプライン。
EventBridge → Step Functions で 4 ステップを順次実行し、最終成果物を Google Drive へアップロードする。

```
EventBridge (毎日 JST 07:00 / UTC 22:00)
       │
       ▼
Step Functions
       │
       ├─► 1. Script Generator  [Lambda / Docker]
       │      Bedrock (Claude) + Tavily で対話型ラジオスクリプト生成
       │      → S3 (scripts/*.json)
       │
       ├─► 2. TTS Worker  [ECS Fargate / 2コンテナ]
       │      tts-worker + voicevox-engine (サイドカー)
       │      → S3 (audio/*.wav)
       │
       ├─► 3. Video Worker  [ECS Fargate]
       │      Remotion で動画レンダリング
       │      → S3 (video/*.mp4)
       │
       └─► 4. Upload  [Lambda / Node.js 22]
              → Google Drive
```

## Stacks

2スタック構成。CI/CD でイメージビルドとインフラデプロイを分離するため ECR を独立スタックに分割。

| Stack | 内容 |
|---|---|
| `EcrStack` | ECR リポジトリ 3つ |
| `VideoFactoryStack` | S3, Secrets, ECS, Lambda, Step Functions, EventBridge |

`VideoFactoryStack` は `EcrStack` に依存（`addDependency`）。

| 項目 | 値 |
|---|---|
| Region | `ap-northeast-1` |
| VPC | デフォルト VPC (fromLookup) |
| Account | `CDK_DEFAULT_ACCOUNT` 環境変数 |

---

## Resources

### S3 Bucket

| 項目 | 値 |
|---|---|
| ID | `VideoFactoryBucket` |
| Public Access | 全ブロック |
| Deletion Policy | **Retain** (スタック削除時も保持) |
| Prefixes | `scripts/`, `audio/`, `video/` |

全パイプラインステップが共有する単一バケット。

### Secrets Manager

| Secret Name | 用途 |
|---|---|
| `video-factory/tavily-api-key` | Tavily API キー (Script Generator で使用) |
| `video-factory/google-drive-credentials` | Google Drive 認証情報 (Upload で使用) |

### ECR Repositories (EcrStack)

| Repository Name | 対象 | Image Scan | emptyOnDelete | removalPolicy |
|---|---|---|---|---|
| `script-generator` | Script Generator Lambda | On Push | true | DESTROY |
| `tts-worker` | TTS Worker ECS Task | On Push | true | DESTROY |
| `video-worker` | Video Worker ECS Task | On Push | true | DESTROY |

### ECS

| 項目 | 値 |
|---|---|
| Cluster | `VideoFactoryCluster` (デフォルト VPC 上) |
| Task Definitions | 2 (TTS Worker, Video Worker) |
| Launch Type | Fargate (FARGATE_SPOT 優先、FARGATE フォールバック) |
| Network Mode | awsvpc |
| CPU | 2048 (2 vCPU) |
| Memory | 4096 MiB (4 GB) |
| Subnets | Public (assignPublicIp: true) |

#### TTS Worker Task (サイドカー構成)

| コンテナ | イメージ | Essential | 役割 |
|---|---|---|---|
| `voicevox-engine` | `voicevox/voicevox_engine:latest` | Yes | VOICEVOX API サーバー (port 50021) |
| `tts-worker` | ECR `tts-worker:latest` | Yes | VOICEVOX を localhost 経由で呼び出し |

- `tts-worker` は `voicevox-engine` が HEALTHY になってから起動
- ヘルスチェック: `curl -f http://localhost:50021/version` (10s間隔, 30s猶予, 5回リトライ)
- Logging: `tts-worker`, `tts-worker-voicevox` prefix

| 環境変数 | コンテナ | 値 |
|---|---|---|
| `S3_BUCKET` | tts-worker | バケット名 |
| `VOICEVOX_URL` | tts-worker | `http://localhost:50021` |

#### Video Worker Task (単一コンテナ)

| コンテナ | イメージ | 役割 |
|---|---|---|
| `video-worker` | ECR `video-worker:latest` | Remotion で動画レンダリング |

- Logging: `video-worker` prefix

| 環境変数 | 値 |
|---|---|
| `S3_BUCKET` | バケット名 |

### Lambda Functions

#### Script Generator Lambda

| 項目 | 値 |
|---|---|
| Type | `DockerImageFunction` (ECR: `script-generator`) |
| Timeout | 15 min (900s) |
| 環境変数 | `S3_BUCKET`, `TAVILY_SECRET_ARN` |

IAM ポリシー:
- S3 ReadWrite
- Secrets Manager GetSecretValue (Tavily)
- `bedrock:InvokeModel`, `bedrock:InvokeModelWithResponseStream` (us-east-1)

#### Upload Lambda

| 項目 | 値 |
|---|---|
| Runtime | Node.js 22.x |
| Timeout | 15 min (900s) |
| Code | 現時点はインラインスタブ (TODO: 実装差し替え) |
| 環境変数 | `S3_BUCKET`, `GOOGLE_DRIVE_SECRET_ARN` |

IAM ポリシー:
- S3 Read
- Secrets Manager GetSecretValue (Google Drive)

### Step Functions

| 項目 | 値 |
|---|---|
| State Machine | `VideoFactoryStateMachine` |
| Chain | ScriptGenerator → TTS → Video → Upload |

| Step | Type | Integration Pattern |
|---|---|---|
| ScriptGeneratorTask | LambdaInvoke | REQUEST_RESPONSE |
| TtsWorkerTask | EcsRunTask (Fargate) | RUN_JOB (完了まで待機) |
| VideoWorkerTask | EcsRunTask (Fargate) | RUN_JOB (完了まで待機) |
| UploadTask | LambdaInvoke | REQUEST_RESPONSE |

### EventBridge

| 項目 | 値 |
|---|---|
| Rule | `DailySchedule` |
| Schedule | `cron(0 22 * * ? *)` — 毎日 UTC 22:00 (JST 07:00) |
| Target | VideoFactoryStateMachine (RoleArn 付き) |

---

## IAM Permissions Summary

| Principal | Permission | Resource |
|---|---|---|
| Script Generator Lambda | S3 ReadWrite | VideoFactoryBucket |
| Script Generator Lambda | SecretsManager GetSecretValue | Tavily Secret |
| Script Generator Lambda | Bedrock InvokeModel, InvokeModelWithResponseStream | us-east-1 foundation-model/*, inference-profile/* |
| Upload Lambda | S3 Read | VideoFactoryBucket |
| Upload Lambda | SecretsManager GetSecretValue | Google Drive Secret |
| TTS Worker Task Role | S3 ReadWrite | VideoFactoryBucket |
| Video Worker Task Role | S3 ReadWrite | VideoFactoryBucket |
| EventBridge Rule | states:StartExecution | VideoFactoryStateMachine |

---

## Cost Notes

- **Fargate Spot**: タスク実行時間のみ課金 (2 vCPU / 4 GB per task, Spot で最大70%割引)
- **Lambda**: 呼び出し回数 + 実行時間課金
- **S3**: ストレージ + リクエスト課金
- **Step Functions**: 状態遷移回数課金
- **ECR**: ストレージ課金
- **Secrets Manager**: シークレット数 + API コール課金
- **EventBridge**: 1日1回のトリガーは無料枠内
