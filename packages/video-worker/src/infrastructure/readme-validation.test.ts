import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('README Documentation', () => {
  const readmePath = join(__dirname, '../../README.md');
  const content = readFileSync(readmePath, 'utf-8');

  describe('structure', () => {
    it('should have project overview section', () => {
      expect(content).toContain('# Video Worker');
      expect(content).toMatch(/## (概要|Overview|プロジェクト概要)/i);
    });

    it('should have local development setup section', () => {
      expect(content).toMatch(/## (ローカル開発環境|開発環境|Local Development|Setup)/);
    });

    it('should have mock mode usage instructions', () => {
      expect(content).toContain('MOCK_MODE');
      expect(content).toMatch(/モックモード|mock.*mode/i);
    });

    it('should have testing instructions', () => {
      expect(content).toMatch(/## (テスト|Test)/i);
      expect(content).toMatch(/pnpm.*test/);
    });

    it('should have directory structure explanation', () => {
      expect(content).toMatch(/## (ディレクトリ構造|プロジェクト構造|Directory Structure|Project Structure)/i);
    });
  });

  describe('content', () => {
    it('should explain purpose of video worker', () => {
      expect(content).toMatch(/Remotion|動画生成|video.*generation/i);
    });

    it('should mention Railway Oriented Programming', () => {
      expect(content).toMatch(/Railway Oriented Programming|ROP|neverthrow/i);
    });

    it('should include Phase 1 scope clarification', () => {
      expect(content).toMatch(/Phase 1|フェーズ1|MVP/i);
    });

    it('should list key dependencies', () => {
      expect(content).toContain('Remotion');
      expect(content).toContain('neverthrow');
      expect(content).toContain('Zod');
    });

    it('should include npm scripts usage', () => {
      expect(content).toMatch(/pnpm.*run dev/);
      expect(content).toMatch(/pnpm.*test/);
    });
  });

  describe('language', () => {
    it('should be written in Japanese (per spec.json)', () => {
      // Check for Japanese characters in major sections
      const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(content);
      expect(hasJapanese).toBe(true);
    });
  });
});
