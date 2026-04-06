# script-generator

Bedrock + Tavily でニュースラジオ用スクリプトを生成する Lambda パッケージ。

## アーキテクチャ

- **本番**: Lambda (Docker image) — Step Functions から呼び出し
- **エントリポイント**:
  - `src/entrypoints/lambda.ts` — Lambda handler (esbuild でバンドル)
  - `src/entrypoints/docker-runner.ts` — Docker compose 用 (S3 アップロード付き)
  - `src/entrypoints/local.ts` — ローカル開発用 (stdout 出力)

## ローカル実行

```bash
# .env を packages/script-generator/.env に作成
# AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, TAVILY_API_KEY が必要

pnpm --filter script-generator run local [genre]
# 例: pnpm --filter script-generator run local technology
```

生成されたスクリプト JSON が stdout に出力される。

## テスト

```bash
pnpm --filter script-generator test
pnpm --filter script-generator test:watch
```

## Docker + rustfs (E2E)

プロジェクトルートから実行:

```bash
# 1. インフラ起動
docker compose up -d rustfs bucket-init voicevox

# 2. スクリプト生成 → S3: script-generator/script.json
docker compose run --rm --build script-generator
```

`.env` をプロジェクトルートに配置:

```
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>
AWS_REGION=ap-northeast-1
TAVILY_API_KEY=<your-tavily-key>
```

## Dockerfile

- `Dockerfile` — Lambda 本番用 (AWS base image + esbuild バンドル)
- `Dockerfile.dev` — Docker compose 用 (node:22-slim + tsx)
