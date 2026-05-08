import type { FilterState, Significance, SourceType, Category } from './types';

const SOURCE_TYPES: SourceType[] = ['x','cdc','who','google_news','reddit','bluesky','ecdc','africa_cdc','wikipedia'];
const CATEGORIES: Category[] = ['case_report','policy','research','travel_advisory','mutation','death','containment','speculation'];

export const DEFAULT_LIMIT = 50;

export function parseFilters(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): FilterState {
  const get = (k: string): string | undefined => {
    if (params instanceof URLSearchParams) return params.get(k) ?? undefined;
    const v = params[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const sigStr = get('sig');
  const sigNum = sigStr ? Number(sigStr) : NaN;
  const significance: Significance | null = [1, 2, 3, 4, 5].includes(sigNum)
    ? (sigNum as Significance)
    : null;

  const sourceStr = get('source');
  const source: SourceType | null = sourceStr && SOURCE_TYPES.includes(sourceStr as SourceType)
    ? (sourceStr as SourceType)
    : null;

  const catStr = get('category');
  const category: Category | null = catStr && CATEGORIES.includes(catStr as Category)
    ? (catStr as Category)
    : null;

  const limitStr = get('limit');
  const limitNum = limitStr ? Number(limitStr) : NaN;
  const limit = Number.isFinite(limitNum) && limitNum > 0 && limitNum <= 500 ? limitNum : DEFAULT_LIMIT;

  return { significance, source, category, limit };
}

export function filtersToSearchString(f: FilterState): string {
  const u = new URLSearchParams();
  if (f.significance) u.set('sig', String(f.significance));
  if (f.source) u.set('source', f.source);
  if (f.category) u.set('category', f.category);
  if (f.limit !== DEFAULT_LIMIT) u.set('limit', String(f.limit));
  const s = u.toString();
  return s ? `?${s}` : '';
}

export function eventMatchesFilter(
  event: { significance: Significance; source_type: SourceType; category: Category },
  f: FilterState,
): boolean {
  if (f.significance && event.significance < f.significance) return false;
  if (f.source && event.source_type !== f.source) return false;
  if (f.category && event.category !== f.category) return false;
  return true;
}
