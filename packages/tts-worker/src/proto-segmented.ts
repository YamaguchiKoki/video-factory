import { writeFile } from "fs";

const VOICEVOX_URL = process.env.VOICEVOX_URL ?? "http://localhost:50021";
async function processScript(script: any): Promise<any> {
  const segments: any[] = [];
  let offset = 0;

  for (const [i, seg] of script.segments.entries()) {
    // 1. audio_query でタイミング取得
    const query = await fetch(
      `http://localhost:50021/audio_query?text=${encodeURIComponent(seg.text)}&speaker=${seg.voicevoxSpeakerId}`,
      { method: "POST" },
    ).then((r) => r.json());

    // 2. synthesis で WAV 生成
    const wav = await fetch(
      `http://localhost:50021/synthesis?speaker=${seg.voicevoxSpeakerId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(query),
      },
    ).then((r) => r.arrayBuffer());

    const audioPath = `public/audio/segment-${i}.wav`;
    // await writeFile(audioPath, Buffer.from(wav));

    // // 3. WAV実測の長さを使う（audio_queryの積算より信頼性が高い）
    // // const durationSec = getWavDuration(audioPath);
  }

  return segments;
}
