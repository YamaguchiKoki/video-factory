# Deployment Guide

## CI/CD ワ��クフロー

### CI (`ci.yml`) — PR 時に実行

```
PR → main
  ├─► lint          pnpm lint (biome)
  ├─► test-packages pnpm test (vitest, 全パッケージ)
  ├─► test-infra    npm ci → tsc --noEmit → npm test (jest, infra)
  └─► cdk-synth     npm ci → cdk synth (test-infra 完了後)
```

### CD (`deploy.yml`) — main push 時に実行

```
push → main
  ├─► build-and-push (並列 x3)
  │     script-generator ──► ECR push (:latest + :$SHA)
  │     tts-worker ─────────► ECR push (:latest + :$SHA)
  │     video-worker ──────► ECR push (:latest + :$SHA)
  │
  └─► deploy-infra (build-and-push 完了後)
        cdk deploy --all -c imageTag=$SHA
```

## ローカルデプロイ

```bash
# ECR ログイン
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin 983882936274.dkr.ecr.ap-northeast-1.amazonaws.com

# イメージビルド&push（プロジェクトルートで実行）
docker buildx build --builder desktop-linux --platform linux/amd64 --provenance=false --load \
  -t 983882936274.dkr.ecr.ap-northeast-1.amazonaws.com/script-generator:latest \
  -f packages/script-generator/Dockerfile .
docker push 983882936274.dkr.ecr.ap-northeast-1.amazonaws.com/script-generator:latest

docker buildx build --builder desktop-linux --platform linux/amd64 --provenance=false --load \
  -t 983882936274.dkr.ecr.ap-northeast-1.amazonaws.com/tts-worker:latest \
  -f packages/tts-worker/Dockerfile .
docker push 983882936274.dkr.ecr.ap-northeast-1.amazonaws.com/tts-worker:latest

docker buildx build --builder desktop-linux --platform linux/amd64 --provenance=false --load \
  -t 983882936274.dkr.ecr.ap-northeast-1.amazonaws.com/video-worker:latest \
  -f packages/video-worker/Dockerfile .
docker push 983882936274.dkr.ecr.ap-northeast-1.amazonaws.com/video-worker:latest

# CDK デプロイ
cd infra
npx cdk deploy EcrStack
npx cdk deploy VideoFactoryStack
# タグ指定する場合:
npx cdk deploy VideoFactoryStack -c imageTag=<commit-sha>
```

### ローカルビルド注意事項

- **必ず `--platform linux/amd64`** を指定（Apple Silicon 対応）
- **必ず `--provenance=false`** を指定（OCI 形式だと Lambda が拒否する）
- `--builder desktop-linux` は Docker Desktop の docker ドライバーを使用（docker-container ドライバーは OCI 形式を吐くため）

---

## TODO: セットアップ

### AWS Secrets Manager

デプロイ後、以下のシークレットに値を手動設定する必要がある:

| Secret Name | 設定する値 | 備考 |
|---|---|---|
| `video-factory/tavily-api-key` | Tavily API キー | https://tavily.com で取得 |
| `video-factory/google-drive-credentials` | Google Drive 認証 JSON | サービスアカウントの credentials |

```bash
# Tavily API キー
aws secretsmanager put-secret-value \
  --secret-id video-factory/tavily-api-key \
  --secret-string "tvly-xxxxxxxxxxxxxxxx" \
  --region ap-northeast-1

# Google Drive credentials
aws secretsmanager put-secret-value \
  --secret-id video-factory/google-drive-credentials \
  --secret-string file://path/to/credentials.json \
  --region ap-northeast-1
```

### GitHub Actions OIDC + IAM ロール

GHA から AWS にアクセスするための OIDC 設定が必要。

#### 1. AWS 側: OIDC プロバイダー作成

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

#### 2. AWS 側: IAM ロール作成

信頼ポリシー (`trust-policy.json`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::983882936274:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:YamaguchiKoki/video-factory:*"
        }
      }
    }
  ]
}
```

必要な権限:
- `ecr:*` (イメージ push)
- `cloudformation:*` (CDK deploy)
- `sts:AssumeRole` (CDK lookup/deploy ロール)
- `s3:*`, `ecs:*`, `lambda:*`, `iam:*`, `events:*`, `states:*`, `logs:*`, `ec2:Describe*`, `secretsmanager:*`, `ssm:GetParameter` (CDK が作成・管理するリソース)

```bash
aws iam create-role \
  --role-name github-actions-video-factory \
  --assume-role-policy-document file://trust-policy.json

aws iam attach-role-policy \
  --role-name github-actions-video-factory \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
# ※ 本番では最小権限に絞ること
```

**注意**: 最小権限ポリシー (`github-actions-video-factory-policy`) を使う場合、
`ecr:Put*` / `ecr:*LayerUpload` 等の push 系アクションの `Resource` は
`arn:aws:ecr:ap-northeast-1:983882936274:repository/*` のワイルドカード
指定を推奨。新しいワーカーを追加するたびに個別のリポジトリ ARN を追加
する必要がなくなる。

#### 3. GitHub 側: Repository Variables 設定

Settings → Secrets and variables → Actions → Variables:

| Variable | 値 |
|---|---|
| `AWS_ACCOUNT_ID` | `983882936274` |
| `AWS_ROLE_ARN` | `arn:aws:iam::983882936274:role/github-actions-video-factory` |

### Upload Lambda 実装

現在インラインスタブのため、実装が必要:

```typescript
// 現状:
exports.handler = async (event) => { console.log(JSON.stringify(event)); return { status: "ok" }; }

// TODO: Google Drive へのアップロードロジック実装
```
