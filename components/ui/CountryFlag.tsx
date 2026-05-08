import { countryFlag } from '@/lib/format';

export function CountryFlag({ code, className }: { code: string | null; className?: string }) {
  if (!code) return null;
  return <span aria-hidden className={className}>{countryFlag(code)}</span>;
}
