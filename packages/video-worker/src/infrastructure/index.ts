/**
 * Infrastructure layer exports
 * External dependencies and side effects
 */

// File system operations
export { readFile, writeFile, fileExists } from "./file-system";

// Temporary file management
export { createTempDir, cleanupTempDir } from "./temp-file";

// Remotion renderer
export { createRenderVideo, type Logger } from "./remotion-renderer";
