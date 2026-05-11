// Parses a case dossier (plain-text prose written by the pipeline) into
// structured sections for rendering. Does NOT modify the underlying text.
//
// Two structural cues the pipeline already uses:
//   - "[Updated YYYY-MM-DD HH:MM UTC] ..."  — appended updates
//   - "Label: ..."                          — inline section labels like
//                                             "Travel:", "Exposure:",
//                                             "Current condition:", "Sources:"

export interface DossierSection {
  label: string | null;
  body: string;
}

export interface DossierBlock {
  timestamp: string | null; // null = original / first block; non-null = update timestamp
  sections: DossierSection[];
}

const UPDATE_REGEX = /\[Updated\s+([^\]]+)\]\s*/g;

// Matches "Label:" or "Label (parenthetical):" appearing at the start of a
// sentence (preceded by ". ", a newline, or at the very beginning of the
// chunk). Bounded to 4–60 chars and capitalized.
const LABEL_REGEX =
  /(^|(?<=[.!?]\s))([A-Z][A-Za-z][A-Za-z ]{2,40}?(?:\s*\([^)]+\))?):\s/g;

function parseSections(chunk: string): DossierSection[] {
  const sections: DossierSection[] = [];
  let lastEnd = 0;
  let lastLabel: string | null = null;

  // Reset regex state for each call.
  const re = new RegExp(LABEL_REGEX.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(chunk)) !== null) {
    const labelStart = m.index + m[1].length;
    const body = chunk.slice(lastEnd, labelStart).trim().replace(/\.\s*$/, '');
    if (body) sections.push({ label: lastLabel, body });
    lastLabel = m[3].trim();
    lastEnd = m.index + m[0].length;
  }

  const tail = chunk.slice(lastEnd).trim().replace(/\.\s*$/, '');
  if (tail) sections.push({ label: lastLabel, body: tail });

  return sections;
}

export function parseDossier(text: string | null | undefined): DossierBlock[] {
  if (!text) return [];
  const blocks: DossierBlock[] = [];
  let lastEnd = 0;
  let lastTimestamp: string | null = null;

  const re = new RegExp(UPDATE_REGEX.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const chunk = text.slice(lastEnd, m.index).trim();
    if (chunk) blocks.push({ timestamp: lastTimestamp, sections: parseSections(chunk) });
    lastTimestamp = m[1].trim();
    lastEnd = m.index + m[0].length;
  }

  const tail = text.slice(lastEnd).trim();
  if (tail) blocks.push({ timestamp: lastTimestamp, sections: parseSections(tail) });

  return blocks;
}

export function extractUrls(body: string): string[] {
  const matches = body.match(/https?:\/\/[^\s,)]+/g) ?? [];
  return matches.map((u) => u.replace(/[.,;]+$/, ''));
}

export function isSourcesLabel(label: string | null): boolean {
  if (!label) return false;
  return /^(sources?|references?|citations?)\b/i.test(label);
}
