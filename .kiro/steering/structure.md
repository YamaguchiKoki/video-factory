# Project Structure

## Organization Philosophy

**Workspace-Based Monorepo**: Separate packages per pipeline stage with shared tooling and infrastructure. Each package is independently deployable (Lambda or ECS) with its own dependencies and runtime characteristics.

## Directory Patterns

### Root Workspace
**Location**: `/`
**Purpose**: Shared configuration, tooling, and workspace orchestration
**Example**: `package.json` (workspaces), `vitest.config.ts` (multi-project), `biome.json`, `pnpm-workspace.yaml`

### Pipeline Packages
**Location**: `/packages/*`
**Purpose**: Independent workers for each pipeline stage
**Example**:
- `script-generator/`: Lambda for AI script generation (Strands + Bedrock + Tavily)
- `tts-worker/`: ECS task for VOICEVOX TTS conversion
- `video-worker/`: ECS task for Remotion video rendering

### Infrastructure
**Location**: `/infra/`
**Purpose**: AWS CDK stack definitions (EventBridge, Step Functions, Lambda, ECS, S3)
**Example**: CDK TypeScript constructs, separate `node_modules` (independent npm workspace)

### Core Domain Layer (example: video-worker)
**Location**: `/packages/video-worker/src/core/`
**Purpose**: Pure business logic and domain types (no framework dependencies)
**Example**:
```
core/
  errors.ts         # Domain errors (ValidationError, S3DownloadError, etc.)
  script-types.ts   # Zod schemas + inferred types
  script-parser.ts  # Pure parsing logic
  index.ts          # Public API (exports only)
  *.test.ts         # Co-located tests
```

### Feature Components (example: video-worker)
**Location**: `/packages/video-worker/src/HelloWorld/`
**Purpose**: Remotion composition components grouped by feature
**Example**: `Title.tsx`, `Logo.tsx`, `constants.ts` (grouped as `HelloWorld/`)

## Naming Conventions

- **Files**:
  - Components: PascalCase (`Title.tsx`, `HelloWorld.tsx`)
  - Modules: kebab-case (`script-parser.ts`, `script-types.ts`)
  - Tests: `.test.ts` suffix, co-located
  - Config: kebab-case (`remotion.config.ts`, `vitest.config.ts`)
- **Types**: PascalCase (`ParsedScript`, `ValidationError`)
- **Functions**: camelCase (`parseScript`, `createValidationError`)
- **Constants**: SCREAMING_SNAKE_CASE or camelCase (context-dependent)

## Import Organization

```typescript
// External dependencies (third-party)
import { Result, ResultAsync } from 'neverthrow';
import { z } from 'zod';

// Internal core/domain (relative within package)
import { parseScript } from './core/script-parser';
import type { ParsedScript } from './core/script-types';

// Feature modules (relative)
import { Title } from './HelloWorld/Title';
```

**No path aliases configured** (straight relative imports). Infrastructure package has isolated dependencies.

## Code Organization Principles

### Dependency Direction
- Core domain layer has **zero** external dependencies (pure TypeScript)
- Infrastructure/framework code depends on core (never the reverse)
- Tests import from public API (`./core/index.ts`) when possible

### Public API Pattern
Each domain module exports via `index.ts` barrel file:
- Types (via `export type`)
- Schemas (Zod validators)
- Factory functions (error constructors, parsers)
- Hide implementation details (unexported helpers)

### File Placement
- **Main function first**: Public API at top of file
- **Helpers below**: Internal/private functions after main
- **Tests co-located**: `*.test.ts` next to source file
- **Constants separate**: When shared (e.g., `constants.ts`)

### Workspace Isolation
Each package in `/packages/*` and `/infra/` has:
- Own `package.json` with specific dependencies
- Own scripts (test, build, dev)
- Shared root tooling (Biome, Vitest root config)
- Filtered commands: `pnpm --filter <package-name> <script>`

### Configuration Files
- Root configs: Biome, Vitest (workspace-level)
- Package configs: `remotion.config.ts`, `vitest.config.ts` (overrides)
- Infrastructure: CDK `cdk.json`, `tsconfig.json` (isolated)

## Example Structure
```
video-factory/
  packages/
    script-generator/
      src/
        agents/       # Strands agent implementations
        mcp/          # Model Context Protocol integrations
        prompts/      # Agent prompts
        proto.ts      # Prototype/entry point
    tts-worker/
      src/
        cli.ts        # CLI interface
        proto.ts      # Prototype/entry point
    video-worker/
      src/
        core/         # Domain layer (pure logic)
        HelloWorld/   # Remotion feature component
        Root.tsx      # Remotion root composition
        index.ts      # Entry point
  infra/
    lib/              # CDK constructs
    bin/              # CDK app entry
    test/             # Infrastructure tests
  vitest.config.ts    # Workspace test config
  package.json        # Workspace root
```

---
_Document patterns, not file trees. New files following patterns shouldn't require updates_
