import { writeVarint, writeTag, writeFixed32, bytesToB64 } from './wire.js';

const utf8 = s => [...new TextEncoder().encode(s)];

function lenDelim(field, bytes) {
  return [...writeTag(field, 2), ...writeVarint(bytes.length), ...bytes];
}

function encodeCondition(c) {
  const out = [...writeTag(1, 0), ...writeVarint(c.type)];
  for (const p of c.params || []) out.push(...writeTag(2, 5), ...writeFixed32(p));
  if (c.value1) out.push(...writeTag(4, 0), ...writeVarint(c.value1));
  if (c.value2) out.push(...writeTag(5, 0), ...writeVarint(c.value2));
  if (c.value3) out.push(...writeTag(6, 0), ...writeVarint(c.value3));
  return out;
}

function encodeRule(r) {
  const out = [...lenDelim(1, utf8(r.name))];
  // Видимость пишем всегда, даже нулевую (SHOW): замер 2026-09-21 показал,
  // что экспорт из игры делает именно так. Повторяем за источником.
  out.push(...writeTag(2, 0), ...writeVarint(r.visibility));
  if (r.color != null) out.push(...writeTag(3, 5), ...writeFixed32(r.color));
  for (const c of r.conditions) out.push(...lenDelim(4, encodeCondition(c)));
  out.push(...writeTag(5, 0), ...writeVarint(r.enabled ? 1 : 0));
  return out;
}

export function encodeFilter(filter) {
  const out = [];
  for (const r of filter.rules) out.push(...lenDelim(1, encodeRule(r)));
  out.push(...lenDelim(2, utf8(filter.name)));
  // Значения полей 3 и 4 переносим как есть; для собранных с нуля фильтров
  // берём 3 и 3 — такая пара встречается в живых кодах. UNVERIFIED.
  out.push(...writeTag(3, 0), ...writeVarint(filter.meta3 ?? 3));
  out.push(...writeTag(4, 0), ...writeVarint(filter.meta4 ?? 3));
  return bytesToB64(new Uint8Array(out));
}
