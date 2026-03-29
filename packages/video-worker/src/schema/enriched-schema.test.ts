import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { ZodFastCheck } from "zod-fast-check";
import { EnrichedLineSchema, EnrichedScriptSchema } from "./enriched-schema";

// ---------------------------------------------------------------------------
// Minimal valid fixture — mirrors real enriched.json structure
// ---------------------------------------------------------------------------

const validLine = {
  speaker: "A",
  text: "こんにちは",
  voicevoxSpeakerId: 0,
  offsetSec: 0,
  durationSec: 3.0,
};

const validEnrichedScript = {
  title: "テストタイトル",
  totalDurationSec: 30.0,
  outputWavS3Key: "output/test.wav",
  newsItems: [
    { id: "news-1", title: "ニュース1", sourceUrl: "https://example.com/1" },
  ],
  sections: [
    {
      type: "intro",
      greeting: [
        {
          speaker: "A",
          text: "こんにちは",
          voicevoxSpeakerId: 0,
          offsetSec: 0,
          durationSec: 3.0,
        },
      ],
      newsOverview: [
        {
          speaker: "B",
          text: "今日のニュース",
          voicevoxSpeakerId: 1,
          offsetSec: 3.0,
          durationSec: 4.0,
        },
      ],
    },
    {
      type: "discussion",
      newsId: "news-1",
      blocks: [
        {
          phase: "summary",
          lines: [
            {
              speaker: "A",
              text: "要約",
              voicevoxSpeakerId: 0,
              offsetSec: 7.0,
              durationSec: 5.0,
            },
          ],
        },
        {
          phase: "background",
          lines: [
            {
              speaker: "B",
              text: "背景",
              voicevoxSpeakerId: 1,
              offsetSec: 12.0,
              durationSec: 5.0,
            },
          ],
        },
        {
          phase: "deepDive",
          lines: [
            {
              speaker: "A",
              text: "深掘り",
              voicevoxSpeakerId: 0,
              offsetSec: 17.0,
              durationSec: 5.0,
            },
          ],
        },
      ],
    },
    {
      type: "outro",
      recap: [
        {
          speaker: "A",
          text: "まとめ",
          voicevoxSpeakerId: 0,
          offsetSec: 22.0,
          durationSec: 4.0,
        },
      ],
      closing: [
        {
          speaker: "B",
          text: "さようなら",
          voicevoxSpeakerId: 1,
          offsetSec: 26.0,
          durationSec: 4.0,
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// EnrichedLine Schema
// ---------------------------------------------------------------------------

describe("EnrichedLineSchema", () => {
  describe("正常系", () => {
    it("speaker A のラインを受け入れる", () => {
      const result = EnrichedLineSchema.safeParse(validLine);
      expect(result.success).toBe(true);
    });

    it("speaker B のラインを受け入れる", () => {
      const lineB = { ...validLine, speaker: "B" };
      const result = EnrichedLineSchema.safeParse(lineB);
      expect(result.success).toBe(true);
    });

    it("offsetSec が 0 のラインを受け入れる（イントロ先頭）", () => {
      const firstLine = { ...validLine, offsetSec: 0 };
      const result = EnrichedLineSchema.safeParse(firstLine);
      expect(result.success).toBe(true);
    });
  });

  describe("異常系", () => {
    it("speaker が A/B 以外のとき拒否する", () => {
      const invalidLine = { ...validLine, speaker: "C" };
      const result = EnrichedLineSchema.safeParse(invalidLine);
      expect(result.success).toBe(false);
    });

    it("offsetSec が欠損しているとき拒否する", () => {
      const { offsetSec: _omitted, ...withoutOffset } = validLine;
      const result = EnrichedLineSchema.safeParse(withoutOffset);
      expect(result.success).toBe(false);
    });

    it("durationSec が欠損しているとき拒否する", () => {
      const { durationSec: _omitted, ...withoutDuration } = validLine;
      const result = EnrichedLineSchema.safeParse(withoutDuration);
      expect(result.success).toBe(false);
    });

    it("text が欠損しているとき拒否する", () => {
      const { text: _omitted, ...withoutText } = validLine;
      const result = EnrichedLineSchema.safeParse(withoutText);
      expect(result.success).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// EnrichedScript Schema (full document)
// ---------------------------------------------------------------------------

describe("EnrichedScriptSchema", () => {
  describe("正常系", () => {
    it("有効な enriched JSON を受け入れる", () => {
      const result = EnrichedScriptSchema.safeParse(validEnrichedScript);
      expect(result.success).toBe(true);
    });

    it("複数の discussion セクションを含む JSON を受け入れる", () => {
      const multiDiscussion = {
        ...validEnrichedScript,
        newsItems: [
          {
            id: "news-1",
            title: "ニュース1",
            sourceUrl: "https://example.com/1",
          },
          {
            id: "news-2",
            title: "ニュース2",
            sourceUrl: "https://example.com/2",
          },
        ],
        sections: [
          ...validEnrichedScript.sections,
          {
            type: "discussion",
            newsId: "news-2",
            blocks: [
              {
                phase: "summary",
                lines: [
                  {
                    speaker: "A",
                    text: "要約2",
                    voicevoxSpeakerId: 0,
                    offsetSec: 30.0,
                    durationSec: 5.0,
                  },
                ],
              },
            ],
          },
        ],
      };
      const result = EnrichedScriptSchema.safeParse(multiDiscussion);
      expect(result.success).toBe(true);
    });
  });

  describe("異常系 - トップレベルフィールド", () => {
    it("title が欠損しているとき拒否する", () => {
      const { title: _omitted, ...withoutTitle } = validEnrichedScript;
      const result = EnrichedScriptSchema.safeParse(withoutTitle);
      expect(result.success).toBe(false);
    });

    it("totalDurationSec が欠損しているとき拒否する", () => {
      const { totalDurationSec: _omitted, ...without } = validEnrichedScript;
      const result = EnrichedScriptSchema.safeParse(without);
      expect(result.success).toBe(false);
    });

    it("newsItems が欠損しているとき拒否する", () => {
      const { newsItems: _omitted, ...without } = validEnrichedScript;
      const result = EnrichedScriptSchema.safeParse(without);
      expect(result.success).toBe(false);
    });

    it("sections が欠損しているとき拒否する", () => {
      const { sections: _omitted, ...without } = validEnrichedScript;
      const result = EnrichedScriptSchema.safeParse(without);
      expect(result.success).toBe(false);
    });
  });

  describe("異常系 - セクション構造", () => {
    it("discussion の phase が無効なとき拒否する", () => {
      const invalidPhase = {
        ...validEnrichedScript,
        sections: [
          validEnrichedScript.sections[0],
          {
            type: "discussion",
            newsId: "news-1",
            blocks: [
              {
                phase: "invalid",
                lines: [
                  {
                    speaker: "A",
                    text: "test",
                    voicevoxSpeakerId: 0,
                    offsetSec: 7.0,
                    durationSec: 3.0,
                  },
                ],
              },
            ],
          },
        ],
      };
      const result = EnrichedScriptSchema.safeParse(invalidPhase);
      expect(result.success).toBe(false);
    });

    it("discussion に newsId が欠損しているとき拒否する", () => {
      const missingNewsId = {
        ...validEnrichedScript,
        sections: [
          {
            type: "discussion",
            blocks: [
              {
                phase: "summary",
                lines: [
                  {
                    speaker: "A",
                    text: "test",
                    voicevoxSpeakerId: 0,
                    offsetSec: 0,
                    durationSec: 3.0,
                  },
                ],
              },
            ],
          },
        ],
      };
      const result = EnrichedScriptSchema.safeParse(missingNewsId);
      expect(result.success).toBe(false);
    });

    it("discussion の blocks が空配列のとき拒否する", () => {
      const emptyBlocks = {
        ...validEnrichedScript,
        sections: [
          validEnrichedScript.sections[0],
          {
            type: "discussion",
            newsId: "news-1",
            blocks: [],
          },
          validEnrichedScript.sections[2],
        ],
      };
      const result = EnrichedScriptSchema.safeParse(emptyBlocks);
      expect(result.success).toBe(false);
    });

    it("intro の greeting フィールドが欠損しているとき拒否する", () => {
      const missingGreeting = {
        ...validEnrichedScript,
        sections: [
          {
            type: "intro",
            newsOverview: validEnrichedScript.sections[0].newsOverview,
          },
        ],
      };
      const result = EnrichedScriptSchema.safeParse(missingGreeting);
      expect(result.success).toBe(false);
    });

    it("outro の recap フィールドが欠損しているとき拒否する", () => {
      const missingRecap = {
        ...validEnrichedScript,
        sections: [
          {
            type: "outro",
            closing: [
              {
                speaker: "A",
                text: "end",
                voicevoxSpeakerId: 0,
                offsetSec: 0,
                durationSec: 3.0,
              },
            ],
          },
        ],
      };
      const result = EnrichedScriptSchema.safeParse(missingRecap);
      expect(result.success).toBe(false);
    });
  });

  describe("異常系 - ライン内のバリデーション", () => {
    it("intro の greeting 内に不正な speaker が含まれるとき拒否する", () => {
      const invalidSpeaker = {
        ...validEnrichedScript,
        sections: [
          {
            type: "intro",
            greeting: [
              {
                speaker: "X",
                text: "test",
                voicevoxSpeakerId: 0,
                offsetSec: 0,
                durationSec: 3.0,
              },
            ],
            newsOverview: [],
          },
          ...validEnrichedScript.sections.slice(1),
        ],
      };
      const result = EnrichedScriptSchema.safeParse(invalidSpeaker);
      expect(result.success).toBe(false);
    });
  });

  describe("プロパティベーステスト", () => {
    it("スキーマから生成した任意の EnrichedLine は必ず検証を通過する", () => {
      const zfc = ZodFastCheck();
      fc.assert(
        fc.property(zfc.inputOf(EnrichedLineSchema), (line) => {
          const result = EnrichedLineSchema.safeParse(line);
          expect(result.success).toBe(true);
        }),
        { numRuns: 50 },
      );
    });
  });
});
