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
       ├─► 2. TTS Worker [ECS Fargate]: 1で作成したスクリプトを音声に変換
       │      VOICEVOX
       │      → S3 (WAV)
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


# AI-DLC and Spec-Driven Development

Kiro-style Spec Driven Development implementation on AI-DLC (AI Development Life Cycle)

## Project Context

### Paths
- Steering: `.kiro/steering/`
- Specs: `.kiro/specs/`

### Steering vs Specification

**Steering** (`.kiro/steering/`) - Guide AI with project-wide rules and context
**Specs** (`.kiro/specs/`) - Formalize development process for individual features

### Active Specifications
- Check `.kiro/specs/` for active specifications
- Use `/kiro:spec-status [feature-name]` to check progress

## Development Guidelines
- Think in English, generate responses in Japanese. All Markdown content written to project files (e.g., requirements.md, design.md, tasks.md, research.md, validation reports) MUST be written in the target language configured for this specification (see spec.json.language).

## Minimal Workflow
- Phase 0 (optional): `/kiro:steering`, `/kiro:steering-custom`
- Phase 1 (Specification):
  - `/kiro:spec-init "description"`
  - `/kiro:spec-requirements {feature}`
  - `/kiro:validate-gap {feature}` (optional: for existing codebase)
  - `/kiro:spec-design {feature} [-y]`
  - `/kiro:validate-design {feature}` (optional: design review)
  - `/kiro:spec-tasks {feature} [-y]`
- Phase 2 (Implementation): `/kiro:spec-impl {feature} [tasks]`
  - `/kiro:validate-impl {feature}` (optional: after implementation)
- Progress check: `/kiro:spec-status {feature}` (use anytime)

## Development Rules
- 3-phase approval workflow: Requirements → Design → Tasks → Implementation
- Human review required each phase; use `-y` only for intentional fast-track
- Keep steering current and verify alignment with `/kiro:spec-status`
- Follow the user's instructions precisely, and within that scope act autonomously: gather the necessary context and complete the requested work end-to-end in this run, asking questions only when essential information is missing or the instructions are critically ambiguous.

## Steering Configuration
- Load entire `.kiro/steering/` as project memory
- Default files: `product.md`, `tech.md`, `structure.md`
- Custom files are supported (managed via `/kiro:steering-custom`)
