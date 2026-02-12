# ニュース対話型スクリプト生成エージェント - アーキテクチャ設計書

## 概要

qmdプロジェクトの**クエリ拡張**、**RRF (Reciprocal Rank Fusion)**、**ポジション考慮リランキング**の手法を取り入れた、Mastraベースのニュース対話型スクリプト生成エージェント。

毎日定時で起動し、今日世界で話題になっている政治経済ニュースにまつわる対話型スクリプトを自動生成します。

## システムアーキテクチャ

```
EventBridge (毎日定時)
       │
       ▼
Step Functions
       │
       └─► Script Generator Agent [Lambda]
              │
              ├─► 1. Topic Selection Agent
              │      • Tavilyで今日の主要ニュース取得
              │      • クエリ拡張でバリエーション生成
              │      • RRFで複数ソースを統合
              │      • 政治経済カテゴリにスコアリング
              │      → Top 3 Topics
              │
              ├─► 2. Topic Deep Dive Agent (各トピック並列実行)
              │      • Grok (X API) でX上の意見収集
              │      • Tavilyで詳細情報・背景取得
              │      • 固有名詞保持を重視したチャンク化
              │      • リランキングで示唆に富んだ投稿を優先
              │      → Enriched Topic Context
              │
              ├─► 3. Fact Check Agent
              │      • 複数ソース間でクロスチェック
              │      • 信頼性スコアリング
              │      • 矛盾検出とアラート
              │      → Verified Facts
              │
              └─► 4. Dialogue Script Generator
                     • 解説役 vs 質問役のペルソナ設定
                     • 自然な対話フロー生成
                     • 固有名詞・専門用語の保持検証
                     → S3 (JSON)
```

## qmdプロジェクトから学んだ重要パターン

### 1. クエリ拡張 (Query Expansion)

qmdは**ファインチューニングされた小型LLM (Qwen3-1.7B)** を使用して、1つのクエリを複数の検索バリエーションに拡張します。

**qmdの構造化出力形式**:
```
hyde: [仮説的な文書パッセージ - 50-200文字]
lex: [キーワード重視の短いバリエーション]
lex: [別のキーワードバリエーション]
vec: [自然言語フレーズ]
vec: [別のセマンティックバリエーション]
```

**本プロジェクトへの適用**:
```typescript
type StoryExpansion = {
  type: 'headline' | 'context' | 'opinion';
  text: string;
};

// 例: "渋谷で火災" →
// headline: 渋谷区で建物火災、けが人なし
// context: 渋谷駅周辺の防災体制と過去の火災事例
// opinion: SNSで話題の渋谷火災への反応
```

### 2. Reciprocal Rank Fusion (RRF)

複数の検索結果リストを統合する実証済みの手法。各結果の順位に基づいてスコアを計算し、重み付けで統合します。

**qmdのRRF実装**:
```typescript
const rrfContribution = weight / (k + rank + 1);  // k=60がデフォルト

// Top-rank bonus
if (topRank === 0) score += 0.05;      // #1: +5%
else if (topRank <= 2) score += 0.02;  // #2-3: +2%
```

**本プロジェクトへの適用**:
```typescript
// 複数ニュースソースからRRFで統合
const sources = [
  tavilyResults,   // weight: 2.0 (信頼性高)
  newsAPIResults,  // weight: 1.0
  grokResults,     // weight: 1.0
];
const fused = reciprocalRankFusion(sources, [2.0, 1.0, 1.0]);
```

### 3. ポジション考慮リランキング (Position-Aware Reranking)

RRFランクに基づいて、リランカーとリトリーバルの重みを動的に調整します。

**qmdの重み付け戦略**:
```typescript
// Top 1-3: リトリーバル信号を重視 (完全一致を保護)
if (rrfRank <= 3) rrfWeight = 0.75;  // 75% RRF / 25% reranker

// Top 4-10: バランス
else if (rrfRank <= 10) rrfWeight = 0.60;  // 60% RRF / 40% reranker

// Top 11+: リランカーを信頼
else rrfWeight = 0.40;  // 40% RRF / 60% reranker
```

**本プロジェクトへの適用**:
```typescript
// 情報の新鮮さと信頼性のバランス
const blendedScore = (rank <= 3)
  ? 0.8 * timelinessScore + 0.2 * credibilityScore  // 新しいニュース優先
  : 0.4 * timelinessScore + 0.6 * credibilityScore; // 信頼性重視
```

### 4. チャンク化とベストチャンク選択

長文を処理する際、全文をリランクするのではなく、**最も関連性の高いチャンクのみ**をリランクすることでパフォーマンスを最適化します。

**qmdのチャンキング戦略**:
```typescript
// 800トークン/チャンク、15%オーバーラップ
const chunks = chunkDocument(cand.body, 800, 0.15);

// キーワードオーバーラップでベストチャンクを選択
let bestIdx = 0;
let bestScore = -1;
for (let i = 0; i < chunks.length; i++) {
  const chunkLower = chunks[i].text.toLowerCase();
  const score = queryTerms.reduce((acc, term) =>
    acc + (chunkLower.includes(term) ? 1 : 0), 0);
  if (score > bestScore) { bestScore = score; bestIdx = i; }
}
```

**本プロジェクトへの適用**:
```typescript
// 長い記事から最も関連性の高いセクションのみを抽出
const chunks = chunkArticle(article, 500);  // 500トークン/チャンク
const bestChunk = selectBestChunk(chunks, topic, keywords);
const summary = await llm.summarize(bestChunk);  // 全文ではなくチャンクのみ
```

### 5. 固有名詞の保持 (Named Entity Preservation)

**qmdの報酬関数**では、固有名詞の保持が**-45から+20**という最大のペナルティ/報酬を持ちます。これは情報品質において最重要であることを示します。

**本プロジェクトへの適用**:
```typescript
const entities = extractNamedEntities(originalStory);
const generatedScript = await generateScript(context);

// 生成後に固有名詞が保持されているか検証
const preservedEntities = entities.filter(e =>
  generatedScript.toLowerCase().includes(e.toLowerCase())
);

const preservationScore = preservedEntities.length / entities.length;

// 80%未満の保持率で警告・再生成
if (preservationScore < 0.8) {
  console.warn(`Entity preservation low: ${preservationScore.toFixed(2)}`);
  // オプション: 再生成またはエンティティ注入
}
```

## エージェント設計

### 1. Topic Selection Agent

**目的**: 今日の政治経済ニュースから最も議論価値の高いトピックを選定

**ワークフロー**:
```
1. ベースクエリ: "今日の政治経済ニュース"
2. クエリ拡張: headline/context/opinion の3バリエーション生成
3. マルチソース検索:
   - Tavily (advanced search, 1日以内)
   - NewsAPI (日本語, 24時間以内)
4. RRF統合: Tavily結果に2倍の重み
5. LLMスコアリング:
   - relevanceScore (0-1): 政治経済関連度
   - discussionScore (0-1): 議論価値・論争性
   - timelinessScore (0-1): 新鮮さ
6. 最終スコア = RRF × (0.4×relevance + 0.4×discussion + 0.2×timeliness)
7. Top 3トピックを選定
```

**実装例**:
```typescript
const TopicExpansionSchema = z.object({
  type: z.enum(['headline', 'context', 'opinion']),
  text: z.string(),
});

const ScoredTopicSchema = z.object({
  title: z.string(),
  summary: z.string(),
  url: z.string(),
  score: z.number(),
  relevanceScore: z.number(),
  discussionScore: z.number(),
  timelinessScore: z.number(),
});

const reciprocalRankFusion = (
  resultLists: RankedTopic[][],
  weights: number[] = [],
  k: number = 60
): ScoredTopic[] => {
  // RRF実装 (qmd pattern)
  // ...
};
```

### 2. Topic Deep Dive Agent

**目的**: 選定されたトピックをX (Twitter) とWebで深掘り、示唆に富んだ意見を収集

**ワークフロー**:
```
1. 並列取得:
   - Grok API: X上の関連ポスト (Top 50)
   - Tavily: 詳細記事・背景情報
2. 固有名詞抽出:
   - LLMで人名・組織名・地名を抽出
   - 以降の処理で保持を監視
3. チャンク化:
   - 背景記事を500トークン/チャンク、50トークンオーバーラップ
   - キーワードオーバーラップでベストチャンク選択
4. Xポストリランキング:
   - LLMで各ポストのcredibility (信頼性) とrelevance (関連性) を評価
   - score = 0.6×credibility + 0.4×relevance
   - Top 10ポストを選定
5. Enriched Context出力:
   - topic, backgroundInfo, expertOpinions, keyEntities
```

**実装例**:
```typescript
const EnrichedContextSchema = z.object({
  topic: z.string(),
  backgroundInfo: z.string(), // Tavilyから (ベストチャンク)
  expertOpinions: z.array(z.object({
    text: z.string(),
    author: z.string(),
    credibility: z.number(), // 0-1
  })), // Xから (Top 10)
  keyEntities: z.array(z.string()), // 固有名詞リスト
  chunks: z.array(z.object({
    text: z.string(),
    score: z.number(),
  })),
});

const chunkText = (text: string, chunkSize: number = 500, overlap: number = 50): string[] => {
  const chunks: string[] = [];
  const words = text.split(/\s+/);

  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    chunks.push(words.slice(i, i + chunkSize).join(' '));
  }

  return chunks;
};

const selectBestChunk = (chunks: string[], topic: string, entities: string[]): string => {
  const topicTerms = topic.toLowerCase().split(/\s+/);
  const entityTerms = entities.map(e => e.toLowerCase());
  const allTerms = [...topicTerms, ...entityTerms];

  let bestIdx = 0;
  let bestScore = -1;

  for (let i = 0; i < chunks.length; i++) {
    const chunkLower = chunks[i].toLowerCase();
    const score = allTerms.reduce((acc, term) =>
      acc + (chunkLower.includes(term) ? 1 : 0), 0
    );

    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  return chunks[bestIdx];
};
```

### 3. Fact Check Agent

**目的**: 複数ソース間でクロスチェックし、信頼性を検証

**ワークフロー**:
```
1. クレーム抽出:
   - 背景情報とエキスパート意見から主要な主張を抽出
2. 各クレームを複数ソースで検証:
   - 支持する情報源をリスト化
   - 矛盾する情報を検出
3. 信頼性スコアリング:
   - confidence (0-1): 支持ソース数 / 総ソース数
   - verified: true/false
4. 検証済み事実のみを出力
```

**実装例**:
```typescript
const FactCheckResultSchema = z.object({
  claim: z.string(),
  verified: z.boolean(),
  confidence: z.number(), // 0-1
  sources: z.array(z.string()),
  contradictions: z.array(z.string()).optional(),
});

const factCheckClaim = (claim: string, context: EnrichedContext) => (llm: LLM): ResultAsync<FactCheckResult, Error> => {
  const sources = [
    context.backgroundInfo,
    ...context.expertOpinions.map(o => o.text),
  ];

  return ResultAsync.fromPromise(
    llm.generate({
      prompt: `Fact-check this claim using the provided sources:
Claim: ${claim}

Sources:
${sources.map((s, i) => `[${i + 1}] ${s}`).join('\n\n')}

Return JSON:
{
  "claim": "${claim}",
  "verified": <true/false>,
  "confidence": <0.0-1.0>,
  "sources": ["source indices that support this"],
  "contradictions": ["any contradicting information"]
}`,
      maxTokens: 300,
    }),
    (error) => new Error(`Fact check failed: ${error}`)
  );
};
```

### 4. Dialogue Script Generator

**目的**: 解説役と質問役の自然な対話形式で原稿生成（固有名詞保持を重視）

**ワークフロー**:
```
1. ペルソナ設定:
   - Explainer: 専門家、トピックを分かりやすく解説
   - Questioner: 好奇心旺盛、視聴者目線で質問
2. 対話生成:
   - 10-15回の対話交換
   - 検証済み事実とエキスパート意見を織り込む
   - 固有名詞を必ず保持 (qmdの-45点ペナルティを回避)
3. Entity Preservation Check:
   - 生成後に固有名詞保持率を計算
   - 80%未満の場合は警告・再生成
4. 出力:
   - topic, dialogue[], keyEntities, entityPreservationScore
```

**実装例**:
```typescript
const DialogueSchema = z.object({
  speaker: z.enum(['explainer', 'questioner']),
  text: z.string(),
});

const ScriptSchema = z.object({
  topic: z.string(),
  dialogue: z.array(DialogueSchema),
  keyEntities: z.array(z.string()),
  entityPreservationScore: z.number(), // 0-1
});

const checkEntityPreservation = (
  originalEntities: string[],
  generatedScript: string
): number => {
  const scriptLower = generatedScript.toLowerCase();
  const preserved = originalEntities.filter((entity) =>
    scriptLower.includes(entity.toLowerCase())
  );

  return preserved.length / originalEntities.length; // 0-1
};

const generateDialogue = (context: EnrichedContext, factCheckResults: FactCheckResult[]) => (llm: LLM): ResultAsync<Script, Error> => {
  const prompt = `Generate a conversational radio script between two hosts:
- Explainer: Expert who explains the topic clearly
- Questioner: Curious host who asks clarifying questions

Topic: ${context.topic}
Background: ${context.backgroundInfo}
Key Entities (MUST preserve): ${context.keyEntities.join(', ')}

Expert Opinions:
${context.expertOpinions.map((o) => `- ${o.author}: ${o.text}`).join('\n')}

Verified Facts:
${factCheckResults.filter(f => f.verified).map(f => `- ${f.claim}`).join('\n')}

Requirements:
1. Natural, engaging dialogue (10-15 exchanges)
2. CRITICAL: Preserve all key entities (${context.keyEntities.join(', ')})
3. Explainer provides context, Questioner asks follow-up questions
4. Include diverse expert opinions from X
5. Keep language accessible (avoid jargon without explanation)

Return JSON:
{
  "topic": "${context.topic}",
  "dialogue": [
    { "speaker": "questioner", "text": "..." },
    { "speaker": "explainer", "text": "..." },
    ...
  ]
}`;

  // 生成後にentityPreservationScoreを計算
  // ...
};
```

## Mastra Workflow

全エージェントをオーケストレーションするMastraワークフロー:

```typescript
import { Mastra } from '@mastra/core';
import { createTopicSelectionAgent } from './agents/topic-selection';
import { createTopicDeepDiveAgent } from './agents/topic-deep-dive';
import { createFactCheckAgent } from './agents/fact-check';
import { createDialogueGeneratorAgent } from './agents/dialogue-generator';

export const createScriptGenerationWorkflow = (mastra: Mastra) => {
  const topicSelectionAgent = createTopicSelectionAgent(mastra);
  const deepDiveAgent = createTopicDeepDiveAgent(mastra);
  const factCheckAgent = createFactCheckAgent(mastra);
  const dialogueAgent = createDialogueGeneratorAgent(mastra);

  return mastra.createWorkflow({
    name: 'daily-script-generation',
    description: 'Daily news radio script generation pipeline',

    steps: [
      {
        name: 'select-topics',
        agent: topicSelectionAgent,
        output: 'topics', // Top 3 topics
      },
      {
        name: 'deep-dive',
        agent: deepDiveAgent,
        parallel: true, // 3トピック並列実行
        input: ({ topics }) => topics,
        output: 'enrichedContexts',
      },
      {
        name: 'fact-check',
        agent: factCheckAgent,
        parallel: true,
        input: ({ enrichedContexts }) => enrichedContexts.map(ctx => ({
          claims: extractClaimsFromContext(ctx),
          context: ctx,
        })),
        output: 'factCheckResults',
      },
      {
        name: 'generate-scripts',
        agent: dialogueAgent,
        parallel: true,
        input: ({ enrichedContexts, factCheckResults }) =>
          enrichedContexts.map((ctx, idx) => ({
            context: ctx,
            factCheckResults: factCheckResults[idx],
          })),
        output: 'scripts',
      },
    ],

    onComplete: async ({ scripts }) => {
      const s3Key = `scripts/${new Date().toISOString()}.json`;
      await uploadToS3(s3Key, JSON.stringify(scripts, null, 2));

      return { s3Key, scripts };
    },
  });
};
```

## パフォーマンス最適化

qmdの知見を適用したパフォーマンス最適化戦略:

### 1. Early Exit最適化

強力なシグナルを検出したら、高額な処理をスキップします。

```typescript
// Step 1: BM25/keyword searchでプローブ
const initialResults = await quickKeywordSearch(query);
const hasStrongSignal = topScore >= 0.85 && (topScore - secondScore) >= 0.15;

// Step 2: 強力なシグナルがある場合はクエリ拡張をスキップ
const expanded = hasStrongSignal ? [] : await expandQuery(query);
```

### 2. 並列実行

3トピックの深掘りと原稿生成を並列化してレイテンシを削減:

```typescript
// Mastra workflowで自動的に並列実行
{
  name: 'deep-dive',
  agent: deepDiveAgent,
  parallel: true, // 3トピック同時実行
  input: ({ topics }) => topics,
}
```

### 3. チャンク化

長文記事の全文ではなく、最適なチャンクのみをLLM処理:

```typescript
// 500トークン/チャンク、50トークンオーバーラップ
const chunks = chunkText(article, 500, 50);
const bestChunk = selectBestChunk(chunks, topic, entities);

// ベストチャンクのみをLLMに渡す
const summary = await llm.summarize(bestChunk);
```

### 4. キャッシング

クエリ拡張とリランク結果をDynamoDBでキャッシュ (24時間TTL):

```typescript
const getCachedResult = async (key: string): Promise<string | null> => {
  const result = await dynamodb.getItem({
    TableName: 'script-generator-cache',
    Key: { cacheKey: { S: key } },
  });
  return result.Item?.value?.S || null;
};

const cacheResult = async (key: string, value: string, ttl: number = 86400) => {
  await dynamodb.putItem({
    TableName: 'script-generator-cache',
    Item: {
      cacheKey: { S: key },
      value: { S: value },
      expiresAt: { N: String(Math.floor(Date.now() / 1000) + ttl) },
    },
  });
};

// 使用例
const expandQuery = async (query: string): Promise<TopicExpansion[]> => {
  const cacheKey = `expand:${query}`;
  const cached = await getCachedResult(cacheKey);

  if (cached) return JSON.parse(cached);

  const result = await llm.expand(query);
  await cacheResult(cacheKey, JSON.stringify(result));

  return result;
};
```

### 5. パフォーマンス目標

```
Topic Selection:     < 5秒   (クエリ拡張 + マルチソース検索 + RRF + スコアリング)
Deep Dive (×3):      < 10秒  (並列実行: Grok + Tavily + チャンク + リランク)
Fact Check (×3):     < 5秒   (並列実行: LLM検証)
Script Gen (×3):     < 15秒  (並列実行: 対話生成 + エンティティチェック)
----------------------------
Total Pipeline:      < 35秒
```

## データフロー

```
Input: EventBridge Trigger (毎日定時)
  ↓
Topic Selection Agent
  Output: Top3Topics = [
    { title: "...", summary: "...", score: 0.95, ... },
    { title: "...", summary: "...", score: 0.89, ... },
    { title: "...", summary: "...", score: 0.82, ... },
  ]
  ↓
Deep Dive Agent (並列 ×3)
  Output: EnrichedContexts = [
    {
      topic: "...",
      backgroundInfo: "...",
      expertOpinions: [{ text: "...", author: "...", credibility: 0.9 }, ...],
      keyEntities: ["日本銀行", "黒田東彦", "金融政策", ...],
      chunks: [{ text: "...", score: 1.0 }],
    },
    ...
  ]
  ↓
Fact Check Agent (並列 ×3)
  Output: FactCheckResults = [
    [
      { claim: "...", verified: true, confidence: 0.95, sources: [...] },
      { claim: "...", verified: false, confidence: 0.3, contradictions: [...] },
      ...
    ],
    ...
  ]
  ↓
Dialogue Generator (並列 ×3)
  Output: Scripts = [
    {
      topic: "...",
      dialogue: [
        { speaker: "questioner", text: "今日の日銀の発表について教えてください" },
        { speaker: "explainer", text: "日本銀行が..." },
        ...
      ],
      keyEntities: ["日本銀行", "黒田東彦", ...],
      entityPreservationScore: 0.95,
    },
    ...
  ]
  ↓
S3 Upload
  Output: s3://bucket/scripts/2026-02-11T12:00:00.000Z.json
```

## エラーハンドリング

Railway Oriented Programming (neverthrow) を使用した堅牢なエラーハンドリング:

```typescript
import { ResultAsync } from 'neverthrow';

// 全エージェント関数はResult<T, E>を返す
const fetchTopics = (query: string): ResultAsync<Topic[], Error> =>
  ResultAsync.fromPromise(
    tavilyAPI.search(query),
    (error) => new Error(`Tavily search failed: ${error}`)
  ).andThen((results) => {
    if (results.length === 0) {
      return ResultAsync.fromSafePromise(
        Promise.reject(new Error('No topics found'))
      );
    }
    return ResultAsync.fromSafePromise(Promise.resolve(results));
  });

// エラー時のフォールバック戦略
const topicsResult = await fetchTopics(query);

if (topicsResult.isErr()) {
  // フォールバック: キャッシュから取得
  const cachedTopics = await getCachedTopics();
  if (cachedTopics) {
    return cachedTopics;
  }

  // それでも失敗したらデフォルトトピックを返す
  return DEFAULT_TOPICS;
}
```

## テスト戦略

TDDとプロパティベーステストを使用:

```typescript
import { describe, it, expect } from 'vitest';
import { fc } from '@fast-check/vitest';
import { z } from 'zod';

// プロパティベーステスト: RRF関数
describe('reciprocalRankFusion', () => {
  it('should preserve top-ranked items from all lists', () => {
    fc.assert(
      fc.property(
        fc.array(fc.array(fc.record({ url: fc.string(), rank: fc.nat() })), { minLength: 1 }),
        (resultLists) => {
          const fused = reciprocalRankFusion(resultLists);

          // Invariant: Top item from each list should appear in fused results
          for (const list of resultLists) {
            if (list.length > 0) {
              const topItem = list[0];
              expect(fused.some(r => r.url === topItem.url)).toBe(true);
            }
          }
        }
      )
    );
  });

  it('should assign higher scores to items appearing in multiple lists', () => {
    const duplicateItem = { url: 'duplicate', rank: 0 };
    const uniqueItem = { url: 'unique', rank: 0 };

    const lists = [
      [duplicateItem, uniqueItem],
      [duplicateItem],
    ];

    const fused = reciprocalRankFusion(lists);

    const duplicateScore = fused.find(r => r.url === 'duplicate')?.score ?? 0;
    const uniqueScore = fused.find(r => r.url === 'unique')?.score ?? 0;

    expect(duplicateScore).toBeGreaterThan(uniqueScore);
  });
});

// プロパティベーステスト: Entity Preservation
describe('checkEntityPreservation', () => {
  it('should return 1.0 when all entities are preserved', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string(), { minLength: 1, maxLength: 10 }),
        (entities) => {
          const script = entities.join(' and ');
          const score = checkEntityPreservation(entities, script);
          expect(score).toBe(1.0);
        }
      )
    );
  });

  it('should be case-insensitive', () => {
    const entities = ['Toyota', 'Honda'];
    const script = 'toyota and HONDA are leading car manufacturers';
    const score = checkEntityPreservation(entities, script);
    expect(score).toBe(1.0);
  });
});
```

## デプロイメント

### Lambda設定

```typescript
// CDK定義
const scriptGeneratorLambda = new lambda.Function(this, 'ScriptGenerator', {
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset('dist/script-generator'),
  timeout: cdk.Duration.seconds(300), // 5分 (全パイプライン)
  memorySize: 2048, // 2GB (LLM処理)
  environment: {
    TAVILY_API_KEY: process.env.TAVILY_API_KEY!,
    GROK_API_KEY: process.env.GROK_API_KEY!,
    NEWS_API_KEY: process.env.NEWS_API_KEY!,
    BEDROCK_REGION: 'us-east-1',
    CACHE_TABLE_NAME: cacheTable.tableName,
    OUTPUT_BUCKET: outputBucket.bucketName,
  },
});

// DynamoDB権限
cacheTable.grantReadWriteData(scriptGeneratorLambda);

// S3権限
outputBucket.grantWrite(scriptGeneratorLambda);

// Bedrock権限
scriptGeneratorLambda.addToRolePolicy(new iam.PolicyStatement({
  actions: ['bedrock:InvokeModel'],
  resources: ['*'],
}));
```

### EventBridge スケジュール

```typescript
// 毎日午前9時 (JST) に実行
const rule = new events.Rule(this, 'DailyScriptGeneration', {
  schedule: events.Schedule.cron({
    hour: '0',   // UTC 0:00 = JST 9:00
    minute: '0',
  }),
});

rule.addTarget(new targets.LambdaFunction(scriptGeneratorLambda));
```

## モニタリング

### CloudWatch メトリクス

```typescript
// カスタムメトリクス
const putMetric = async (name: string, value: number, unit: string = 'Count') => {
  await cloudwatch.putMetricData({
    Namespace: 'ScriptGenerator',
    MetricData: [{
      MetricName: name,
      Value: value,
      Unit: unit,
      Timestamp: new Date(),
    }],
  });
};

// 使用例
await putMetric('TopicsSelected', 3);
await putMetric('EntityPreservationScore', 0.95, 'None');
await putMetric('PipelineDuration', 32.5, 'Seconds');
await putMetric('FactCheckFailures', 2);
```

### アラート

```typescript
// Entity Preservation が低い場合にアラート
const entityPreservationAlarm = new cloudwatch.Alarm(this, 'LowEntityPreservation', {
  metric: new cloudwatch.Metric({
    namespace: 'ScriptGenerator',
    metricName: 'EntityPreservationScore',
    statistic: 'Average',
  }),
  threshold: 0.8,
  comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
  evaluationPeriods: 1,
  alarmDescription: 'Entity preservation score is below 80%',
});

entityPreservationAlarm.addAlarmAction(new actions.SnsAction(alertTopic));
```

## 今後の拡張

### 1. ファインチューニング (qmdスタイル)

qmdと同様に、小型LLM (Qwen3-1.7B) をクエリ拡張用にファインチューニング:

```python
# finetune/generate_data.py
# Claudeで高品質な訓練データ生成

import anthropic

client = anthropic.Anthropic()

def generate_training_examples(base_queries: list[str]) -> list[dict]:
    examples = []

    for query in base_queries:
        response = client.messages.create(
            model="claude-3-7-sonnet-20250219",
            messages=[{
                "role": "user",
                "content": f"""Generate 3 search query variations for news research:
Base query: {query}

Format:
headline: [concise headline version]
context: [background/historical context angle]
opinion: [public opinion/reaction angle]"""
            }]
        )

        examples.append({
            "input": query,
            "output": response.content[0].text,
        })

    return examples
```

### 2. マルチモーダル入力

画像・動画ニュースも取り込む:

```typescript
// Tavily image search
const imageResults = await tavily.search({
  query: topic,
  searchDepth: 'advanced',
  includeImages: true,
});

// Claude 3で画像を解析
const imageAnalysis = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  messages: [{
    role: 'user',
    content: [
      { type: 'image', source: { type: 'url', url: imageResults[0].image } },
      { type: 'text', text: 'この画像のニュースコンテキストを説明してください' },
    ],
  }],
});
```

### 3. リアルタイムストリーミング

X (Twitter) のリアルタイムストリームを監視:

```typescript
// X API v2 Filtered Stream
const stream = await xClient.stream('tweets/search/stream', {
  'tweet.fields': 'created_at,author_id,public_metrics',
  expansions: 'author_id',
});

stream.on('data', async (tweet) => {
  if (isRelevantToCurrentTopics(tweet)) {
    await enrichContext(tweet);
  }
});
```

## 参考文献

- [qmd project](https://github.com/tobi/qmd): Query expansion, RRF, reranking patterns
- [Mastra documentation](https://mastra.ai/docs): Agent framework
- [Anthropic Bedrock integration](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude-messages.html)
- [Tavily Search API](https://docs.tavily.com/)
- [Grok (X) API](https://docs.x.ai/api)

---

**Last updated**: 2026-02-11
**Author**: Claude Code
**Version**: 1.0.0
