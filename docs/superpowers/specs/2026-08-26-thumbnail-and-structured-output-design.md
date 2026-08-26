# サムネイル生成の再構成と構造化出力の堅牢化

**日付**: 2026-08-26
**対象パッケージ**: `metadata-generator`, `script-generator`, `shared`

## 背景

日次パイプラインが継続的に失敗している。CloudWatch Logs を調査して2つの独立した原因を特定した。

### 原因1: サムネイル生成モデルの Legacy 化

`metadata-generator` は `amazon.nova-canvas-v1:0` でサムネイルを生成している。このモデルは Bedrock 上で **LEGACY** に変わっており、30日以上使っていないアカウントからは呼べない。

```
Access denied. This Model is marked by provider as Legacy and you have not been
actively using the model in the last 30 days. Please upgrade to an active model
on Amazon Bedrock
```

`aws bedrock list-foundation-models` で確認した現況:

| モデル | region | lifecycle |
| --- | --- | --- |
| `amazon.nova-canvas-v1:0` | us-east-1 | LEGACY |
| `stability.stable-image-core-v1:1` | us-west-2 | ACTIVE |
| `stability.stable-image-ultra-v1:1` | us-west-2 | ACTIVE |
| `stability.sd3-5-large-v1:0` | us-west-2 | ACTIVE |
| `us.anthropic.claude-sonnet-4-5-20250929-v1:0` | - | ACTIVE |

us-east-1 に ACTIVE な text-to-image モデルは存在しない。テキストモデルは影響を受けていない。

### 原因2: 構造化出力の不安定さ

`script-generator` のワークフローで、Mastra の `structuredOutput` が2つの形で失敗している。どちらも実ログで確認済み。

**形態A — `response.object` が `undefined`**

`topic-selection` ステップが `response.object` を無検証で返しており、`undefined` がそのまま `.foreach()` に渡って `@mastra/core` 内部で落ちる。

```
TypeError: Cannot read properties of undefined (reading 'length')
    at executeForeach (file:///var/task/lambda.mjs:207013:36)
```

`@mastra/core@1.3.0` の `executeForeach` は `for (let i = 0; i < prevOutput.length; i += concurrency)` で前ステップの出力を直接走査するため、`undefined` を渡すと即座に TypeError になる。2026-08-17 以降の全実行がこの形で失敗している。

**形態B — 正しい JSON が `$schema` キーに包まれる**

`dialogue-script-generator` ステップで、モデルが生成した JSON 全体が文字列化され単一キーのオブジェクトに包まれて返る。

```json
{"$schema": "{\"title\":\"...\",\"newsItems\":[...],\"sections\":[...]}"}
```

失敗時の生データ（7221文字）を取り出して確認したところ、**中身は完全で末尾も欠けていない**。トークン切れでもスキーマ複雑度の問題でもなく、ラップ事故である。

### スコープ外

- Google Drive へのアップロード（`UploadLambda` は現在スタブ）
- 概要欄・初コメの `.txt` 化
- ECS ロググループの保持期間設定

これらは別 spec で扱う。

## 設計1: サムネイル生成の再構成

### 方針

拡散モデルは日本語を正しく描けない。「背景画像の生成」と「日本語テキストの合成」を分離し、テキストは決定論的に描画する。

```
generateThumbnail(script)
  ├─ background : Bedrock stability.stable-image-core-v1:1 (us-west-2)
  │               文字を含まない抽象背景 PNG (16:9)
  └─ compose    : @napi-rs/canvas で 1280×720 に合成
                  背景描画 → 暗色オーバーレイ → タイトル(自動折返し) → 右下に日付
```

出力は現行と同じ `metadata-generator/thumbnail.png`（1280×720 PNG、YouTube サムネイル標準サイズ）。

### AI SDK を経由しない理由

`@ai-sdk/amazon-bedrock` の `imageModel()` は Nova Canvas 専用実装である。`src/bedrock-image-model.ts` を読むと、リクエストボディを以下に固定して組み立てている。

```ts
args = {
  taskType: 'TEXT_IMAGE',
  textToImageParams: { text: prompt, ... },
  imageGenerationConfig,
}
```

Stability 系は `{prompt, mode, aspect_ratio, output_format, seed}` という別形式を取るため、モデル ID を差し替えるだけでは動かない。型定義も `BedrockImageModelId = 'amazon.nova-canvas-v1:0' | (string & {})` であり、最新の 5.0.62 でも同じ（`AmazonBedrockImageModelId`、リクエスト組み立ても Nova Canvas 固定）。

よって画像モデルの呼び出しのみ `@aws-sdk/client-bedrock-runtime` の `InvokeModel` を直接使う。**テキスト生成（Mastra + `bedrock()`）は一切変更しない。**

自作の `ImageModelV3` アダプタで `generateImage()` の I/F を維持する案も検討したが、SigV4 署名のため結局内部で `@aws-sdk/client-bedrock-runtime` を呼ぶことになり、「直接呼び出し ＋ アダプタ層」という構造になる。呼び出し箇所が1つしかないため抽象化の対価が小さく、一方 AI SDK 側の仕様変更（v3 → v4）への追従コストは確実に発生するため採用しない。

### モジュール構成

| ファイル | 責務 | 依存 |
| --- | --- | --- |
| `src/infrastructure/bedrock-image.ts` | `InvokeModel` を叩き base64 文字列を返すだけ | `@aws-sdk/client-bedrock-runtime`（新規追加） |
| `src/generators/thumbnail/background.ts` | プロンプト組み立て＋背景取得 | 上を DI で受ける |
| `src/generators/thumbnail/compose.ts` | **純粋関数** `(背景Buffer, title, date) => PNG Buffer` | `@napi-rs/canvas` のみ |
| `src/generators/thumbnail/index.ts` | 上2つを合成し `ThumbnailResult` を返す | `effect` |

既存の `src/generators/thumbnail.ts` は `src/generators/thumbnail/` ディレクトリに置き換える。公開 I/F（`generateThumbnail`, `ThumbnailGenerationError`, `ThumbnailResult`）は変えないため、`pipeline/generate-metadata.ts` 側の変更は不要。

依存性注入はカリー化で行う（`CLAUDE.md` の方針どおり）。

```ts
export const invokeImageModel =
  (client: BedrockRuntimeClient) =>
  (modelId: string, body: unknown): Effect.Effect<string, BedrockImageError> => ...
```

### 描画仕様

- キャンバス: 1280×720
- 背景: 取得した PNG を `cover` 相当でリサイズ描画
- オーバーレイ: 黒 40% の矩形を全面に重ね、文字のコントラストを確保
- タイトル: `script.title` を中央寄せ。フォントサイズは 72px から開始し、3行に収まるまで 4px ずつ縮小（下限 40px）。それでも収まらない場合は3行目の末尾を `…` で切る
- 日付: 右下に 32px。Lambda 実行時刻を JST で `2026年8月26日` 形式に整形（`Script` に日付フィールドが無いため）
- フォント: Noto Sans JP (OFL)。`packages/metadata-generator/assets/NotoSansJP-Bold.ttf` を同梱し `GlobalFonts.registerFromPath()` で登録

### Docker

`@napi-rs/canvas` はネイティブバイナリを含むため esbuild でバンドルできない。

- ビルドステージ: esbuild に `--external:@napi-rs/canvas` を追加
- ランタイムステージ: `node_modules/@napi-rs/canvas` と `assets/` を `${LAMBDA_TASK_ROOT}` にコピー

### infra

変更不要。`bedrockInvokePolicy()` は既に `arn:aws:bedrock:us-west-2::foundation-model/*` を許可している。環境変数も追加せず、モデル ID とリージョンはコード定数とする。

### テスト

- `compose.ts`: 実際に PNG を生成し、寸法と PNG シグネチャを検証。長文・空文字・改行・絵文字入りのタイトルを `@fast-check/vitest` で投げる property test。不変条件は「どんなタイトル文字列でも 1280×720 の有効な PNG が返り、例外を投げない」
- `background.ts`: `BedrockRuntimeClient` を注入して差し替え。成功時に base64 を返すこと、Bedrock 例外が `BedrockImageError` に変換されること
- `index.ts`: 背景取得と合成を両方モックし、Effect のエラー経路（背景失敗／合成失敗）を検証

## 設計2: 構造化出力の堅牢化

### 方針

純粋なコア1つと、各パッケージの流儀に合わせた薄いアダプタ2つに分ける。

```
shared/src/structured-output.ts                    純粋関数。Mastra 非依存
  └─ parseStructuredOutput(schema, raw)

script-generator/src/shared/structured-output.ts   async アダプタ
  └─ generateStructured(agent, prompt, schema, maxAttempts)

metadata-generator/src/generators/create-text-generator.ts   Effect アダプタ
  └─ 既存ファクトリの safeParse を差し替え
```

### `parseStructuredOutput`

```ts
export const parseStructuredOutput = <T>(
  schema: z.ZodType<T>,
  raw: unknown,
): Result<T, string>
```

段階的に復旧を試みる。

1. `schema.safeParse(raw)` — 成功すればそれを返す
2. `raw` が string なら `JSON.parse` して 1 に戻る
3. `raw` が「キーが1つだけのオブジェクトで、その値が string」なら、その値を取り出して 1 に戻る（形態B の復旧）
4. すべて失敗したら、最初の zod エラーメッセージを含む失敗を返す

再帰は最大2段まで。`JSON.parse` の失敗は例外にせず失敗値として扱う。

`shared` は `effect` と `zod` に既に依存しており、`@mastra/core` には依存しない。この関数は Mastra の型を一切参照しないため `shared` に置ける。

### `generateStructured`（script-generator）

```ts
export const generateStructured = <T>(
  agent: Agent,
  prompt: string,
  schema: z.ZodType<T>,
  maxAttempts = 3,
): Promise<T>
```

`agent.generate(prompt, { structuredOutput: { schema } })` を呼び、結果を `parseStructuredOutput` に通す。失敗したら再試行し、`maxAttempts` 回すべて失敗したら最後のエラーを含めて throw する（Mastra の step は throw で失敗を表現するため）。

適用先は4ステップすべて。

- `topic-selection`
- `topic-deep-dive`
- `fact-check`
- `dialogue-script-generator`

各 executor から重複した safeParse ブロックが消える。先行して `topic-selection` に入れたガードもこのヘルパーに巻き取る。

### `createTextGenerator`（metadata-generator）

既存ファクトリ内の `config.schema.safeParse(response.object)` を `parseStructuredOutput` に差し替え、同じリトライを加える。`description` と `comment` はこのファクトリ経由なので、1ファイルの変更で両方が直る。

### リトライ方針

- 回数: 3
- 待ち時間: なし。構造化の失敗は決定論的に即判明するものであり、レート制限由来の再試行は AI SDK 側が既に行っているため二重化しない
- ログ: 失敗ごとに attempt 番号と理由を `console.warn` に出力する。今回の調査で「Mastra のログが1行も出ず原因追跡に時間がかかった」ため、この観測点は必須とする

### テスト

- `parseStructuredOutput`: property test。任意の有効オブジェクトについて「素で渡す／JSON 文字列にする／単一キーに包む」の3形態がすべて同じ結果を返すことが不変条件。加えて、スキーマに合致しないデータは必ず失敗すること
- `generateStructured`: agent をモックし、以下を検証
  - 1回目がラップ形式 → 復旧して成功し、`generate` の呼び出しは1回だけ
  - 3回とも `undefined` → throw し、`generate` は3回呼ばれる
  - 1回目失敗・2回目成功 → 成功し、`generate` は2回
- 既存4ステップの spec を新しいエラーメッセージに追従させる

## この設計で解決しないこと

`response.object` が `undefined` になる根本原因は `@mastra/core` の structuring agent 側にあり、こちらからは制御できない。リトライは確率的な回復手段であって、3回とも失敗すれば日次実行は落ちる。根本対処が必要になった場合は「Mastra の `structuredOutput` を使わず、テキストで受けて自前で JSON 抽出する」方向に踏み込む必要がある。その判断は本 spec の実装後、失敗率を観測してから行う。

## デプロイ

コードのマージ後、CI がイメージをビルドし `cdk deploy` を実行する。`metadata-generator` は Dockerfile が変わるためイメージの再ビルドが必須。
