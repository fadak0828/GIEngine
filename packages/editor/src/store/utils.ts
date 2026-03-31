// ── Utility: nanoid-lite ──────────────────────────────────────────
let _counter = 0;
export function genId(prefix = 'id'): string {
  _counter += 1;
  return `${prefix}_${Date.now()}_${_counter}`;
}
