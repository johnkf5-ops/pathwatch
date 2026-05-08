function colorFor(value: number): string {
  if (value >= 0.75) return '#2ee37a';
  if (value >= 0.5) return '#f5b041';
  return '#ff4d5e';
}

export function ConfidenceBar({ confidence }: { confidence: number | null }) {
  if (confidence == null) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-[3px] w-32 bg-border" />
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">—</span>
      </div>
    );
  }
  const pct = Math.round(confidence * 100);
  const color = colorFor(confidence);
  return (
    <div className="flex items-center gap-2">
      <div className="h-[3px] w-32 bg-border">
        <div className="h-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-secondary tabular-nums">
        {pct}%
      </span>
    </div>
  );
}
