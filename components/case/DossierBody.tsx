import { parseDossier, extractUrls, isSourcesLabel } from '@/lib/dossier-parse';

export function DossierBody({ text }: { text: string | null | undefined }) {
  const blocks = parseDossier(text);
  if (blocks.length === 0) return null;

  // Render newest first. The dossier is append-only in the DB (older entries on
  // top, newest at the bottom of the raw text). For the reader's eye, the most
  // recent update is what matters; reverse the order so it leads. The original
  // lead block (no timestamp) ends up at the bottom as the foundational entry.
  const orderedBlocks = [...blocks].reverse();

  return (
    <div className="flex flex-col gap-5">
      {orderedBlocks.map((block, bi) => (
        <div key={bi} className="flex flex-col gap-3">
          {block.timestamp ? (
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">
              UPDATED · {block.timestamp}
            </div>
          ) : (
            bi !== 0 && (
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
                ORIGINAL ENTRY
              </div>
            )
          )}
          {block.sections.map((section, si) => (
            <SectionBlock key={si} label={section.label} body={section.body} />
          ))}
        </div>
      ))}
    </div>
  );
}

function SectionBlock({ label, body }: { label: string | null; body: string }) {
  if (isSourcesLabel(label)) {
    const urls = extractUrls(body);
    if (urls.length === 0) {
      return <LabeledParagraph label={label} body={body} />;
    }
    return (
      <div className="flex flex-col gap-1.5">
        <Label text={label!} />
        <ul className="flex flex-col gap-1 text-sm">
          {urls.map((url, i) => (
            <li key={i}>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline break-all"
              >
                {hostnameOf(url)}
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return <LabeledParagraph label={label} body={body} />;
}

function LabeledParagraph({ label, body }: { label: string | null; body: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <Label text={label} />}
      <p className="text-sm leading-[1.55] text-text-secondary">{body}</p>
    </div>
  );
}

function Label({ text }: { text: string }) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
      {text}
    </div>
  );
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
