export function formatNumber(n: number | null | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US').format(n);
}

export function formatPercent(rate: number | null | undefined, digits = 1): string {
  if (rate == null) return '—';
  return `${(rate * 100).toFixed(digits)}%`;
}

export function countryFlag(code: string | null | undefined): string {
  if (!code || code.length !== 2) return '🏳️';
  const A = 0x1f1e6;
  return String.fromCodePoint(
    A + code.toUpperCase().charCodeAt(0) - 65,
    A + code.toUpperCase().charCodeAt(1) - 65,
  );
}
