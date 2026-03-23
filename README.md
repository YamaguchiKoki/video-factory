# video-factory

ニュースラジオ動画を自動生成するパイプライン。

```
EventBridge (毎日定時)
       |
       v
Step Functions
       |
       +-> 1. Script Generator [Lambda]  ... Bedrock + Tavily でスクリプト生成
       |      -> S3 (script.json)
       |
       +-> 2. TTS Worker [ECS Fargate]   ... VOICEVOX で音声合成
       |      -> S3 (audio.wav, enriched script.json)
       |
       +-> 3. Video Worker [ECS Fargate]  ... Remotion で動画レンダリング
       |      -> S3 (video.mp4)
       |
       +-> 4. Upload [Lambda]
              -> Google Drive
```

## 前提条件

- Node.js 22+
- pnpm 10+
- Docker Desktop

## セットアップ

```bash
pnpm install
```

`.env` をプロジェクトルートに作成:

```
AWS_ACCESS_KEY_ID=<your-aws-access-key>
AWS_SECRET_ACCESS_KEY=<your-aws-secret-key>
AWS_REGION=ap-northeast-1
TAVILY_API_KEY=<your-tavily-api-key>
```

## テスト

```bash
pnpm --filter script-generator test
pnpm --filter tts-worker test
pnpm --filter video-worker test
```

## ローカル実行 (パッケージ単体)

### script-generator

Bedrock + Tavily を使ってスクリプトを生成し、stdout に出力する。

```bash
pnpm --filter script-generator run local [genre]
# 例: pnpm --filter script-generator run local technology
```

環境変数は `packages/script-generator/.env` から自動読み込み。

### tts-worker

VOICEVOX を使ってスクリプトを音声に変換する。事前に VOICEVOX を起動しておく。

```bash
# VOICEVOX を起動
docker compose up -d voicevox

# スクリプト JSON を指定して実行
pnpm --filter tts-worker run local <path/to/script.json>
```

`output/` ディレクトリに WAV と enriched JSON が出力される。

### video-worker

Remotion で動画をレンダリングする。

```bash
# モックデータで実行
pnpm --filter video-worker run render

# ファイルを指定して実行
pnpm --filter video-worker exec tsx src/entrypoints/local.ts \
  --script <path/to/script.json> \
  --audio <path/to/audio.wav> \
  --output output/video.mp4
```

Remotion Studio で UI 確認:

```bash
pnpm --filter video-worker run dev
```

## Docker + rustfs で E2E 実行

rustfs (S3 互換ストレージ) と VOICEVOX をローカルで起動し、本番同様の S3 経由パイプラインを実行する。

### 1. インフラ起動

```bash
docker compose up -d rustfs bucket-init voicevox
```

| サービス | URL | 説明 |
|---|---|---|
| rustfs API | http://localhost:9000 | S3 互換 API |
| rustfs Console | http://localhost:9001 | Web UI (rustfsadmin / rustfsadmin) |
| VOICEVOX | http://localhost:50021 | 音声合成エンジン |

`bucket-init` が `video-factory` バケットを自動作成する。

### 2. パイプラインを順番に実行

Step Functions の代わりに `docker compose run` で各ワーカーを順番に実行する。

```bash
# Step 1: スクリプト生成 -> S3: script-generator/script.json
docker compose run --rm --build script-generator

# Step 2: TTS -> S3: tts-worker/audio.wav, tts-worker/script.json
docker compose run --rm --build tts-worker

# Step 3: 動画生成 -> S3: video-worker/video.mp4
docker compose run --rm --build video-worker
```

tts-worker と video-worker は commander CLI なので、オプションでキーを変更可能:

```bash
docker compose run --rm tts-worker \
  --input-key custom/script.json \
  --output-wav-key custom/audio.wav \
  --output-script-key custom/enriched.json

docker compose run --rm video-worker \
  --script-key custom/enriched.json \
  --audio-key custom/audio.wav \
  --output-key custom/video.mp4
```

### 3. 成果物の確認

rustfs Console (http://localhost:9001) にログインして確認するか、CLI で取得:

```bash
# バケット内のファイル一覧
AWS_ACCESS_KEY_ID=rustfsadmin AWS_SECRET_ACCESS_KEY=rustfsadmin \
  aws --endpoint-url http://localhost:9000 s3 ls s3://video-factory/ --recursive

# 動画をダウンロード
AWS_ACCESS_KEY_ID=rustfsadmin AWS_SECRET_ACCESS_KEY=rustfsadmin \
  aws --endpoint-url http://localhost:9000 s3 cp s3://video-factory/video-worker/video.mp4 ./output.mp4
```

### 4. クリーンアップ

```bash
docker compose down -v   # -v でボリュームも削除
```

## プロジェクト構造

```
packages/
  script-generator/        Lambda (Docker image)
    src/
      entrypoints/
        lambda.ts          Lambda handler エントリポイント
        docker.ts          Docker compose 用エントリポイント
        local.ts           ローカル開発用
      handler.ts           コアロジック (Mastra workflow)
      cli.ts               Docker compose 用 S3 アップロード
    Dockerfile             Lambda 本番用 (AWS base image + esbuild)
    Dockerfile.dev         Docker compose 用 (node + tsx)

  tts-worker/              ECS Fargate
    src/
      entrypoints/
        docker.ts          Docker/ECS エントリポイント
        local.ts           ローカル開発用
      cli.ts               Commander CLI 定義
      pipeline.ts          音声合成パイプライン
    Dockerfile             ECS 用

  video-worker/            ECS Fargate
    src/
      entrypoints/
        docker.ts          Docker/ECS エントリポイント
        local.ts           ローカル開発用
      cli.ts               Commander CLI 定義
      service/             動画レンダリングサービス
      remotion/            Remotion コンポーネント
    Dockerfile             ECS 用
```
