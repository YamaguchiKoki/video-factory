# Video Worker

## プロジェクト概要

Video Workerは、AI Agentと社会人の対話形式でニュースを深掘りするラジオ動画を生成するサービスです。Remotionを使用して、音声ファイル（WAV）とスクリプト（JSON）を入力として、MP4形式の動画を生成します。

**目的**: 音声とスクリプトを同期した対話型ニュース解説動画をプログラマティックに生成する。

**フェーズ**: 現在はPhase 1（MVP）として、ローカル実行可能なRemotionコア機能の実装に焦点を当てています。

### 主な機能

- **モックデータから動画生成**: WAVファイル + JSONスクリプトからMP4動画を生成
- **対話形式の動画構成**: AI AgentとXXX男性の対話を視覚化
- **Remotionコンポーネント**:
  - ニュースリスト表示
  - 概念説明テンプレート（図解 + 箇条書き）
  - 会話サマリー
  - アバター表示（静止画 + モーション効果）
- **Railway Oriented Programming**: neverthrowを使用した堅牢なエラーハンドリング

### スコープ

**Phase 1（現在のスコープ）**:
- ✅ モックデータ（WAV + JSON）から動画（MP4）を生成
- ✅ ローカル実行可能（`pnpm run dev`）
- ✅ Railway Oriented Programmingパターンに従ったエラーハンドリング
- ❌ S3連携、Step Functions統合、Docker化、ECS Fargate（Phase 2で実装予定）

## ローカル開発環境のセットアップ

### 必要なツール

- Node.js 20+ (mise経由で管理)
- pnpm 10.25.0+

### インストール

```bash
# プロジェクトルートで依存関係をインストール
pnpm install
```

### 開発コマンド

```bash
# Remotion Studioを起動（動画プレビュー）
pnpm --filter video-worker dev

# TypeScript型チェック
pnpm --filter video-worker exec tsc --noEmit

# Lintとフォーマット
pnpm --filter video-worker lint
```

## モックモードでの動画生成

モックデータを使用してローカル環境で動画を生成できます。

### モックデータ

- `mock-data/script.json`: サンプルスクリプト（2名の発話者、3つのニュース深掘りシナリオ）
- `mock-data/audio.wav`: サンプル音声ファイル

### 使用方法

```bash
# 環境変数MOCK_MODEを設定して実行
MOCK_MODE=true node dist/index.js \
  --script mock-data/script.json \
  --audio mock-data/audio.wav \
  --output output/video.mp4
```

または、CLIエントリーポイントから直接実行:

```bash
# デフォルトでモックデータを使用
pnpm --filter video-worker exec tsx src/index.ts \
  --script mock-data/script.json \
  --audio mock-data/audio.wav \
  --output output/test-video.mp4
```

## テスト実行手順

### ユニットテスト

```bash
# 全テストを実行
pnpm --filter video-worker test

# ウォッチモードでテストを実行
pnpm --filter video-worker test:watch
```

### 統合テスト・E2Eテスト

```bash
# 統合テスト（Remotionレンダリング含む）
pnpm --filter video-worker test:integration

# E2Eテスト（完全な動画生成フロー）
pnpm --filter video-worker test:e2e

# パフォーマンステスト
pnpm --filter video-worker test:perf

# エラーシナリオテスト
pnpm --filter video-worker test:errors

# ファジングテスト
pnpm --filter video-worker test:fuzzing

# 全拡張テストを実行
pnpm --filter video-worker test:all-extended
```

### プロパティベーステスト

fast-checkとzod-fast-checkを使用したプロパティベーステストを実装しています。ランダムなスクリプトデータでロバストネスを検証します。

## ディレクトリ構造

```
packages/video-worker/
  src/
    core/                      # 純粋なビジネスロジック（外部依存なし）
      errors.ts               # ドメインエラー型定義
      script-types.ts         # Zodスキーマ + 推論型
      script-parser.ts        # スクリプトJSON解析
      render-config.ts        # Remotionレンダリング設定構築
      index.ts                # コア層のパブリックAPI
      *.test.ts               # Co-locatedテスト

    service/                   # ワークフローオーケストレーション
      video-service.ts        # 動画生成ワークフロー
      video-service.test.ts

    infrastructure/            # 外部依存（Remotion、ファイルシステム）
      remotion-renderer.ts    # Remotion renderMedia() API呼び出し
      file-system.ts          # ファイル読み込み/書き込み
      temp-file.ts            # 一時ファイル管理
      logger.ts               # 構造化ログ出力
      mock-data.ts            # モックデータローダー
      *.test.ts

    components/                # Remotionコンポーネント
      VideoComposition.tsx    # メインコンポジション
      AvatarComponent.tsx     # 発話者アバター
      NewsListComponent.tsx   # ニュースリスト表示
      ConceptExplanationComponent.tsx  # 概念説明
      ConversationSummaryComponent.tsx # 会話要約
      *.test.tsx

    index.ts                   # CLIエントリーポイント
    Root.tsx                   # Remotionルートコンポジション

  mock-data/                   # サンプルデータ
    script.json               # サンプルスクリプト
    audio.wav                 # サンプル音声

  output/                      # 生成された動画（gitignore）
```

### 依存方向

- **Core層**: 外部依存ゼロ（純粋TypeScript、neverthrow/zodのみ）
- **Infrastructure層**: Node.js/Remotion依存OK、coreをimport
- **Service層**: ワークフロー組み立て、依存注入でinfrastructureを統合

## 主要な技術スタック

### コア依存関係

- **Remotion 4.0.419**: プログラマティック動画生成
- **React 19**: Remotionコンポーネント実装
- **neverthrow 8.2.0**: Railway Oriented Programmingパターン
- **Zod 3.22.3**: スキーマ検証と型推論

### 開発依存関係

- **TypeScript 5.9.3**: 型安全性（strict mode）
- **Vitest 2.1.8**: テストランナー
- **fast-check 3.23.2**: プロパティベーステスト
- **zod-fast-check 0.10.1**: Zodスキーマからarbitrary生成

## コーディング標準

### 関数型プログラミングスタイル

- 純粋関数、イミュータブルデータ、関数合成
- カリー化と部分適用による依存性注入
- パブリック関数をファイルの先頭に配置、ヘルパー関数は下部

### Railway Oriented Programming (neverthrow)

- 操作をResult返却パイプラインとしてモデル化（`Result<T, E>` / `ResultAsync<T, E>`）
- `map` / `andThen`でハッピーパスをチェーン
- `safeTry` + `yield*`で非同期パイプライン
- 外部/副作用呼び出しを`fromPromise` / `fromThrowable`でwrap
- **禁止**: Result返却関数内でのbare try/catchやthrow

### バリデーション (Zod)

- Zodスキーマをデータ型の単一情報源として使用
- TypeScript型を推論: `z.infer<typeof schema>`
- 常に`.safeParse()`を使用、neverthrowのResultに変換
- **禁止**: `.parse()`の直接使用（エラーをthrowするためROP違反）

### 型安全性

- TypeScript strict mode
- `any`型禁止
- `class`キーワード禁止（関数型アプローチ優先）
- `let`キーワード禁止（`const`のみ使用）

### テスト駆動開発 (TDD)

- Red → Green → Refactorサイクル
- プロパティベーステストを優先（fast-check + @fast-check/zod）
- すべての有効な入力に対する不変条件を定義
- ファジングでエッジケースを発見
- テストファイルはソースとco-located (`.test.ts`)

## パフォーマンス要件

| メトリック | 目標値 | 測定方法 |
|-----------|--------|----------|
| レンダリング時間 | 15分以内（10分の動画） | ログ（開始〜完了時刻） |
| メモリ使用量 | 4GB以内 | ECS Fargateタスクメトリクス |
| 動画ファイルサイズ | 100MB以下（10分の動画） | S3オブジェクトサイズ |

## Phase 2への移行（将来実装）

Phase 2では以下の機能を実装予定:

- S3からの入力取得とS3への出力アップロード
- Step Functions統合（タスクトークン処理）
- ECS Fargate対応とDocker化
- 本番環境デプロイ

現在のコア層（純粋関数）は変更なしでPhase 2に移行可能です。

## ライセンス

UNLICENSED（プライベートプロジェクト）

## 参考リンク

- [Remotion Documentation](https://www.remotion.dev/docs)
- [neverthrow (Railway Oriented Programming)](https://github.com/supermacro/neverthrow)
- [Zod (TypeScript-first schema validation)](https://zod.dev/)
