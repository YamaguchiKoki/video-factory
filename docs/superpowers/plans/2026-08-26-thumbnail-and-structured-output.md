# サムネイル生成の再構成と構造化出力の堅牢化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** LEGACY 化した画像モデルを ACTIVE な Stability モデル＋日本語テキスト合成に置き換え、Mastra の構造化出力の失敗を検証・復旧・リトライで吸収する。

**Architecture:** サムネイルは「Bedrock で文字なし背景を生成」→「`@napi-rs/canvas` で 1280×720 に日本語タイトルと日付を描画」の2段構成にする。構造化出力は純粋関数 `parseStructuredOutput` を `shared` に置き、`script-generator`（async）と `metadata-generator`（Effect）それぞれの流儀に合わせた薄いアダプタから呼ぶ。

**Tech Stack:** TypeScript / pnpm workspace / vitest + @fast-check/vitest / effect 4.0.0-beta.43 / zod 4 / @mastra/core 1.3.0 / @aws-sdk/client-bedrock-runtime / @napi-rs/canvas 1.0.1

**元 spec:** `docs/superpowers/specs/2026-08-26-thumbnail-and-structured-output-design.md`

---

## 事前に確定済みの外部仕様

実装中に調べ直す必要はない。すべて実機で確認済み。

**Bedrock Stability 画像モデル** (`stability.stable-image-core-v1:1`, region `us-west-2`)

リクエストボディ:
```json
{"prompt":"...","mode":"text-to-image","aspect_ratio":"16:9","output_format":"png"}
```
レスポンス:
```json
{"seeds":[2487305531],"finish_reasons":[null],"images":["<base64 PNG>"]}
```
- 返る PNG は **2016×1152**（ちょうど 16:9）。1280×720 へは切り抜き不要の等比縮小で足りる
- `finish_reasons[0]` が `null` なら成功。非 null はコンテンツフィルタによる拒否

**`@napi-rs/canvas` のフォント登録**（macOS 実機で検証済み）
```js
GlobalFonts.registerFromPath("./NotoSansJP.ttf", "NotoSansJP");
GlobalFonts.has("NotoSansJP"); // => true
ctx.font = "bold 72px NotoSansJP";
```
別名が実際に使われることは、存在しないファミリ名とのメトリクス差で確認済み。

**effect 4.0.0-beta.43 の `Result` API**
- 構築: `Result.succeed(value)` / `Result.fail(error)`
- 判定: `Result.isSuccess(r)` / `Result.isFailure(r)`
- 取り出し: `r.success` / `r.failure`
- 例外の捕捉: `Result.try({ try: () => ..., catch: (e) => ... })`（`CLAUDE.md` の「bare try/catch 禁止」を満たす）

**フォント取得元**
```
https://github.com/google/fonts/raw/main/ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf
```
可変ウェイト TTF、約 9.6MB、OFL ライセンス。

---

## File Structure

**新規作成**

| ファイル | 責務 |
| --- | --- |
| `packages/shared/vitest.config.ts` | shared パッケージのテスト設定 |
| `packages/shared/src/structured-output.ts` | `parseStructuredOutput` — 検証と復旧の純粋関数 |
| `packages/shared/src/structured-output.spec.ts` | 上のテスト |
| `packages/script-generator/src/shared/structured-output.ts` | `generateStructured` — agent 呼び出し＋リトライ |
| `packages/script-generator/src/shared/structured-output.spec.ts` | 上のテスト |
| `packages/metadata-generator/assets/NotoSansJP.ttf` | 同梱フォント |
| `packages/metadata-generator/src/infrastructure/bedrock-image.ts` | `InvokeModel` を叩き base64 を返す |
| `packages/metadata-generator/src/infrastructure/bedrock-image.spec.ts` | 上のテスト |
| `packages/metadata-generator/src/generators/thumbnail/compose.ts` | 純粋関数。背景＋文字 → PNG Buffer |
| `packages/metadata-generator/src/generators/thumbnail/compose.spec.ts` | 上のテスト |
| `packages/metadata-generator/src/generators/thumbnail/background.ts` | プロンプト組み立て＋背景取得 |
| `packages/metadata-generator/src/generators/thumbnail/background.spec.ts` | 上のテスト |
| `packages/metadata-generator/src/generators/thumbnail/index.ts` | 上2つを合成する `generateThumbnail` |
| `packages/metadata-generator/src/generators/thumbnail/index.spec.ts` | 上のテスト |

**変更**

| ファイル | 変更内容 |
| --- | --- |
| `packages/shared/package.json` | test スクリプトと devDependencies を追加 |
| `packages/shared/src/index.ts` | `parseStructuredOutput` を re-export |
| `packages/shared/src/schemas/metadata-output.ts:8` | description の「Amazon Nova Canvas」表記を修正 |
| `packages/script-generator/src/steps/topic-selection/executor.ts` | `generateStructured` に置換 |
| `packages/script-generator/src/steps/topic-deep-dive/executor.ts` | 同上 |
| `packages/script-generator/src/steps/fact-check/executor.ts` | 同上 |
| `packages/script-generator/src/steps/dialogue-script-generator/executor.ts` | 同上 |
| `packages/metadata-generator/src/generators/create-text-generator.ts` | `parseStructuredOutput` ＋リトライに置換 |
| `packages/metadata-generator/package.json` | `@aws-sdk/client-bedrock-runtime` と `@napi-rs/canvas` を追加 |
| `packages/metadata-generator/Dockerfile` | esbuild の external 指定、canvas とフォントのコピー |

**削除**

| ファイル | 理由 |
| --- | --- |
| `packages/metadata-generator/src/generators/thumbnail.ts` | `thumbnail/` ディレクトリに置き換え |

---

## Task 0: 依存関係のインストール

このリポジトリの `node_modules` は現在存在しない。以降のタスクの前提。

**Files:** なし

- [ ] **Step 1: ワークスペース全体をインストール**

```bash
cd /Users/kokiyamaguchi/projects/git/personal/github.com/YamaguchiKoki/video-factory
pnpm install
```

Expected: `Done in ...` で終了。エラーなし。

- [ ] **Step 2: 既存テストが全部通ることを確認**

```bash
pnpm --filter script-generator test
```

Expected: `Test Files 17 passed (17)` / `Tests 122 passed (122)`

これがベースライン。以降のタスクでこの数字が減ってはいけない。

---

# Part A: 構造化出力の堅牢化

## Task 1: shared にテスト環境を用意する

`packages/shared` には現在テストが1つも無く、vitest の設定も無い。`parseStructuredOutput` を置く前に土台を作る。

**Files:**
- Modify: `packages/shared/package.json`
- Create: `packages/shared/vitest.config.ts`

- [ ] **Step 1: package.json に test スクリプトと devDependencies を追加**

`packages/shared/package.json` を以下に置き換える。

```json
{
  "name": "@video-factory/shared",
  "version": "1.0.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.782.0",
    "effect": "4.0.0-beta.43",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@fast-check/vitest": "^0.2.4",
    "@types/node": "^25.0.10",
    "vitest": "^4.0.18"
  }
}
```

- [ ] **Step 2: vitest.config.ts を作成**

`packages/shared/vitest.config.ts`（他パッケージと同じ形。ただし `shared` は起動時に環境変数を読まないので `setupFiles` は不要）:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules", "dist", "**/*.spec.ts"],
    },
  },
});
```

- [ ] **Step 3: インストール**

```bash
pnpm --filter @video-factory/shared install
```

Expected: エラーなし。

- [ ] **Step 4: コミット**

```bash
git add packages/shared/package.json packages/shared/vitest.config.ts
git commit -m "chore(shared): vitest のテスト環境を追加"
```

---

## Task 2: `parseStructuredOutput` を実装する

**Files:**
- Create: `packages/shared/src/structured-output.ts`
- Test: `packages/shared/src/structured-output.spec.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: 失敗するテストを書く**

`packages/shared/src/structured-output.spec.ts`:

```ts
import { fc, it } from "@fast-check/vitest";
import { Result } from "effect";
import { describe, expect } from "vitest";
import { z } from "zod";
import { parseStructuredOutput } from "./structured-output.js";

// Mastra の structuredOutput は、正しい JSON を
//   1. そのままオブジェクトで返す（正常）
//   2. JSON 文字列で返す
//   3. 単一キーのオブジェクトに文字列として包んで返す（実際に観測された {"$schema": "..."} 形式）
// のいずれかの形で返してくる。1〜3 はすべて同じ値として解釈できなければならない。

const TopicSchema = z.object({
  id: z.string(),
  title: z.string(),
  count: z.number(),
});

describe("parseStructuredOutput", () => {
  it("should parse a plain object that already matches the schema", () => {
    // Arrange
    const value = { id: "news-1", title: "見出し", count: 3 };

    // Act
    const result = parseStructuredOutput(TopicSchema, value);

    // Assert
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) expect(result.success).toEqual(value);
  });

  it("should recover a JSON string", () => {
    // Arrange
    const value = { id: "news-1", title: "見出し", count: 3 };

    // Act
    const result = parseStructuredOutput(TopicSchema, JSON.stringify(value));

    // Assert
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) expect(result.success).toEqual(value);
  });

  it("should recover a value wrapped in a single-key object", () => {
    // Arrange — 2026-08-09 に実際に観測された形
    const value = { id: "news-1", title: "見出し", count: 3 };
    const wrapped = { $schema: JSON.stringify(value) };

    // Act
    const result = parseStructuredOutput(TopicSchema, wrapped);

    // Assert
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) expect(result.success).toEqual(value);
  });

  it("should fail for undefined", () => {
    // Act
    const result = parseStructuredOutput(TopicSchema, undefined);

    // Assert
    expect(Result.isFailure(result)).toBe(true);
  });

  it("should report the original zod error when nothing can be recovered", () => {
    // Act
    const result = parseStructuredOutput(TopicSchema, { id: "news-1" });

    // Assert
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result))
      expect(result.failure).toContain("Structured output validation failed");
  });

  it("should fail for a single-key object whose value is not JSON", () => {
    // Act
    const result = parseStructuredOutput(TopicSchema, { $schema: "not json" });

    // Assert
    expect(Result.isFailure(result)).toBe(true);
  });

  it("should not unwrap an object with more than one key", () => {
    // Arrange — 複数キーのオブジェクトは復旧対象にしない
    const value = { id: "news-1", title: "見出し", count: 3 };
    const result = parseStructuredOutput(TopicSchema, {
      $schema: JSON.stringify(value),
      extra: "x",
    });

    // Assert
    expect(Result.isFailure(result)).toBe(true);
  });

  it.prop([
    fc.record({
      id: fc.string(),
      title: fc.string(),
      count: fc.integer(),
    }),
  ])("should give the same result for all three encodings", (value) => {
    // Act — 素／JSON文字列／単一キー包みの3形態
    const plain = parseStructuredOutput(TopicSchema, value);
    const asString = parseStructuredOutput(TopicSchema, JSON.stringify(value));
    const wrapped = parseStructuredOutput(TopicSchema, {
      $schema: JSON.stringify(value),
    });

    // Assert — 成功判定は3形態すべて無条件に行う。
    // if (isSuccess) ガードの中だけで判定すると、復旧に失敗しても
    // ガードが false になるだけでテストが通ってしまう。
    expect(Result.isSuccess(plain)).toBe(true);
    expect(Result.isSuccess(asString)).toBe(true);
    expect(Result.isSuccess(wrapped)).toBe(true);
    if (Result.isSuccess(plain)) expect(plain.success).toEqual(value);
    if (Result.isSuccess(asString)) expect(asString.success).toEqual(value);
    if (Result.isSuccess(wrapped)) expect(wrapped.success).toEqual(value);
  });

  it.prop([fc.integer()])("should always fail for a bare number", (n) => {
    // Assert — スキーマに合わない値は必ず失敗する
    expect(Result.isFailure(parseStructuredOutput(TopicSchema, n))).toBe(true);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
pnpm --filter @video-factory/shared test
```

Expected: FAIL。`Failed to resolve import "./structured-output.js"` のようなモジュール解決エラー。

- [ ] **Step 3: 実装を書く**

`packages/shared/src/structured-output.ts`:

```ts
import { Result } from "effect";
import type { z } from "zod";

// Mastra の structuredOutput は、スキーマに合う JSON を作れていても
// それを JSON 文字列にして単一キーのオブジェクトに包んで返すことがある
// （2026-08-09 に {"$schema": "<json>"} 形式を観測）。
// 素で通らなかった場合に限り、その包みを剥がして再検証する。
const MAX_UNWRAP_DEPTH = 2;

export const parseStructuredOutput = <T>(
  schema: z.ZodType<T>,
  raw: unknown,
): Result.Result<T, string> => {
  const direct = schema.safeParse(raw);
  if (direct.success) return Result.succeed(direct.data);

  const recovered = recover(schema, raw, 0);
  return (
    recovered ??
    Result.fail(
      `Structured output validation failed: ${direct.error.message}`,
    )
  );
};

const recover = <T>(
  schema: z.ZodType<T>,
  raw: unknown,
  depth: number,
): Result.Result<T, string> | undefined => {
  if (depth >= MAX_UNWRAP_DEPTH) return undefined;

  const inner = unwrap(raw);
  if (inner === undefined) return undefined;

  const parsed = schema.safeParse(inner);
  if (parsed.success) return Result.succeed(parsed.data);

  return recover(schema, inner, depth + 1);
};

const unwrap = (raw: unknown): unknown => {
  if (typeof raw === "string") return parseJson(raw);
  if (!isPlainObject(raw)) return undefined;

  const values = Object.values(raw);
  if (values.length !== 1) return undefined;

  const only = values[0];
  return typeof only === "string" ? parseJson(only) : undefined;
};

const parseJson = (value: string): unknown => {
  const parsed = Result.try({
    try: () => JSON.parse(value) as unknown,
    catch: () => undefined,
  });
  return Result.isSuccess(parsed) ? parsed.success : undefined;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
```

- [ ] **Step 4: テストを実行して成功を確認**

```bash
pnpm --filter @video-factory/shared test
```

Expected: PASS。`Tests 9 passed (9)`

- [ ] **Step 5: index.ts から re-export**

`packages/shared/src/index.ts` の1行目の直後（`parseWithZodEffect` の export の下）に追加する。既存の export はアルファベット順に並んでいるので、`export { parseWithZodEffect }` の行の直後に置く。

```ts
export { parseStructuredOutput } from "./structured-output.js";
```

- [ ] **Step 6: 型チェック**

```bash
pnpm --filter @video-factory/shared exec tsc --noEmit
```

Expected: 出力なし（エラーなし）。

- [ ] **Step 7: コミット**

```bash
git add packages/shared/src/structured-output.ts packages/shared/src/structured-output.spec.ts packages/shared/src/index.ts
git commit -m "feat(shared): 構造化出力の検証と復旧を行う parseStructuredOutput を追加"
```

---

## Task 3: `generateStructured` を実装する

**Files:**
- Create: `packages/script-generator/src/shared/structured-output.ts`
- Test: `packages/script-generator/src/shared/structured-output.spec.ts`

- [ ] **Step 1: 失敗するテストを書く**

`packages/script-generator/src/shared/structured-output.spec.ts`:

```ts
import type { Agent } from "@mastra/core/agent";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { generateStructured } from "./structured-output";

const TopicSchema = z.object({ id: z.string(), title: z.string() });
const VALID = { id: "news-1", title: "見出し" };

describe("generateStructured", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should return the parsed object on the first attempt", async () => {
    // Arrange
    const generate = vi.fn().mockResolvedValue({ object: VALID });

    // Act
    const result = await generateStructured(
      buildAgent(generate),
      "prompt",
      TopicSchema,
    );

    // Assert
    expect(result).toEqual(VALID);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("should recover a wrapped response without retrying", async () => {
    // Arrange — 1回目から $schema 包み。復旧できるので再実行してはならない
    const generate = vi
      .fn()
      .mockResolvedValue({ object: { $schema: JSON.stringify(VALID) } });

    // Act
    const result = await generateStructured(
      buildAgent(generate),
      "prompt",
      TopicSchema,
    );

    // Assert
    expect(result).toEqual(VALID);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("should retry when the first attempt yields undefined", async () => {
    // Arrange
    const generate = vi
      .fn()
      .mockResolvedValueOnce({ object: undefined })
      .mockResolvedValueOnce({ object: VALID });

    // Act
    const result = await generateStructured(
      buildAgent(generate),
      "prompt",
      TopicSchema,
    );

    // Assert
    expect(result).toEqual(VALID);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("should throw after exhausting all attempts", async () => {
    // Arrange
    const generate = vi.fn().mockResolvedValue({ object: undefined });

    // Act + Assert
    await expect(
      generateStructured(buildAgent(generate), "prompt", TopicSchema),
    ).rejects.toThrow(/Structured output validation failed/);
    expect(generate).toHaveBeenCalledTimes(3);
  });

  it("should propagate an error thrown by agent.generate", async () => {
    // Arrange
    const generate = vi.fn().mockRejectedValue(new Error("Bedrock timeout"));

    // Act + Assert
    await expect(
      generateStructured(buildAgent(generate), "prompt", TopicSchema),
    ).rejects.toThrow("Bedrock timeout");
  });

  it("should respect a custom maxAttempts", async () => {
    // Arrange
    const generate = vi.fn().mockResolvedValue({ object: undefined });

    // Act + Assert
    await expect(
      generateStructured(buildAgent(generate), "prompt", TopicSchema, 1),
    ).rejects.toThrow(/Structured output validation failed/);
    expect(generate).toHaveBeenCalledTimes(1);
  });
});

// Helpers

const buildAgent = (generate: ReturnType<typeof vi.fn>): Agent =>
  ({ generate }) as unknown as Agent;
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
pnpm --filter script-generator test src/shared/structured-output.spec.ts
```

Expected: FAIL。`Failed to resolve import "./structured-output"`

- [ ] **Step 3: 実装を書く**

`packages/script-generator/src/shared/structured-output.ts`:

```ts
import type { Agent } from "@mastra/core/agent";
import { parseStructuredOutput } from "@video-factory/shared";
import { Result } from "effect";
import type { z } from "zod";

const DEFAULT_MAX_ATTEMPTS = 3;

// Mastra の structuredOutput は間欠的に undefined を返したり、正しい JSON を
// 単一キーのオブジェクトに包んで返したりする。包みは parseStructuredOutput が
// 剥がすので、リトライが必要なのは「何も返ってこなかった」場合だけになる。
// 失敗は決定論的に即判明するため待ち時間は入れない（スロットリング由来の
// 再試行は AI SDK 側が既に行っている）。
export const generateStructured = async <T>(
  agent: Agent,
  prompt: string,
  schema: z.ZodType<T>,
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS,
): Promise<T> => attempt(agent, prompt, schema, maxAttempts, 1);

const attempt = async <T>(
  agent: Agent,
  prompt: string,
  schema: z.ZodType<T>,
  maxAttempts: number,
  n: number,
): Promise<T> => {
  const response = await agent.generate(prompt, {
    structuredOutput: { schema },
  });

  const parsed = parseStructuredOutput(schema, response.object);
  if (Result.isSuccess(parsed)) return parsed.success;

  console.warn(
    `[structured-output] attempt ${n}/${maxAttempts} failed: ${parsed.failure}`,
  );

  if (n >= maxAttempts) throw new Error(parsed.failure);
  return attempt(agent, prompt, schema, maxAttempts, n + 1);
};
```

ループではなく再帰にしているのは `CLAUDE.md` が `let` を禁じているため。`for` + カウンタ変数だと規約に反する。

- [ ] **Step 4: テストを実行して成功を確認**

```bash
pnpm --filter script-generator test src/shared/structured-output.spec.ts
```

Expected: PASS。`Tests 6 passed (6)`

- [ ] **Step 5: コミット**

```bash
git add packages/script-generator/src/shared/structured-output.ts packages/script-generator/src/shared/structured-output.spec.ts
git commit -m "feat(script-generator): 構造化出力のリトライ付きヘルパー generateStructured を追加"
```

---

## Task 4: 4つのステップを `generateStructured` に載せ替える

各 executor から重複した `agent.generate` ＋ `safeParse` を取り除く。

**Files:**
- Modify: `packages/script-generator/src/steps/topic-selection/executor.ts`
- Modify: `packages/script-generator/src/steps/topic-deep-dive/executor.ts`
- Modify: `packages/script-generator/src/steps/fact-check/executor.ts`
- Modify: `packages/script-generator/src/steps/dialogue-script-generator/executor.ts`

- [ ] **Step 1: topic-selection を書き換える**

`packages/script-generator/src/steps/topic-selection/executor.ts` を以下に置き換える。

```ts
import { createStep } from "@mastra/core/workflows";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { generateStructured } from "../../shared/structured-output";
import { TOPIC_SELECTION_AGENT_ID } from "./agent";
import type { WorkflowInput } from "./schema";
import { TopicsOutputSchema, WorkflowInputSchema } from "./schema";

export const topicSelectionStep = createStep({
  id: "topic-selection",
  inputSchema: WorkflowInputSchema,
  outputSchema: TopicsOutputSchema,
  execute: async ({ inputData, mastra }) => {
    const agent = mastra.getAgent(TOPIC_SELECTION_AGENT_ID);
    if (!agent) throw new Error(`${TOPIC_SELECTION_AGENT_ID} not found`);

    return generateStructured(
      agent,
      buildTopicSelectionPrompt(inputData),
      TopicsOutputSchema,
    );
  },
});

const buildTopicSelectionPrompt = (inputData: WorkflowInput): string => {
  const today = format(new Date(), "yyyy年MM月dd日", { locale: ja });
  return `ジャンル「${inputData.genre}」について、${today}の主要ニューストップ3を選択してください。各トピックにはユニークなid（"news-1", "news-2", "news-3"）、日本語のタイトル、要約を含めてください。`;
};
```

- [ ] **Step 2: topic-deep-dive を書き換える**

`packages/script-generator/src/steps/topic-deep-dive/executor.ts` を以下に置き換える。

```ts
import { createStep } from "@mastra/core/workflows";
import { generateStructured } from "../../shared/structured-output";
import type { Topic } from "../topic-selection/schema";
import { TopicSchema } from "../topic-selection/schema";
import { TOPIC_DEEP_DIVE_AGENT_ID } from "./agent";
import { EnrichedTopicSchema } from "./schema";

export const topicDeepDiveStep = createStep({
  id: "topic-deep-dive",
  inputSchema: TopicSchema,
  outputSchema: EnrichedTopicSchema,
  execute: async ({ inputData, mastra }) => {
    const agent = mastra.getAgent(TOPIC_DEEP_DIVE_AGENT_ID);
    if (!agent) throw new Error(`${TOPIC_DEEP_DIVE_AGENT_ID} not found`);

    return generateStructured(
      agent,
      buildTopicDeepDivePrompt(inputData),
      EnrichedTopicSchema,
    );
  },
});

const buildTopicDeepDivePrompt = (inputData: Topic): string =>
  `トピック「${inputData.title}」について詳細なリサーチを実施してください。X上の意見、詳細なコンテキスト・背景情報、信頼性の高いソースURLを収集してください。`;
```

- [ ] **Step 3: fact-check を書き換える**

`packages/script-generator/src/steps/fact-check/executor.ts` を以下に置き換える。

```ts
import { createStep } from "@mastra/core/workflows";
import { generateStructured } from "../../shared/structured-output";
import type { EnrichedTopicsOutput } from "../topic-deep-dive/schema";
import { EnrichedTopicsOutputSchema } from "../topic-deep-dive/schema";
import { FACT_CHECK_AGENT_ID } from "./agent";
import { VerifiedTopicsOutputSchema } from "./schema";

export const factCheckStep = createStep({
  id: "fact-check",
  inputSchema: EnrichedTopicsOutputSchema,
  outputSchema: VerifiedTopicsOutputSchema,
  execute: async ({ inputData, mastra }) => {
    const agent = mastra.getAgent(FACT_CHECK_AGENT_ID);
    if (!agent) throw new Error(`${FACT_CHECK_AGENT_ID} not found`);

    return generateStructured(
      agent,
      buildFactCheckPrompt(inputData),
      VerifiedTopicsOutputSchema,
    );
  },
});

const buildFactCheckPrompt = (inputData: EnrichedTopicsOutput): string =>
  `以下のトピックについてファクトチェックを実施してください。複数ソース間のクロスチェック、信頼性スコアリング（0〜1）、矛盾検出を行ってください。\n\n${JSON.stringify(inputData, null, 2)}`;
```

- [ ] **Step 4: dialogue-script-generator を書き換える**

`packages/script-generator/src/steps/dialogue-script-generator/executor.ts` を以下に置き換える。

```ts
import { createStep } from "@mastra/core/workflows";
import { ScriptSchema } from "../../schema";
import { generateStructured } from "../../shared/structured-output";
import type { VerifiedTopicsOutput } from "../fact-check/schema";
import { VerifiedTopicsOutputSchema } from "../fact-check/schema";
import { DIALOGUE_SCRIPT_GENERATOR_AGENT_ID } from "./agent";

export const dialogueScriptGeneratorStep = createStep({
  id: "dialogue-script-generator",
  inputSchema: VerifiedTopicsOutputSchema,
  outputSchema: ScriptSchema,
  execute: async ({ inputData, mastra }) => {
    const agent = mastra.getAgent(DIALOGUE_SCRIPT_GENERATOR_AGENT_ID);
    if (!agent)
      throw new Error(`${DIALOGUE_SCRIPT_GENERATOR_AGENT_ID} not found`);

    return generateStructured(
      agent,
      buildDialogueScriptPrompt(inputData),
      ScriptSchema,
    );
  },
});

const buildDialogueScriptPrompt = (inputData: VerifiedTopicsOutput): string =>
  `以下のファクトチェック済みトピックを元に、解説役（A）と質問役（B）の対話型ラジオスクリプトを生成してください。導入（intro）→各トピック議論（discussion×3）→まとめ（outro）の構成で作成してください。\n\n${JSON.stringify(inputData, null, 2)}`;
```

- [ ] **Step 5: テストを実行する**

```bash
pnpm --filter script-generator test
```

Expected: 一部 FAIL。`agent.generate` を1回しか呼ばない前提のモックが、リトライで3回呼ばれるようになったテストが落ちる。具体的には各 executor の spec のうち「`response.object` が不正／undefined のとき throw する」系のテスト。落ちたテスト名を控える。

- [ ] **Step 6: 落ちたテストを新しい挙動に追従させる**

各 executor の spec で、失敗系のアサーションを以下の形に合わせる。`topic-deep-dive/executor.spec.ts` を例に取ると、`should throw when response.object fails EnrichedTopicSchema validation` は既に `/Structured output validation failed/` を期待しているのでメッセージは変えなくてよい。変更が必要なのは呼び出し回数を数えているテストだけで、`toHaveBeenCalledTimes(1)` を `toHaveBeenCalledTimes(3)` に直す。

`topic-selection/executor.spec.ts` に Task の前段で追加済みの2件（`should throw a descriptive error when response.object is undefined` と `should throw when response.object fails TopicsOutputSchema validation`）はメッセージが一致するのでそのまま通る。

`should call getAgent with the correct agent id` と `should pass genre and date to agent prompt` は成功パスなので影響を受けない。

- [ ] **Step 7: テストを再実行して全部通ることを確認**

```bash
pnpm --filter script-generator test
```

Expected: PASS。テスト数は Task 0 のベースライン 122 + Task 3 の 6 = 128 以上。

- [ ] **Step 8: 型チェック**

```bash
pnpm --filter script-generator exec tsc --noEmit
```

Expected: 出力なし。

- [ ] **Step 9: コミット**

```bash
git add packages/script-generator/src/steps
git commit -m "refactor(script-generator): 4ステップを generateStructured に統一"
```

---

## Task 5: `createTextGenerator` にも同じ復旧とリトライを入れる

`description` と `comment` はこのファクトリ経由なので、1ファイルの変更で両方が直る。

**Files:**
- Modify: `packages/metadata-generator/src/generators/create-text-generator.ts`
- Test: `packages/metadata-generator/src/generators/create-text-generator.spec.ts`（存在しなければ作成）

- [ ] **Step 1: 失敗するテストを書く**

`packages/metadata-generator/src/generators/create-text-generator.spec.ts` に以下を追記する（ファイルが無ければこの内容で作成）:

```ts
import type { Mastra } from "@mastra/core/mastra";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createTextGenerator } from "./create-text-generator";

const ResultSchema = z.object({ text: z.string() });
const VALID = { text: "概要欄テキスト" };

const buildScript = () =>
  ({ title: "タイトル", newsItems: [], sections: [] }) as never;

const buildMastra = (generate: ReturnType<typeof vi.fn>): Mastra =>
  ({ getAgent: vi.fn().mockReturnValue({ generate }) }) as unknown as Mastra;

const generator = createTextGenerator({
  agentId: "test-agent",
  schema: ResultSchema,
  createError: (message: string) => ({ message }),
  buildPrompt: () => "prompt",
});

describe("createTextGenerator", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should recover a wrapped response without retrying", async () => {
    // Arrange
    const generate = vi
      .fn()
      .mockResolvedValue({ object: { $schema: JSON.stringify(VALID) } });

    // Act
    const result = await Effect.runPromise(
      generator(buildScript(), buildMastra(generate)),
    );

    // Assert
    expect(result).toEqual(VALID);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("should retry when the response is undefined and succeed on the second attempt", async () => {
    // Arrange
    const generate = vi
      .fn()
      .mockResolvedValueOnce({ object: undefined })
      .mockResolvedValueOnce({ object: VALID });

    // Act
    const result = await Effect.runPromise(
      generator(buildScript(), buildMastra(generate)),
    );

    // Assert
    expect(result).toEqual(VALID);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("should fail after three failed attempts", async () => {
    // Arrange
    const generate = vi.fn().mockResolvedValue({ object: undefined });

    // Act
    const exit = await Effect.runPromiseExit(
      generator(buildScript(), buildMastra(generate)),
    );

    // Assert
    expect(exit._tag).toBe("Failure");
    expect(generate).toHaveBeenCalledTimes(3);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
pnpm --filter metadata-generator test src/generators/create-text-generator.spec.ts
```

Expected: FAIL。現行実装はリトライしないので「2回目で成功」「3回呼ばれる」のテストが落ちる。

- [ ] **Step 3: 実装を書き換える**

`packages/metadata-generator/src/generators/create-text-generator.ts` を以下に置き換える。

```ts
import type { Mastra } from "@mastra/core/mastra";
import { parseStructuredOutput } from "@video-factory/shared";
import { Effect, Result } from "effect";
import type { z } from "zod";
import type { Script } from "../schema";

// ============================================
// Config type
// ============================================

type TextGeneratorConfig<T, E> = {
  readonly agentId: string;
  readonly schema: z.ZodType<T>;
  readonly createError: (message: string) => E;
  readonly buildPrompt: (script: Script) => string;
};

const MAX_ATTEMPTS = 3;

// ============================================
// Factory
// ============================================

export const createTextGenerator =
  <T, E>(
    config: TextGeneratorConfig<T, E>,
  ): ((script: Script, mastra: Mastra) => Effect.Effect<T, E>) =>
  (script, mastra) =>
    Effect.gen(function* () {
      const agent = mastra.getAgent(config.agentId);
      if (!agent) {
        return yield* Effect.fail(
          config.createError(`Agent ${config.agentId} not found`),
        );
      }

      // Mastra の structuredOutput は間欠的に undefined を返す。包み形式
      // （{"$schema": "<json>"}）は parseStructuredOutput が剥がすので、
      // 再実行が要るのは何も返らなかった場合だけ。
      // `CLAUDE.md` が `let` を禁じているのでループではなく再帰にする。
      const attempt = (
        n: number,
        lastFailure: string,
      ): Effect.Effect<T, E> =>
        n > MAX_ATTEMPTS
          ? Effect.fail(config.createError(lastFailure))
          : Effect.gen(function* () {
              const response = yield* Effect.tryPromise({
                try: () =>
                  agent.generate(config.buildPrompt(script), {
                    structuredOutput: { schema: config.schema },
                  }),
                catch: (e) =>
                  config.createError(
                    e instanceof Error ? e.message : String(e),
                  ),
              });

              const parsed = parseStructuredOutput(
                config.schema,
                response.object,
              );
              if (Result.isSuccess(parsed)) return parsed.success;

              console.warn(
                `[${config.agentId}] attempt ${n}/${MAX_ATTEMPTS} failed: ${parsed.failure}`,
              );
              return yield* attempt(n + 1, parsed.failure);
            });

      return yield* attempt(1, "no attempt was made");
    });
```

- [ ] **Step 4: テストを実行して成功を確認**

```bash
pnpm --filter metadata-generator test src/generators/create-text-generator.spec.ts
```

Expected: PASS。`Tests 3 passed (3)`

- [ ] **Step 5: `generateStructured` が規約に沿っていることを確認する**

Task 3 で既に再帰形（`let` なし）で実装されているはず。以下と一致することを確認し、差異があれば直す。

```ts
import type { Agent } from "@mastra/core/agent";
import { parseStructuredOutput } from "@video-factory/shared";
import { Result } from "effect";
import type { z } from "zod";

const DEFAULT_MAX_ATTEMPTS = 3;

// Mastra の structuredOutput は間欠的に undefined を返したり、正しい JSON を
// 単一キーのオブジェクトに包んで返したりする。包みは parseStructuredOutput が
// 剥がすので、リトライが必要なのは「何も返ってこなかった」場合だけになる。
// 失敗は決定論的に即判明するため待ち時間は入れない（スロットリング由来の
// 再試行は AI SDK 側が既に行っている）。
export const generateStructured = async <T>(
  agent: Agent,
  prompt: string,
  schema: z.ZodType<T>,
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS,
): Promise<T> => attempt(agent, prompt, schema, maxAttempts, 1);

const attempt = async <T>(
  agent: Agent,
  prompt: string,
  schema: z.ZodType<T>,
  maxAttempts: number,
  n: number,
): Promise<T> => {
  const response = await agent.generate(prompt, {
    structuredOutput: { schema },
  });

  const parsed = parseStructuredOutput(schema, response.object);
  if (Result.isSuccess(parsed)) return parsed.success;

  console.warn(
    `[structured-output] attempt ${n}/${maxAttempts} failed: ${parsed.failure}`,
  );

  if (n >= maxAttempts) throw new Error(parsed.failure);
  return attempt(agent, prompt, schema, maxAttempts, n + 1);
};
```

- [ ] **Step 6: 両パッケージのテストを実行**

```bash
pnpm --filter script-generator test && pnpm --filter metadata-generator test
```

Expected: 両方 PASS。

- [ ] **Step 7: 型チェック**

```bash
pnpm --filter metadata-generator exec tsc --noEmit
```

Expected: 出力なし。

- [ ] **Step 8: コミット**

```bash
git add packages/metadata-generator/src/generators/create-text-generator.ts packages/metadata-generator/src/generators/create-text-generator.spec.ts packages/script-generator/src/shared/structured-output.ts
git commit -m "feat(metadata-generator): 構造化出力の復旧とリトライを createTextGenerator に導入"
```

---

# Part B: サムネイル生成の再構成

## Task 6: Bedrock 画像モデル呼び出しを実装する

**Files:**
- Modify: `packages/metadata-generator/package.json`
- Create: `packages/metadata-generator/src/infrastructure/bedrock-image.ts`
- Test: `packages/metadata-generator/src/infrastructure/bedrock-image.spec.ts`

- [ ] **Step 1: 依存関係を追加**

```bash
pnpm --filter metadata-generator add @aws-sdk/client-bedrock-runtime@^3.1016.0
```

Expected: `dependencies` に追加され、インストールが成功する。

- [ ] **Step 2: 失敗するテストを書く**

`packages/metadata-generator/src/infrastructure/bedrock-image.spec.ts`:

```ts
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateBackgroundImage } from "./bedrock-image";

// Bedrock の stability.stable-image-core-v1:1 は
//   request : {prompt, mode, aspect_ratio, output_format}
//   response: {seeds:[n], finish_reasons:[null], images:["<base64>"]}
// を取る。finish_reasons[0] が非 null のときはコンテンツフィルタによる拒否。

const buildResponse = (payload: unknown) => ({
  body: new TextEncoder().encode(JSON.stringify(payload)),
});

const buildClient = (send: ReturnType<typeof vi.fn>) =>
  ({ send }) as never;

describe("generateBackgroundImage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should return the base64 image on success", async () => {
    // Arrange
    const send = vi.fn().mockResolvedValue(
      buildResponse({
        seeds: [1],
        finish_reasons: [null],
        images: ["QUJD"],
      }),
    );

    // Act
    const result = await Effect.runPromise(
      generateBackgroundImage(buildClient(send))("a prompt"),
    );

    // Assert
    expect(result).toBe("QUJD");
  });

  it("should send the stability request shape", async () => {
    // Arrange
    const send = vi.fn().mockResolvedValue(
      buildResponse({ seeds: [1], finish_reasons: [null], images: ["QUJD"] }),
    );

    // Act
    await Effect.runPromise(
      generateBackgroundImage(buildClient(send))("a prompt"),
    );

    // Assert
    const command = send.mock.calls[0][0];
    const body = JSON.parse(new TextDecoder().decode(command.input.body));
    expect(body).toEqual({
      prompt: "a prompt",
      mode: "text-to-image",
      aspect_ratio: "16:9",
      output_format: "png",
    });
    expect(command.input.modelId).toBe("stability.stable-image-core-v1:1");
  });

  it("should fail when the content filter rejects the prompt", async () => {
    // Arrange
    const send = vi.fn().mockResolvedValue(
      buildResponse({
        seeds: [1],
        finish_reasons: ["CONTENT_FILTERED"],
        images: [""],
      }),
    );

    // Act
    const exit = await Effect.runPromiseExit(
      generateBackgroundImage(buildClient(send))("a prompt"),
    );

    // Assert
    expect(exit._tag).toBe("Failure");
  });

  it("should fail when no image is returned", async () => {
    // Arrange
    const send = vi.fn().mockResolvedValue(
      buildResponse({ seeds: [], finish_reasons: [], images: [] }),
    );

    // Act
    const exit = await Effect.runPromiseExit(
      generateBackgroundImage(buildClient(send))("a prompt"),
    );

    // Assert
    expect(exit._tag).toBe("Failure");
  });

  it("should fail when the client throws", async () => {
    // Arrange
    const send = vi.fn().mockRejectedValue(new Error("AccessDeniedException"));

    // Act
    const exit = await Effect.runPromiseExit(
      generateBackgroundImage(buildClient(send))("a prompt"),
    );

    // Assert
    expect(exit._tag).toBe("Failure");
  });
});
```

- [ ] **Step 3: テストを実行して失敗を確認**

```bash
pnpm --filter metadata-generator test src/infrastructure/bedrock-image.spec.ts
```

Expected: FAIL。`Failed to resolve import "./bedrock-image"`

- [ ] **Step 4: 実装を書く**

`packages/metadata-generator/src/infrastructure/bedrock-image.ts`:

```ts
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { Effect, Result, Schema } from "effect";
import { z } from "zod";

// amazon.nova-canvas-v1:0 は Bedrock 上で LEGACY となり呼び出せなくなった。
// us-east-1 に ACTIVE な text-to-image モデルは存在しないため us-west-2 を使う。
// @ai-sdk/amazon-bedrock の imageModel() は Nova Canvas 専用のボディを組み立てる
// 実装なので Stability 系には使えず、InvokeModel を直接呼んでいる。
const IMAGE_MODEL_ID = "stability.stable-image-core-v1:1";
const IMAGE_REGION = "us-west-2";

export class BedrockImageError extends Schema.TaggedErrorClass<BedrockImageError>()(
  "BedrockImageError",
  { message: Schema.String },
) {}

export const createBedrockImageClient = (): BedrockRuntimeClient =>
  new BedrockRuntimeClient({ region: IMAGE_REGION });

const ResponseSchema = z.object({
  images: z.array(z.string()),
  finish_reasons: z.array(z.string().nullable()),
});

export const generateBackgroundImage =
  (client: BedrockRuntimeClient) =>
  (prompt: string): Effect.Effect<string, BedrockImageError> =>
    Effect.gen(function* () {
      const response = yield* Effect.tryPromise({
        try: () =>
          client.send(
            new InvokeModelCommand({
              modelId: IMAGE_MODEL_ID,
              contentType: "application/json",
              accept: "application/json",
              body: new TextEncoder().encode(
                JSON.stringify({
                  prompt,
                  mode: "text-to-image",
                  aspect_ratio: "16:9",
                  output_format: "png",
                }),
              ),
            }),
          ),
        catch: (e) =>
          new BedrockImageError({
            message: e instanceof Error ? e.message : String(e),
          }),
      });

      const decoded = yield* decodeBody(response.body);

      const parsed = ResponseSchema.safeParse(decoded);
      if (!parsed.success) {
        return yield* Effect.fail(
          new BedrockImageError({
            message: `Unexpected Bedrock image response: ${parsed.error.message}`,
          }),
        );
      }

      const reason = parsed.data.finish_reasons[0];
      if (reason != null) {
        return yield* Effect.fail(
          new BedrockImageError({
            message: `Image generation was rejected: ${reason}`,
          }),
        );
      }

      const image = parsed.data.images[0];
      if (!image) {
        return yield* Effect.fail(
          new BedrockImageError({ message: "No image returned from model" }),
        );
      }

      return image;
    });

const decodeBody = (
  body: Uint8Array | undefined,
): Effect.Effect<unknown, BedrockImageError> => {
  if (!body) {
    return Effect.fail(
      new BedrockImageError({ message: "Empty response body" }),
    );
  }

  const parsed = Result.try({
    try: () => JSON.parse(new TextDecoder().decode(body)) as unknown,
    catch: (e) =>
      new BedrockImageError({
        message: `Failed to decode response body: ${String(e)}`,
      }),
  });

  return Result.isSuccess(parsed)
    ? Effect.succeed(parsed.success)
    : Effect.fail(parsed.failure);
};
```

- [ ] **Step 5: テストを実行して成功を確認**

```bash
pnpm --filter metadata-generator test src/infrastructure/bedrock-image.spec.ts
```

Expected: PASS。`Tests 5 passed (5)`

- [ ] **Step 6: コミット**

```bash
git add packages/metadata-generator/package.json packages/metadata-generator/src/infrastructure/bedrock-image.ts packages/metadata-generator/src/infrastructure/bedrock-image.spec.ts
git commit -m "feat(metadata-generator): Stability 画像モデルの InvokeModel ラッパーを追加"
```

---

## Task 7: フォントを同梱する

**Files:**
- Create: `packages/metadata-generator/assets/NotoSansJP.ttf`

- [ ] **Step 1: フォントをダウンロード**

```bash
mkdir -p packages/metadata-generator/assets
curl -sL -o packages/metadata-generator/assets/NotoSansJP.ttf \
  "https://github.com/google/fonts/raw/main/ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf"
```

- [ ] **Step 2: 正しい TTF であることを確認**

```bash
file packages/metadata-generator/assets/NotoSansJP.ttf
ls -la packages/metadata-generator/assets/NotoSansJP.ttf
```

Expected: `TrueType Font data, 23 tables, ...` と表示され、サイズが約 9.6MB。

- [ ] **Step 3: ライセンス表記を添える**

`packages/metadata-generator/assets/LICENSE-NotoSansJP.txt` を作成する。

```
Noto Sans JP is licensed under the SIL Open Font License, Version 1.1.
Source: https://github.com/google/fonts/tree/main/ofl/notosansjp
Full license text: https://openfontlicense.org/open-font-license-official-text/
```

- [ ] **Step 4: コミット**

```bash
git add packages/metadata-generator/assets
git commit -m "chore(metadata-generator): サムネイル用に Noto Sans JP を同梱"
```

---

## Task 8: `compose.ts` を実装する

背景 Buffer とタイトル・日付から 1280×720 の PNG を作る純粋関数。

**Files:**
- Modify: `packages/metadata-generator/package.json`
- Create: `packages/metadata-generator/src/generators/thumbnail/compose.ts`
- Test: `packages/metadata-generator/src/generators/thumbnail/compose.spec.ts`

- [ ] **Step 1: 依存関係を追加**

```bash
pnpm --filter metadata-generator add @napi-rs/canvas@^1.0.1
```

- [ ] **Step 2: 失敗するテストを書く**

`packages/metadata-generator/src/generators/thumbnail/compose.spec.ts`:

```ts
import { fc, it } from "@fast-check/vitest";
import { createCanvas } from "@napi-rs/canvas";
import { describe, expect } from "vitest";
import { composeThumbnail, THUMBNAIL_HEIGHT, THUMBNAIL_WIDTH } from "./compose";

const PNG_SIGNATURE = "89504e470d0a1a0a";

// テスト用のダミー背景。実際の Bedrock 出力と同じ 2016x1152 で作る。
const buildBackground = (): Buffer => {
  const canvas = createCanvas(2016, 1152);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#14324f";
  ctx.fillRect(0, 0, 2016, 1152);
  return canvas.toBuffer("image/png");
};

const readSize = (png: Buffer): { width: number; height: number } => ({
  width: png.readUInt32BE(16),
  height: png.readUInt32BE(20),
});

describe("composeThumbnail", () => {
  it("should produce a 1280x720 PNG", async () => {
    // Act
    const png = await composeThumbnail({
      background: buildBackground(),
      title: "高市政権、食料品の消費税率を1%に引き下げ",
      date: "2026年8月26日",
    });

    // Assert
    expect(png.subarray(0, 8).toString("hex")).toBe(PNG_SIGNATURE);
    expect(readSize(png)).toEqual({
      width: THUMBNAIL_WIDTH,
      height: THUMBNAIL_HEIGHT,
    });
  });

  it("should handle an extremely long title without throwing", async () => {
    // Arrange
    const title = "長いタイトル".repeat(50);

    // Act
    const png = await composeThumbnail({
      background: buildBackground(),
      title,
      date: "2026年8月26日",
    });

    // Assert
    expect(readSize(png)).toEqual({
      width: THUMBNAIL_WIDTH,
      height: THUMBNAIL_HEIGHT,
    });
  });

  it.prop([fc.string()])(
    "should always produce a valid 1280x720 PNG for any title",
    async (title) => {
      // Act
      const png = await composeThumbnail({
        background: buildBackground(),
        title,
        date: "2026年8月26日",
      });

      // Assert — どんな文字列でも例外を投げず、寸法が変わらないことが不変条件
      expect(png.subarray(0, 8).toString("hex")).toBe(PNG_SIGNATURE);
      expect(readSize(png)).toEqual({
        width: THUMBNAIL_WIDTH,
        height: THUMBNAIL_HEIGHT,
      });
    },
  );
});
```

- [ ] **Step 3: テストを実行して失敗を確認**

```bash
pnpm --filter metadata-generator test src/generators/thumbnail/compose.spec.ts
```

Expected: FAIL。`Failed to resolve import "./compose"`

- [ ] **Step 4: 実装を書く**

`packages/metadata-generator/src/generators/thumbnail/compose.ts`:

```ts
import type { SKRSContext2D } from "@napi-rs/canvas";
import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import { fileURLToPath } from "node:url";

export const THUMBNAIL_WIDTH = 1280;
export const THUMBNAIL_HEIGHT = 720;

const FONT_FAMILY = "NotoSansJP";
const MAX_TITLE_LINES = 3;
const MAX_FONT_SIZE = 72;
const MIN_FONT_SIZE = 40;
const FONT_SIZE_STEP = 4;
const TITLE_MARGIN_X = 80;
const DATE_FONT_SIZE = 32;
const DATE_MARGIN = 40;

// Lambda では lambda.mjs と assets/ が同じ LAMBDA_TASK_ROOT に置かれる。
// ローカル（vitest / tsx）ではこのファイルから見た相対位置を辿る。
const fontPath = fileURLToPath(
  new URL("../../../assets/NotoSansJP.ttf", import.meta.url),
);

GlobalFonts.registerFromPath(fontPath, FONT_FAMILY);

type ComposeInput = {
  readonly background: Buffer;
  readonly title: string;
  readonly date: string;
};

export const composeThumbnail = async (
  input: ComposeInput,
): Promise<Buffer> => {
  const canvas = createCanvas(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);
  const ctx = canvas.getContext("2d");

  // 背景は 16:9 で返るので、切り抜き無しの等比縮小で埋まる。
  const image = await loadImage(input.background);
  ctx.drawImage(image, 0, 0, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);

  // 文字のコントラストを確保する暗色オーバーレイ。
  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
  ctx.fillRect(0, 0, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);

  const maxWidth = THUMBNAIL_WIDTH - TITLE_MARGIN_X * 2;
  const layout = fitTitle(ctx, input.title, maxWidth);

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${layout.fontSize}px ${FONT_FAMILY}`;

  const lineHeight = layout.fontSize * 1.4;
  const blockHeight = lineHeight * layout.lines.length;
  const firstLineY = THUMBNAIL_HEIGHT / 2 - blockHeight / 2 + lineHeight / 2;

  layout.lines.forEach((line, index) => {
    ctx.fillText(line, THUMBNAIL_WIDTH / 2, firstLineY + lineHeight * index);
  });

  ctx.font = `${DATE_FONT_SIZE}px ${FONT_FAMILY}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(
    input.date,
    THUMBNAIL_WIDTH - DATE_MARGIN,
    THUMBNAIL_HEIGHT - DATE_MARGIN,
  );

  return canvas.toBuffer("image/png");
};

// ============================================
// Helpers
// ============================================

type TitleLayout = {
  readonly fontSize: number;
  readonly lines: readonly string[];
};

// 72px から 4px 刻みで縮め、3行に収まる最大サイズを選ぶ。
// 下限まで縮めても収まらない場合は最終行を省略記号で切る。
const fitTitle = (
  ctx: SKRSContext2D,
  title: string,
  maxWidth: number,
): TitleLayout => {
  const sizes = buildSizes();

  const fitting = sizes
    .map((fontSize) => {
      ctx.font = `bold ${fontSize}px ${FONT_FAMILY}`;
      return { fontSize, lines: wrap(ctx, title, maxWidth) };
    })
    .find((candidate) => candidate.lines.length <= MAX_TITLE_LINES);

  if (fitting) return fitting;

  ctx.font = `bold ${MIN_FONT_SIZE}px ${FONT_FAMILY}`;
  const all = wrap(ctx, title, maxWidth);
  return {
    fontSize: MIN_FONT_SIZE,
    lines: truncate(all, MAX_TITLE_LINES),
  };
};

const buildSizes = (): readonly number[] =>
  Array.from(
    { length: Math.floor((MAX_FONT_SIZE - MIN_FONT_SIZE) / FONT_SIZE_STEP) + 1 },
    (_unused, index) => MAX_FONT_SIZE - index * FONT_SIZE_STEP,
  );

// 日本語には単語境界が無いので1文字ずつ詰める。
const wrap = (
  ctx: SKRSContext2D,
  title: string,
  maxWidth: number,
): readonly string[] =>
  Array.from(title).reduce<readonly string[]>((lines, char) => {
    if (char === "\n") return [...lines, ""];

    const current = lines[lines.length - 1] ?? "";
    const candidate = current + char;

    if (lines.length === 0) return [candidate];
    if (ctx.measureText(candidate).width <= maxWidth)
      return [...lines.slice(0, -1), candidate];

    return [...lines, char];
  }, []);

const truncate = (
  lines: readonly string[],
  limit: number,
): readonly string[] => {
  if (lines.length <= limit) return lines;

  const kept = lines.slice(0, limit);
  const last = kept[kept.length - 1] ?? "";
  return [...kept.slice(0, -1), `${last.slice(0, -1)}…`];
};
```

- [ ] **Step 5: テストを実行して成功を確認**

```bash
pnpm --filter metadata-generator test src/generators/thumbnail/compose.spec.ts
```

Expected: PASS。`Tests 3 passed (3)`

空文字列のタイトルでは `wrap` が空配列を返し、`fitTitle` は `lines.length === 0 <= 3` なので最大フォントサイズを選ぶ。`forEach` は空配列に対して何も描かないため例外にはならず、PNG の寸法も変わらない。

- [ ] **Step 6: 目視確認用の PNG を出力する**

```bash
cd packages/metadata-generator && npx tsx -e '
import { createCanvas } from "@napi-rs/canvas";
import { writeFileSync } from "node:fs";
import { composeThumbnail } from "./src/generators/thumbnail/compose.ts";
const bg = createCanvas(2016, 1152);
const c = bg.getContext("2d");
c.fillStyle = "#14324f"; c.fillRect(0, 0, 2016, 1152);
const png = await composeThumbnail({
  background: bg.toBuffer("image/png"),
  title: "高市政権、食料品の消費税率を1%に引き下げ　2年間限定で実施",
  date: "2026年8月26日",
});
writeFileSync("/tmp/thumb-preview.png", png);
console.log("wrote /tmp/thumb-preview.png", png.length, "bytes");
'
```

`/tmp/thumb-preview.png` を開き、日本語が豆腐（□）になっていないこと、タイトルが枠内に収まっていること、右下に日付があることを目で確認する。

- [ ] **Step 7: コミット**

```bash
git add packages/metadata-generator/package.json packages/metadata-generator/src/generators/thumbnail/compose.ts packages/metadata-generator/src/generators/thumbnail/compose.spec.ts
git commit -m "feat(metadata-generator): サムネイルの日本語テキスト合成を追加"
```

---

## Task 9: `background.ts` と `thumbnail/index.ts` を実装し、旧実装を差し替える

**Files:**
- Create: `packages/metadata-generator/src/generators/thumbnail/background.ts`
- Test: `packages/metadata-generator/src/generators/thumbnail/background.spec.ts`
- Create: `packages/metadata-generator/src/generators/thumbnail/index.ts`
- Test: `packages/metadata-generator/src/generators/thumbnail/index.spec.ts`
- Delete: `packages/metadata-generator/src/generators/thumbnail.ts`
- Modify: `packages/shared/src/schemas/metadata-output.ts:8`

- [ ] **Step 1: background の失敗テストを書く**

`packages/metadata-generator/src/generators/thumbnail/background.spec.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildBackgroundPrompt } from "./background";

describe("buildBackgroundPrompt", () => {
  it("should instruct the model not to render any text", () => {
    // Arrange + Act — 拡散モデルは日本語を描けないので、文字は必ず禁止する
    const prompt = buildBackgroundPrompt("2026年夏の経済政策を読み解く");

    // Assert
    expect(prompt).toContain("no text");
  });

  it("should not embed the Japanese title into the image prompt", () => {
    // Arrange
    const title = "高市政権、食料品の消費税率を1%に引き下げ";

    // Act
    const prompt = buildBackgroundPrompt(title);

    // Assert — タイトルは canvas 側で描くので、画像プロンプトには入れない
    expect(prompt).not.toContain(title);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
pnpm --filter metadata-generator test src/generators/thumbnail/background.spec.ts
```

Expected: FAIL。`Failed to resolve import "./background"`

- [ ] **Step 3: background を実装する**

`packages/metadata-generator/src/generators/thumbnail/background.ts`:

```ts
// 拡散モデルは日本語を正しく描けないため、背景には一切の文字を出させない。
// タイトルと日付は compose.ts が canvas で描く。
// タイトル自体は画像プロンプトに含めない（日本語を渡しても描けないうえ、
// 意図しないラテン文字が生成される原因になる）。
export const buildBackgroundPrompt = (_title: string): string =>
  "abstract modern news broadcast background, deep blue and teal gradient, " +
  "geometric shapes, clean professional studio lighting, " +
  "no text, no letters, no typography, no watermark";
```

- [ ] **Step 4: テストを実行して成功を確認**

```bash
pnpm --filter metadata-generator test src/generators/thumbnail/background.spec.ts
```

Expected: PASS。`Tests 2 passed (2)`

- [ ] **Step 5: index の失敗テストを書く**

`packages/metadata-generator/src/generators/thumbnail/index.spec.ts`:

```ts
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../infrastructure/bedrock-image", async () => {
  const actual = await vi.importActual<
    typeof import("../../infrastructure/bedrock-image")
  >("../../infrastructure/bedrock-image");
  return {
    ...actual,
    createBedrockImageClient: vi.fn(() => ({ send: vi.fn() })),
    generateBackgroundImage: vi.fn(),
  };
});

import { createCanvas } from "@napi-rs/canvas";
import { generateBackgroundImage } from "../../infrastructure/bedrock-image";
import { BedrockImageError } from "../../infrastructure/bedrock-image";
import { generateThumbnail } from "./index";

const buildScript = () =>
  ({
    title: "テスト番組タイトル",
    newsItems: [],
    sections: [],
  }) as never;

const backgroundBase64 = (): string => {
  const canvas = createCanvas(2016, 1152);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#14324f";
  ctx.fillRect(0, 0, 2016, 1152);
  return canvas.toBuffer("image/png").toString("base64");
};

describe("generateThumbnail", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should return a base64 PNG with the image/png content type", async () => {
    // Arrange
    vi.mocked(generateBackgroundImage).mockReturnValue(() =>
      Effect.succeed(backgroundBase64()),
    );

    // Act
    const result = await Effect.runPromise(generateThumbnail(buildScript()));

    // Assert
    expect(result.contentType).toBe("image/png");
    expect(
      Buffer.from(result.imageBase64, "base64").subarray(0, 8).toString("hex"),
    ).toBe("89504e470d0a1a0a");
  });

  it("should fail when the background cannot be generated", async () => {
    // Arrange
    vi.mocked(generateBackgroundImage).mockReturnValue(() =>
      Effect.fail(new BedrockImageError({ message: "AccessDeniedException" })),
    );

    // Act
    const exit = await Effect.runPromiseExit(
      generateThumbnail(buildScript()),
    );

    // Assert
    expect(exit._tag).toBe("Failure");
  });
});
```

- [ ] **Step 6: テストを実行して失敗を確認**

```bash
pnpm --filter metadata-generator test src/generators/thumbnail/index.spec.ts
```

Expected: FAIL。`./index` が解決できない。

- [ ] **Step 7: index を実装する**

`packages/metadata-generator/src/generators/thumbnail/index.ts`:

```ts
import { Effect, Schema } from "effect";
import type { Script, ThumbnailResult } from "../../schema";
import {
  createBedrockImageClient,
  generateBackgroundImage,
} from "../../infrastructure/bedrock-image";
import { buildBackgroundPrompt } from "./background";
import { composeThumbnail } from "./compose";

// ============================================
// Error type
// ============================================

export class ThumbnailGenerationError extends Schema.TaggedErrorClass<ThumbnailGenerationError>()(
  "ThumbnailGenerationError",
  { message: Schema.String },
) {}

// ============================================
// Public function
// ============================================

const client = createBedrockImageClient();

export const generateThumbnail = (
  script: Script,
): Effect.Effect<ThumbnailResult, ThumbnailGenerationError> =>
  Effect.gen(function* () {
    const background = yield* generateBackgroundImage(client)(
      buildBackgroundPrompt(script.title),
    ).pipe(
      Effect.mapError(
        (e) => new ThumbnailGenerationError({ message: e.message }),
      ),
    );

    const png = yield* Effect.tryPromise({
      try: () =>
        composeThumbnail({
          background: Buffer.from(background, "base64"),
          title: script.title,
          date: formatJstDate(new Date()),
        }),
      catch: (e) =>
        new ThumbnailGenerationError({
          message: e instanceof Error ? e.message : String(e),
        }),
    });

    return {
      imageBase64: png.toString("base64"),
      contentType: "image/png" as const,
    };
  });

// ============================================
// Helpers
// ============================================

// Script に日付フィールドが無いため、Lambda の実行時刻を JST で使う。
const formatJstDate = (now: Date): string => {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(now);
  return parts;
};
```

- [ ] **Step 8: 旧実装を削除する**

```bash
git rm packages/metadata-generator/src/generators/thumbnail.ts
```

- [ ] **Step 9: 参照が壊れていないか確認する**

```bash
grep -rn "generators/thumbnail" packages/metadata-generator/src --include="*.ts"
```

Expected: `pipeline/generate-metadata.ts:7-8` が `../generators/thumbnail` から `ThumbnailGenerationError` と `generateThumbnail` を import している。拡張子なしなので `thumbnail/index.ts` に解決される。**このファイルの変更は不要**。

- [ ] **Step 10: schema の説明文を直す**

`packages/shared/src/schemas/metadata-output.ts` の8行目を変更する。

変更前:
```ts
        "Amazon Nova Canvas が生成したPNG画像のbase64エンコード済みデータ",
```
変更後:
```ts
        "サムネイルPNG画像のbase64エンコード済みデータ。背景はBedrockの画像モデル、タイトル文字はcanvasで合成",
```

- [ ] **Step 11: metadata-generator のテストを全部実行**

```bash
pnpm --filter metadata-generator test
```

Expected: PASS。旧 `thumbnail.ts` の spec が残っていて落ちる場合は、`packages/metadata-generator/src/generators/thumbnail.spec.ts` を `git rm` する。

- [ ] **Step 12: 型チェック**

```bash
pnpm --filter metadata-generator exec tsc --noEmit
pnpm --filter @video-factory/shared exec tsc --noEmit
```

Expected: どちらも出力なし。

- [ ] **Step 13: コミット**

```bash
git add packages/metadata-generator/src/generators packages/shared/src/schemas/metadata-output.ts
git commit -m "feat(metadata-generator): サムネイルを背景生成とテキスト合成の2段構成に再構築"
```

---

## Task 10: Dockerfile を更新する

`@napi-rs/canvas` はネイティブバイナリを含むので esbuild でバンドルできない。フォントも実行時に読むため同梱が要る。

**Files:**
- Modify: `packages/metadata-generator/Dockerfile`

- [ ] **Step 1: Dockerfile を書き換える**

`packages/metadata-generator/Dockerfile` を以下に置き換える。

```dockerfile
FROM public.ecr.aws/lambda/nodejs:22 AS builder

RUN corepack enable && corepack prepare pnpm@10.25.0 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY config/ ./config/
COPY packages/shared/package.json ./packages/shared/
COPY packages/metadata-generator/package.json ./packages/metadata-generator/

RUN pnpm --filter metadata-generator install --frozen-lockfile

COPY packages/shared/ ./packages/shared/
COPY packages/metadata-generator/ ./packages/metadata-generator/

WORKDIR /app/packages/metadata-generator

# @napi-rs/canvas はネイティブバイナリを含むためバンドルできない。
# external に逃がし、ランタイムステージへ node_modules ごとコピーする。
RUN npx esbuild src/entrypoints/lambda.ts \
  --bundle \
  --platform=node \
  --target=node22 \
  --outfile=dist/lambda.mjs \
  --format=esm \
  --external:@napi-rs/canvas \
  --banner:js="import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);"

FROM public.ecr.aws/lambda/nodejs:22

COPY --from=builder /app/packages/metadata-generator/dist/lambda.mjs ${LAMBDA_TASK_ROOT}/
COPY --from=builder /app/packages/metadata-generator/assets/ ${LAMBDA_TASK_ROOT}/assets/

# pnpm の node_modules はシンボリックリンクの集合なので COPY では壊れる。
# ランタイムに必要なネイティブ依存は1つだけなので、実ファイルとして入れ直す。
# lambda.mjs は ESM なので、Node は /var/task/node_modules から解決する。
RUN npm install --omit=dev --prefix ${LAMBDA_TASK_ROOT} @napi-rs/canvas@1.0.1

CMD ["lambda.handler"]
```

バージョン `1.0.1` は `packages/metadata-generator/package.json` の指定と一致させること。片方だけ上げるとローカルと Lambda で挙動がずれる。

- [ ] **Step 2: フォントパスの解決を Lambda のレイアウトに合わせる**

`compose.ts` の `fontPath` は `new URL("../../../assets/NotoSansJP.ttf", import.meta.url)` でソースツリーの位置を辿っている。Lambda では `lambda.mjs` が `${LAMBDA_TASK_ROOT}` 直下、`assets/` がその下にあるため、この相対パスでは解決できない。以下に置き換える。

`packages/metadata-generator/src/generators/thumbnail/compose.ts` の `fontPath` の定義を差し替える:

```ts
// Lambda では lambda.mjs と assets/ が LAMBDA_TASK_ROOT 直下に並ぶ。
// ローカル（vitest / tsx）ではソースツリーから辿る。
const fontPath = process.env.LAMBDA_TASK_ROOT
  ? `${process.env.LAMBDA_TASK_ROOT}/assets/NotoSansJP.ttf`
  : fileURLToPath(new URL("../../../assets/NotoSansJP.ttf", import.meta.url));
```

- [ ] **Step 3: テストを再実行してローカル側が壊れていないことを確認**

```bash
pnpm --filter metadata-generator test src/generators/thumbnail/compose.spec.ts
```

Expected: PASS。

- [ ] **Step 4: Docker イメージをビルドして検証する**

```bash
docker build -f packages/metadata-generator/Dockerfile -t metadata-generator-test .
```

Expected: ビルド成功。

- [ ] **Step 5: イメージ内でフォントと canvas が読めることを確認する**

```bash
docker run --rm --entrypoint node metadata-generator-test -e '
const { GlobalFonts } = require("/var/task/node_modules/@napi-rs/canvas");
const ok = GlobalFonts.registerFromPath("/var/task/assets/NotoSansJP.ttf", "NotoSansJP");
console.log("registered:", GlobalFonts.has("NotoSansJP"));
'
```

Expected: `registered: true`

これが `false` になる場合はフォントのコピー先が違う。`docker run --rm --entrypoint ls metadata-generator-test /var/task/assets` で確認する。

- [ ] **Step 5.5: ハンドラが実際に読み込めることを確認する**

```bash
docker run --rm --entrypoint node metadata-generator-test -e '
import("/var/task/lambda.mjs").then((m) => console.log("handler:", typeof m.handler));
'
```

Expected: `handler: function`

これが失敗する場合、`@napi-rs/canvas` の解決に失敗している。`docker run --rm --entrypoint ls metadata-generator-test /var/task/node_modules/@napi-rs/canvas` で実体を確認する。

- [ ] **Step 6: コミット**

```bash
git add packages/metadata-generator/Dockerfile packages/metadata-generator/src/generators/thumbnail/compose.ts
git commit -m "build(metadata-generator): canvas とフォントを Lambda イメージに同梱"
```

---

## Task 11: 全体検証

**Files:** なし

- [ ] **Step 1: 全パッケージのテストを実行**

```bash
pnpm --filter @video-factory/shared test && \
pnpm --filter script-generator test && \
pnpm --filter metadata-generator test && \
pnpm --filter video-worker test
```

Expected: すべて PASS。

- [ ] **Step 2: infra のテストを実行**

```bash
cd infra && npx jest && cd ..
```

Expected: `Tests 27 passed (27)`

- [ ] **Step 3: 全パッケージの型チェック**

```bash
pnpm --filter @video-factory/shared exec tsc --noEmit && \
pnpm --filter script-generator exec tsc --noEmit && \
pnpm --filter metadata-generator exec tsc --noEmit
```

Expected: いずれも出力なし。

- [ ] **Step 4: lint**

```bash
pnpm lint
```

Expected: `Checked N files ... No fixes applied.` エラーがあれば `pnpm lint:fix` で直し、直らないものは手で直す。

- [ ] **Step 5: CDK の synth が通ることを確認**

```bash
cd infra && npx cdk synth --quiet && cd ..
```

Expected: エラーなし。

- [ ] **Step 6: 未コミットの変更が残っていないことを確認**

```bash
git status --short
```

Expected: このプラン以前から未コミットだった `infra/lib/orchestration.ts`、`infra/test/video-factory-stack.test.ts`、`.claude/settings.local.json` 以外に差分が無いこと。

- [ ] **Step 7: 先行して入っていた Step Functions のログ設定をコミット**

このプランの作業開始前に、Step Functions の CloudWatch Logs 転送設定が作業ツリーに入っている（`infra/lib/orchestration.ts` と `infra/test/video-factory-stack.test.ts`）。テストは通っているので、ここでコミットする。

```bash
git add infra/lib/orchestration.ts infra/test/video-factory-stack.test.ts
git commit -m "feat(infra): Step Functions の実行ログを CloudWatch Logs に転送"
```

---

## 完了後に残る既知の課題

これらは本プランのスコープ外。別 spec で扱う。

- `UploadLambda` はスタブのままで、Google Drive には何も上がらない
- 概要欄・初コメは `.json` で S3 に出力されており、`.txt` にはなっていない
- ECS のロググループは保持期間が未設定（無期限）
- `response.object` が `undefined` になる根本原因は `@mastra/core` 内部にあり、リトライで確率的に回避しているだけ。デプロイ後に失敗率を観測し、必要なら「Mastra の `structuredOutput` を使わず自前で JSON 抽出する」方向に踏み込む

## デプロイ

マージ後に CI がイメージをビルドし `cdk deploy` を実行する。`metadata-generator` は Dockerfile が変わるためイメージの再ビルドが必須。
