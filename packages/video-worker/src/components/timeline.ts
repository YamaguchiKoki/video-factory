import type { SectionMarker, TimedLine } from "../schema/schema";

/** 指定時刻(秒)に該当するセクションマーカーを返す */
export function getActiveMarker(
  markers: SectionMarker[],
  timeSec: number,
): SectionMarker | undefined {
  return markers.find((m) => timeSec >= m.startSec && timeSec < m.endSec);
}

/** 指定時刻(秒)に該当する発話を返す */
export function getActiveLine(
  lines: TimedLine[],
  timeSec: number,
): TimedLine | undefined {
  return lines.find(
    (l) => timeSec >= l.startSec && timeSec < l.startSec + l.durationSec,
  );
}

/** セクションマーカー内に含まれるlinesを返す */
export function getLinesInSection(
  lines: TimedLine[],
  marker: SectionMarker,
): TimedLine[] {
  return lines.filter(
    (l) => l.startSec >= marker.startSec && l.startSec < marker.endSec,
  );
}
