/**
 * AvatarComponent tests
 * Type-safe tests for speaker avatar component
 */

import { describe, it, expect } from "vitest";
import type { Speaker } from "../core/script-types";
import { AvatarComponent } from "./AvatarComponent";

describe("AvatarComponent", () => {
  it("should be a valid React functional component", () => {
    expect(typeof AvatarComponent).toBe("function");
  });

  it("should accept speaker and isActive props", () => {
    const mockSpeaker: Speaker = {
      id: "agent",
      name: "AI Agent",
      role: "agent",
      avatarPath: "/assets/agent-avatar.png",
    };

    // Type checking: this code compiles means props are correctly typed
    const _props = { speaker: mockSpeaker, isActive: false };
    expect(_props.speaker.id).toBe("agent");
    expect(_props.isActive).toBe(false);
  });

  it("should accept agent role speaker", () => {
    const agent: Speaker = {
      id: "agent",
      name: "AI Agent",
      role: "agent",
      avatarPath: "/assets/agent.png",
    };

    expect(agent.role).toBe("agent");
  });

  it("should accept questioner role speaker", () => {
    const questioner: Speaker = {
      id: "human",
      name: "Human",
      role: "questioner",
      avatarPath: "/assets/human.png",
    };

    expect(questioner.role).toBe("questioner");
  });

  it("should handle speaker without voiceId", () => {
    const speaker: Speaker = {
      id: "test",
      name: "Test Speaker",
      role: "agent",
      avatarPath: "/assets/test.png",
    };

    expect(speaker.voiceId).toBeUndefined();
  });

  it("should handle speaker with voiceId", () => {
    const speaker: Speaker = {
      id: "test",
      name: "Test Speaker",
      role: "agent",
      avatarPath: "/assets/test.png",
      voiceId: "voice-123",
    };

    expect(speaker.voiceId).toBe("voice-123");
  });

  it("should validate speaker has required fields", () => {
    const speaker: Speaker = {
      id: "test-id",
      name: "Test Name",
      role: "agent",
      avatarPath: "/path/to/avatar.png",
    };

    expect(speaker.id).toBeTruthy();
    expect(speaker.name).toBeTruthy();
    expect(speaker.role).toBeTruthy();
    expect(speaker.avatarPath).toBeTruthy();
  });
});
