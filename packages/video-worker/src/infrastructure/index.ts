/**
 * Infrastructure layer exports
 * External dependencies and side effects
 */

// File system operations
export { readFile, writeFile, fileExists } from "./file-system";

// Temporary file management
export { createTempDir, cleanupTempDir } from "./temp-file";

// Remotion renderer
export { createRenderVideo } from "./remotion-renderer";

// Remotion bundler
export { bundleComposition } from "./remotion-bundler";

// Logger
export { createLogger, type Logger } from "./logger";

// Mock data
export { loadMockScript, loadMockAudio } from "./mock-data";
