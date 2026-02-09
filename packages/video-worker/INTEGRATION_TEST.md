# VideoComposition Integration Tests

This document describes the integration tests for the VideoComposition component.

## Overview

The integration tests verify the complete rendering pipeline of the VideoComposition component using Remotion's `renderMedia()` API. These tests validate:

1. **VideoComposition renders successfully** - The component can be bundled and rendered without errors
2. **Visual components display correctly** - NewsListComponent, ConceptExplanationComponent, and ConversationSummaryComponent render as expected
3. **Avatar animations work** - Avatar state changes (isActive) are correctly applied based on speaker timing
4. **Audio and text synchronization** - Segments are displayed at the correct times based on their timestamps

## Running Integration Tests

Integration tests are **disabled by default** because they are time-consuming (each test takes 1-3 minutes to render a video).

### Run integration tests manually

```bash
# From the project root
pnpm --filter video-worker test:integration

# Or from the video-worker package directory
cd packages/video-worker
pnpm test:integration
```

### Run in CI

To enable integration tests in CI, set the environment variable:

```bash
RUN_INTEGRATION_TESTS=true pnpm test:integration
```

## Test Cases

### 1. Basic Video Rendering
- **Duration**: 10 seconds
- **Components**: Basic segments without visual components
- **Validates**: Core rendering capability

### 2. NewsListComponent Test
- **Duration**: 8 seconds
- **Components**: NewsListComponent with 2 news items
- **Validates**: News list visual component rendering

### 3. ConceptExplanationComponent Test
- **Duration**: 8 seconds
- **Components**: ConceptExplanationComponent with bullet points template
- **Validates**: Concept explanation visual component rendering

### 4. ConversationSummaryComponent Test
- **Duration**: 8 seconds
- **Components**: ConversationSummaryComponent with summary and key points
- **Validates**: Conversation summary visual component rendering

### 5. Avatar Animation Test
- **Duration**: 12 seconds
- **Components**: Multiple speakers with alternating segments
- **Validates**: Avatar state changes (isActive) based on current speaker

### 6. Comprehensive Integration Test
- **Duration**: 24 seconds
- **Components**: All visual components + multiple speakers + avatar animations
- **Validates**: Complete integration of all features

## Output Files

Integration tests generate MP4 files in the `temp-test-output` directory:

```
temp-test-output/
├── basic-test.mp4
├── newslist-test.mp4
├── concept-test.mp4
├── summary-test.mp4
├── avatar-test.mp4
└── comprehensive-test.mp4
```

These files are automatically cleaned up after the test run completes.

## Manual Verification

After running integration tests, you can manually verify the output videos:

1. Check that all video files were created
2. Play each video file to verify:
   - Visual components display correctly
   - Avatars animate when speaking
   - Text appears at the correct times
   - Layout and styling are correct

## Performance

Integration test timings (approximate):

- Basic test: ~30 seconds
- Component tests: ~30-60 seconds each
- Avatar animation test: ~60 seconds
- Comprehensive test: ~90 seconds

Total integration test suite: ~5-7 minutes

## Troubleshooting

### Bundle errors

If you encounter bundling errors, ensure all dependencies are installed:

```bash
pnpm install
```

### Chrome Headless Shell not found

Remotion requires Chrome Headless Shell for rendering. It should be installed automatically, but if not:

```bash
npx remotion browser ensure
```

### Out of memory

If integration tests fail with OOM errors, increase Node.js memory limit:

```bash
NODE_OPTIONS=--max-old-space-size=4096 pnpm test:integration
```

## CI Configuration

For CI environments, you can skip integration tests by default and run them only in specific jobs:

```yaml
# GitHub Actions example
jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - run: pnpm test

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - run: RUN_INTEGRATION_TESTS=true pnpm test:integration
```

## Related Files

- `src/components/VideoComposition.integration.test.ts` - Integration test implementation
- `src/components/VideoComposition.tsx` - Main component under test
- `src/components/VideoComposition.test.tsx` - Unit tests
- `src/Root.tsx` - Remotion composition registration

## Future Improvements

Potential enhancements for integration tests:

1. **Visual regression testing** - Compare rendered frames with reference images
2. **Audio synchronization validation** - Verify audio tracks align with segments
3. **Performance benchmarks** - Track rendering time and memory usage
4. **Automated video validation** - Parse MP4 metadata to verify duration, resolution, codec

---

# CLI Integration Testing

## Mock Mode Testing

The video-worker supports a mock mode for local testing without requiring actual audio/script files.

### Running with Mock Data

```bash
# Using environment variable
MOCK_MODE=true node src/index.ts --output output/test-video.mp4

# Or with npm script (to be added)
pnpm run render:mock
```

### Mock Data Files

Mock data is located in the `mock-data/` directory:

- `mock-data/script.json` - Sample script with 3 news segments, 2 speakers, and visual components
- `mock-data/audio.wav` - 120-second silent audio file (44.1kHz, 16-bit, mono)

### Running CLI E2E Tests

CLI E2E tests are skipped by default. To run them:

```bash
RUN_E2E_TESTS=true pnpm test src/index.e2e.test.ts
```

**Note**: E2E tests will actually run the Remotion renderer and may take 2+ minutes.

### Manual Testing

1. Generate mock audio (if needed):
   ```bash
   cd mock-data
   node generate-audio.js
   ```

2. Run the CLI:
   ```bash
   MOCK_MODE=true node src/index.ts --output output/test-video.mp4
   ```

3. Verify the output:
   ```bash
   ls -lh output/test-video.mp4
   ffprobe output/test-video.mp4
   ```

### Normal Mode (with actual files)

```bash
node src/index.ts \
  --script /path/to/script.json \
  --audio /path/to/audio.wav \
  --output output/video.mp4
```

### Environment Variables

- `MOCK_MODE=true` - Enable mock mode (uses mock-data files)
- `LOG_LEVEL=DEBUG|INFO|WARN|ERROR` - Set logging level (default: INFO)

### Exit Codes

- `0` - Success
- `1` - Error (check console output for details)

### Troubleshooting

**Issue**: Missing required arguments
- **Solution**: Ensure you provide `--output` at minimum, or set `MOCK_MODE=true`

**Issue**: Mock files not found
- **Solution**: Run `node mock-data/generate-audio.js` to generate the audio file

**Issue**: Rendering timeout
- **Solution**: Check that the script duration matches the audio duration

---

# Extended Test Suites (Tasks 10.1-10.4)

This section describes the comprehensive test suites implemented for tasks 10.1-10.4.

## Task 10.1: Complete End-to-End Tests (`e2e.test.ts`)

Tests the complete video generation workflow using real mock data.

### What it tests:
- Complete video rendering from script and audio files
- Video file generation and metadata verification
- All VisualComponent types (news-list, concept-explanation, conversation-summary)
- Audio-text synchronization
- File size expectations based on duration

### Run command:
```bash
pnpm test:e2e
```

### Requirements:
- Mock data files must exist: `mock-data/script.json`, `mock-data/audio.wav`
- Chrome Headless Shell must be installed (run `npx remotion browser ensure`)
- Sufficient disk space in temp directory (~100MB)

### Expected duration:
~5-15 minutes per test (depending on video complexity)

---

## Task 10.2: Performance Tests (`performance.test.ts`)

Verifies that the system meets performance requirements.

### What it tests:
- Rendering time ≤ 15 minutes for standard video
- Memory usage ≤ 4GB during rendering
- File size optimization (reasonable size for video duration)
- Concurrency setting effectiveness

### Run command:
```bash
pnpm test:perf
```

### Requirements:
- At least 4GB free RAM
- Mock data files must exist
- System should not be under heavy load during testing

### Expected duration:
~15-20 minutes (includes full rendering)

### Metrics tracked:
- Peak memory usage (heap)
- Elapsed rendering time
- Output file size

---

## Task 10.3: Error Scenario Tests (`error-scenarios.test.ts`)

Verifies robust error handling across various failure scenarios.

### What it tests:
- Missing script file handling
- Missing audio file handling
- Invalid JSON syntax handling
- Invalid schema handling (missing required fields)
- Timestamp overlap/conflict detection
- Invalid speaker reference detection
- Temp file cleanup after errors
- Error logging and context

### Run command:
```bash
pnpm test:errors
```

### Requirements:
- Write permissions in temp directory
- Mock data files should exist (for valid test baselines)

### Expected duration:
~2-5 minutes

---

## Task 10.4: Property-Based Fuzzing Tests (`fuzzing.test.ts`)

Uses fast-check to verify invariants with randomly generated inputs.

### What it tests:
- Script parsing invariants (segment sorting, overlap detection, speaker references)
- Render config calculation correctness (durationInFrames formula)
- Video dimension consistency (always 1920x1080@30fps)
- Extreme edge cases (very long text, very short durations, maximum segment count)
- Unicode and emoji handling

### Run command:
```bash
pnpm test:fuzzing
```

### Requirements:
- None (pure unit-style tests with mocked data)

### Expected duration:
~1-3 minutes (50-100 test runs per property)

### Invariants verified:
- Segments always sorted by startTime
- Overlapping timestamps always rejected
- Invalid speaker references always rejected
- durationInFrames = ceil(durationSeconds × fps)
- Video dimensions always 1920×1080@30fps
- Zero/negative durations always rejected

---

## Running All Extended Tests

### Unit Tests Only (Fast)
```bash
pnpm test
```
Runs all unit tests, skips E2E/performance/error/fuzzing tests.

### All Extended Tests (Comprehensive)
```bash
pnpm test:all-extended
```
Runs everything including E2E, performance, error scenarios, and fuzzing.

**Warning:** This will take 15-30 minutes to complete.

---

## Environment Variables

Tests are conditionally enabled via environment variables:

- `RUN_E2E_TESTS=true` - Enable E2E tests
- `RUN_PERF_TESTS=true` - Enable performance tests
- `RUN_ERROR_TESTS=true` - Enable error scenario tests
- `RUN_FUZZING_TESTS=true` - Enable fuzzing tests

Example:
```bash
RUN_E2E_TESTS=true vitest run e2e.test.ts
```

---

## Test Coverage

All tests follow TDD methodology:
1. **RED**: Test written first (fails)
2. **GREEN**: Minimal implementation to pass
3. **REFACTOR**: Clean up while maintaining green state

Requirements coverage:
- **Task 10.1**: Requirements 3.1, 3.2, 3.3 (Remotion rendering, components, audio sync)
- **Task 10.2**: Requirements 8.2, 8.3, 8.4 (Memory ≤4GB, Time ≤15min, optimization)
- **Task 10.3**: Requirements 1.5, 1.6, 2.6, 3.8, 5.2, 8.1 (Error handling, cleanup)
- **Task 10.4**: Requirements 2.6, 8.3 (Validation robustness, performance)
