import { Effect, Result } from "effect";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseEnrichedScript } from "./enriched-parser";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const run = (jsonContent: string, wavPath: string) =>
  Effect.runSync(Effect.result(parseEnrichedScript(jsonContent, wavPath)));

// ---------------------------------------------------------------------------
// Shared fixture — minimal valid enriched.json structure
// ---------------------------------------------------------------------------

const minimalEnrichedScript = {
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

const MINIMAL_JSON = JSON.stringify(minimalEnrichedScript);
const WAV_PATH = "/tmp/audio/test.wav";

// ---------------------------------------------------------------------------
// JSON parse errors
// ---------------------------------------------------------------------------

describe("parseEnrichedScript — JSON パースエラー", () => {
  it("不正な JSON 文字列で ValidationError を返す", () => {
    const invalidJson = "{ invalid json }";
    const result = run(invalidJson, WAV_PATH);
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("ValidationError");
    }
  });

  it("空文字列で ValidationError を返す", () => {
    const result = run("", WAV_PATH);
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("ValidationError");
    }
  });

  it("JSON_PARSE エラーは cause に元の Error を保持する", () => {
    const result = run("not-json", WAV_PATH);
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("ValidationError");
      expect(result.failure.cause).toBeInstanceOf(Error);
    }
  });
});

// ---------------------------------------------------------------------------
// Schema validation errors
// ---------------------------------------------------------------------------

describe("parseEnrichedScript — スキーマバリデーションエラー", () => {
  it("title が欠損しているとき ValidationError を返す", () => {
    const { title: _omitted, ...withoutTitle } = minimalEnrichedScript;
    const json = JSON.stringify(withoutTitle);
    const result = run(json, WAV_PATH);
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("ValidationError");
    }
  });

  it("sections が欠損しているとき ValidationError を返す", () => {
    const { sections: _omitted, ...withoutSections } = minimalEnrichedScript;
    const json = JSON.stringify(withoutSections);
    const result = run(json, WAV_PATH);
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("ValidationError");
    }
  });

  it("newsItems が欠損しているとき ValidationError を返す", () => {
    const { newsItems: _omitted, ...withoutNewsItems } = minimalEnrichedScript;
    const json = JSON.stringify(withoutNewsItems);
    const result = run(json, WAV_PATH);
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("ValidationError");
    }
  });

  it("discussion の phase が無効なとき ValidationError を返す", () => {
    const invalidPhase = {
      ...minimalEnrichedScript,
      sections: [
        minimalEnrichedScript.sections[0],
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
    const json = JSON.stringify(invalidPhase);
    const result = run(json, WAV_PATH);
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("ValidationError");
    }
  });

  it("ライン内の speaker が A/B 以外のとき ValidationError を返す", () => {
    const invalidSpeaker = {
      ...minimalEnrichedScript,
      sections: [
        {
          type: "intro",
          greeting: [
            {
              speaker: "X",
              text: "hi",
              voicevoxSpeakerId: 0,
              offsetSec: 0,
              durationSec: 3.0,
            },
          ],
          newsOverview: [],
        },
        ...minimalEnrichedScript.sections.slice(1),
      ],
    };
    const json = JSON.stringify(invalidSpeaker);
    const result = run(json, WAV_PATH);
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("ValidationError");
    }
  });
});

// ---------------------------------------------------------------------------
// Empty array errors (F-004)
// ---------------------------------------------------------------------------

describe("parseEnrichedScript — 異常系: 空の配列", () => {
  it("discussion block の lines が空のとき ValidationError を返す", () => {
    const emptyDiscLines = {
      ...minimalEnrichedScript,
      sections: [
        minimalEnrichedScript.sections[0],
        {
          type: "discussion",
          newsId: "news-1",
          blocks: [{ phase: "summary", lines: [] }],
        },
        minimalEnrichedScript.sections[2],
      ],
    };
    const result = run(JSON.stringify(emptyDiscLines), WAV_PATH);
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("ValidationError");
    }
  });

  it("intro の greeting も newsOverview も空のとき ValidationError を返す", () => {
    const emptyIntro = {
      ...minimalEnrichedScript,
      sections: [
        { type: "intro", greeting: [], newsOverview: [] },
        ...minimalEnrichedScript.sections.slice(1),
      ],
    };
    const result = run(JSON.stringify(emptyIntro), WAV_PATH);
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("ValidationError");
    }
  });

  it("outro の recap も closing も空のとき ValidationError を返す", () => {
    const emptyOutro = {
      ...minimalEnrichedScript,
      sections: [
        ...minimalEnrichedScript.sections.slice(0, 2),
        { type: "outro", recap: [], closing: [] },
      ],
    };
    const result = run(JSON.stringify(emptyOutro), WAV_PATH);
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("ValidationError");
    }
  });
});

// ---------------------------------------------------------------------------
// Successful parsing — scalar fields
// ---------------------------------------------------------------------------

describe("parseEnrichedScript — 正常系: スカラーフィールド", () => {
  it("title が VideoProps に正確に引き継がれる", () => {
    const result = run(MINIMAL_JSON, WAV_PATH);
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.success.title).toBe("テストタイトル");
    }
  });

  it("totalDurationSec が VideoProps に正確に引き継がれる", () => {
    const result = run(MINIMAL_JSON, WAV_PATH);
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.success.totalDurationSec).toBe(30.0);
    }
  });
});

// ---------------------------------------------------------------------------
// Successful parsing — newsItems
// ---------------------------------------------------------------------------

describe("parseEnrichedScript — 正常系: newsItems", () => {
  it("newsItems が id/title のみにマップされ sourceUrl は除外される", () => {
    const result = run(MINIMAL_JSON, WAV_PATH);
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      const { newsItems } = result.success;
      expect(newsItems).toHaveLength(1);
      expect(newsItems[0]).toEqual({ id: "news-1", title: "ニュース1" });
      expect(newsItems[0]).not.toHaveProperty("sourceUrl");
    }
  });

  it("複数の newsItems が全て引き継がれる", () => {
    const script = {
      ...minimalEnrichedScript,
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
        {
          id: "news-3",
          title: "ニュース3",
          sourceUrl: "https://example.com/3",
        },
      ],
    };
    const result = run(JSON.stringify(script), WAV_PATH);
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.success.newsItems).toHaveLength(3);
      expect(result.success.newsItems.map((n) => n.id)).toEqual([
        "news-1",
        "news-2",
        "news-3",
      ]);
    }
  });
});

// ---------------------------------------------------------------------------
// Successful parsing — lines flattening
// ---------------------------------------------------------------------------

describe("parseEnrichedScript — 正常系: ライン平坦化", () => {
  it("全セクションのライン数の合計が VideoProps.lines の長さになる", () => {
    const result = run(MINIMAL_JSON, WAV_PATH);
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.success.lines).toHaveLength(7);
    }
  });

  it("各ラインの audioPath が渡した wavPath と一致する", () => {
    const result = run(MINIMAL_JSON, WAV_PATH);
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      result.success.lines.forEach((line) => {
        expect(line.audioPath).toBe(WAV_PATH);
      });
    }
  });

  it("各ラインの startSec が入力 offsetSec と一致する", () => {
    const expectedOffsets = [0, 3.0, 7.0, 12.0, 17.0, 22.0, 26.0];
    const result = run(MINIMAL_JSON, WAV_PATH);
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      const actualOffsets = result.success.lines.map((l) => l.startSec);
      expect(actualOffsets).toEqual(expectedOffsets);
    }
  });

  it("各ラインの durationSec が入力 durationSec と一致する", () => {
    const expectedDurations = [3.0, 4.0, 5.0, 5.0, 5.0, 4.0, 4.0];
    const result = run(MINIMAL_JSON, WAV_PATH);
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      const actualDurations = result.success.lines.map((l) => l.durationSec);
      expect(actualDurations).toEqual(expectedDurations);
    }
  });

  it("ラインは sections の出現順（intro → discussion → outro）に並ぶ", () => {
    const result = run(MINIMAL_JSON, WAV_PATH);
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      const offsets = result.success.lines.map((l) => l.startSec);
      const isMonotonicallyIncreasing = offsets
        .slice(1)
        .every((offset, i) => offset > offsets[i]);
      expect(isMonotonicallyIncreasing).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Successful parsing — SectionMarkers
// ---------------------------------------------------------------------------

describe("parseEnrichedScript — 正常系: SectionMarkers", () => {
  it("SectionMarkers の総数が正しい（1 intro + 3 discussion blocks + 1 outro = 5）", () => {
    const result = run(MINIMAL_JSON, WAV_PATH);
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.success.sectionMarkers).toHaveLength(5);
    }
  });

  describe("IntroSectionMarker", () => {
    it("type が 'intro' である", () => {
      const result = run(MINIMAL_JSON, WAV_PATH);
      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        const intro = result.success.sectionMarkers.find(
          (m) => m.type === "intro",
        );
        expect(intro).toBeDefined();
      }
    });

    it("startSec が intro の最初のライン offsetSec (0) と一致する", () => {
      const result = run(MINIMAL_JSON, WAV_PATH);
      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        const intro = result.success.sectionMarkers.find(
          (m) => m.type === "intro",
        );
        expect(intro?.startSec).toBe(0);
      }
    });

    it("endSec が intro の最後のライン (offsetSec + durationSec) と一致する", () => {
      const result = run(MINIMAL_JSON, WAV_PATH);
      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        const intro = result.success.sectionMarkers.find(
          (m) => m.type === "intro",
        );
        expect(intro?.endSec).toBeCloseTo(7.0);
      }
    });

    it("agenda が newsItems の id/title を含む", () => {
      const result = run(MINIMAL_JSON, WAV_PATH);
      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        const intro = result.success.sectionMarkers.find(
          (m) => m.type === "intro",
        );
        expect(intro?.type).toBe("intro");
        if (intro?.type === "intro") {
          expect(intro.agenda).toEqual([{ id: "news-1", title: "ニュース1" }]);
        }
      }
    });
  });

  describe("DiscussionSectionMarker（各 block が独立した marker になる）", () => {
    it("discussion の各 block に対して DiscussionSectionMarker が生成される", () => {
      const result = run(MINIMAL_JSON, WAV_PATH);
      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        const discussions = result.success.sectionMarkers.filter(
          (m) => m.type === "discussion",
        );
        expect(discussions).toHaveLength(3);
      }
    });

    it("summary block の newsId と phase が正しい", () => {
      const result = run(MINIMAL_JSON, WAV_PATH);
      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        const discussions = result.success.sectionMarkers.filter(
          (m) => m.type === "discussion",
        );
        const summary = discussions.find(
          (m) => m.type === "discussion" && m.phase === "summary",
        );
        expect(summary).toBeDefined();
        if (summary?.type === "discussion") {
          expect(summary.newsId).toBe("news-1");
          expect(summary.phase).toBe("summary");
        }
      }
    });

    it("summary block の startSec が 7.0、endSec が 12.0 である", () => {
      const result = run(MINIMAL_JSON, WAV_PATH);
      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        const summary = result.success.sectionMarkers.find(
          (m) => m.type === "discussion" && m.phase === "summary",
        );
        expect(summary?.startSec).toBeCloseTo(7.0);
        expect(summary?.endSec).toBeCloseTo(12.0);
      }
    });

    it("background block の startSec が 12.0、endSec が 17.0 である", () => {
      const result = run(MINIMAL_JSON, WAV_PATH);
      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        const background = result.success.sectionMarkers.find(
          (m) => m.type === "discussion" && m.phase === "background",
        );
        expect(background?.startSec).toBeCloseTo(12.0);
        expect(background?.endSec).toBeCloseTo(17.0);
      }
    });

    it("deepDive block の startSec が 17.0、endSec が 22.0 である", () => {
      const result = run(MINIMAL_JSON, WAV_PATH);
      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        const deepDive = result.success.sectionMarkers.find(
          (m) => m.type === "discussion" && m.phase === "deepDive",
        );
        expect(deepDive?.startSec).toBeCloseTo(17.0);
        expect(deepDive?.endSec).toBeCloseTo(22.0);
      }
    });
  });

  describe("OutroSectionMarker", () => {
    it("type が 'outro' である", () => {
      const result = run(MINIMAL_JSON, WAV_PATH);
      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        const outro = result.success.sectionMarkers.find(
          (m) => m.type === "outro",
        );
        expect(outro).toBeDefined();
      }
    });

    it("startSec が outro の最初のライン offsetSec (22.0) と一致する", () => {
      const result = run(MINIMAL_JSON, WAV_PATH);
      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        const outro = result.success.sectionMarkers.find(
          (m) => m.type === "outro",
        );
        expect(outro?.startSec).toBeCloseTo(22.0);
      }
    });

    it("endSec が outro の最後のライン (26.0 + 4.0 = 30.0) と一致する", () => {
      const result = run(MINIMAL_JSON, WAV_PATH);
      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        const outro = result.success.sectionMarkers.find(
          (m) => m.type === "outro",
        );
        expect(outro?.endSec).toBeCloseTo(30.0);
      }
    });
  });

  it("全 SectionMarker の startSec は単調非減少の順で並ぶ", () => {
    const result = run(MINIMAL_JSON, WAV_PATH);
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      const starts = result.success.sectionMarkers.map((m) => m.startSec);
      const isMonotonicallyNonDecreasing = starts
        .slice(1)
        .every((start, i) => start >= starts[i]);
      expect(isMonotonicallyNonDecreasing).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Property-based tests — invariants
// ---------------------------------------------------------------------------

describe("parseEnrichedScript — プロパティベーステスト（不変条件）", () => {
  const validEnrichedScriptArb = fc
    .record({
      introLineCount: fc.integer({ min: 1, max: 5 }),
      discLineCount: fc.integer({ min: 1, max: 5 }),
      outroLineCount: fc.integer({ min: 1, max: 5 }),
    })
    .map(({ introLineCount, discLineCount, outroLineCount }) => {
      const dur = 2.0;
      const makeLines = (
        count: number,
        startOffset: number,
        speaker: "A" | "B",
        prefix: string,
      ) =>
        Array.from({ length: count }, (_, i) => ({
          speaker,
          text: `${prefix} ${i}`,
          voicevoxSpeakerId: 0,
          offsetSec: startOffset + i * dur,
          durationSec: dur,
        }));

      const greetingStart = 0;
      const discStart = introLineCount * dur;
      const outroStart = (introLineCount + discLineCount) * dur;
      const totalDuration =
        (introLineCount + discLineCount + outroLineCount) * dur;

      return {
        title: "プロパティテスト",
        totalDurationSec: totalDuration,
        outputWavS3Key: "output/test.wav",
        newsItems: [
          { id: "news-1", title: "News", sourceUrl: "https://x.com" },
        ],
        sections: [
          {
            type: "intro",
            greeting: makeLines(introLineCount, greetingStart, "A", "greeting"),
            newsOverview: [],
          },
          {
            type: "discussion",
            newsId: "news-1",
            blocks: [
              {
                phase: "summary",
                lines: makeLines(discLineCount, discStart, "B", "disc"),
              },
            ],
          },
          {
            type: "outro",
            recap: makeLines(outroLineCount, outroStart, "A", "outro"),
            closing: [],
          },
        ],
      };
    });

  it("任意の有効な enriched script でパースは Success を返す", () => {
    fc.assert(
      fc.property(validEnrichedScriptArb, (script) => {
        const result = run(JSON.stringify(script), "/p/a.wav");
        expect(Result.isSuccess(result)).toBe(true);
      }),
      { numRuns: 30 },
    );
  });

  it("不変条件: 全ライン.audioPath === wavPath", () => {
    fc.assert(
      fc.property(
        validEnrichedScriptArb,
        fc.string({ minLength: 1 }),
        (script, wavPath) => {
          const result = run(JSON.stringify(script), wavPath);
          expect(Result.isSuccess(result)).toBe(true);
          if (Result.isSuccess(result)) {
            result.success.lines.forEach((line) => {
              expect(line.audioPath).toBe(wavPath);
            });
          }
        },
      ),
      { numRuns: 30 },
    );
  });

  it("不変条件: 全 SectionMarker で startSec <= endSec", () => {
    fc.assert(
      fc.property(validEnrichedScriptArb, (script) => {
        const result = run(JSON.stringify(script), "/p/a.wav");
        expect(Result.isSuccess(result)).toBe(true);
        if (Result.isSuccess(result)) {
          result.success.sectionMarkers.forEach((marker) => {
            expect(marker.startSec).toBeLessThanOrEqual(marker.endSec);
          });
        }
      }),
      { numRuns: 30 },
    );
  });

  it("不変条件: lines の総数 = 全セクションのライン数の合計", () => {
    fc.assert(
      fc.property(validEnrichedScriptArb, (script) => {
        const totalInputLines = script.sections.reduce((acc, section) => {
          if (section.type === "intro") {
            return acc + section.greeting.length + section.newsOverview.length;
          } else if (section.type === "discussion") {
            return (
              acc +
              section.blocks.reduce((sum, block) => sum + block.lines.length, 0)
            );
          } else {
            return acc + section.recap.length + section.closing.length;
          }
        }, 0);

        const result = run(JSON.stringify(script), "/p/a.wav");
        expect(Result.isSuccess(result)).toBe(true);
        if (Result.isSuccess(result)) {
          expect(result.success.lines).toHaveLength(totalInputLines);
        }
      }),
      { numRuns: 30 },
    );
  });
});
