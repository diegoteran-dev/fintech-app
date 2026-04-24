export const CAT_COLORS: Record<string, string> = {
  Housing: '#6366F1', Groceries: '#F59E0B', Transport: '#06B6D4',
  Entertainment: '#EC4899', Shopping: '#8B5CF6', Health: '#10B981',
  Utilities: '#F97316', Dining: '#EF4444', Savings: '#14B8A6',
  Salary: '#10B981', Freelance: '#7C3AED', 'Investment Returns': '#F59E0B',
  'Personal Care': '#DB2777', Insurance: '#0EA5E9', Education: '#A855F7',
  Travel: '#22D3EE', 'Gifts & Donations': '#F472B6', Other: '#94A3B8',
};

export function categoryColor(cat: string, fallback = '#94A3B8'): string {
  return CAT_COLORS[cat] ?? fallback;
}
