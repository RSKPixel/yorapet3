const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

export const money = (v: number | null | undefined) => '₹' + inr.format(v ?? 0);
export const qty = (v: number | null | undefined) => num.format(v ?? 0);

export function isoDate(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function showDate(s: string) {
  const [y, m, d] = s.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export type Range = { key: string; label: string; from?: string; to?: string };

// Indian financial year starts on 1 April.
export function ranges(): Range[] {
  const now = new Date();
  const today = isoDate(now);
  const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  return [
    { key: 'today', label: 'Today', from: today, to: today },
    { key: 'month', label: 'This month', from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: today },
    { key: 'lastmonth', label: 'Last month', from: isoDate(lastMonthStart), to: isoDate(lastMonthEnd) },
    { key: 'fy', label: 'This FY', from: `${fyStartYear}-04-01`, to: today },
    { key: 'all', label: 'All' },
  ];
}
