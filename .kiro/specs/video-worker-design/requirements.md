# Requirements Document

## Project Description (Input)
CLAUDE.md記載のアーキテクチャの設計を行おうとしている。video-workerは前段で作成したwavファイルとスクリプトを使ってremotionで動画を作成するモジュールである。video-workerの設計をまずは固めたい。video-workerの設計を行い、その結果として要求されるデータをtts-workerで生成する流れで実装を行う。そのためwavとスクリプトはモックデータで良い。

## Introduction
本ドキュメントは、Video Workerモジュールの要件を定義します。Video Workerは、TTS Workerが生成した音声ファイル(WAV)とScript Generatorが生成したスクリプト(JSON)を入力として、Remotionを使用して動画(MP4)を生成するECS Fargateベースのワーカーサービスです。

Video Workerは、自動化されたラジオ動画生成パイプラインの第3段階として機能し、Step Functionsによってオーケストレーションされ、生成された動画をS3に出力します。

## Requirements

### Requirement 1: 入力データの取得
**Objective:** As a Video Worker, I want S3から必要な入力データを取得する, so that 動画生成処理を開始できる

#### Acceptance Criteria
1. When Step Functionsから起動される, the Video Worker shall S3から音声ファイル(WAV)のパスを受け取る
2. When Step Functionsから起動される, the Video Worker shall S3からスクリプトファイル(JSON)のパスを受け取る
3. When S3パスを受け取る, the Video Worker shall 指定されたS3バケットから音声ファイルをダウンロードする
4. When S3パスを受け取る, the Video Worker shall 指定されたS3バケットからスクリプトファイルをダウンロードする
5. If 音声ファイルのダウンロードに失敗した, then the Video Worker shall エラーメッセージをログに記録し、処理を中断する
6. If スクリプトファイルのダウンロードに失敗した, then the Video Worker shall エラーメッセージをログに記録し、処理を中断する
7. The Video Worker shall ダウンロードしたファイルの整合性を検証する

### Requirement 2: スクリプトデータの解析
**Objective:** As a Video Worker, I want スクリプトファイルを解析して動画生成に必要な情報を抽出する, so that Remotionでレンダリングできる形式にデータを変換できる

#### Acceptance Criteria
1. When スクリプトファイルをダウンロードした, the Video Worker shall JSONデータをパースする
2. If JSONパースに失敗した, then the Video Worker shall エラーメッセージをログに記録し、処理を中断する
3. The Video Worker shall スクリプトに含まれる発話者情報を抽出する
4. The Video Worker shall スクリプトに含まれるテキスト内容を抽出する
5. The Video Worker shall スクリプトに含まれるタイムスタンプ情報を抽出する
6. When 必須フィールドが欠落している, the Video Worker shall バリデーションエラーをログに記録し、処理を中断する

### Requirement 3: Remotion動画レンダリング
**Objective:** As a Video Worker, I want Remotionを使用して動画をレンダリングする, so that 音声とスクリプトを同期した動画を生成できる

#### Acceptance Criteria
1. When 入力データの準備が完了した, the Video Worker shall Remotionコンポジションを初期化する
2. The Video Worker shall スクリプトデータに基づいてテキスト表示タイミングを設定する
3. The Video Worker shall 音声ファイルを動画のオーディオトラックとして統合する
4. The Video Worker shall 背景画像またはビジュアル要素を動画に追加する
5. The Video Worker shall 動画の解像度を1920x1080(フルHD)に設定する
6. The Video Worker shall 動画のフレームレートを30fpsに設定する
7. When Remotionレンダリングを実行する, the Video Worker shall MP4形式で動画をエクスポートする
8. If レンダリング中にエラーが発生した, then the Video Worker shall エラー内容をログに記録し、処理を中断する
9. While レンダリングが進行中である, the Video Worker shall 進行状況をログに出力する

### Requirement 4: 動画出力とS3アップロード
**Objective:** As a Video Worker, I want 生成した動画をS3にアップロードする, so that 後続のUploadステップがGoogle Driveへのアップロードを実行できる

#### Acceptance Criteria
1. When 動画レンダリングが完了した, the Video Worker shall 生成されたMP4ファイルの存在を確認する
2. When MP4ファイルが生成された, the Video Worker shall ファイルサイズとメタデータを検証する
3. When 動画ファイルの検証が完了した, the Video Worker shall 指定されたS3バケットにMP4ファイルをアップロードする
4. The Video Worker shall S3オブジェクトキーに日時情報を含む一意の名前を付ける
5. When S3アップロードが成功した, the Video Worker shall アップロード先のS3 URIをログに記録する
6. When S3アップロードが成功した, the Video Worker shall Step Functionsにアップロード先のS3パスを返す
7. If S3アップロードに失敗した, then the Video Worker shall リトライロジックを実行する(最大3回)
8. If リトライが全て失敗した, then the Video Worker shall エラーメッセージをログに記録し、処理を中断する

### Requirement 5: エラーハンドリングとロギング
**Objective:** As a Video Worker, I want 適切なエラーハンドリングとロギングを実装する, so that 問題発生時のトラブルシューティングとモニタリングが可能になる

#### Acceptance Criteria
1. The Video Worker shall 全ての処理ステップで構造化ログを出力する
2. The Video Worker shall エラー発生時にスタックトレースをログに記録する
3. When 処理が開始される, the Video Worker shall 開始時刻とリクエストIDをログに記録する
4. When 処理が完了する, the Video Worker shall 終了時刻と処理時間をログに記録する
5. If 致命的エラーが発生した, then the Video Worker shall エラーコードと詳細メッセージを含むエラーレスポンスを返す
6. The Video Worker shall Result型を使用してエラーを伝播する(Railway Oriented Programming)
7. The Video Worker shall 例外をスローせず、全てのエラーをResult<T, E>で表現する

### Requirement 6: ECS Fargate環境での実行
**Objective:** As a Video Worker, I want ECS Fargate環境で効率的に実行される, so that スケーラブルで運用しやすいシステムを構築できる

#### Acceptance Criteria
1. The Video Worker shall Dockerコンテナとしてパッケージ化される
2. The Video Worker shall 環境変数からS3バケット名とリージョン情報を取得する
3. The Video Worker shall 環境変数からAWS認証情報を取得する
4. The Video Worker shall FFmpegを含む必要な依存関係をコンテナイメージに含める
5. The Video Worker shall Node.js実行環境とRemotionランタイムをコンテナイメージに含める
6. The Video Worker shall Step Functionsから渡されるタスクトークンを処理する
7. When 処理が正常終了する, the Video Worker shall Step Functionsにサクセスレスポンスを送信する
8. When 処理が異常終了する, the Video Worker shall Step Functionsにフェイルレスポンスを送信する
9. The Video Worker shall コンテナの起動時間を最小化するための最適化を実装する

### Requirement 7: モックデータ対応
**Objective:** As a Developer, I want 開発段階でモックデータを使用できる, so that TTS Workerの実装を待たずにVideo Workerの開発とテストを進められる

#### Acceptance Criteria
1. The Video Worker shall モックモードをサポートする環境変数を持つ
2. When モックモードが有効である, the Video Worker shall サンプルの音声ファイル(WAV)を使用する
3. When モックモードが有効である, the Video Worker shall サンプルのスクリプトファイル(JSON)を使用する
4. The Video Worker shall モックデータのスキーマが本番データと同一である
5. Where モックモードが有効である, the Video Worker shall ローカル環境でも実行可能である

### Requirement 8: パフォーマンスとリソース管理
**Objective:** As a Video Worker, I want リソースを効率的に管理する, so that コスト効率良く動画を生成できる

#### Acceptance Criteria
1. The Video Worker shall レンダリング完了後に一時ファイルをクリーンアップする
2. The Video Worker shall メモリ使用量が4GB以内に収まるように最適化される
3. The Video Worker shall 1つの動画の生成時間が15分以内に完了する
4. When 大きなファイルを処理する, the Video Worker shall ストリーミング処理を使用してメモリ効率を向上させる
5. The Video Worker shall 並列処理が必要な場合はワーカープールパターンを使用する
