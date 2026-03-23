# tts-worker

VOICEVOX を使ってスクリプトを音声に変換する ECS Fargate パッケージ。

## アーキテクチャ

- **本番**: ECS Fargate — Step Functions から直接 RunTask で起動
- **CLI**: Commander.js ベース。S3 キーをオプションで指定可能
- **エントリポイント**:
  - `src/entrypoints/docker.ts` — Docker/ECS エントリポイント (Commander CLI)
  - `src/entrypoints/local.ts` — ローカル開発用 (ファイルシステム I/O)

## ローカル実行

VOICEVOX を起動してからスクリプト JSON を渡す:

```bash
# VOICEVOX 起動
docker compose up -d voicevox

# スクリプト JSON を指定して実行
pnpm --filter tts-worker run local <path/to/script.json>
```

同ディレクトリに WAV と enriched JSON が出力される。

## テスト

```bash
pnpm --filter tts-worker test
pnpm --filter tts-worker test:watch
```

## Docker + rustfs (E2E)

プロジェクトルートから実行:

```bash
# 1. インフラ起動
docker compose up -d rustfs bucket-init voicevox

# 2. (script-generator を先に実行しておく)

# 3. TTS → S3: tts-worker/audio.wav, tts-worker/script.json
docker compose run --rm --build tts-worker
```

### CLI オプション

```bash
docker compose run --rm tts-worker \
  --input-key custom/script.json \
  --output-wav-key custom/audio.wav \
  --output-script-key custom/enriched.json
```

| オプション | デフォルト | 説明 |
|---|---|---|
| `--input-key` | `script-generator/script.json` | 入力スクリプトの S3 キー |
| `--output-wav-key` | `tts-worker/audio.wav` | 出力 WAV の S3 キー |
| `--output-script-key` | `tts-worker/script.json` | enriched スクリプトの S3 キー |
