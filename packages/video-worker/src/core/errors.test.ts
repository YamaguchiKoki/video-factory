import { describe, it, expect } from 'vitest';
import {
  ValidationError,
  S3DownloadError,
  RenderError,
  FileSystemError,
  createValidationError,
  createS3DownloadError,
  createRenderError,
  createFileSystemError,
} from './errors';

describe('Domain Error Types', () => {
  describe('ValidationError', () => {
    it('should create ValidationError with all required fields', () => {
      const error: ValidationError = {
        type: 'JSON_PARSE_ERROR',
        message: 'Invalid JSON format',
        cause: new Error('Unexpected token'),
        context: { filePath: '/tmp/script.json' },
      };

      expect(error.type).toBe('JSON_PARSE_ERROR');
      expect(error.message).toBe('Invalid JSON format');
      expect(error.cause).toBeInstanceOf(Error);
      expect(error.context).toEqual({ filePath: '/tmp/script.json' });
    });

    it('should support SCHEMA_VALIDATION_ERROR type', () => {
      const error: ValidationError = {
        type: 'SCHEMA_VALIDATION_ERROR',
        message: 'Missing required field: speakers',
        cause: null,
        context: { fieldPath: 'speakers' },
      };

      expect(error.type).toBe('SCHEMA_VALIDATION_ERROR');
      expect(error.cause).toBeNull();
    });

    it('should support TIMESTAMP_ERROR type', () => {
      const error: ValidationError = {
        type: 'TIMESTAMP_ERROR',
        message: 'startTime must be less than endTime',
        cause: null,
        context: { segmentId: 'seg-001', startTime: 10, endTime: 5 },
      };

      expect(error.type).toBe('TIMESTAMP_ERROR');
      expect(error.context.segmentId).toBe('seg-001');
    });

    it('should be created using helper function', () => {
      const error = createValidationError(
        'JSON_PARSE_ERROR',
        'Invalid JSON',
        new Error('Parse failed'),
        { line: 10 }
      );

      expect(error.type).toBe('JSON_PARSE_ERROR');
      expect(error.message).toBe('Invalid JSON');
      expect(error.cause).toBeInstanceOf(Error);
      expect(error.context).toEqual({ line: 10 });
    });
  });

  describe('S3DownloadError', () => {
    it('should create S3DownloadError with all required fields', () => {
      const error: S3DownloadError = {
        type: 'S3_NOT_FOUND',
        message: 'S3 object not found',
        cause: new Error('NoSuchKey'),
        context: { s3Uri: 's3://bucket/key', bucket: 'bucket', key: 'key' },
      };

      expect(error.type).toBe('S3_NOT_FOUND');
      expect(error.message).toBe('S3 object not found');
      expect(error.context.s3Uri).toBe('s3://bucket/key');
    });

    it('should support S3_ACCESS_DENIED type', () => {
      const error: S3DownloadError = {
        type: 'S3_ACCESS_DENIED',
        message: 'Access denied to S3 object',
        cause: null,
        context: { s3Uri: 's3://bucket/secret.json' },
      };

      expect(error.type).toBe('S3_ACCESS_DENIED');
    });

    it('should support S3_NETWORK_ERROR type', () => {
      const error: S3DownloadError = {
        type: 'S3_NETWORK_ERROR',
        message: 'Network error during S3 download',
        cause: new Error('ECONNRESET'),
        context: { retryCount: 3 },
      };

      expect(error.type).toBe('S3_NETWORK_ERROR');
      expect(error.context.retryCount).toBe(3);
    });

    it('should be created using helper function', () => {
      const error = createS3DownloadError(
        'S3_NOT_FOUND',
        'Object not found',
        new Error('NoSuchKey'),
        { s3Uri: 's3://test/file.json' }
      );

      expect(error.type).toBe('S3_NOT_FOUND');
      expect(error.message).toBe('Object not found');
    });
  });

  describe('RenderError', () => {
    it('should create RenderError with all required fields', () => {
      const error: RenderError = {
        type: 'RENDER_TIMEOUT',
        message: 'Rendering timeout after 15 minutes',
        cause: new Error('Timeout'),
        context: { durationInFrames: 18000, completedFrames: 5000 },
      };

      expect(error.type).toBe('RENDER_TIMEOUT');
      expect(error.message).toBe('Rendering timeout after 15 minutes');
      expect(error.context.completedFrames).toBe(5000);
    });

    it('should support RENDER_FAILED type', () => {
      const error: RenderError = {
        type: 'RENDER_FAILED',
        message: 'Rendering failed with error',
        cause: new Error('Codec error'),
        context: { frameNumber: 450 },
      };

      expect(error.type).toBe('RENDER_FAILED');
      expect(error.context.frameNumber).toBe(450);
    });

    it('should support BROWSER_ERROR type', () => {
      const error: RenderError = {
        type: 'BROWSER_ERROR',
        message: 'Chrome headless shell error',
        cause: null,
        context: { browserPid: 12345 },
      };

      expect(error.type).toBe('BROWSER_ERROR');
    });

    it('should be created using helper function', () => {
      const error = createRenderError(
        'RENDER_TIMEOUT',
        'Timeout',
        null,
        { durationInFrames: 10000 }
      );

      expect(error.type).toBe('RENDER_TIMEOUT');
      expect(error.message).toBe('Timeout');
    });
  });

  describe('FileSystemError', () => {
    it('should create FileSystemError with all required fields', () => {
      const error: FileSystemError = {
        type: 'DISK_FULL',
        message: 'Disk space exhausted',
        cause: new Error('ENOSPC'),
        context: { path: '/tmp/video-worker-uuid', availableSpace: 0 },
      };

      expect(error.type).toBe('DISK_FULL');
      expect(error.message).toBe('Disk space exhausted');
      expect(error.context.path).toBe('/tmp/video-worker-uuid');
    });

    it('should support PERMISSION_DENIED type', () => {
      const error: FileSystemError = {
        type: 'PERMISSION_DENIED',
        message: 'Permission denied',
        cause: new Error('EACCES'),
        context: { path: '/protected/file.txt' },
      };

      expect(error.type).toBe('PERMISSION_DENIED');
    });

    it('should support IO_ERROR type', () => {
      const error: FileSystemError = {
        type: 'IO_ERROR',
        message: 'IO error during file operation',
        cause: new Error('EIO'),
        context: { operation: 'read', path: '/tmp/file.txt' },
      };

      expect(error.type).toBe('IO_ERROR');
      expect(error.context.operation).toBe('read');
    });

    it('should be created using helper function', () => {
      const error = createFileSystemError(
        'DISK_FULL',
        'No space left',
        new Error('ENOSPC'),
        { path: '/tmp' }
      );

      expect(error.type).toBe('DISK_FULL');
      expect(error.message).toBe('No space left');
    });
  });

  describe('Error Context', () => {
    it('should allow empty context object', () => {
      const error = createValidationError(
        'JSON_PARSE_ERROR',
        'Parse failed',
        null,
        {}
      );

      expect(error.context).toEqual({});
    });

    it('should allow complex nested context', () => {
      const error = createRenderError(
        'RENDER_FAILED',
        'Render error',
        null,
        {
          composition: { id: 'main', width: 1920, height: 1080 },
          frameInfo: { current: 100, total: 1000 },
        }
      );

      expect(error.context.composition).toEqual({ id: 'main', width: 1920, height: 1080 });
      expect(error.context.frameInfo).toEqual({ current: 100, total: 1000 });
    });
  });

  describe('Error Cause', () => {
    it('should allow null cause', () => {
      const error = createValidationError(
        'SCHEMA_VALIDATION_ERROR',
        'Invalid schema',
        null,
        {}
      );

      expect(error.cause).toBeNull();
    });

    it('should preserve Error instance with stack trace', () => {
      const originalError = new Error('Original error');
      const error = createS3DownloadError(
        'S3_NETWORK_ERROR',
        'Network failed',
        originalError,
        {}
      );

      expect(error.cause).toBe(originalError);
      expect(error.cause?.stack).toBeDefined();
    });
  });
});
