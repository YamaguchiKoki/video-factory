# Technology Stack

## Architecture

**Serverless Event-Driven Pipeline**
AWS Step Functions orchestrates four sequential stages: script generation (Lambda) → TTS (ECS Fargate) → video rendering (ECS Fargate) → upload (Lambda). State passed via S3 (JSON scripts, WAV audio, MP4 video).

## Core Technologies

- **Language**: TypeScript (ESM modules)
- **Runtime**: Node.js 20+ (via mise)
- **Package Manager**: pnpm workspace (monorepo)
- **Infrastructure**: AWS CDK v2 (TypeScript)

## Key Libraries

- **Functional Error Handling**: neverthrow (Railway Oriented Programming pattern)
- **Validation**: Zod schemas with safeParse (no direct `.parse()`)
- **AI/Agent Framework**: Strands SDK (@strands-agents/sdk), Bedrock Agent SDK
- **Video**: Remotion 4.x with React 19, Tailwind CSS v4
- **Testing**: Vitest (workspace-aware), fast-check (property-based testing)
- **Code Quality**: Biome (linting + formatting)

## Development Standards

### Functional Programming Style
- Pure functions, immutable data, function composition
- Currying and partial application for dependency injection
- Public functions at top of file, helpers below

### Railway Oriented Programming (neverthrow)
- Model operations as Result-returning pipelines (`Result<T, E>` / `ResultAsync<T, E>`)
- Chain with `map` / `andThen` for happy path
- Use `safeTry` + `yield*` for async pipelines
- Wrap third-party/side-effectful calls with `fromPromise` / `fromThrowable`
- **Never** use bare try/catch or throw in Result-returning functions

### Validation (Zod)
- Zod schemas as single source of truth for data shapes
- Infer TypeScript types: `z.infer<typeof schema>`
- Always use `.safeParse()`, convert to neverthrow Result
- **Never** use `.parse()` directly

### Type Safety
- TypeScript strict mode
- No `any` types
- No `class` keyword (prefer functional approach)
- No `let` keyword (use `const` only)

### Testing
- TDD: Red → Green → Refactor cycle
- Property-based tests preferred (fast-check with @fast-check/zod)
- Define invariants for all valid inputs
- Use fuzzing to discover edge cases
- Test files co-located with source (`.test.ts`)

### Code Quality
- Biome for linting and formatting
- ESLint with Remotion config (video-worker)
- No bare throw statements in Result-returning code

## Development Environment

### Required Tools
- Node.js 20+ (managed via mise)
- pnpm 10.25.0+
- AWS CDK CLI 2.x

### Common Commands
```bash
# Install dependencies
pnpm install

# Run tests (workspace-filtered)
pnpm --filter <package-name> test
pnpm --filter <package-name> test:watch

# Lint/Format
pnpm lint
pnpm format

# Video development
pnpm --filter video-worker dev  # Remotion Studio

# Infrastructure
cd infra && pnpm cdk deploy
```

## Key Technical Decisions

**Monorepo with pnpm workspaces**: Separate packages for each pipeline stage (script-generator, tts-worker, video-worker) plus infrastructure, enabling independent deployment while sharing tooling.

**Never use .parse() for validation**: Zod's `.parse()` throws errors, violating Railway Oriented Programming. Always use `.safeParse()` and convert to `Result<T, E>`.

**ECS Fargate for compute-intensive workers**: TTS and video rendering require significant resources (VOICEVOX, Remotion); Lambda timeouts/memory limits make Fargate the right choice.

**Remotion for video**: Programmatic video generation via React components, type-safe props with Zod schemas, Tailwind CSS for styling.

**Strands SDK for agentic workflows**: Manages multi-step agent orchestration (research, planning, execution) for script generation with Bedrock integration.

---
_Document standards and patterns, not every dependency_
