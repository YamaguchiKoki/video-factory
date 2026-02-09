# Implementation Plan

## Task Format Template

以下のフォーマットに従って実装タスクを定義します。

## Implementation Tasks

### Phase 1: Remotionコア機能（MVP）

> **重要な規約**:
> - **neverthrow**: `import { Result, ok, err, ResultAsync } from 'neverthrow'` - Railway Oriented Programming
> - **Zod**: 常に`.safeParse()`を使用。`.parse()`は禁止（throws errorでROP違反）
> - **変数宣言**: `const`のみ使用。`let`は禁止（イミュータブル原則）
> - **クラス**: 使用禁止。純粋関数とカリー化を使用
> - **テスト**: property-based testing (fast-check) を優先。`@fast-check/zod`でスキーマからarbitrary生成
> - **依存方向**: core/層は外部依存ゼロ（純粋TypeScript）。infrastructure/層がcoreに依存

- [ ] 1. Result型とコアユーティリティの実装
- [x] 1.1 (P) ドメインエラー型の定義
  - ValidationError, S3DownloadError, RenderError, FileSystemErrorの型定義
  - 各エラー型に`type`, `message`, `cause`, `context`フィールドを含める
  - エラー型のユニットテストを作成
  - _Requirements: 5.5, 5.6_

- [ ] 2. スクリプトスキーマとパーサーの実装
- [x] 2.1 (P) スクリプトデータ構造の型定義
  - `src/core/script-types.ts`に型とスキーマを作成
  - ParsedScript, Speaker, Segment, ScriptMetadataの型定義
  - VisualComponent関連の型定義（NewsListData, ConceptExplanationData, ConversationSummaryData）
  - ZodスキーマとTypeScript型の対応: `z.infer<typeof schema>`
  - スキーマベースのvalidation（`.safeParse()`のみ、`.parse()`禁止）
  - _Requirements: 2.3, 2.4, 2.5_

- [x] 2.2 ScriptParserの実装
  - `src/core/script-parser.ts`に`parseScript`関数を作成
  - JSON文字列のパース処理を実装（JSON_PARSE_ERRORのハンドリング）
  - 必須フィールドの検証（speakers, segments, metadata）
  - タイムスタンプの整合性検証（startTime < endTime、重複なし）
  - speakerIdの参照整合性検証（segments[].speakerIdがspeakers[].idに存在）
  - セグメントのstartTime昇順ソート処理
  - _Requirements: 2.1, 2.2, 2.6_

- [x] 2.3 ScriptParserのユニットテスト
  - `src/core/script-parser.test.ts`にテストを作成（co-located）
  - 有効なスクリプトのパース成功ケース
  - 不正なJSON形式のエラーハンドリング
  - 必須フィールド欠落のエラーハンドリング
  - タイムスタンプ重複・逆転のエラーハンドリング
  - 存在しないspeakerIdのエラーハンドリング
  - **property-based testing**: fast-checkでランダム入力生成、`@fast-check/zod`でスキーマ連携
  - ファジングによる不変条件の検証（セグメント順序保証、重複なしなど）
  - _Requirements: 2.1, 2.2, 2.6_

- [ ] 3. RenderConfig構築関数の実装
- [x] 3.1 (P) buildRenderConfig関数の作成
  - `src/core/render-config.ts`に`buildRenderConfig`関数を実装
  - ParsedScriptとaudioPathからRenderConfigを構築
  - 純粋関数（副作用なし、外部依存なし）
  - composition設定（width: 1920, height: 1080, fps: 30）
  - durationInFramesの計算（`const durationInFrames = durationSeconds * fps`）
  - コーデック設定（h264, CRF 23, imageFormat: "jpeg"）
  - タイムアウト設定（timeoutInMilliseconds: 900000）
  - 並列処理設定（concurrency: 2, enableMultiProcessOnLinux: true）
  - Result型でエラーハンドリング（durationSeconds <= 0など）
  - _Requirements: 3.4, 3.5, 3.6, 3.7_

- [x] 3.2 (P) buildRenderConfig関数のユニットテスト
  - `src/core/render-config.test.ts`にテストを作成
  - 有効なスクリプトからの正しいRenderConfig生成
  - durationInFramesの正確な計算検証（fps * seconds）
  - durationSecondsが0以下の場合のエラーハンドリング
  - **property-based testing**: ランダムなdurationSecondsで計算式の不変条件検証
  - 極端に長い動画（60分以上）の警告検証（logger依存の場合はモック）
  - _Requirements: 3.4, 3.5, 3.6, 3.7_

- [ ] 4. ファイルシステム操作の実装
- [x] 4.1 (P) ファイルシステム基本操作関数の実装
  - `src/infrastructure/file-system.ts`にファイル操作関数を作成（infrastructure層）
  - `readFile(path: string): ResultAsync<Buffer, FileSystemError>`の実装
  - `writeFile(path: string, data: Buffer): ResultAsync<void, FileSystemError>`の実装
  - `fileExists(path: string): ResultAsync<boolean, FileSystemError>`の実装
  - Node.js `fs/promises`をneverthrowで wrap: `ResultAsync.fromPromise()`
  - FileSystemErrorの詳細なエラーメッセージとコンテキスト
  - 変数宣言は`const`のみ（`let`禁止）
  - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7_

- [x] 4.2 (P) 一時ファイル管理関数の実装
  - `src/infrastructure/temp-file.ts`に一時ファイル管理関数を作成
  - `createTempDir(): ResultAsync<string, FileSystemError>`の実装（`/tmp/video-worker-${uuid}`形式）
  - `cleanupTempDir(path: string): ResultAsync<void, FileSystemError>`の実装（再帰的削除）
  - Node.js `fs.rm(path, { recursive: true, force: true })`で実装
  - ディスク容量監視: `fs.statfs()`で空き容量チェック、1GB未満で警告ログ
  - 冪等性保証（cleanupTempDirの複数回呼び出しが安全、存在しないパスもok）
  - UUIDは外部ライブラリまたは`crypto.randomUUID()`
  - _Requirements: 8.1_

- [x] 4.3 ファイルシステム関数のユニットテスト
  - `src/infrastructure/file-system.test.ts`, `temp-file.test.ts`にテストを作成
  - ファイル読み込み・書き込みの正常系テスト
  - ファイル未存在時のエラーハンドリング（Result.isErr()検証）
  - 権限不足時のエラーハンドリング
  - 一時ディレクトリ作成とクリーンアップの検証
  - cleanupTempDirの冪等性テスト（2回呼び出してもエラーなし）
  - テストで実ファイル操作する場合は`os.tmpdir()`配下で実施
  - _Requirements: 1.5, 1.6, 8.1_

- [x] 5. Remotionレンダラーの実装
- [x] 5.1 renderVideo関数の作成
  - `src/infrastructure/remotion-renderer.ts`に`renderVideo`関数を実装（infrastructure層）
  - @remotion/rendererの`renderMedia()`をneverthrowでwrap
  - `renderVideo(config: RenderConfig): ResultAsync<string, RenderError>`
  - RenderConfigから`renderMedia()`パラメータへの変換
  - 一時ディレクトリへのMP4出力パス生成: `${tmpDir}/output-${Date.now()}.mp4`
  - タイムアウト監視: Promise.raceまたはAbortSignalで15分制限
  - レンダリング中止時のリソースクリーンアップ（一時ファイル削除）
  - エラーはRenderErrorに変換してResult.Err
  - ログ必要ならカリー化: `createRenderVideo(logger: Logger) => (config) => ResultAsync<...>`
  - _Requirements: 3.1, 3.2, 3.3, 3.8, 8.3_

- [x] 5.2 レンダリング進行状況のログ出力
  - `renderMedia()`の`onProgress`コールバックで進行状況取得
  - 10%ごとの進行状況ログ出力（例: "Rendering: 30% (450/1500 frames)"）
  - メモリ使用量の監視: `process.memoryUsage().heapUsed`で4GB接近時に警告
  - レンダリング時間の監視: `Date.now()`で開始/終了時刻記録、経過時間をログ
  - logger依存はカリー化で注入（`createRenderVideo(logger)`）
  - `let`は使わず、`const`でクロージャ変数を管理
  - _Requirements: 3.9, 8.2_

- [x] 5.3 renderVideo関数のユニットテスト（モック使用）
  - `src/infrastructure/remotion-renderer.test.ts`にテストを作成
  - `renderMedia()`をvi.fn()でモック化
  - 正常系: モックが成功Promiseを返す、Result.isOk()検証
  - タイムアウトエラー: 15分超過でRenderErrorに変換、Result.isErr()検証
  - レンダリング失敗: モックがthrowした場合のエラー変換検証
  - onProgressコールバック: モックから呼び出され、ログ関数が正しく呼ばれる検証
  - メモリ監視: `process.memoryUsage`をモックして警告ログ検証
  - _Requirements: 3.8, 3.9, 8.2, 8.3_

- [ ] 6. Remotionビデオコンポーネントの実装

> **重要**: このセクションの実装時は `.claude/skills/remotion-best-practices` を参照すること。
> - Animations, Sequencing, Timing, Transitions
> - Text animations, Measuring text, Fonts
> - Audio, Images, Videos
> - Parameters (Zod schema)
> - 参照: `.claude/skills/remotion-best-practices/SKILL.md`

- [x] 6.1 (P) AvatarComponentの実装
  - `src/components/AvatarComponent.tsx`を作成
  - Speaker型のプロップスを受け取る
  - 発話中フラグ（isActive）に応じたアニメーション（拡大1.1倍、上下動2-3px）
  - 非発話中の透明度80%
  - springアニメーションでトランジション
  - _Requirements: 3.2, 3.3_

- [x] 6.2 (P) NewsListComponentの実装
  - `src/components/NewsListComponent.tsx`を作成
  - NewsListData型のプロップスを受け取る
  - カード形式のニュースリスト表示
  - 順次表示アニメーション
  - タイトル、カテゴリ、日付の表示
  - _Requirements: 3.2, 3.3_

- [x] 6.3 (P) ConceptExplanationComponentの実装
  - `src/components/ConceptExplanationComponent.tsx`を作成
  - ConceptExplanationData型のプロップスを受け取る
  - テンプレート切り替え（bullet-points, flowchart, timeline）
  - 箇条書きテンプレートの実装
  - フローチャートテンプレートの実装
  - タイムラインテンプレートの実装
  - _Requirements: 3.2, 3.3_

- [x] 6.4 (P) ConversationSummaryComponentの実装
  - `src/components/ConversationSummaryComponent.tsx`を作成
  - ConversationSummaryData型のプロップスを受け取る
  - 要約テキストの表示
  - キーポイントの箇条書き表示
  - 重要度別ハイライト（high, medium, low）
  - _Requirements: 3.2, 3.3_

- [x] 6.5 VideoCompositionの実装
  - `src/components/VideoComposition.tsx`を作成
  - ParsedScript、audioPath、speakers配列をプロップスとして受け取る
  - 音声ファイルをオーディオトラックとして統合
  - segmentsのタイムスタンプに基づいてテキスト表示タイミングを制御
  - アバターの発話状態を制御（currentFrameとsegmentタイムスタンプから判定）
  - VisualComponentがある場合に対応コンポーネントを表示
  - 背景画像またはビジュアル要素の追加
  - _Requirements: 3.1, 3.2, 3.3_

- [x]* 6.6 Remotionコンポーネントの統合テスト
  - VideoCompositionを使用した小規模動画のレンダリングテスト
  - 各VisualComponentの表示検証
  - アバターアニメーションの動作確認
  - 音声とテキストの同期検証
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 7. Loggerの実装
- [ ] 7.1 (P) ログ出力関数の作成
  - `src/infrastructure/logger.ts`にログ出力関数を作成（infrastructure層）
  - `createLogger(requestId: string): Logger`でカリー化されたlogger関数群を返す
  - Logger型: `{ debug, info, warn, error }: (message: string, context?: Record<string, unknown>) => void`
  - JSON形式の構造化ログ出力: `{ timestamp, level, message, requestId, context }`
  - ログレベル（DEBUG, INFO, WARN, ERROR）のサポート
  - エラーログにスタックトレースを含める（Error型の場合は`error.stack`）
  - 環境変数`LOG_LEVEL`によるログレベル制御（デフォルトはINFO）
  - `console.log(JSON.stringify(logObject))`で出力（CloudWatch Logs対応）
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 7.2 (P) Logger関数のユニットテスト
  - `src/infrastructure/logger.test.ts`にテストを作成
  - `console.log`をvi.spyOn()でモック化
  - 各ログレベル（debug, info, warn, error）の出力検証
  - 構造化ログ形式の検証: JSON.parseして型チェック
  - スタックトレース出力の検証: Error渡した場合にstack含まれる
  - LOG_LEVEL環境変数の動作検証: DEBUGレベル以下がフィルタされる
  - requestIdが正しくログに含まれることの検証
  - **property-based testing**: ランダムなcontext objectで構造化ログ検証
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 8. VideoService関数の実装
- [x] 8.1 renderVideoWorkflow関数の作成
  - `src/service/video-service.ts`にワークフロー関数を作成（service層）
  - カリー化で依存注入: `createRenderWorkflow(deps: Dependencies) => (params) => ResultAsync<...>`
  - Dependencies型: `{ readFile, writeFile, parseScript, buildRenderConfig, renderVideo, createTempDir, cleanupTempDir, logger }`
  - `renderVideoWorkflow(scriptPath, audioPath, outputPath): ResultAsync<string, VideoServiceError>`
  - ワークフローステップをRailway Oriented Programmingで実装:
    - `createTempDir()` → `readFile(scriptPath)` → `parseScript()` → `readFile(audioPath)` → `buildRenderConfig()` → `renderVideo()` → `writeFile(outputPath)` → `cleanupTempDir()`
  - `ResultAsync.fromSafePromise()`または`andThen()`チェーンで実装
  - 各ステップ失敗時は早期リターン（`.mapErr()`でVideoServiceErrorに変換）
  - 一時ファイル管理: finallyパターンまたはtry-finallyでcleanupTempDir保証
  - 処理開始/終了時刻: `const startTime = Date.now()`、経過時間をログ
  - requestIDの生成: `crypto.randomUUID()`、`createLogger(requestId)`でlogger作成
  - _Requirements: 1.3, 1.4, 2.1, 3.1, 4.3, 5.3, 5.4, 8.1_

- [x] 8.2 renderVideoWorkflowのエラーハンドリング統合
  - 各ステップのエラーをVideoServiceErrorに変換
  - エラーコンテキストに関連情報を含める（ファイルパス、フレーム番号など）
  - エラー発生時の詳細ログ出力（スタックトレース含む）
  - 一時ファイルクリーンアップの保証（成功・失敗に関わらず）
  - _Requirements: 5.2, 5.5, 5.6, 5.7, 8.1_

- [x] 8.3 renderVideoWorkflowの統合テスト
  - `src/service/video-service.test.ts`にテストを作成
  - 全依存関数をvi.fn()でモック化（readFile, parseScript, renderVideoなど）
  - 正常系: 全ステップ成功、Result.isOk()、出力パス返却検証
  - ファイル読み込み失敗: readFileがErr返す、早期リターン検証
  - スクリプト検証失敗: parseScriptがErr返す、VideoServiceError変換検証
  - レンダリング失敗: renderVideoがErr返す、エラー伝播検証
  - 一時ファイルクリーンアップ: cleanupTempDirが成功/失敗両方で呼ばれる検証
  - 処理時間のログ出力: loggerモックで開始/終了ログ検証
  - **property-based testing**: ランダムなファイルパスでワークフロー実行
  - _Requirements: 5.2, 5.5, 5.6, 5.7, 8.1_

- [x] 9. CLIエントリーポイントの実装
- [x] 9.1 EntryPointの実装
  - `src/index.ts`に`main()`関数を作成
  - CLIコマンドライン引数の解析: `process.argv`またはyargs/commander
    - `--script <path>`: スクリプトJSONファイルパス
    - `--audio <path>`: 音声WAVファイルパス
    - `--output <path>`: 出力MP4ファイルパス
  - 環境変数読み込み: `LOG_LEVEL`, `MOCK_MODE`
  - 依存関数の組み立て（実関数をimportして注入）
  - `createRenderWorkflow(deps)(scriptPath, audioPath, outputPath)`実行
  - Result処理: `.match({ ok: () => process.exit(0), err: () => process.exit(1) })`
  - エラーメッセージ: `error.message`とcontextを人間可読形式で`console.error()`
  - 成功時: 出力パスを`logger.info()`でログ出力
  - _Requirements: 1.1, 1.2, 5.3, 5.4, 7.1_

- [x] 9.2 (P) モックデータ読み込み関数の実装
  - `src/infrastructure/mock-data.ts`にモックデータ読み込み関数を作成
  - `loadMockScript(): ResultAsync<string, FileSystemError>`の実装
  - `loadMockAudio(): ResultAsync<Buffer, FileSystemError>`の実装
  - 環境変数`MOCK_MODE=true`の判定: `process.env.MOCK_MODE === 'true'`
  - `/app/mock-data/script.json`, `/app/mock-data/audio.wav`から読み込み
  - `readFile()`を使って実装（FileSystemError統一）
  - モックファイル未存在時: FileSystemErrorでErr返す
  - main()で`MOCK_MODE`フラグに応じて引数パスを上書き
  - _Requirements: 7.1, 7.2, 7.3, 7.5_

- [x] 9.3 モックデータの作成
  - `mock-data/script.json`にサンプルスクリプトを作成
  - スクリプトスキーマに準拠した完全なサンプルデータ
  - 2名の発話者（AI Agent、社会人男性）
  - 3つのニュース深掘りシナリオ
  - 各VisualComponentタイプのサンプルデータを含む
  - `mock-data/audio.wav`にサンプル音声ファイルを配置（または生成）
  - _Requirements: 7.2, 7.3, 7.4_

- [x] 9.4 CLIのエンドツーエンドテスト
  - モックモードでの完全な動画生成フロー検証
  - CLI引数解析のテスト
  - 不正な引数のエラーハンドリング
  - Exit Code検証（成功時0、失敗時1）
  - 生成された動画ファイルの存在確認
  - _Requirements: 1.1, 1.2, 7.5_

- [ ] 10. システム統合とパフォーマンス検証
- [x] 10.1 完全な動画生成のエンドツーエンドテスト
  - モックデータを使用した完全な動画レンダリング
  - 生成された動画の再生確認（メディアプレーヤーで視聴）
  - 音声とテキストの同期検証
  - VisualComponentの表示確認
  - アバターアニメーションの動作確認
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 10.2 パフォーマンス要件の検証
  - メモリ使用量が4GB以内であることを検証（10分の動画）
  - レンダリング時間が15分以内であることを検証（10分の動画）
  - 動画ファイルサイズの測定（目標: 100MB以下）
  - 並列フレームレンダリング数（concurrency）の最適化検証
  - _Requirements: 8.2, 8.3, 8.4_

- [x] 10.3 エラーシナリオのエンドツーエンドテスト
  - ファイル未存在時のエラーハンドリング検証
  - 不正なスクリプト形式のエラーハンドリング検証
  - レンダリングタイムアウトのシミュレーション
  - 一時ファイルクリーンアップの検証（エラー時）
  - エラーログの出力検証
  - _Requirements: 1.5, 1.6, 2.6, 3.8, 5.2, 8.1_

- [x]* 10.4 プロパティベーステスティング
  - ランダムなスクリプトデータでのロバストネス検証
  - 極端に長いスクリプト（セグメント数5,000）での動作確認
  - 極端に短いスクリプト（1セグメント）での動作確認
  - 不正なタイムスタンプパターンのファジング
  - _Requirements: 2.6, 8.3_

- [ ] 11. ドキュメントとビルド設定の整備
- [x] 11.1 (P) package.jsonとTypeScript設定
  - package.jsonに必要な依存関係を追加（@remotion/renderer, @aws-sdk/client-s3など）
  - tsconfig.jsonの設定（strict mode、target: ES2022）
  - npm scriptsの追加（build, test, render, lint）
  - .gitignoreの設定（node_modules, dist, tmpディレクトリ）
  - _Requirements: 6.5_

- [x] 11.2 (P) READMEの作成
  - プロジェクト概要の記述
  - ローカル開発環境のセットアップ手順
  - モックモードでの動画生成手順（`npm run render`）
  - テスト実行手順（`npm test`）
  - ディレクトリ構造の説明
  - _Requirements: 7.5_

### Phase 2: AWS統合（将来実装）

以下のタスクはPhase 1完了後、Phase 2として実装予定。

- [ ] 12. S3操作関数の実装
  - `src/infrastructure/s3.ts`にS3操作関数を作成
  - @aws-sdk/client-s3を使用したS3操作
  - `downloadFromS3(uri: string, localPath: string): ResultAsync<void, S3DownloadError>`の実装
  - `uploadToS3(localPath: string, bucket: string, key: string): ResultAsync<string, S3UploadError>`の実装
  - `generateOutputKey(prefix: string): string`関数の実装（日時情報含む一意キー生成）
  - S3 URI形式のバリデーション関数
  - ストリーミングダウンロード/アップロード
  - Content-MD5チェックによるファイル整合性検証
  - AWS SDK組み込みリトライロジックの活用
  - S3操作関数の統合テスト（LocalStack使用）
  - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 4.1, 4.2, 4.3, 4.4, 4.7, 4.8_

- [ ] 13. Step Functions操作関数の実装
  - `src/infrastructure/step-functions.ts`にStep Functions操作関数を作成
  - @aws-sdk/client-sfnを使用したStep Functions操作
  - `sendTaskSuccess(taskToken: string, output: unknown): ResultAsync<void, StepFunctionsError>`の実装
  - `sendTaskFailure(taskToken: string, error: Error): ResultAsync<void, StepFunctionsError>`の実装
  - タスクトークン検証関数
  - 構造化エラー形式への変換（error, cause, context）
  - SendTaskSuccessタイムアウト監視（30秒）
  - Step Functions操作関数のユニットテスト（モック使用）
  - _Requirements: 6.6, 6.7, 6.8_

- [ ] 14. エラー変換関数の実装
  - `src/infrastructure/error-transformer.ts`にエラー変換関数を作成
  - `transformToStepFunctionsError(error: VideoServiceError): StepFunctionsErrorFormat`の実装
  - VideoServiceErrorからStepFunctionsError形式への変換
  - エラータイプごとの適切なメッセージ生成
  - エラーコンテキストの32KB制限対応（自動切り詰め）
  - 機密情報のマスキング（S3パスのハッシュ化）
  - エラー変換関数のユニットテスト
  - _Requirements: 5.5, 5.6, 5.7_

- [ ] 15. EntryPointのStep Functions統合
  - 環境変数の読み取り（TASK_TOKEN, S3_SCRIPT_PATH, S3_AUDIO_PATH, S3_OUTPUT_BUCKET, AWS_REGION）
  - Zodスキーマによる環境変数検証
  - renderVideoWorkflow実行後のsendTaskSuccess/sendTaskFailure呼び出し
  - TASK_TOKENがnullの場合のローカルモード対応
  - Exit Code 0での終了保証（ECSタスクステータスへの影響なし）
  - 統合テスト（モックStep Functions関数使用）
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

### コーディング規約（必須）

- **Railway Oriented Programming (neverthrow)**:
  - `import { Result, ok, err, ResultAsync } from 'neverthrow'`
  - すべてのエラー可能性のある操作はResult型を返す
  - `andThen()`, `map()`, `mapErr()`でチェーン
  - 外部ライブラリは`ResultAsync.fromPromise()`でwrap
  - **禁止**: bare try/catch、throw（Result返す関数内）

- **Zod検証**:
  - スキーマを型の単一情報源とする: `z.infer<typeof schema>`
  - **常に`.safeParse()`を使用**、`.parse()`は禁止（throws errorでROP違反）
  - safeParse結果をneverthrowのResultに変換

- **イミュータブル原則**:
  - **`const`のみ使用、`let`は禁止**
  - 配列操作: `map()`, `filter()`, `reduce()`（破壊的メソッド禁止）
  - オブジェクト更新: スプレッド演算子 `{ ...obj, field: newValue }`

- **関数型スタイル**:
  - **クラス禁止**: 純粋関数とカリー化を使用
  - 依存性注入はカリー化: `createFn(deps) => (params) => Result<...>`
  - 純粋関数優先: 副作用は最小限、外部依存なし（特にcore/層）
  - メイン関数を先に、ヘルパー関数は下部に配置

- **テスト戦略**:
  - **TDD**: Red → Green → Refactor
  - **Property-based testing優先**: fast-check + `@fast-check/zod`
  - 不変条件の検証（ソート順序、重複なし、範囲チェックなど）
  - テストファイルはco-located (`.test.ts`)

- **依存方向**:
  - `core/`層: 外部依存ゼロ（純粋TypeScript、neverthrow/zodのみ）
  - `infrastructure/`層: Node.js/AWS SDK/Remotion依存OK、coreをimport
  - `service/`層: ワークフロー組み立て、依存注入でinfrastructureを統合

### 例: カリー化による依存注入

```typescript
// Logger作成（requestId固定）
const createLogger = (requestId: string) => ({
  info: (msg: string, ctx?: Record<string, unknown>) =>
    console.log(JSON.stringify({ level: 'INFO', requestId, msg, ctx })),
  // ...
});

// ワークフロー作成（依存関数注入）
const createRenderWorkflow = (deps: {
  readFile: (path: string) => ResultAsync<Buffer, FileSystemError>,
  parseScript: (json: string) => Result<ParsedScript, ValidationError>,
  // ...
}) => (scriptPath: string, audioPath: string, outputPath: string): ResultAsync<string, VideoServiceError> => {
  // deps.readFile(), deps.parseScript() を使って実装
};
```
