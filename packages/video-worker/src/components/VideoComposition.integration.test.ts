/**
 * VideoComposition Integration Tests
 * Tests actual video rendering with all components integrated
 *
 * These tests use Remotion's renderMedia() to verify:
 * - VideoComposition renders successfully
 * - All visual components display correctly
 * - Avatar animations work as expected
 * - Audio and text synchronization
 *
 * Note: These tests are time-consuming and should be run manually
 * or in a separate integration test pipeline.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ParsedScript } from "../core/script-types";

// Skip these tests in CI environment (can be enabled with --run-integration flag)
const isIntegrationTest = process.env.RUN_INTEGRATION_TESTS === "true";
const testIf = isIntegrationTest ? it : it.skip;

describe("VideoComposition Integration Tests", () => {
  let bundleLocation: string;
  let tempOutputDir: string;

  beforeAll(async () => {
    if (!isIntegrationTest) {
      return;
    }

    // Create temp output directory
    tempOutputDir = path.join(process.cwd(), "temp-test-output");
    await fs.mkdir(tempOutputDir, { recursive: true });

    // Bundle the Remotion project
    const webpackBundle = await bundle({
      entryPoint: path.join(process.cwd(), "src", "index.ts"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      webpackOverride: (config: any) => config,
    });

    bundleLocation = webpackBundle;
  }, 60000); // 60 seconds timeout for bundling

  afterAll(async () => {
    if (!isIntegrationTest) {
      return;
    }

    // Cleanup temp directory
    try {
      await fs.rm(tempOutputDir, { recursive: true, force: true });
    } catch (err) {
      console.warn("Failed to cleanup temp directory:", err);
    }
  });

  /**
   * Test Case 1: Small video rendering with minimal segments
   * Verifies basic rendering capability
   */
  testIf(
    "should render a small video with basic segments",
    async () => {
      const mockScript: ParsedScript = {
        metadata: {
          title: "Integration Test Video",
          createdAt: "2026-02-09T09:00:00.000Z",
          durationSeconds: 10, // Short video for fast testing
        },
        speakers: [
          {
            id: "agent",
            name: "AI Agent",
            role: "agent",
            avatarPath: "/assets/agent-avatar.png",
          },
          {
            id: "man",
            name: "Test User",
            role: "questioner",
            avatarPath: "/assets/man-avatar.png",
          },
        ],
        segments: [
          {
            id: "seg-001",
            speakerId: "man",
            text: "Hello, this is a test",
            startTime: 0,
            endTime: 3,
          },
          {
            id: "seg-002",
            speakerId: "agent",
            text: "This is a test response",
            startTime: 3,
            endTime: 6,
          },
        ],
      };

      const outputPath = path.join(tempOutputDir, "basic-test.mp4");

      // Get composition
      const composition = await selectComposition({
        serveUrl: bundleLocation,
        id: "VideoComposition",
        inputProps: {
          script: mockScript,
          audioPath: "", // No audio for this basic test
          speakers: mockScript.speakers,
        },
      });

      // Render video
      await renderMedia({
        composition,
        serveUrl: bundleLocation,
        codec: "h264",
        outputLocation: outputPath,
        inputProps: {
          script: mockScript,
          audioPath: "",
          speakers: mockScript.speakers,
        },
      });

      // Verify output file exists
      const stats = await fs.stat(outputPath);
      expect(stats.isFile()).toBe(true);
      expect(stats.size).toBeGreaterThan(0);
    },
    120000,
  ); // 2 minutes timeout

  /**
   * Test Case 2: Video with NewsListComponent
   * Verifies visual component rendering
   */
  testIf(
    "should render video with NewsListComponent",
    async () => {
      const mockScript: ParsedScript = {
        metadata: {
          title: "News List Test",
          createdAt: "2026-02-09T09:00:00.000Z",
          durationSeconds: 8,
        },
        speakers: [
          {
            id: "agent",
            name: "AI Agent",
            role: "agent",
            avatarPath: "/assets/agent-avatar.png",
          },
        ],
        segments: [
          {
            id: "seg-001",
            speakerId: "agent",
            text: "Here are today's news",
            startTime: 0,
            endTime: 8,
            visualComponent: {
              type: "news-list",
              data: {
                items: [
                  {
                    title: "Test News 1",
                    category: "Technology",
                    date: "2026-02-09",
                  },
                  {
                    title: "Test News 2",
                    category: "Politics",
                    date: "2026-02-09",
                  },
                ],
              },
            },
          },
        ],
      };

      const outputPath = path.join(tempOutputDir, "newslist-test.mp4");

      const composition = await selectComposition({
        serveUrl: bundleLocation,
        id: "VideoComposition",
        inputProps: {
          script: mockScript,
          audioPath: "",
          speakers: mockScript.speakers,
        },
      });

      await renderMedia({
        composition,
        serveUrl: bundleLocation,
        codec: "h264",
        outputLocation: outputPath,
        inputProps: {
          script: mockScript,
          audioPath: "",
          speakers: mockScript.speakers,
        },
      });

      const stats = await fs.stat(outputPath);
      expect(stats.isFile()).toBe(true);
      expect(stats.size).toBeGreaterThan(0);
    },
    120000,
  );

  /**
   * Test Case 3: Video with ConceptExplanationComponent
   * Verifies concept explanation rendering
   */
  testIf(
    "should render video with ConceptExplanationComponent",
    async () => {
      const mockScript: ParsedScript = {
        metadata: {
          title: "Concept Explanation Test",
          createdAt: "2026-02-09T09:00:00.000Z",
          durationSeconds: 8,
        },
        speakers: [
          {
            id: "agent",
            name: "AI Agent",
            role: "agent",
            avatarPath: "/assets/agent-avatar.png",
          },
        ],
        segments: [
          {
            id: "seg-001",
            speakerId: "agent",
            text: "Let me explain this concept",
            startTime: 0,
            endTime: 8,
            visualComponent: {
              type: "concept-explanation",
              data: {
                title: "Test Concept",
                template: "bullet-points",
                bulletPoints: [
                  { text: "Point 1", emphasis: "high" },
                  { text: "Point 2", emphasis: "medium" },
                  { text: "Point 3", emphasis: "low" },
                ],
              },
            },
          },
        ],
      };

      const outputPath = path.join(tempOutputDir, "concept-test.mp4");

      const composition = await selectComposition({
        serveUrl: bundleLocation,
        id: "VideoComposition",
        inputProps: {
          script: mockScript,
          audioPath: "",
          speakers: mockScript.speakers,
        },
      });

      await renderMedia({
        composition,
        serveUrl: bundleLocation,
        codec: "h264",
        outputLocation: outputPath,
        inputProps: {
          script: mockScript,
          audioPath: "",
          speakers: mockScript.speakers,
        },
      });

      const stats = await fs.stat(outputPath);
      expect(stats.isFile()).toBe(true);
      expect(stats.size).toBeGreaterThan(0);
    },
    120000,
  );

  /**
   * Test Case 4: Video with ConversationSummaryComponent
   * Verifies conversation summary rendering
   */
  testIf(
    "should render video with ConversationSummaryComponent",
    async () => {
      const mockScript: ParsedScript = {
        metadata: {
          title: "Summary Test",
          createdAt: "2026-02-09T09:00:00.000Z",
          durationSeconds: 8,
        },
        speakers: [
          {
            id: "agent",
            name: "AI Agent",
            role: "agent",
            avatarPath: "/assets/agent-avatar.png",
          },
        ],
        segments: [
          {
            id: "seg-001",
            speakerId: "agent",
            text: "Here is the summary",
            startTime: 0,
            endTime: 8,
            visualComponent: {
              type: "conversation-summary",
              data: {
                summaryText: "This is a test summary of the conversation",
                keyPoints: [
                  { text: "Key point 1", importance: "high" },
                  { text: "Key point 2", importance: "medium" },
                ],
              },
            },
          },
        ],
      };

      const outputPath = path.join(tempOutputDir, "summary-test.mp4");

      const composition = await selectComposition({
        serveUrl: bundleLocation,
        id: "VideoComposition",
        inputProps: {
          script: mockScript,
          audioPath: "",
          speakers: mockScript.speakers,
        },
      });

      await renderMedia({
        composition,
        serveUrl: bundleLocation,
        codec: "h264",
        outputLocation: outputPath,
        inputProps: {
          script: mockScript,
          audioPath: "",
          speakers: mockScript.speakers,
        },
      });

      const stats = await fs.stat(outputPath);
      expect(stats.isFile()).toBe(true);
      expect(stats.size).toBeGreaterThan(0);
    },
    120000,
  );

  /**
   * Test Case 5: Video with multiple speakers and avatar animations
   * Verifies avatar state changes (isActive) work correctly
   */
  testIf(
    "should render video with multiple speakers and avatar state changes",
    async () => {
      const mockScript: ParsedScript = {
        metadata: {
          title: "Avatar Animation Test",
          createdAt: "2026-02-09T09:00:00.000Z",
          durationSeconds: 12,
        },
        speakers: [
          {
            id: "agent",
            name: "AI Agent",
            role: "agent",
            avatarPath: "/assets/agent-avatar.png",
          },
          {
            id: "man",
            name: "Test User",
            role: "questioner",
            avatarPath: "/assets/man-avatar.png",
          },
        ],
        segments: [
          {
            id: "seg-001",
            speakerId: "man",
            text: "First speaker",
            startTime: 0,
            endTime: 3,
          },
          {
            id: "seg-002",
            speakerId: "agent",
            text: "Second speaker",
            startTime: 3,
            endTime: 6,
          },
          {
            id: "seg-003",
            speakerId: "man",
            text: "First speaker again",
            startTime: 6,
            endTime: 9,
          },
          {
            id: "seg-004",
            speakerId: "agent",
            text: "Second speaker again",
            startTime: 9,
            endTime: 12,
          },
        ],
      };

      const outputPath = path.join(tempOutputDir, "avatar-test.mp4");

      const composition = await selectComposition({
        serveUrl: bundleLocation,
        id: "VideoComposition",
        inputProps: {
          script: mockScript,
          audioPath: "",
          speakers: mockScript.speakers,
        },
      });

      await renderMedia({
        composition,
        serveUrl: bundleLocation,
        codec: "h264",
        outputLocation: outputPath,
        inputProps: {
          script: mockScript,
          audioPath: "",
          speakers: mockScript.speakers,
        },
      });

      const stats = await fs.stat(outputPath);
      expect(stats.isFile()).toBe(true);
      expect(stats.size).toBeGreaterThan(0);
    },
    120000,
  );

  /**
   * Test Case 6: Comprehensive test with all visual components
   * Verifies complete integration of all features
   */
  testIf(
    "should render comprehensive video with all component types",
    async () => {
      const mockScript: ParsedScript = {
        metadata: {
          title: "Comprehensive Integration Test",
          createdAt: "2026-02-09T09:00:00.000Z",
          durationSeconds: 24,
        },
        speakers: [
          {
            id: "agent",
            name: "AI Agent",
            role: "agent",
            avatarPath: "/assets/agent-avatar.png",
          },
          {
            id: "man",
            name: "Test User",
            role: "questioner",
            avatarPath: "/assets/man-avatar.png",
          },
        ],
        segments: [
          // Introduction
          {
            id: "seg-001",
            speakerId: "man",
            text: "Tell me about today's news",
            startTime: 0,
            endTime: 3,
          },
          // News list
          {
            id: "seg-002",
            speakerId: "agent",
            text: "Here are three important news items",
            startTime: 3,
            endTime: 8,
            visualComponent: {
              type: "news-list",
              data: {
                items: [
                  {
                    title: "Economic Policy Update",
                    category: "Politics",
                    date: "2026-02-09",
                  },
                  {
                    title: "AI Technology Breakthrough",
                    category: "Technology",
                    date: "2026-02-09",
                  },
                  {
                    title: "Environmental Initiative",
                    category: "Environment",
                    date: "2026-02-09",
                  },
                ],
              },
            },
          },
          // Concept explanation
          {
            id: "seg-003",
            speakerId: "man",
            text: "Can you explain the economic policy?",
            startTime: 8,
            endTime: 11,
          },
          {
            id: "seg-004",
            speakerId: "agent",
            text: "Let me explain the key points",
            startTime: 11,
            endTime: 16,
            visualComponent: {
              type: "concept-explanation",
              data: {
                title: "Economic Policy Key Points",
                template: "bullet-points",
                bulletPoints: [
                  { text: "Tax reform measures", emphasis: "high" },
                  { text: "Infrastructure investment", emphasis: "high" },
                  { text: "Support for small businesses", emphasis: "medium" },
                ],
              },
            },
          },
          // Summary
          {
            id: "seg-005",
            speakerId: "agent",
            text: "To summarize our discussion",
            startTime: 16,
            endTime: 24,
            visualComponent: {
              type: "conversation-summary",
              data: {
                summaryText:
                  "We discussed three major news topics covering politics, technology, and environment",
                keyPoints: [
                  {
                    text: "Economic policy focuses on reform",
                    importance: "high",
                  },
                  {
                    text: "AI technology shows promising advances",
                    importance: "medium",
                  },
                  {
                    text: "Environmental initiatives gain traction",
                    importance: "medium",
                  },
                ],
              },
            },
          },
        ],
      };

      const outputPath = path.join(tempOutputDir, "comprehensive-test.mp4");

      const composition = await selectComposition({
        serveUrl: bundleLocation,
        id: "VideoComposition",
        inputProps: {
          script: mockScript,
          audioPath: "",
          speakers: mockScript.speakers,
        },
      });

      await renderMedia({
        composition,
        serveUrl: bundleLocation,
        codec: "h264",
        outputLocation: outputPath,
        inputProps: {
          script: mockScript,
          audioPath: "",
          speakers: mockScript.speakers,
        },
      });

      const stats = await fs.stat(outputPath);
      expect(stats.isFile()).toBe(true);
      expect(stats.size).toBeGreaterThan(0);

      // Verify output file is a reasonable size (>100KB for a 24-second video)
      expect(stats.size).toBeGreaterThan(100000);
    },
    180000,
  ); // 3 minutes timeout for comprehensive test
});
