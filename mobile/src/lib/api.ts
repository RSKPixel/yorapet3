const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

let token: string | null = null;
let onUnauthorized: () => void = () => {};

export function setToken(t: string | null) {
  token = t;
}

export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new Error('Cannot reach server. Check your connection.');
  }
  if (res.status === 401 && token) onUnauthorized();
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = body?.detail;
    // FastAPI validation errors arrive as a list of { msg }.
    const msg = Array.isArray(detail) ? detail.map((d) => String(d.msg).replace(/^Value error, /, '')).join('\n') : detail;
    throw new Error(msg ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export function qs(params: Record<string, string | number | undefined>) {
  const s = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');
  return s ? `?${s}` : '';
}

export type Kind = 'sales' | 'purchases';

export type Summary = {
  totals: { amount: number; qty: number; vouchers: number };
  top_parties: { name: string; amount: number }[];
  top_items: { name: string; qty: number; amount: number }[];
};

export type VoucherRow = {
  voucher_no: string;
  voucher_date: string;
  party: string;
  line_count: number;
  qty: number;
  amount: number;
};

export type VoucherDetail = {
  voucher_no: string;
  voucher_date: string;
  party: string;
  broker: string | null;
  total: number;
  lines: { stock_item: string; brand: string | null; qty: number; rate: number; amount: number }[];
};

export type StockItem = {
  stock_group: string;
  stock_item: string;
  closing: string | null;
  closing_rate: number | null;
  closing_value: number | null;
  inwards: string | null;
  outwards: string | null;
};

export type Stock = {
  period: { period_from: string; period_to: string } | null;
  groups: { name: string; value: number }[];
  items: StockItem[];
};

export type ProductionInput = {
  prod_date: string;
  output_item: string;
  output_qty: number;
  preform_item: string | null;
  preform_qty: number;
  cap_item: string | null;
  cap_qty: number;
  wastage_qty: number;
  eb_start: number;
  eb_end: number;
  eb_rate: number;
  labour_cost: number;
  notes: string | null;
};

export type ProductionEntry = ProductionInput & {
  id: number;
  preform_rate: number | null;
  cap_rate: number | null;
  material_cost: number;
  eb_units: number;
  eb_cost: number;
  total_cost: number;
  cost_per_unit: number | null;
};

export type ProductionSummary = {
  totals: {
    entries: number;
    output_qty: number;
    wastage_qty: number;
    eb_units: number;
    eb_cost: number;
    material_cost: number;
    labour_cost: number;
    total_cost: number;
  };
  by_item: { name: string; qty: number; cost: number }[];
  materials: { name: string; qty: number }[];
};

export type InventoryItem = { name: string; group: string; rate: number | null };
