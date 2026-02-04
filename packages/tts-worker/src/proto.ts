import fs from "node:fs/promises";

interface DialogueLine {
  speaker: string;
  text: string;
}

const SPEAKER_MAP: Record<string, number> = {
  アキラ: 3,
  ユウキ: 2,
};

const VOICEVOX_URL = process.env.VOICEVOX_URL ?? "http://localhost:50021";

// 単一セリフ → WAV (Buffer)
async function synthesize(text: string, speakerId: number): Promise<Buffer> {
  const queryRes = await fetch(
    `${VOICEVOX_URL}/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`,
    { method: "POST" },
  );
  const query = await queryRes.json();

  const audioRes = await fetch(
    `${VOICEVOX_URL}/synthesis?speaker=${speakerId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(query),
    },
  );

  return Buffer.from(await audioRes.arrayBuffer());
}

// 対話全体 → 1つのWAV
export async function synthesizeDialogue(
  dialogue: DialogueLine[],
): Promise<Buffer> {
  // 1. 各セリフをWAVに変換
  const wavBuffers: Buffer[] = [];
  for (const line of dialogue) {
    const speakerId = SPEAKER_MAP[line.speaker] ?? 1;
    const wav = await synthesize(line.text, speakerId);
    wavBuffers.push(wav);
  }

  // 2. connect_waves で連結
  const base64Waves = wavBuffers.map((buf) => buf.toString("base64"));

  const res = await fetch(`${VOICEVOX_URL}/connect_waves`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(base64Waves),
  });

  return Buffer.from(await res.arrayBuffer());
}

const script = {
  dialogue: [
    { speaker: "アキラ", text: "こんにちは！今日のニュースをお届けします。" },
    { speaker: "ユウキ", text: "よろしくお願いします。" },
    { speaker: "アキラ", text: "まずは経済ニュースからです。" },
  ],
};

const wav = await synthesizeDialogue(script.dialogue);
await fs.writeFile("output.wav", wav);
