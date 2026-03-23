# video-worker

Remotion で動画をレンダリングする ECS Fargate パッケージ。

## アーキテクチャ

- **本番**: ECS Fargate — Step Functions から直接 RunTask で起動
- **CLI**: Commander.js ベース。S3 キーをオプションで指定可能
- **エントリポイント**:
  - `src/entrypoints/docker.ts` — Docker/ECS エントリポイント (Commander CLI)
  - `src/entrypoints/local.ts` — ローカル開発用 (ファイルシステム I/O)

## ローカル実行

```bash
# モックデータで実行
pnpm --filter video-worker run render

# ファイルを指定して実行
pnpm --filter video-worker exec tsx src/entrypoints/local.ts \
  --script <path/to/script.json> \
  --audio <path/to/audio.wav> \
  --output output/video.mp4
```

## Remotion Studio

UI を確認しながら開発:

```bash
pnpm --filter video-worker run dev
```

## テスト

```bash
pnpm --filter video-worker test
pnpm --filter video-worker test:watch

# 拡張テスト
pnpm --filter video-worker run test:e2e
pnpm --filter video-worker run test:fuzzing
pnpm --filter video-worker run test:all-extended
```

## Docker + rustfs (E2E)

プロジェクトルートから実行:

```bash
# 1. インフラ起動
docker compose up -d rustfs bucket-init voicevox

# 2. (script-generator → tts-worker を先に実行しておく)

# 3. 動画生成 → S3: video-worker/video.mp4
docker compose run --rm --build video-worker
```

### CLI オプション

```bash
docker compose run --rm video-worker \
  --script-key custom/enriched.json \
  --audio-key custom/audio.wav \
  --output-key custom/video.mp4
```

| オプション | デフォルト | 説明 |
|---|---|---|
| `--script-key` | `tts-worker/script.json` | enriched スクリプトの S3 キー |
| `--audio-key` | `tts-worker/audio.wav` | 入力 WAV の S3 キー |
| `--output-key` | `video-worker/video.mp4` | 出力動画の S3 キー |

## ディレクトリ構造

```
src/
  entrypoints/
    docker.ts              Docker/ECS エントリポイント
    local.ts               ローカル開発用
  core/                    純粋なビジネスロジック
  service/                 ワークフローオーケストレーション
  infrastructure/          外部依存 (Remotion, ファイルシステム, S3)
  remotion/                Remotion コンポーネント
  cli.ts                   Commander CLI 定義
```
