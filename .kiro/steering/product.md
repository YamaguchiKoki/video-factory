# Product Overview

Automated radio podcast generation system that produces daily conversational content with synthesized voices and video outputs.

## Core Capabilities

- **AI-Powered Script Generation**: Creates conversational radio scripts using AWS Bedrock (Anthropic Claude) with agent framework (Strands SDK) and web search integration (Tavily)
- **Text-to-Speech Processing**: Converts scripts to natural-sounding dialogue using VOICEVOX engine with character voice support
- **Video Rendering**: Generates video content from audio and visual components using Remotion framework
- **Automated Publishing**: Scheduled daily execution via AWS EventBridge → Step Functions workflow with upload to Google Drive

## Target Use Cases

- Daily automated radio podcast production with minimal human intervention
- Multi-speaker conversational content generation with distinct voice personalities
- Educational or news-style audio/video content creation at scale

## Value Proposition

Fully automated pipeline from content ideation to video delivery, leveraging AWS serverless architecture (Lambda, ECS Fargate, S3) for scalable, scheduled production of radio-style media content.

---
_Focus on patterns and purpose, not exhaustive feature lists_
