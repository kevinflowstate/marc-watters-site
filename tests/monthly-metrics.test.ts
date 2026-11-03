import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';
import { NextResponse } from 'next/server';
import * as metrics from '../lib/monthly-metrics';

let user: { id: string } | null;
let inactive: boolean;
let rows: Record<string, unknown>[];
let route: (request: Request) => Promise<Response>;
const upsert = vi.fn(async (record: Record<string, unknown>) => {
  rows = [...rows.filter(r => r.client_id !== record.client_id || r.month_start !== record.month_start), record];
  return { error: null };
});
const values = { monthly_revenue: 20000, gross_profit_margin: 32, lead_conversion_rate: 25, average_job_value: 5000, pipeline_forward_book: 40000 };
beforeEach(async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-03T21:00:00Z'));
  user = { id: 'authenticated-user' }; inactive = false; upsert.mockClear();
  rows = [{ client_id: 'own-profile', month_start: '2026-11-01', ...values, submitted_at: '2026-11-02T09:00:00Z' }];
  const admin = { from: (table: string) => {
    const filters: Record<string, unknown> = {};
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { filters[key] = value; return query; },
      single: async () => ({ data: table === 'client_profiles' && filters.user_id === user?.id ? { id: 'own-profile' } : null }),
      maybeSingle: async () => ({ data: rows.find(r => Object.entries(filters).every(([k,v]) => r[k] === v)) || null }),
      order: async () => ({ data: rows.filter(r => Object.entries(filters).every(([k,v]) => r[k] === v)) }),
      upsert,
    }; return query;
  }};
  const source = readFileSync(new URL('../app/api/portal/monthly-metrics/route.ts', import.meta.url), 'utf8');
  const code = (await transform(source.replace(/import[\s\S]*?from\s+["'][^"']+["'];/g, '').replace(/export async function/g, 'async function'), { loader: 'ts', target: 'es2022' })).code;
  route = new Function('createAdminClient', 'createClient', 'NextResponse', 'inactiveClientResponse', ...Object.keys(metrics), code + ';return PUT;')(
    () => admin, async () => ({ auth: { getUser: async () => ({ data: { user } }) } }), NextResponse,
    async () => inactive ? NextResponse.json({ error: 'Inactive' }, { status: 403 }) : null, ...Object.values(metrics),
  );
});
afterEach(() => vi.useRealTimers());
const request = (extra: Record<string, unknown> = {}) => new Request('http://localhost/api/portal/monthly-metrics', { method: 'PUT', body: JSON.stringify({ values, ...extra }) });

describe('monthly metrics reporting period', () => {
  it('saves October against the authenticated client without overwriting November', async () => {
    const november = { ...rows[0] };
    const response = await route(request({ monthStart: '2026-10-01', client_id: 'someone-else' }));
    expect(response.status).toBe(200);
    expect((await response.json()).monthStart).toBe('2026-10-01');
    expect(rows).toHaveLength(2);
    expect(rows.find(r => r.month_start === '2026-11-01')).toEqual(november);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ client_id: 'own-profile', month_start: '2026-10-01' }), { onConflict: 'client_id,month_start' });
  });
  it('updates an older scorecard without duplicating it or changing its original submission timestamp', async () => {
    rows.push({ client_id: 'own-profile', month_start: '2026-10-01', ...values, submitted_at: '2026-10-31T10:00:00Z' });
    await route(request({ monthStart: '2026-10-01', values: { ...values, monthly_revenue: 23000 } }));
    expect(rows).toHaveLength(2);
    expect(rows.find(r => r.month_start === '2026-10-01')).toMatchObject({ monthly_revenue: 23000, submitted_at: '2026-10-31T10:00:00Z' });
  });
  it('keeps current-month compatibility for older open tabs', async () => {
    expect((await route(request())).status).toBe(200);
    expect(rows).toHaveLength(1);
    expect(rows[0].month_start).toBe('2026-11-01');
  });
  it.each(['2026-12-01', '2026-13-01', '2026-10-15', '2026-1-01', '0000-01-01', '', null, {}])('rejects invalid or future month %j without writing', async monthStart => {
    expect((await route(request({ monthStart }))).status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });
  it('preserves authentication, inactive-client and numeric validation', async () => {
    user = null; expect((await route(request())).status).toBe(401);
    user = { id: 'authenticated-user' }; inactive = true;
    expect((await route(request())).status).toBe(403);
    inactive = false;
    expect((await route(request({ values: { ...values, lead_conversion_rate: 101 } }))).status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });
  it('offers December when January begins and includes older recorded months once', () => {
    const older = [{ month_start: '2024-10-01' }, { month_start: '2024-10-01' }] as Parameters<typeof metrics.getMetricsMonthOptions>[1];
    const options = metrics.getMetricsMonthOptions('2027-01-01', older);
    expect(options.slice(0, 2)).toEqual(['2027-01-01', '2026-12-01']);
    expect(options.filter(m => m === '2024-10-01')).toHaveLength(1);
  });
  it('uses the London month at the summer timezone boundary', () => {
    expect(metrics.getCurrentMetricsMonthStart(new Date('2026-08-31T23:30:00Z'))).toBe('2026-09-01');
  });
});
