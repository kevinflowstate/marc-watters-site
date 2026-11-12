// Minimal in-memory stand-in for the Supabase query builder, enough for the reply-draft modules.
// Supports select/insert/update/upsert with eq, neq, in, is, lte, gte, not, or(claimed_at...), order, limit,
// single and maybeSingle. Embedded selects are ignored (only flat columns are returned).

type Row = Record<string, unknown>;
type Filter = (row: Row) => boolean;

export type FakeDb = {
  tables: Record<string, Row[]>;
  inserts: Array<{ table: string; rows: Row[] }>;
  updates: Array<{ table: string; patch: Row }>;
  rpcCalls: Array<{ name: string; args: Row }>;
  rpcHandlers: Record<string, (args: Row) => unknown>;
  from: (table: string) => Builder;
  rpc: (name: string, args: Row) => Promise<{ data: unknown; error: null | { message: string } }>;
};

let idCounter = 0;
const newId = () => `00000000-0000-4000-8000-${String(++idCounter).padStart(12, "0")}`;

class Builder implements PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }> {
  private filters: Filter[] = [];
  private op: "select" | "insert" | "update" | "upsert" = "select";
  private payload: Row[] | Row | null = null;
  private wantSingle: "single" | "maybe" | null = null;
  private orderBy: { col: string; asc: boolean } | null = null;
  private max: number | null = null;
  private returning = false;

  constructor(private db: FakeDb, private table: string, private uniqueOpen?: (rows: Row[], row: Row) => boolean) {}

  select() {
    if (this.op !== "select") this.returning = true;
    return this;
  }
  insert(rows: Row | Row[]) {
    this.op = "insert";
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }
  upsert(row: Row) {
    this.op = "upsert";
    this.payload = row;
    return this;
  }
  update(patch: Row) {
    this.op = "update";
    this.payload = patch;
    return this;
  }
  eq(col: string, value: unknown) {
    this.filters.push((r) => r[col] === value);
    return this;
  }
  neq(col: string, value: unknown) {
    this.filters.push((r) => r[col] !== value);
    return this;
  }
  in(col: string, values: unknown[]) {
    this.filters.push((r) => values.includes(r[col]));
    return this;
  }
  is(col: string, value: unknown) {
    this.filters.push((r) => (r[col] ?? null) === value);
    return this;
  }
  not(col: string, _op: string, value: unknown) {
    this.filters.push((r) => (r[col] ?? null) !== value);
    return this;
  }
  lte(col: string, value: string) {
    this.filters.push((r) => String(r[col]) <= value);
    return this;
  }
  gte(col: string, value: string) {
    this.filters.push((r) => String(r[col]) >= value);
    return this;
  }
  lt(col: string, value: string) {
    this.filters.push((r) => String(r[col]) < value);
    return this;
  }
  or(expr: string) {
    // Only the "x.is.null,x.lt.<iso>" shape is used.
    const m = /^(\w+)\.is\.null,\1\.lt\.(.+)$/.exec(expr);
    if (m) this.filters.push((r) => r[m[1]] == null || String(r[m[1]]) < m[2]);
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderBy = { col, asc: opts?.ascending !== false };
    return this;
  }
  limit(n: number) {
    this.max = n;
    return this;
  }
  returns() {
    return this;
  }
  single() {
    this.wantSingle = "single";
    return this;
  }
  maybeSingle() {
    this.wantSingle = "maybe";
    return this;
  }

  private rows() {
    return (this.db.tables[this.table] ||= []);
  }

  private run(): { data: unknown; error: { code?: string; message: string } | null } {
    const table = this.rows();
    let out: Row[] = [];
    if (this.op === "insert") {
      const inserted: Row[] = [];
      for (const raw of this.payload as Row[]) {
        const row = { id: newId(), created_at: new Date().toISOString(), ...raw };
        if (this.uniqueOpen && this.uniqueOpen(table, row)) return { data: null, error: { code: "23505", message: "duplicate key" } };
        table.push(row);
        inserted.push(row);
      }
      this.db.inserts.push({ table: this.table, rows: inserted });
      out = inserted;
    } else if (this.op === "upsert") {
      const row = this.payload as Row;
      const existing = table.find((r) => r.id === row.id || (row.user_id !== undefined && r.user_id === row.user_id));
      if (existing) Object.assign(existing, row);
      else table.push({ ...row });
      out = [existing || row];
    } else {
      out = table.filter((r) => this.filters.every((f) => f(r)));
      if (this.op === "update") {
        for (const r of out) Object.assign(r, this.payload as Row);
        this.db.updates.push({ table: this.table, patch: this.payload as Row });
        if (!this.returning && !this.wantSingle) return { data: null, error: null };
      }
    }
    if (this.orderBy) {
      const { col, asc } = this.orderBy;
      out = [...out].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : String(a[col]) > String(b[col]) ? 1 : 0) * (asc ? 1 : -1));
    }
    if (this.max !== null) out = out.slice(0, this.max);
    out = out.map((r) => ({ ...r }));
    if (this.wantSingle) {
      if (out.length > 1) return { data: null, error: { message: "multiple rows" } };
      if (!out.length) return this.wantSingle === "single" ? { data: null, error: { message: "no rows" } } : { data: null, error: null };
      return { data: out[0], error: null };
    }
    return { data: out, error: null };
  }

  then<T1 = { data: unknown; error: { code?: string; message: string } | null }, T2 = never>(
    onfulfilled?: ((value: { data: unknown; error: { code?: string; message: string } | null }) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }
}

const OPEN = ["pending", "ready", "needs_marc", "skipped"];

export function fakeSupabase(seed: Record<string, Row[]> = {}): FakeDb {
  const db: FakeDb = {
    tables: JSON.parse(JSON.stringify(seed)),
    inserts: [],
    updates: [],
    rpcCalls: [],
    rpcHandlers: {},
    from(table: string) {
      // Mirrors the partial unique index reply_drafts_one_open_per_conversation.
      const unique =
        table === "reply_drafts"
          ? (rows: Row[], row: Row) =>
              OPEN.includes(String(row.status)) && rows.some((r) => r.conversation_key === row.conversation_key && OPEN.includes(String(r.status)))
          : undefined;
      return new Builder(db, table, unique);
    },
    async rpc(name: string, args: Row) {
      db.rpcCalls.push({ name, args });
      const handler = db.rpcHandlers[name];
      return { data: handler ? handler(args) : [], error: null };
    },
  };
  return db;
}
