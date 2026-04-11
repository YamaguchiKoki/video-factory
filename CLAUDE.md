# Architecture
```
EventBridge (毎日定時)
       │
       ▼
Step Functions
       │
       ├─► 1. Script Generator [Lambda]: 対話型のラジオ用スクリプトを作成する
       │      Strands + Bedrock + Tavily
       │      → S3 (JSON)
       │
       ├─► 2a. Metadata Generator [Lambda]: 1のスクリプトからYouTube用メタデータを生成
       │       Mastra + Bedrock (テキスト/画像生成)
       │       → S3 (サムネイルPNG, 概要欄JSON, コメントJSON)
       │
       ├─► 2b. TTS Worker [ECS Fargate]: 1で作成したスクリプトを音声に変換
       │       VOICEVOX
       │       → S3 (WAV)
       │
       ├─► 3. Video Worker [ECS Fargate]: remotionを使った動画生成
       │      → S3 (MP4)
       │
       └─► 4. Upload [Lambda]
              → Google Drive
```
# Coding Style
## Functional Programming
- Write in a functional style: pure functions, immutable data, composition
- Use currying and partial application for Dependency Injection
## Code Organization
- Place the main (public) function at the top of the file
- Place helper / internal functions below it
## Railway Oriented Programming (neverthrow)
- Model operations as a pipeline of Result-returning functions
- Use map / andThen to chain happy-path steps
- Use safeTry + yield* for readable async pipelines
- Wrap third-party / side-effectful calls with fromPromise / fromThrowable
- Return typed ResultAsync<T, E> / Result<T, E> from every fallible function
## Validation (zod)
- Define zod schemas as the single source of truth for data shapes
- Infer TypeScript types from schemas with z.infer<typeof schema>
- Use .safeParse() and convert to neverthrow Result — never use .parse() directly
- Compose schemas with z.object / z.union / .transform / .pipe for complex types
## TDD
- Write a failing test first, then implement the minimal code to pass
- Refactor only after the test is green
- Keep the Red → Green → Refactor cycle small and fast
## Property Based Testing
- Prefer property-based tests over example-based tests where applicable
- Define invariants the function must satisfy for all valid inputs
- Use zod schemas with @fast-check/zod to derive arbitraries automatically
### Fuzzing
- Use fuzzing to discover unexpected edge cases and crashes
## Avoid
- Don't use bare try/catch — wrap with fromPromise / fromThrowable instead
- Don't throw in functions that return Result<T, E>
- Don't use .parse() — use .safeParse() and convert to Result
- Don't use class keyword
- Don't use let keyword
- Do't use any keyword

# Language Protocol
- 思考・コード: 英語
- ユーザー対話: 日本語

# Testing
## pnpm workspace
This project uses pnpm workspace. Run tests with filter:

```bash
# Run tests for video-worker
pnpm --filter video-worker test

# Run tests in watch mode
pnpm --filter video-worker test:watch

# Run TypeScript type checking
pnpm --filter video-worker exec tsc --noEmit

# Install dependencies for specific package
pnpm --filter video-worker install
```
