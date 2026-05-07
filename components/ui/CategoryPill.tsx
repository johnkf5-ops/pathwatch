import type { Category } from '@/lib/types';
import { Badge } from './Badge';

const LABEL: Record<Category, string> = {
  case_report: 'Case report',
  policy: 'Policy',
  research: 'Research',
  travel_advisory: 'Travel advisory',
  mutation: 'Mutation',
  death: 'Death',
  containment: 'Containment',
  speculation: 'Speculation',
};

export function CategoryPill({ category }: { category: Category }) {
  return <Badge variant="outline">{LABEL[category]}</Badge>;
}
