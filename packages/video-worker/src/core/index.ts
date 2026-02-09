/**
 * Core domain layer exports
 * Pure business logic and domain types
 */

export type {
  FileSystemError,
  FileSystemErrorType,
  RenderError,
  RenderErrorType,
  S3DownloadError,
  S3DownloadErrorType,
  ValidationError,
  ValidationErrorType,
} from "./errors";

export {
  createFileSystemError,
  createRenderError,
  createS3DownloadError,
  createValidationError,
} from "./errors";
// Script parser
export { parseScript } from "./script-parser";
// Script types and schemas
export type {
  ConceptExplanationData,
  ConversationSummaryData,
  NewsListData,
  ParsedScript,
  ScriptMetadata,
  Segment,
  Speaker,
  VisualComponent,
  VisualComponentData,
} from "./script-types";
export {
  conceptExplanationDataSchema,
  conversationSummaryDataSchema,
  newsListDataSchema,
  parsedScriptSchema,
  scriptMetadataSchema,
  segmentSchema,
  speakerRoleSchema,
  speakerSchema,
  visualComponentSchema,
} from "./script-types";
