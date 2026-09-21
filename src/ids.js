// Поиск id по названию. Названия приходят из d4builds и пишутся там
// непоследовательно по регистру, поэтому сравниваем нормализованно.
const norm = s => String(s).trim().toLowerCase().replace(/\s+/g, ' ');

export function makeLookup(rows) {
  const index = new Map();
  for (const r of rows) {
    index.set(norm(r.name), { id: r.id, source: r.source, verified: r.verified });
  }
  return name => index.get(norm(name)) ?? null;
}
