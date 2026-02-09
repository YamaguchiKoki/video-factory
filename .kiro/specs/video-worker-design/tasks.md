# Implementation Plan

## Task Format Template

以下のフォーマットに従って実装タスクを定義します。

## Implementation Tasks

### Phase 1: Remotionコア機能（MVP）

> **注記**: neverthrowライブラリは既にプロジェクトにインストールされています。実装時は直接インポートして使用してください: `import { Result, ok, err, ResultAsync } from 'neverthrow'`

- [ ] 1. Result型とコアユーティリティの実装
- [x] 1.1 (P) ドメインエラー型の定義
  - ValidationError, S3DownloadError, RenderError, FileSystemErrorの型定義
  - 各エラー型に`type`, `message`, `cause`, `context`フィールドを含める
  - エラー型のユニットテストを作成
  - _Requirements: 5.5, 5.6_

- [ ] 2. スクリプトスキーマとパーサーの実装
- [ ] 2.1 (P) スクリプトデータ構造の型定義
  - ParsedScript, Speaker, Segment, ScriptMetadataの型定義
  - VisualComponent関連の型定義（NewsListData, ConceptExplanationData, ConversationSummaryData）
  - スクリプトスキーマのZodバリデーションスキーマを作成
  - _Requirements: 2.3, 2.4, 2.5_

- [ ] 2.2 ScriptParserの実装
  - `src/core/script-parser.ts`にScriptParserクラスを作成
  - JSON文字列のパース処理を実装（JSON_PARSE_ERRORのハンドリング）
  - 必須フィールドの検証（speakers, segments, metadata）
  - タイムスタンプの整合性検証（startTime < endTime、重複なし）
  - speakerIdの参照整合性検証（segments[].speakerIdがspeakers[].idに存在）
  - セグメントのstartTime昇順ソート処理
  - _Requirements: 2.1, 2.2, 2.6_

- [ ] 2.3 ScriptParserのユニットテスト
  - 有効なスクリプトのパース成功ケース
  - 不正なJSON形式のエラーハンドリング
  - 必須フィールド欠落のエラーハンドリング
  - タイムスタンプ重複・逆転のエラーハンドリング
  - 存在しないspeakerIdのエラーハンドリング
  - プロパティベーステスティング（ファジング）によるロバストネス検証
  - _Requirements: 2.1, 2.2, 2.6_

- [ ] 3. RenderConfigBuilderの実装
- [ ] 3.1 (P) RenderConfigBuilderクラスの作成
  - `src/core/render-config-builder.ts`にRenderConfigBuilderを実装
  - ParsedScriptとaudioPathからRenderConfigを構築
  - composition設定（width: 1920, height: 1080, fps: 30）
  - durationInFramesの計算（durationSeconds * fps）
  - コーデック設定（h264, CRF 23, imageFormat: "jpeg"）
  - タイムアウト設定（timeoutInMilliseconds: 900000）
  - 並列処理設定（concurrency: 2, enableMultiProcessOnLinux: true）
  - _Requirements: 3.4, 3.5, 3.6, 3.7_

- [ ] 3.2 (P) RenderConfigBuilderのユニットテスト
  - 有効なスクリプトからの正しいRenderConfig生成
  - durationInFramesの正確な計算検証
  - durationSecondsが0の場合のエラーハンドリング
  - 極端に長い動画（60分以上）の警告ログ出力検証
  - _Requirements: 3.4, 3.5, 3.6, 3.7_

- [ ] 4. ファイルシステムクライアントの実装
- [ ] 4.1 (P) FileSystemClientの基本操作実装
  - `src/infrastructure/file-system-client.ts`にFileSystemClientクラスを作成
  - readFile()メソッドの実装（ファイル読み込み）
  - writeFile()メソッドの実装（ファイル書き込み）
  - fileExists()メソッドの実装（ファイル存在確認）
  - すべての操作をResult<T, E>でラップ
  - FileSystemErrorの詳細なエラーメッセージ
  - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7_

- [ ] 4.2 (P) TempFileManagerの実装
  - `src/infrastructure/temp-file-manager.ts`にTempFileManagerクラスを作成
  - createTempDir()メソッドの実装（/tmp/video-worker-${uuid}形式）
  - cleanup()メソッドの実装（再帰的ディレクトリ削除）
  - ディスク容量監視機能（空き容量1GB未満で警告）
  - 冪等性保証（cleanup()の複数回呼び出しが安全）
  - _Requirements: 8.1_

- [ ] 4.3 FileSystemClientとTempFileManagerのユニットテスト
  - ファイル読み込み・書き込みの正常系テスト
  - ファイル未存在時のエラーハンドリング
  - 権限不足時のエラーハンドリング
  - 一時ディレクトリ作成とクリーンアップの検証
  - cleanup()の冪等性テスト
  - _Requirements: 1.5, 1.6, 8.1_

- [ ] 5. Remotionレンダラーの実装
- [ ] 5.1 RemotionRendererクラスの作成
  - `src/infrastructure/remotion-renderer.ts`にRemotionRendererクラスを作成
  - @remotion/rendererのrenderMedia() APIを統合
  - RenderConfigからRemotionのrenderMedia()パラメータへの変換
  - 一時ディレクトリへのMP4出力パスを生成
  - タイムアウト監視機能（15分で自動キャンセル）
  - レンダリング中止時のリソースクリーンアップ
  - すべてのエラーをResult<RenderError>でラップ
  - _Requirements: 3.1, 3.2, 3.3, 3.8, 8.3_

- [ ] 5.2 レンダリング進行状況のログ出力
  - onProgressコールバックの実装
  - 10%ごとの進行状況ログ出力（例: "Rendering: 30% (450/1500 frames)"）
  - メモリ使用量の監視（4GBに近づいた場合に警告）
  - レンダリング時間の監視とログ出力
  - _Requirements: 3.9, 8.2_

- [ ] 5.3 RemotionRendererのユニットテスト（モック使用）
  - renderMedia()のモックを使用した正常系テスト
  - タイムアウトエラーのハンドリング検証
  - レンダリング失敗時のエラー変換検証
  - onProgressコールバックの呼び出し検証
  - メモリ監視機能のテスト
  - _Requirements: 3.8, 3.9, 8.2, 8.3_

- [ ] 6. Remotionビデオコンポーネントの実装
- [ ] 6.1 (P) AvatarComponentの実装
  - `src/components/AvatarComponent.tsx`を作成
  - Speaker型のプロップスを受け取る
  - 発話中フラグ（isActive）に応じたアニメーション（拡大1.1倍、上下動2-3px）
  - 非発話中の透明度80%
  - springアニメーションでトランジション
  - _Requirements: 3.2, 3.3_

- [ ] 6.2 (P) NewsListComponentの実装
  - `src/components/NewsListComponent.tsx`を作成
  - NewsListData型のプロップスを受け取る
  - カード形式のニュースリスト表示
  - 順次表示アニメーション
  - タイトル、カテゴリ、日付の表示
  - _Requirements: 3.2, 3.3_

- [ ] 6.3 (P) ConceptExplanationComponentの実装
  - `src/components/ConceptExplanationComponent.tsx`を作成
  - ConceptExplanationData型のプロップスを受け取る
  - テンプレート切り替え（bullet-points, flowchart, timeline）
  - 箇条書きテンプレートの実装
  - フローチャートテンプレートの実装
  - タイムラインテンプレートの実装
  - _Requirements: 3.2, 3.3_

- [ ] 6.4 (P) ConversationSummaryComponentの実装
  - `src/components/ConversationSummaryComponent.tsx`を作成
  - ConversationSummaryData型のプロップスを受け取る
  - 要約テキストの表示
  - キーポイントの箇条書き表示
  - 重要度別ハイライト（high, medium, low）
  - _Requirements: 3.2, 3.3_

- [ ] 6.5 VideoCompositionの実装
  - `src/components/VideoComposition.tsx`を作成
  - ParsedScript、audioPath、speakers配列をプロップスとして受け取る
  - 音声ファイルをオーディオトラックとして統合
  - segmentsのタイムスタンプに基づいてテキスト表示タイミングを制御
  - アバターの発話状態を制御（currentFrameとsegmentタイムスタンプから判定）
  - VisualComponentがある場合に対応コンポーネントを表示
  - 背景画像またはビジュアル要素の追加
  - _Requirements: 3.1, 3.2, 3.3_

- [ ]* 6.6 Remotionコンポーネントの統合テスト
  - VideoCompositionを使用した小規模動画のレンダリングテスト
  - 各VisualComponentの表示検証
  - アバターアニメーションの動作確認
  - 音声とテキストの同期検証
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 7. Loggerの実装
- [ ] 7.1 (P) Loggerクラスの作成
  - `src/infrastructure/logger.ts`にLoggerクラスを作成
  - JSON形式の構造化ログ出力（timestamp, level, message, requestId, context）
  - ログレベル（DEBUG, INFO, WARN, ERROR）のサポート
  - エラーログにスタックトレースを含める
  - 環境変数LOG_LEVELによるログレベル制御
  - すべてのログにrequestIdを含める
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 7.2 (P) Loggerのユニットテスト
  - 各ログレベルの出力検証
  - 構造化ログ形式の検証
  - スタックトレース出力の検証
  - LOG_LEVEL環境変数の動作検証
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 8. VideoServiceの実装
- [ ] 8.1 VideoServiceクラスの作成
  - `src/service/video-service.ts`にVideoServiceクラスを作成
  - renderVideo()メソッドの実装（scriptPath, audioPath, outputPathを引数）
  - ワークフローステップの順次実行（ファイル読み込み→解析→レンダリング→出力）
  - 各ステップのResult<T, E>評価とエラー時の早期リターン
  - TempFileManagerを使用した一時ファイル管理（finallyブロックでクリーンアップ）
  - 処理開始時刻・終了時刻・処理時間のログ出力
  - requestIDの生成と全ログへの付与
  - _Requirements: 1.3, 1.4, 2.1, 3.1, 4.3, 5.3, 5.4, 8.1_

- [ ] 8.2 VideoServiceのエラーハンドリング統合
  - 各ステップのエラーをVideoServiceErrorに変換
  - エラーコンテキストに関連情報を含める（ファイルパス、フレーム番号など）
  - エラー発生時の詳細ログ出力（スタックトレース含む）
  - 一時ファイルクリーンアップの保証（成功・失敗に関わらず）
  - _Requirements: 5.2, 5.5, 5.6, 5.7, 8.1_

- [ ] 8.3 VideoServiceの統合テスト
  - モックFileSystemClient、RemotionRendererを使用した全体ワークフローテスト
  - ファイル読み込み失敗時のエラーハンドリング検証
  - スクリプト検証失敗時のエラーハンドリング検証
  - レンダリング失敗時のエラーハンドリング検証
  - 一時ファイルクリーンアップの検証（成功・失敗両方）
  - 処理時間のログ出力検証
  - _Requirements: 5.2, 5.5, 5.6, 5.7, 8.1_

- [ ] 9. CLIエントリーポイントの実装
- [ ] 9.1 EntryPointの実装
  - `src/index.ts`にmain()関数を作成
  - CLIコマンドライン引数の解析（--script, --audio, --output）
  - 環境変数からの設定読み込み（LOG_LEVEL, MOCK_MODE）
  - VideoService.renderVideo()の呼び出し
  - Result<T, E>のハンドリング（成功時はExit 0、失敗時はExit 1）
  - エラーメッセージの人間が読みやすい形式での出力
  - 成功時の出力パスログ
  - _Requirements: 1.1, 1.2, 5.3, 5.4, 7.1_

- [ ] 9.2 (P) MockDataLoaderの実装
  - `src/infrastructure/mock-data-loader.ts`にMockDataLoaderクラスを作成
  - 環境変数MOCK_MODE=trueの判定
  - `/app/mock-data/`からサンプルファイルの読み込み
  - loadMockScript()とloadMockAudio()メソッドの実装
  - モックファイル未存在時のエラーハンドリング
  - _Requirements: 7.1, 7.2, 7.3, 7.5_

- [ ] 9.3 モックデータの作成
  - `mock-data/script.json`にサンプルスクリプトを作成
  - スクリプトスキーマに準拠した完全なサンプルデータ
  - 2名の発話者（AI Agent、社会人男性）
  - 3つのニュース深掘りシナリオ
  - 各VisualComponentタイプのサンプルデータを含む
  - `mock-data/audio.wav`にサンプル音声ファイルを配置（または生成）
  - _Requirements: 7.2, 7.3, 7.4_

- [ ] 9.4 CLIのエンドツーエンドテスト
  - モックモードでの完全な動画生成フロー検証
  - CLI引数解析のテスト
  - 不正な引数のエラーハンドリング
  - Exit Code検証（成功時0、失敗時1）
  - 生成された動画ファイルの存在確認
  - _Requirements: 1.1, 1.2, 7.5_

- [ ] 10. システム統合とパフォーマンス検証
- [ ] 10.1 完全な動画生成のエンドツーエンドテスト
  - モックデータを使用した完全な動画レンダリング
  - 生成された動画の再生確認（メディアプレーヤーで視聴）
  - 音声とテキストの同期検証
  - VisualComponentの表示確認
  - アバターアニメーションの動作確認
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 10.2 パフォーマンス要件の検証
  - メモリ使用量が4GB以内であることを検証（10分の動画）
  - レンダリング時間が15分以内であることを検証（10分の動画）
  - 動画ファイルサイズの測定（目標: 100MB以下）
  - 並列フレームレンダリング数（concurrency）の最適化検証
  - _Requirements: 8.2, 8.3, 8.4_

- [ ] 10.3 エラーシナリオのエンドツーエンドテスト
  - ファイル未存在時のエラーハンドリング検証
  - 不正なスクリプト形式のエラーハンドリング検証
  - レンダリングタイムアウトのシミュレーション
  - 一時ファイルクリーンアップの検証（エラー時）
  - エラーログの出力検証
  - _Requirements: 1.5, 1.6, 2.6, 3.8, 5.2, 8.1_

- [ ]* 10.4 プロパティベーステスティング
  - ランダムなスクリプトデータでのロバストネス検証
  - 極端に長いスクリプト（セグメント数5,000）での動作確認
  - 極端に短いスクリプト（1セグメント）での動作確認
  - 不正なタイムスタンプパターンのファジング
  - _Requirements: 2.6, 8.3_

- [ ] 11. ドキュメントとビルド設定の整備
- [ ] 11.1 (P) package.jsonとTypeScript設定
  - package.jsonに必要な依存関係を追加（@remotion/renderer, @aws-sdk/client-s3など）
  - tsconfig.jsonの設定（strict mode、target: ES2022）
  - npm scriptsの追加（build, test, render, lint）
  - .gitignoreの設定（node_modules, dist, tmpディレクトリ）
  - _Requirements: 6.5_

- [ ] 11.2 (P) READMEの作成
  - プロジェクト概要の記述
  - ローカル開発環境のセットアップ手順
  - モックモードでの動画生成手順（`npm run render`）
  - テスト実行手順（`npm test`）
  - ディレクトリ構造の説明
  - _Requirements: 7.5_

### Phase 2: AWS統合（将来実装）

以下のタスクはPhase 1完了後、Phase 2として実装予定。

- [ ] 12. S3クライアントの実装
  - @aws-sdk/client-s3を使用したS3Clientクラスの作成
  - download()メソッドの実装（S3からローカルへ）
  - upload()メソッドの実装（ローカルからS3へ）
  - generateOutputKey()メソッドの実装（日時情報含む一意キー生成）
  - S3 URI形式のバリデーション
  - ストリーミングダウンロード/アップロード
  - Content-MD5チェックによるファイル整合性検証
  - AWS SDK組み込みリトライロジックの活用
  - S3Clientの統合テスト（LocalStack使用）
  - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 4.1, 4.2, 4.3, 4.4, 4.7, 4.8_

- [ ] 13. Step Functionsクライアントの実装
  - @aws-sdk/client-sfnを使用したStepFunctionsClientクラスの作成
  - sendTaskSuccess()メソッドの実装
  - sendTaskFailure()メソッドの実装
  - タスクトークン検証
  - 構造化エラー形式への変換（error, cause, context）
  - SendTaskSuccessタイムアウト監視（30秒）
  - StepFunctionsClientのユニットテスト（モック使用）
  - _Requirements: 6.6, 6.7, 6.8_

- [ ] 14. ErrorHandlerの実装
  - VideoServiceErrorからStepFunctionsError形式への変換
  - エラータイプごとの適切なメッセージ生成
  - エラーコンテキストの32KB制限対応（自動切り詰め）
  - 機密情報のマスキング（S3パスのハッシュ化）
  - ErrorHandlerのユニットテスト
  - _Requirements: 5.5, 5.6, 5.7_

- [ ] 15. EntryPointのStep Functions統合
  - 環境変数の読み取り（TASK_TOKEN, S3_SCRIPT_PATH, S3_AUDIO_PATH, S3_OUTPUT_BUCKET, AWS_REGION）
  - Zodスキーマによる環境変数検証
  - VideoService実行後のSendTaskSuccess/Failure呼び出し
  - TASK_TOKENがnullの場合のローカルモード対応
  - Exit Code 0での終了保証（ECSタスクステータスへの影響なし）
  - 統合テスト（モックStep FunctionsClient使用）
  - _Requirements: 1.1, 1.2, 6.6, 6.7, 6.8_

- [ ] 16. Dockerコンテナ化
  - Dockerfileの作成（Debian 12 bookworm-slimベース）
  - マルチステージビルドの実装
  - Chrome依存関係のインストール（libnss3, libdbus-1-3など）
  - Chrome Headless Shellのインストール（`npx remotion browser ensure`）
  - 非rootユーザーの設定（videoworker）
  - モックデータのコピー（/app/mock-data/）
  - .dockerignoreの設定
  - Dockerイメージのビルドとローカルテスト
  - _Requirements: 6.1, 6.4, 6.5, 6.9_

- [ ] 17. ECS Fargate統合とデプロイ
  - ECSタスク定義の作成（CPU: 2048, Memory: 4096）
  - IAMロールの設定（S3アクセス、Step Functions通知）
  - CloudWatch Logsの設定
  - S3バケットポリシーの設定
  - Step Functionsステートマシンの統合
  - ECS Fargateでの動画生成テスト
  - 本番環境デプロイ
  - _Requirements: 6.1, 6.2, 6.3, 6.7, 6.8_

## 要件カバレッジ検証

以下の表は、すべての要件がタスクによってカバーされていることを示します。

| Requirement ID | Summary | Covered by Tasks |
|----------------|---------|------------------|
| 1.1, 1.2 | S3パス/環境変数の受信 | 9.1, 15 |
| 1.3, 1.4 | ファイル読み込み | 4.1, 8.1, 12 |
| 1.5, 1.6 | ダウンロード失敗処理 | 4.1, 4.3, 8.2, 10.3, 12 |
| 1.7 | ファイル整合性検証 | 4.1, 12 |
| 2.1, 2.2 | JSONパース | 2.2, 2.3 |
| 2.3, 2.4, 2.5 | スクリプト情報抽出 | 2.1, 2.2, 2.3 |
| 2.6 | バリデーションエラー | 2.2, 2.3, 8.2, 10.3, 10.4 |
| 3.1, 3.2, 3.3 | Remotionレンダリング | 5.1, 6.1-6.6, 8.1, 10.1 |
| 3.4, 3.5, 3.6, 3.7 | レンダリング設定 | 3.1, 3.2 |
| 3.8, 3.9 | レンダリングエラー・進行状況 | 5.1, 5.2, 5.3, 8.2, 10.3 |
| 4.1, 4.2, 4.3 | 動画検証・アップロード | 8.1, 12 |
| 4.4, 4.5, 4.6 | S3オブジェクトキー・URI返却 | 12, 15 |
| 4.7, 4.8 | アップロードリトライ | 12 |
| 5.1, 5.2, 5.3, 5.4 | 構造化ログ | 7.1, 7.2, 8.1, 9.1 |
| 5.5, 5.6, 5.7 | Result型エラーハンドリング | 1.1, 8.2, 14 |
| 6.1, 6.2, 6.3, 6.4, 6.5 | Dockerコンテナ・環境変数 | 11.1, 16, 17 |
| 6.6, 6.7, 6.8 | タスクトークン処理 | 13, 15, 17 |
| 6.9 | コンテナ起動最適化 | 16 |
| 7.1, 7.2, 7.3, 7.4, 7.5 | モックモード | 9.1, 9.2, 9.3, 9.4, 11.2 |
| 8.1 | リソース管理 | 4.2, 4.3, 8.1, 8.2, 10.3 |
| 8.2, 8.3 | メモリ・時間要件 | 5.1, 5.2, 5.3, 10.2 |
| 8.4, 8.5 | メモリ効率・並列処理 | 3.1, 10.2, 12 |

## 注記

- **Phase 1スコープ**: タスク1-11はMVP（Remotionコア機能）に焦点を当て、ローカル実行可能な動画生成システムを実装します。
- **Phase 2スコープ**: タスク12-17はAWS統合（S3、Step Functions、ECS Fargate）を実装し、本番環境デプロイを可能にします。
- **(P)マーカー**: 並列実行可能なタスクに付与。データ依存がなく、ファイル競合がないタスクのみ並列化。
- **オプショナルマーカー (*)**: Phase 1のMVP完了後に実施可能なテストタスク（6.6, 10.4）。機能実装後の包括的な検証として位置付け。
- **タスクサイズ**: 各サブタスクは1-3時間を目安に設計。複雑なタスクは複数のサブタスクに分割。
- **テスト戦略**: TDD原則に従い、各コンポーネントのユニットテストを実装後すぐに作成。統合テストとE2Eテストは各フェーズの最後に実施。
- **neverthrow使用法**: 実装時は`import { Result, ok, err, ResultAsync } from 'neverthrow'`で直接インポート。ラッパーモジュールは不要です。
