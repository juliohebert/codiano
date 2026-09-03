export function parseLocalDate(value: string): { year: number; month: number; day: number } {
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}

export function formatDateLocal(value: string): string {
  const { year, month, day } = parseLocalDate(value);
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

export function isSameLocalDate(a: string, b: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) return false;
  const a2 = parseLocalDate(a);
  const b2 = parseLocalDate(b);
  return a2.year === b2.year && a2.month === b2.month && a2.day === b2.day;
}

export function addDaysLocal(value: string, days: number): string {
  const { year, month, day } = parseLocalDate(value);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  const ny = date.getFullYear();
  const nm = String(date.getMonth() + 1).padStart(2, '0');
  const nd = String(date.getDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

export function toLocalDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}
