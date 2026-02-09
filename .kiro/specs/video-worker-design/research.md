# Research & Design Decisions

---
**Purpose**: 発見調査、アーキテクチャ調査、および技術設計を通知する根拠を記録します。

**Usage**:
- 発見フェーズ中の調査活動と成果を記録
- design.mdに含めるには詳細すぎる設計決定のトレードオフを文書化
- 将来の監査や再利用のための参照と証拠を提供
---

## Summary
- **Feature**: `video-worker-design`
- **Discovery Scope**: Complex Integration
- **Key Findings**:
  - Remotion v4.0.419は`@remotion/renderer`のrenderMedia() APIを通じてプログラマティックレンダリングをサポート
  - ECS FargateとStep Functionsの統合には`.waitForTaskToken`パターンでタスクトークンを使用
  - Dockerコンテナ化にはChrome Headless Shell、FFmpeg、および特定のLinux依存関係が必要
  - AWS SDK v3は型付き例外クラスによる改善されたエラーハンドリングを提供
  - Railway Oriented Programming パターンはTypeScriptのResult<T, E>型で実装可能

## Research Log

### Remotion プログラマティックレンダリング
- **Context**: Video WorkerはNode.js環境でRemotionを使用してMP4動画を生成する必要がある
- **Sources Consulted**:
  - [Remotion SSR APIs](https://www.remotion.dev/docs/ssr-node)
  - [renderMedia() API Reference](https://www.remotion.dev/docs/renderer/render-media)
  - [Remotion GitHub Repository](https://github.com/remotion-dev/remotion)
- **Findings**:
  - `@remotion/renderer`パッケージがNode.js/Bun向けのサーバーサイドレンダリングAPIを提供
  - `renderMedia()`関数が推奨API（`renderFrames()`と`stitchFramesToVideo()`を1ステップに統合）
  - 利用可能なコーデック: "h264", "h265", "vp8", "vp9", "mp3", "aac", "wav", "prores", "h264-mkv", "gif"
  - 解像度とフレームレートは`composition`オブジェクトを通じて設定可能
  - `onProgress`コールバックでレンダリング進行状況の追跡をサポート
  - `cancelSignal`でレンダリングのキャンセルをサポート
  - `timeoutInMilliseconds`でタイムアウト制御（デフォルト30秒）
- **Implications**:
  - Remotion v4.0.419の使用を継続
  - h264コーデックを動画出力に使用
  - サービス層で`renderMedia()`をラップしてエラーハンドリングと進行状況ログを統合
  - タイムアウトを15分（900,000ms）に設定してRequirement 8.3に対応

### ECS Fargate + Step Functions統合
- **Context**: Video Workerは長時間実行タスクとしてStep Functionsによってオーケストレーションされる
- **Sources Consulted**:
  - [AWS Step Functions ECS Integration](https://docs.aws.amazon.com/step-functions/latest/dg/connect-ecs.html)
  - [Step Functions Callback Pattern](https://docs.aws.amazon.com/step-functions/latest/dg/connect-to-resource.html)
  - [ECS Fargate Integration Article](https://medium.com/@yiqun.rong2/ecs-fargate-for-on-demand-long-running-task-and-its-integration-with-step-functions-50353fdb56fe)
- **Findings**:
  - タスクトークンパターン用のリソースARN: `arn:aws:states:::ecs:runTask.waitForTaskToken`
  - タスクトークンは`$$.Task.Token`を通じて環境変数としてコンテナに渡される
  - コンテナはAWS SDK経由で`SendTaskSuccess`または`SendTaskFailure`を呼び出す必要がある
  - Step Functionsはタスクトークンが返されるまで最大1年間待機可能
  - Fargate起動タイプには`NetworkConfiguration`が必要
- **Implications**:
  - 環境変数`TASK_TOKEN`をStep Functionsから受信
  - AWS SDK v3の`@aws-sdk/client-sfn`を使用してタスク完了を通知
  - 正常完了時に`SendTaskSuccess`でS3 URIを返す
  - エラー時に`SendTaskFailure`でエラー詳細を返す
  - タスクトークン処理ロジックを中央エントリーポイントに配置

### Docker コンテナ化要件
- **Context**: Video WorkerをECS Fargateにデプロイするには適切にコンテナ化されたRemotionランタイムが必要
- **Sources Consulted**:
  - [Remotion Docker Guide](https://v3.remotion.dev/docs/docker)
  - [Chrome Headless Shell Documentation](https://www.remotion.dev/docs/miscellaneous/chrome-headless-shell)
  - [Remotion Docker Template Blog](https://www.scotthavird.com/blog/remotion-docker-template/)
  - [FFmpeg Installation Guide](https://www.remotion.dev/docs/ffmpeg)
- **Findings**:
  - Debianベースイメージが推奨（パッケージの安定性）
  - Chrome Headless Shellは`npx remotion browser ensure`でインストール
  - 必要なChrome依存関係: libnss3, libdbus-1-3, libatk1.0-0, libgbm-dev, libasound2
  - Remotion v4.0は軽量FFmpegをバンドル（追加インストール不要）
  - `enableMultiProcessOnLinux: true`でマルチコアパフォーマンス向上
  - セキュリティのため非rootユーザー実行が推奨
  - バージョンピニングは推奨されない（古いパッケージは削除される）
- **Implications**:
  - Debian 12 (bookworm) slimをベースイメージとして使用
  - マルチステージビルドでイメージサイズを最適化
  - 必要なChrome依存関係をインストール
  - `PUPPETEER_EXECUTABLE_PATH`環境変数を設定
  - レンダリング設定で`enableMultiProcessOnLinux: true`を有効化
  - 一時ファイル用に書き込み可能なディレクトリを確保

### AWS SDK v3 S3 操作
- **Context**: Video WorkerはS3から入力ファイルをダウンロードし、出力動画をアップロードする必要がある
- **Sources Consulted**:
  - [AWS SDK v3 Error Handling](https://github.com/aws/aws-sdk-js-v3/blob/main/supplemental-docs/ERROR_HANDLING.md)
  - [S3 Client Documentation](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-client-s3/)
  - [AWS SDK v3 S3 Stream Operations](https://medium.com/@v1shva/uploading-downloading-files-using-aws-s3-sdk-v3-javascript-typescript-as-a-stream-and-processing-42ba07bb892c)
- **Findings**:
  - AWS SDK v3は型付きサービス例外を提供（例: `S3ServiceException`）
  - `GetObjectCommand`でダウンロード、`PutObjectCommand`でアップロード
  - ストリーミング処理により大きなファイルのメモリ効率が向上
  - SDKはリトライロジックを組み込み（設定可能）
  - エラーは`$metadata`、`name`、`$fault`プロパティを含む
  - TypeScriptの型推論により例外型のオートコンプリートが可能
- **Implications**:
  - `@aws-sdk/client-s3`の最新バージョンを使用
  - S3操作をResult<T, E>でラップしてRailway Oriented Programmingパターンに従う
  - ストリーミングダウンロードを実装してメモリ使用量を削減
  - リトライロジックをSDKのデフォルトに依存（最大3回試行）
  - S3例外を具体的にキャッチしてドメインエラー型にマップ

### TypeScript Result型パターン
- **Context**: プロジェクトのコーディング標準はRailway Oriented Programmingを要求している
- **Sources Consulted**:
  - [Railway Oriented Programming (F# for fun and profit)](https://fsharpforfunandprofit.com/rop/)
  - [TypeScript Error Handling with Result Types](https://typescript.tv/best-practices/error-handling-with-result-types/)
  - [neverthrow library](https://github.com/supermacro/neverthrow)
  - [Result Composition and Error Handling](https://patrickroza.com/blog/result-composition-and-error-handling/)
- **Findings**:
  - Result型は`{ ok: true, data: T }`または`{ ok: false, error: E }`の識別可能なユニオン
  - ライブラリ: neverthrow（Rustスタイル）、ts-railway（ROPフレーバー）、fp-ts
  - Promiseと異なり、Result型は失敗パスも型強制する
  - チェーン可能な操作（map、flatMap/andThen、match）をサポート
  - TypeScriptコンパイラは無視された結果を強制できない（ESLintルールが必要）
- **Implications**:
  - カスタムResult<T, E>型を定義（軽量、依存関係なし）
  - すべての非自明な操作をResult型を返すように実装
  - `try/catch`を避け、エラーを明示的にResult値として伝播
  - ドメインエラー型を定義（例: `S3DownloadError`, `RenderError`, `ValidationError`）
  - ユーティリティ関数を提供: `ok()`, `err()`, `map()`, `flatMap()`, `match()`

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Layered Architecture | プレゼンテーション、アプリケーション、ドメイン、インフラストラクチャ層 | シンプル、理解しやすい | 層の境界が曖昧になる可能性 | 単一ワーカーサービスには過剰 |
| Hexagonal (Ports & Adapters) | ドメインロジックをアダプター経由で外部依存関係から分離 | テスト可能なコア、明確な境界 | 小規模サービスには過剰なボイラープレート | 将来の拡張に適している |
| Functional Core, Imperative Shell | 純粋関数コア + 副作用を持つシェル | 高いテスト容易性、推論しやすい | チーム全体の関数型プログラミング知識が必要 | Railway Oriented Programmingと整合 |
| Simple Service Layer | エントリーポイント、サービス層、インフラ層 | 最小限のボイラープレート、高速開発 | 成長に伴い複雑化の可能性 | **選択済み**: 現在のスコープに最適 |

**選択**: **Simple Service Layer** with **Functional Core principles**
- **理由**: 単一責任ワーカーサービス（動画レンダリング）には、完全なHexagonalアーキテクチャは過剰。ただし、テスト容易性のためにコアビジネスロジックを副作用から分離する。
- **実装**:
  - **エントリーポイント層**: Step Functionsタスクトークン処理、環境変数解析
  - **サービス層**: オーケストレーション、ワークフロー制御、エラー変換
  - **コア層**: 純粋なビジネスロジック（スクリプト解析、検証、レンダリング設定構築）
  - **インフラ層**: S3クライアント、Remotionレンダラー、Step Functions通知

## Design Decisions

### Decision: `Result<T, E>型の実装`
- **Context**: プロジェクトコーディング標準がRailway Oriented Programmingを要求
- **Alternatives Considered**:
  1. neverthrowライブラリの使用 — 完全機能だが外部依存関係を追加
  2. fp-tsライブラリの使用 — 強力だが学習曲線が急峻
  3. カスタムResult型の実装 — 軽量、ゼロ依存関係
- **Selected Approach**: カスタムResult型を`src/core/types/result.ts`に実装
- **Rationale**:
  - プロジェクトには最小限の外部依存関係が必要（package.jsonによる）
  - 必要な機能は限定的（ok/err、map、flatMap、match）
  - 完全な型安全性をカスタム実装で達成可能
  - 将来、必要に応じてneverthrowに移行可能（同じAPIパターン）
- **Trade-offs**:
  - メリット: ゼロ依存関係、完全コントロール、軽量
  - デメリット: 高度な組み合わせ子がない、独自のテストが必要
- **Follow-up**: ユニットテストでResult型ユーティリティを検証

### Decision: `Remotion レンダリング設定`
- **Context**: Requirement 3は1920x1080 @30fpsの動画レンダリングを指定
- **Alternatives Considered**:
  1. h264コーデック（デフォルト） — 幅広い互換性、適度なファイルサイズ
  2. h265コーデック — 優れた圧縮率だが互換性が限定的
  3. vp9コーデック — オープン標準だがレンダリングが遅い
- **Selected Approach**: h264コーデック、CRF 23、imageFormat: "jpeg"
- **Rationale**:
  - h264はGoogle Drive再生および一般的な動画プレーヤーで最高の互換性を提供
  - CRF 23は品質とファイルサイズのバランスが良い
  - JPEGフレームレンダリングはPNGよりメモリ効率が高い
- **Trade-offs**:
  - メリット: 最大互換性、予測可能なファイルサイズ
  - デメリット: h265よりファイルサイズが大きい（約30%）
- **Follow-up**: 本番ワークロードでファイルサイズを監視し、必要に応じて調整

### Decision: `タスクトークン処理戦略`
- **Context**: Step Functionsはタスクトークンで完了通知を期待
- **Alternatives Considered**:
  1. 各サービス関数内でSendTaskSuccessを呼び出す — 重複コード
  2. 中央エントリーポイントでタスクトークン処理をラップ — 単一責任
  3. ミドルウェアパターンを使用 — 柔軟だが複雑
- **Selected Approach**: 中央`main()`関数でタスクトークン処理をラップ
- **Rationale**:
  - エントリーポイントの単一責任：Step Functions統合
  - サービス層はタスクトークンを意識しない（テスト容易性向上）
  - エラーハンドリングとログの集中化
- **Trade-offs**:
  - メリット: 明確な関心の分離、テスト可能なサービス
  - デメリット: エントリーポイント層にわずかなボイラープレート
- **Follow-up**: 環境変数`TASK_TOKEN`が存在しない場合のローカル開発モードをサポート

### Decision: `モックモードの実装`
- **Context**: Requirement 7はモックデータを使用した開発をサポート
- **Alternatives Considered**:
  1. モックファイルをコンテナに焼き込む — デプロイが容易だが柔軟性がない
  2. 環境変数でモックS3パスを指定 — 柔軟だがS3依存が残る
  3. ローカルファイルシステムからの読み取りをサポート — 完全ローカル開発
- **Selected Approach**: `MOCK_MODE=true`環境変数 + ローカル`/app/mock-data/`ディレクトリ
- **Rationale**:
  - 開発者はS3なしで`docker run`でローカル実行可能
  - モックデータをリポジトリに含めてバージョン管理
  - 本番コードはモックモードを単純に無視
- **Trade-offs**:
  - メリット: 高速な開発イテレーション、S3コストなし
  - デメリット: モックモードのテストが必要
- **Follow-up**: `mock-data/`にサンプルscript.jsonとaudio.wavを追加

### Decision: `エラーレポート形式`
- **Context**: Step Functionsへの失敗レポートには構造化エラー情報が必要
- **Alternatives Considered**:
  1. プレーンテキストエラーメッセージ — 解析不可能
  2. JSONエラーオブジェクト（error, cause, context） — 構造化
  3. AWS標準エラー形式 — 冗長
- **Selected Approach**: 構造化JSONエラー: `{ error: string, cause: string, context: object }`
- **Rationale**:
  - Step Functionsログはエラーの原因を明確に表示
  - `context`フィールドにS3パス、フレーム番号などのメタデータを含む
  - CloudWatchでのクエリと分析が容易
- **Trade-offs**:
  - メリット: 構造化ログ、デバッグ可能
  - デメリット: SendTaskFailureのペイロードサイズ制限（32KB）
- **Follow-up**: エラーコンテキストが32KB制限内に収まることを確認

## Risks & Mitigations

- **Risk 1: Remotionレンダリングタイムアウト** — 複雑な動画が15分のタイムアウト（Requirement 8.3）を超える可能性
  - 緩和策: renderMedia()の`timeoutInMilliseconds`を900,000（15分）に設定。Step Functionsタスクタイムアウトを16分に設定してバッファを確保。レンダリング時間を監視し、必要に応じて最適化。

- **Risk 2: Dockerイメージサイズ** — Chrome依存関係によりイメージが大きくなり、ECS起動が遅くなる
  - 緩和策: マルチステージビルドを使用してビルドツールを除外。Chrome Headless Shell（Chrome for Testingより小さい）を使用。本番依存関係のみをインストール。イメージサイズ<2GBを目標。

- **Risk 3: メモリ不足** — 動画レンダリングが4GB制限（Requirement 8.2）を超える可能性
  - 緩和策: フレームレンダリングにJPEG形式を使用（PNGよりメモリ効率が高い）。並列フレーム数を制限（`concurrency: 2`）。ECS Fargateタスクで4GB RAMを割り当て、必要に応じて8GBにスケール。

- **Risk 4: S3ダウンロード失敗** — ネットワーク問題または存在しないファイル
  - 緩和策: AWS SDK組み込みリトライロジック（指数バックオフ付き最大3回）。明確なエラーメッセージでRequirement 1.5/1.6に従い失敗を迅速に報告。S3パス検証（`HeadObjectCommand`）をダウンロード前に実行。

- **Risk 5: 一時ファイルのクリーンアップ失敗** — Requirement 8.1によるディスク容量の枯渇
  - 緩和策: finally/destructorパターンで必ずクリーンアップを実行。一時ファイル用に`/tmp`ディレクトリを使用（ECSタスクの再起動時にクリアされる）。20GBのエフェメラルストレージでECS Fargateタスクを設定。

## References

### Official Documentation
- [Remotion renderMedia() API](https://www.remotion.dev/docs/renderer/render-media)
- [AWS Step Functions ECS Integration](https://docs.aws.amazon.com/step-functions/latest/dg/connect-ecs.html)
- [AWS SDK v3 Error Handling](https://github.com/aws/aws-sdk-js-v3/blob/main/supplemental-docs/ERROR_HANDLING.md)
- [Remotion Docker Guide](https://v3.remotion.dev/docs/docker)
- [Chrome Headless Shell](https://www.remotion.dev/docs/miscellaneous/chrome-headless-shell)

### Articles & Blog Posts
- [Building Scalable Video Generation with Remotion and Docker](https://www.scotthavird.com/blog/remotion-docker-template/)
- [Railway Oriented Programming](https://fsharpforfunandprofit.com/rop/)
- [TypeScript Error Handling with Result Types](https://typescript.tv/best-practices/error-handling-with-result-types/)

### Community Resources
- [Remotion GitHub Repository](https://github.com/remotion-dev/remotion)
- [AWS Step Functions ECS Fargate Process Sample](https://github.com/aws-samples/aws-stepfunctions-ecs-fargate-process)
