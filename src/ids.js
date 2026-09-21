// Поиск id по названию. Названия приходят из d4builds и пишутся там
// непоследовательно по регистру, поэтому сравниваем нормализованно.
const norm = s => String(s).trim().toLowerCase().replace(/\s+/g, ' ');

export function makeLookup(rows) {
  const index = new Map();
  for (const r of rows) {
    const value = { id: r.id, source: r.source, verified: r.verified };
    index.set(norm(r.name), value);
    // Синонимы: d4builds пишет часть названий иначе, чем игра, вплоть до
    // опечаток ("All Damage Multipler" без i). Держим их списком, а не
    // правим имя — имя должно совпадать с тем, что в игре.
    for (const alias of r.aliases || []) index.set(norm(alias), value);
  }
  return name => index.get(norm(name)) ?? null;
}
