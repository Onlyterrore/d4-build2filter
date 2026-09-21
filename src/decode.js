import { readVarint, readFixed32, b64ToBytes } from './wire.js';

export function parseFields(buf, start = 0, end = buf.length) {
  const out = [];
  let pos = start;
  while (pos < end) {
    let key;
    [key, pos] = readVarint(buf, pos);
    const field = Math.floor(key / 8);
    const wire = key % 8;
    if (wire === 0) {
      let value;
      [value, pos] = readVarint(buf, pos);
      out.push({ field, wire, value });
    } else if (wire === 2) {
      let len;
      [len, pos] = readVarint(buf, pos);
      out.push({ field, wire, bytes: buf.subarray(pos, pos + len) });
      pos += len;
    } else if (wire === 5) {
      let value;
      [value, pos] = readFixed32(buf, pos);
      out.push({ field, wire, value });
    } else {
      throw new Error(`неизвестный тип поля ${wire} на позиции ${pos}`);
    }
  }
  return out;
}

const text = bytes => new TextDecoder().decode(bytes);

function parseCondition(bytes) {
  // value3 (поле 6) несёт флаг для условий без числовых границ —
  // например "апгрейд кодекса" хранит здесь единицу. Замер 2026-09-21:
  // без него наш код отличался от экспорта игры на два байта.
  const cond = { type: null, params: [], value1: 0, value2: 0, value3: 0 };
  for (const f of parseFields(bytes)) {
    if (f.field === 1) cond.type = f.value;
    else if (f.field === 2 && f.wire === 5) cond.params.push(f.value);
    else if (f.field === 4) cond.value1 = f.value;
    else if (f.field === 5) cond.value2 = f.value;
    else if (f.field === 6) cond.value3 = f.value;
  }
  return cond;
}

function parseRule(bytes) {
  const rule = { name: '', visibility: 0, color: null, conditions: [], enabled: false };
  for (const f of parseFields(bytes)) {
    if (f.field === 1) rule.name = text(f.bytes);
    else if (f.field === 2) rule.visibility = f.value;
    else if (f.field === 3) rule.color = f.value;
    else if (f.field === 4) rule.conditions.push(parseCondition(f.bytes));
    else if (f.field === 5) rule.enabled = f.value === 1;
  }
  return rule;
}

export function decodeFilter(b64) {
  const buf = b64ToBytes(b64.trim());
  // Поля 3 и 4 — назначение неизвестно. В описании формата сказано "всегда 3",
  // но в живых кодах значения разные: Maxroll Light даёт 5 и 1, Medium даёт 3 и 3.
  // Поэтому мы их СОХРАНЯЕМ, а не выбрасываем: иначе при пересборке чужого фильтра
  // мы молча подменим их своими. UNVERIFIED: выяснить смысл на круге сверки.
  const filter = { name: '', rules: [], meta3: 3, meta4: 3 };
  for (const f of parseFields(buf)) {
    if (f.field === 1) filter.rules.push(parseRule(f.bytes));
    else if (f.field === 2) filter.name = text(f.bytes);
    else if (f.field === 3) filter.meta3 = f.value;
    else if (f.field === 4) filter.meta4 = f.value;
  }
  return filter;
}
