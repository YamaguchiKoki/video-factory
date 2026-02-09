import { describe, it, expect } from 'vitest';
import packageJson from '../../package.json';

describe('Package Configuration', () => {
  describe('dependencies', () => {
    it('should include Remotion core packages', () => {
      expect(packageJson.dependencies).toHaveProperty('@remotion/cli');
      expect(packageJson.dependencies).toHaveProperty('@remotion/renderer');
      expect(packageJson.dependencies).toHaveProperty('remotion');
    });

    it('should include neverthrow for Railway Oriented Programming', () => {
      expect(packageJson.dependencies).toHaveProperty('neverthrow');
    });

    it('should include zod for validation', () => {
      expect(packageJson.dependencies).toHaveProperty('zod');
    });

    it('should include React 19 for Remotion', () => {
      expect(packageJson.dependencies).toHaveProperty('react');
      expect(packageJson.dependencies.react).toMatch(/^19\./);
    });
  });

  describe('devDependencies', () => {
    it('should include fast-check for property-based testing', () => {
      expect(packageJson.devDependencies).toHaveProperty('fast-check');
    });

    it('should include zod-fast-check for schema-based arbitraries', () => {
      expect(packageJson.devDependencies).toHaveProperty('zod-fast-check');
    });

    it('should include vitest as test runner', () => {
      expect(packageJson.devDependencies).toHaveProperty('vitest');
    });

    it('should include TypeScript', () => {
      expect(packageJson.devDependencies).toHaveProperty('typescript');
    });
  });

  describe('scripts', () => {
    it('should have build script', () => {
      expect(packageJson.scripts).toHaveProperty('build');
    });

    it('should have test scripts', () => {
      expect(packageJson.scripts).toHaveProperty('test');
      expect(packageJson.scripts).toHaveProperty('test:watch');
    });

    it('should have lint script', () => {
      expect(packageJson.scripts).toHaveProperty('lint');
    });

    it('should have dev script for Remotion Studio', () => {
      expect(packageJson.scripts).toHaveProperty('dev');
    });
  });

  describe('metadata', () => {
    it('should have proper description', () => {
      expect(packageJson.description).toBeTruthy();
      expect(packageJson.description).not.toBe('My Remotion video');
    });

    it('should be marked as private', () => {
      expect(packageJson.private).toBe(true);
    });
  });
});

describe('TypeScript Configuration', () => {
  it('should enforce strict mode', async () => {
    const tsconfig = await import('../../tsconfig.json');
    expect(tsconfig.compilerOptions.strict).toBe(true);
  });

  it('should target ES2022 for modern features', async () => {
    const tsconfig = await import('../../tsconfig.json');
    expect(tsconfig.compilerOptions.module).toBe('ES2022');
  });

  it('should use bundler module resolution', async () => {
    const tsconfig = await import('../../tsconfig.json');
    expect(tsconfig.compilerOptions.moduleResolution).toBe('bundler');
  });
});
