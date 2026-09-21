# d4-build2filter — план работ, ядро

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Статическая страница на GitHub Pages, которая по ссылке на билд с d4builds.gg выдаёт готовый код лут-фильтра Diablo 4.

**Architecture:** Чистый ES-модульный JavaScript без сборки и зависимостей. Страница читает документ билда из открытой базы Firestore, превращает его в `BuildProfile`, собирает набор правил фильтра, кодирует в protobuf + base64 и перед выдачей разбирает собственный результат обратно для самопроверки. Те же модули запускаются в Node под тестами.

**Tech Stack:** Vanilla ES2022, `node --test` (встроенный, Node 24), git, gh CLI. Никаких npm-зависимостей.

**Спека:** `docs/specs/2026-09-21-d4-build2filter-design.md`

**Вне этого плана (уходит во второй план):** чеклист для Switch 2 — заблокирован до скриншота меню игры; автообновление карты витринных билдов задачей GitHub — в этом плане карта заполняется вручную.

---

## Структура файлов

| Файл | Ответственность |
|---|---|
| `src/wire.js` | низкий уровень protobuf: varint, теги, base64 ↔ байты |
| `src/decode.js` | код фильтра → объект `Filter` |
| `src/encode.js` | объект `Filter` → код фильтра |
| `src/constants.js` | битовые маски редкости и свойств, типы условий, видимость |
| `src/resolve.js` | ссылка → идентификатор билда |
| `src/profile.js` | документ Firestore → `BuildProfile` |
| `src/ids.js` | поиск id аффикса и типа вещи по названию |
| `src/rules.js` | `BuildProfile` → массив правил |
| `src/app.js` | связка для браузера: сеть, DOM, самопроверка |
| `data/affix-ids.json` | таблица id аффиксов |
| `data/type-ids.json` | таблица id типов вещей |
| `data/meta-builds.json` | карта коротких адресов |
| `index.html`, `selftest.html`, `verify.html` | три страницы |
| `test/*.test.js` | тесты, по файлу на модуль |

Правило: сеть живёт только в `app.js`. Все остальные модули — чистые функции, поэтому тестируются без заглушек.

---

## Task 1: Каркас репозитория

**Files:**
- Create: `package.json`, `.gitignore`, `README.md`

- [ ] **Step 1: Инициализировать git**

```bash
cd <папка проекта>
git init -b main
```

- [ ] **Step 2: Создать `package.json`**

Зависимостей нет. Файл нужен ровно для одного: чтобы Node считал `.js` модулями ES.

```json
{
  "name": "d4-build2filter",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "scripts": {
    "test": "node --test test/"
  }
}
```

- [ ] **Step 3: Создать `.gitignore`**

```
node_modules/
.DS_Store
*.log
```

- [ ] **Step 4: Создать `README.md`**

```markdown
# d4-build2filter

Вставь ссылку на билд с [d4builds.gg](https://d4builds.gg) — получи код лут-фильтра
для Diablo 4.

**Страница:** https://<логин>.github.io/d4-build2filter/

## Как это работает

Страница читает документ билда из открытой базы d4builds (тот же запрос, который делает
их собственный сайт), берёт оттуда желаемые свойства по слотам и собирает из них фильтр.
Всё происходит в браузере: сервера нет, данные никуда не отправляются.

## Чего инструмент не делает

- Не импортирует билд в игру. В Diablo 4 такой возможности нет вообще.
- Не фильтрует по закалке и аспектам — это не свойства падающей вещи.
- На консолях код вставить нельзя; чеклист для ручного ввода — в разработке.

## Правило безопасности

Прячем только по грубым признакам (редкость, сила предмета, тип вещи).
Красим по аффиксам. Ошибка в таблице id не может спрятать нужную вещь.

## Благодарности

Формат кода фильтра описан сообществом; числовые соответствия «имя аффикса → id»
сверены с экспортом из игры, происхождение каждого — в `AFFIX-IDS.md`.
Данные билдов принадлежат d4builds.gg и их авторам.
```

- [ ] **Step 5: Первый коммит**

```bash
git add -A
git commit -m "chore: scaffold repo

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: Эталоны

Без живых эталонов кодек проверять не на чем. Берём два: чужой рабочий код фильтра и настоящий документ билда.

**Files:**
- Create: `test/fixtures/maxroll-light.txt`, `test/fixtures/build-blazing-scream.json`

- [ ] **Step 1: Сохранить документ билда**

```bash
mkdir -p test/fixtures
curl -s "https://firestore.googleapis.com/v1/projects/d4builds-a3254/databases/(default)/documents/builds/87dc0249-02db-4eb0-b9fc-c2acfb012fa6" -o test/fixtures/build-blazing-scream.json
```

- [ ] **Step 2: Проверить, что скачалось то самое**

```bash
node -e "const d=require('fs').readFileSync('test/fixtures/build-blazing-scream.json','utf8');const j=JSON.parse(d);console.log(j.fields.class.stringValue, j.fields.season.integerValue, Object.keys(j.fields.newStats.mapValue.fields).length)"
```

Ожидается: `Warlock 15` и следом число слотов (ожидаем 10 — по числу мест под вещи).
Если класс и сезон совпали, а число слотов другое — это не ошибка скачивания, а форма данных;
учесть её в Task 8.

- [ ] **Step 3: Сохранить чужой рабочий код фильтра**

Открыть https://maxroll.gg/d4/resources/loot-filter, найти блок **Import Code for Maxroll Light**, скопировать строку целиком в `test/fixtures/maxroll-light.txt` одной строкой без переносов.

- [ ] **Step 4: Проверить эталон**

```bash
node -e "const s=require('fs').readFileSync('test/fixtures/maxroll-light.txt','utf8').trim();console.log('len',s.length,'head',s.slice(0,16),'b64ok',/^[A-Za-z0-9+/=]+$/.test(s))"
```

Ожидается: длина больше 1000, `head Ch4KB215dGhpY3M`, `b64ok true`.
Если `head` другой — скопирован код другого уровня; взять именно **Light**.

- [ ] **Step 5: Коммит**

```bash
git add test/fixtures
git commit -m "test: add live fixtures for codec and build reader

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: Низкий уровень protobuf

**Files:**
- Create: `src/wire.js`
- Test: `test/wire.test.js`

- [ ] **Step 1: Написать падающий тест**

`test/wire.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readVarint, writeVarint, bytesToB64, b64ToBytes } from '../src/wire.js';

test('varint туда и обратно', () => {
  for (const n of [0, 1, 127, 128, 300, 850, 2620563]) {
    const bytes = new Uint8Array(writeVarint(n));
    const [value, pos] = readVarint(bytes, 0);
    assert.equal(value, n);
    assert.equal(pos, bytes.length);
  }
});

test('base64 туда и обратно', () => {
  const src = new Uint8Array([0, 1, 250, 128, 64, 255]);
  assert.deepEqual(b64ToBytes(bytesToB64(src)), src);
});
```

- [ ] **Step 2: Запустить, убедиться что падает**

```bash
node --test test/wire.test.js
```

Ожидается: FAIL, `Cannot find module .../src/wire.js`

- [ ] **Step 3: Реализовать минимум**

`src/wire.js`:

```js
export function readVarint(buf, pos) {
  let result = 0, shift = 1, byte;
  do {
    byte = buf[pos++];
    result += (byte & 0x7f) * shift;
    shift *= 128;
  } while (byte & 0x80);
  return [result, pos];
}

export function writeVarint(n) {
  const out = [];
  while (n > 0x7f) {
    out.push((n & 0x7f) | 0x80);
    n = Math.floor(n / 128);
  }
  out.push(n);
  return out;
}

export function writeTag(field, wire) {
  return writeVarint(field * 8 + wire);
}

export function writeFixed32(value) {
  return [value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255];
}

export function readFixed32(buf, pos) {
  const v = (buf[pos] | (buf[pos + 1] << 8) | (buf[pos + 2] << 16) | (buf[pos + 3] << 24)) >>> 0;
  return [v, pos + 4];
}

export function b64ToBytes(s) {
  if (typeof atob === 'function') {
    const bin = atob(s);
    const a = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return a;
  }
  return new Uint8Array(Buffer.from(s, 'base64'));
}

export function bytesToB64(bytes) {
  if (typeof btoa === 'function') {
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
  }
  return Buffer.from(bytes).toString('base64');
}
```

- [ ] **Step 4: Запустить, убедиться что проходит**

```bash
node --test test/wire.test.js
```

Ожидается: PASS, 2 теста.

- [ ] **Step 5: Коммит**

```bash
git add src/wire.js test/wire.test.js
git commit -m "feat: protobuf wire primitives

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: Константы формата

Значения выведены разбором рабочего кода maxroll по байтам. Четыре независимых правила внутри него дали согласованную картину, но до круга сверки с игрой они помечены как выведенные.

**Files:**
- Create: `src/constants.js`

- [ ] **Step 1: Создать файл**

`src/constants.js`:

```js
// Значения выведены разбором рабочего кода "Maxroll Light" по байтам (2026-09-21).
// Согласованы между четырьмя правилами внутри него. Подтверждаются кругом сверки
// с экспортом из живой игры — до тех пор считать гипотезой.

export const VISIBILITY = {
  SHOW: 0,
  HIDE_TEXT_LABEL: 1,
  RECOLOR: 2,
  HIDE_ALL: 3,
};

export const COND = {
  ITEM_POWER_RANGE: 0,
  ITEM_RARITY_MATCH: 1,
  ITEM_PROPERTIES: 2,
  CODEX_UPGRADE_CHECK: 3,
  GREATER_AFFIX_CHECK: 4,
  ITEM_TYPE_MATCH: 5,
  HAS_REQUIRED_AFFIXES: 6,
  HAS_OPTIONAL_AFFIXES: 7,
  IS_SPECIFIC_UNIQUE: 8,
  TALISMAN_SET_BONUS: 9,
};

// Битовая маска редкости.
export const RARITY = {
  COMMON: 1,
  MAGIC: 2,
  RARE: 4,
  LEGENDARY: 8,
  UNIQUE: 16,
  MYTHIC: 32,
};

// Битовая маска свойств предмета.
export const PROPERTY = {
  ANCESTRAL: 4,
  MYTHIC: 32,
};

// Верхняя граница "недревнего". В тексте статьи maxroll стоит 851,
// в её же рабочем коде — 850. UNVERIFIED: подтвердить на круге сверки.
export const NON_ANCESTRAL_MAX_POWER = 850;

export const DEFAULT_HIGHLIGHT_COLOR = 0xffff8c1a; // ARGB, оранжевый
export const CODEX_COLOR = 0xff6ac46a;             // ARGB, зелёный
```

- [ ] **Step 2: Коммит**

```bash
git add src/constants.js
git commit -m "feat: filter format constants derived from a live code

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: Разборщик кода фильтра

Пишется раньше кодировщика: он нужен и для самопроверки, и для режима сверки id, и проверяется на чужом рабочем коде — то есть на настоящем ground truth.

**Files:**
- Create: `src/decode.js`
- Test: `test/decode.test.js`

- [ ] **Step 1: Написать падающий тест**

`test/decode.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeFilter } from '../src/decode.js';
import { VISIBILITY, COND, RARITY, PROPERTY } from '../src/constants.js';

const code = readFileSync(new URL('./fixtures/maxroll-light.txt', import.meta.url), 'utf8').trim();

test('разбирает чужой рабочий код', () => {
  const f = decodeFilter(code);
  assert.equal(f.name, 'Maxroll Light');
  assert.ok(f.rules.length >= 7, `правил ${f.rules.length}, ожидалось не меньше 7`);
});

test('первое правило — перекраска мификов', () => {
  const r = decodeFilter(code).rules[0];
  assert.equal(r.name, 'mythics');
  assert.equal(r.visibility, VISIBILITY.RECOLOR);
  assert.equal(r.enabled, true);
  const props = r.conditions.find(c => c.type === COND.ITEM_PROPERTIES);
  assert.equal(props.value1, PROPERTY.MYTHIC);
  const rarity = r.conditions.find(c => c.type === COND.ITEM_RARITY_MATCH);
  assert.equal(rarity.value1, RARITY.UNIQUE | RARITY.MYTHIC);
});

test('правило про белое и синее прячет и ограничивает силу предмета', () => {
  const r = decodeFilter(code).rules.find(x => x.name.includes('white/blue'));
  assert.equal(r.visibility, VISIBILITY.HIDE_ALL);
  const rarity = r.conditions.find(c => c.type === COND.ITEM_RARITY_MATCH);
  assert.equal(rarity.value1, RARITY.COMMON | RARITY.MAGIC);
  const power = r.conditions.find(c => c.type === COND.ITEM_POWER_RANGE);
  assert.equal(power.value2, 850);
});

test('хвостовые поля сохраняются, а не подменяются тройками', () => {
  const f = decodeFilter(code);
  assert.equal(f.meta3, 5);
  assert.equal(f.meta4, 1);
});
```

- [ ] **Step 2: Запустить, убедиться что падает**

```bash
node --test test/decode.test.js
```

Ожидается: FAIL, `Cannot find module .../src/decode.js`

- [ ] **Step 3: Реализовать**

`src/decode.js`:

```js
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
  const cond = { type: null, params: [], value1: 0, value2: 0 };
  for (const f of parseFields(bytes)) {
    if (f.field === 1) cond.type = f.value;
    else if (f.field === 2 && f.wire === 5) cond.params.push(f.value);
    else if (f.field === 4) cond.value1 = f.value;
    else if (f.field === 5) cond.value2 = f.value;
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
```

**Почему это важно.** Первая редакция плана выбрасывала поля 3 и 4 и всегда писала в них
тройки, опираясь на фразу «always 3» в описании формата. Разбор живого кода Maxroll Light
показал там `5` и `1`. Код бы собрался, тест круга бы прошёл — и при этом мы бы тихо
меняли чужому фильтру два поля, смысла которых не понимаем. Теперь они переживают круг,
а тест их защищает.

- [ ] **Step 4: Запустить**

```bash
node --test test/decode.test.js
```

Ожидается: PASS, 4 теста.

Если падает тест про имя `Maxroll Light` — значит поле 2 не имя; напечатать `parseFields(b64ToBytes(code)).map(f=>f.field)` и уточнить схему, **не подгоняя тест под результат**.

- [ ] **Step 5: Коммит**

```bash
git add src/decode.js test/decode.test.js
git commit -m "feat: decode filter import codes

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: Кодировщик

**Files:**
- Create: `src/encode.js`
- Test: `test/encode.test.js`

- [ ] **Step 1: Написать падающий тест**

Проверяем не побайтовое совпадение с чужим кодом — порядок полей и опущенные значения по умолчанию могут отличаться законно. Проверяем инвариант: **разбор нашего кода совпадает с разбором исходного**.

`test/encode.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeFilter } from '../src/decode.js';
import { encodeFilter } from '../src/encode.js';
import { VISIBILITY, COND, RARITY } from '../src/constants.js';

const code = readFileSync(new URL('./fixtures/maxroll-light.txt', import.meta.url), 'utf8').trim();

test('круг: разобрал чужой код, закодировал, разобрал снова — совпало', () => {
  const original = decodeFilter(code);
  const again = decodeFilter(encodeFilter(original));
  assert.deepEqual(again, original);
});

test('кодирует правило, собранное с нуля', () => {
  const filter = {
    name: 'Проверка',
    meta3: 3,
    meta4: 3,
    rules: [{
      name: 'кольца билда',
      visibility: VISIBILITY.RECOLOR,
      color: 0xffff8c1a,
      enabled: true,
      conditions: [
        { type: COND.ITEM_RARITY_MATCH, params: [], value1: RARITY.LEGENDARY, value2: 0 },
        { type: COND.HAS_REQUIRED_AFFIXES, params: [2620563, 1234567], value1: 2, value2: 0 },
      ],
    }],
  };
  assert.deepEqual(decodeFilter(encodeFilter(filter)), filter);
});
```

- [ ] **Step 2: Запустить, убедиться что падает**

```bash
node --test test/encode.test.js
```

Ожидается: FAIL, `Cannot find module .../src/encode.js`

- [ ] **Step 3: Реализовать**

`src/encode.js`:

```js
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
  return out;
}

function encodeRule(r) {
  const out = [...lenDelim(1, utf8(r.name))];
  if (r.visibility) out.push(...writeTag(2, 0), ...writeVarint(r.visibility));
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
```

- [ ] **Step 4: Запустить**

```bash
node --test test/encode.test.js
```

Ожидается: PASS, 2 теста.

Первый тест — самый ценный во всём проекте: он доказывает, что наш кодировщик и чужой рабочий код говорят на одном языке.

- [ ] **Step 5: Коммит**

```bash
git add src/encode.js test/encode.test.js
git commit -m "feat: encode filter import codes

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 7: Разбор ссылки

**Files:**
- Create: `src/resolve.js`, `data/meta-builds.json`
- Test: `test/resolve.test.js`

- [ ] **Step 1: Создать карту витринных билдов**

`data/meta-builds.json` — заполняется вручную в этом плане, автообновление во втором.

```json
{
  "blazing-scream-warlock-leveling": "87dc0249-02db-4eb0-b9fc-c2acfb012fa6"
}
```

- [ ] **Step 2: Написать падающий тест**

`test/resolve.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveBuildRef } from '../src/resolve.js';

const map = { 'blazing-scream-warlock-leveling': '87dc0249-02db-4eb0-b9fc-c2acfb012fa6' };

test('берёт идентификатор прямо из адреса', () => {
  const r = resolveBuildRef('https://d4builds.gg/builds/87dc0249-02db-4eb0-b9fc-c2acfb012fa6/', map);
  assert.deepEqual(r, { ok: true, id: '87dc0249-02db-4eb0-b9fc-c2acfb012fa6', via: 'url' });
});

test('находит короткий адрес в карте, хвост запроса не мешает', () => {
  const r = resolveBuildRef('https://d4builds.gg/builds/blazing-scream-warlock-leveling/?var=0', map);
  assert.deepEqual(r, { ok: true, id: '87dc0249-02db-4eb0-b9fc-c2acfb012fa6', via: 'map' });
});

test('неизвестный короткий адрес — понятная причина', () => {
  const r = resolveBuildRef('https://d4builds.gg/builds/something-new/', map);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'slug-not-in-map');
  assert.equal(r.slug, 'something-new');
});

test('чужой сайт отвергается', () => {
  assert.equal(resolveBuildRef('https://maxroll.gg/d4/build-guides/x', map).reason, 'not-d4builds');
});

test('мусор вместо ссылки отвергается', () => {
  assert.equal(resolveBuildRef('просто текст', map).reason, 'not-a-url');
});
```

- [ ] **Step 3: Запустить, убедиться что падает**

```bash
node --test test/resolve.test.js
```

Ожидается: FAIL, `Cannot find module .../src/resolve.js`

- [ ] **Step 4: Реализовать**

`src/resolve.js`:

```js
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function resolveBuildRef(input, metaMap) {
  let url;
  try {
    url = new URL(String(input).trim());
  } catch {
    return { ok: false, reason: 'not-a-url' };
  }
  if (!/(^|\.)d4builds\.gg$/i.test(url.hostname)) {
    return { ok: false, reason: 'not-d4builds' };
  }
  const parts = url.pathname.split('/').filter(Boolean);
  const i = parts.indexOf('builds');
  const key = i >= 0 ? parts[i + 1] : undefined;
  if (!key) return { ok: false, reason: 'no-build-in-url' };
  if (UUID.test(key)) return { ok: true, id: key, via: 'url' };
  const mapped = metaMap[key];
  if (mapped) return { ok: true, id: mapped, via: 'map' };
  return { ok: false, reason: 'slug-not-in-map', slug: key };
}
```

- [ ] **Step 5: Запустить**

```bash
node --test test/resolve.test.js
```

Ожидается: PASS, 5 тестов.

- [ ] **Step 6: Коммит**

```bash
git add src/resolve.js data/meta-builds.json test/resolve.test.js
git commit -m "feat: resolve d4builds URLs to build ids

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 8: Документ базы → BuildProfile

**Files:**
- Create: `src/profile.js`
- Test: `test/profile.test.js`

- [ ] **Step 1: Написать падающий тест**

`test/profile.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { firestoreToProfile } from '../src/profile.js';

const doc = JSON.parse(
  readFileSync(new URL('./fixtures/build-blazing-scream.json', import.meta.url), 'utf8')
);

test('снимает шапку билда', () => {
  const p = firestoreToProfile(doc, '87dc0249-02db-4eb0-b9fc-c2acfb012fa6');
  assert.equal(p.schema, 1);
  assert.equal(p.class, 'Warlock');
  assert.equal(p.season, 15);
  assert.equal(p.name, 'Blazing Scream Warlock Leveling (S15)');
  assert.equal(p.buildId, '87dc0249-02db-4eb0-b9fc-c2acfb012fa6');
});

test('кольцо приходит без пустых мест и с типом вещи', () => {
  const p = firestoreToProfile(doc, 'x');
  const ring = p.slots.find(s => s.slot === 'Ring 1');
  assert.equal(ring.itemType, 'ring');
  assert.deepEqual(ring.affixes, [
    'Willpower', 'Maximum Life', 'Critical Strike Chance', 'Critical Strike Damage Multiplier',
  ]);
  assert.equal(ring.aspect, 'Aspect of Peril');
});

test('слоты без свойств выброшены', () => {
  const p = firestoreToProfile(doc, 'x');
  assert.equal(p.slots.some(s => s.slot === 'Weapon'), false);
  assert.ok(p.slots.length >= 8);
});
```

- [ ] **Step 2: Запустить, убедиться что падает**

```bash
node --test test/profile.test.js
```

Ожидается: FAIL, `Cannot find module .../src/profile.js`

- [ ] **Step 3: Реализовать**

`src/profile.js`:

```js
export const SLOT_TYPES = {
  'Helm': 'helm',
  'Chest Armor': 'chest',
  'Gloves': 'gloves',
  'Pants': 'pants',
  'Boots': 'boots',
  'Weapon': 'weapon',
  'Offhand': 'offhand',
  'Amulet': 'amulet',
  'Ring 1': 'ring',
  'Ring 2': 'ring',
};

function unwrap(v) {
  if (v == null) return null;
  const kind = Object.keys(v)[0];
  const raw = v[kind];
  if (kind === 'mapValue') {
    return Object.fromEntries(Object.entries(raw.fields || {}).map(([k, x]) => [k, unwrap(x)]));
  }
  if (kind === 'arrayValue') return (raw.values || []).map(unwrap);
  if (kind === 'integerValue') return Number(raw);
  if (kind === 'nullValue') return null;
  return raw;
}

export function firestoreToProfile(doc, buildId) {
  const f = unwrap({ mapValue: { fields: doc.fields } });
  const stats = f.newStats || {};
  const gear = f.gear || {};
  const tempering = f.temperingStats || {};
  const greater = f.greaterAffixes || {};

  const slots = [];
  for (const [slot, type] of Object.entries(SLOT_TYPES)) {
    const affixes = (stats[slot] || []).filter(Boolean);
    if (affixes.length === 0) continue;
    slots.push({
      slot,
      itemType: type,
      affixes,
      greater: (greater[slot] || []).filter(Boolean),
      tempering: (tempering[slot] || []).filter(Boolean),
      aspect: gear[slot] || null,
    });
  }

  return {
    schema: 1,
    buildId,
    source: `https://d4builds.gg/builds/${buildId}/`,
    name: f.name || '',
    variant: f.variantName || '',
    class: f.class || '',
    season: f.season ?? null,
    slots,
  };
}
```

- [ ] **Step 4: Запустить**

```bash
node --test test/profile.test.js
```

Ожидается: PASS, 3 теста.

Если `greater` или `tempering` окажутся не массивами по слоту, а иной формой — напечатать
`JSON.stringify(unwrap({mapValue:{fields:doc.fields}}).greaterAffixes).slice(0,300)`
и поправить **реализацию**, а тест дополнить настоящей формой.

- [ ] **Step 5: Коммит**

```bash
git add src/profile.js test/profile.test.js
git commit -m "feat: turn a d4builds document into a BuildProfile

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 9: Таблицы id и поиск по названию

**Files:**
- Create: `data/affix-ids.json`, `data/type-ids.json`, `src/ids.js`, `AFFIX-IDS.md`
- Test: `test/ids.test.js`

- [ ] **Step 1: Завести таблицы с честными пометками**

`data/affix-ids.json` — на старте ни одной подтверждённой строки. Числа появятся после круга сверки; выдумывать их нельзя.

```json
{
  "schema": 1,
  "note": "id подтверждаются экспортом из игры; см. AFFIX-IDS.md",
  "affixes": []
}
```

`data/type-ids.json`:

```json
{
  "schema": 1,
  "note": "id типов вещей подтверждаются экспортом из игры; см. AFFIX-IDS.md",
  "types": []
}
```

`AFFIX-IDS.md`:

```markdown
# Происхождение id

Каждая строка таблиц `data/affix-ids.json` и `data/type-ids.json` имеет источник:

| Источник | Что означает | Доверие |
|---|---|---|
| `game-export` | собран в игре фильтр с одним признаком, экспортирован, id прочитан из кода | факт |
| `community-s13` | взято из открытого генератора сообщества (13 сезон), ссылка на автора обязательна | гипотеза |

Строки с источником `community-s13` показываются на странице жёлтым с подписью
«не подтверждено на 15 сезоне».

## Как добавить подтверждённый id

1. В игре: создать фильтр с одним-единственным условием на нужный признак, экспортировать.
2. Открыть `verify.html`, вставить код.
3. Скачать обновлённый файл таблицы, заменить им файл в репозитории.
4. В коммит добавить строку: какой признак, какой id, дата.

## Журнал

_(пусто — первый круг сверки ещё не проведён)_
```

- [ ] **Step 2: Написать падающий тест**

`test/ids.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeLookup } from '../src/ids.js';

const table = { affixes: [
  { name: 'Critical Strike Chance', id: 111, source: 'game-export', verified: '2026-09-21' },
  { name: 'Resistance to All Elements', id: 222, source: 'community-s13' },
] };

test('находит по точному названию', () => {
  assert.deepEqual(makeLookup(table.affixes)('Critical Strike Chance'),
    { id: 111, source: 'game-export', verified: '2026-09-21' });
});

test('регистр и лишние пробелы не мешают', () => {
  // d4builds пишет одно и то же свойство то с большой, то с маленькой буквы
  assert.equal(makeLookup(table.affixes)('  Resistance To All Elements ').id, 222);
});

test('неизвестное название даёт null, а не выдуманный id', () => {
  assert.equal(makeLookup(table.affixes)('Что-то Неизвестное'), null);
});
```

- [ ] **Step 3: Запустить, убедиться что падает**

```bash
node --test test/ids.test.js
```

Ожидается: FAIL, `Cannot find module .../src/ids.js`

- [ ] **Step 4: Реализовать**

`src/ids.js`:

```js
const norm = s => String(s).trim().toLowerCase().replace(/\s+/g, ' ');

export function makeLookup(rows) {
  const index = new Map();
  for (const r of rows) {
    index.set(norm(r.name), { id: r.id, source: r.source, verified: r.verified });
  }
  return name => index.get(norm(name)) ?? null;
}
```

- [ ] **Step 5: Запустить**

```bash
node --test test/ids.test.js
```

Ожидается: PASS, 3 теста.

- [ ] **Step 6: Коммит**

```bash
git add data/affix-ids.json data/type-ids.json src/ids.js AFFIX-IDS.md test/ids.test.js
git commit -m "feat: affix and item type id lookup with provenance

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 10: Сборка правил

Здесь живёт правило безопасности из спеки: прятки — только по грубым признакам, подсветка — по аффиксам, непереведённое — наружу списком.

**Files:**
- Create: `src/rules.js`
- Test: `test/rules.test.js`

- [ ] **Step 1: Написать падающий тест**

`test/rules.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFilter } from '../src/rules.js';
import { VISIBILITY, COND, RARITY } from '../src/constants.js';

const profile = {
  name: 'Проверочный билд',
  slots: [
    { slot: 'Ring 1', itemType: 'ring', affixes: ['Critical Strike Chance', 'Willpower'] },
    { slot: 'Ring 2', itemType: 'ring', affixes: ['Critical Strike Chance', 'Willpower'] },
    { slot: 'Helm', itemType: 'helm', affixes: ['Maximum Life', 'Неизвестное Свойство'] },
  ],
};

const affixLookup = name => ({
  'Critical Strike Chance': { id: 111, source: 'game-export' },
  'Willpower': { id: 222, source: 'community-s13' },
  'Maximum Life': { id: 333, source: 'game-export' },
}[name] ?? null);

const typeLookup = name => ({ ring: { id: 900, source: 'game-export' } }[name] ?? null);

test('непереведённое выходит наружу, а не пропадает', () => {
  const r = buildFilter(profile, { affixLookup, typeLookup, tier: 'light', threshold: 2 });
  assert.deepEqual(r.untranslated.affixes, ['Неизвестное Свойство']);
  assert.deepEqual(r.untranslated.types, ['helm']);
});

test('одинаковые кольца склеены в одно правило', () => {
  const r = buildFilter(profile, { affixLookup, typeLookup, tier: 'light', threshold: 2 });
  const ringRules = r.filter.rules.filter(x => x.name.includes('Ring'));
  assert.equal(ringRules.length, 1);
  assert.equal(ringRules[0].name, 'Проверочный билд · Ring 1, Ring 2');
});

test('у слота с неподтверждённым типом условие о типе выброшено', () => {
  const r = buildFilter(profile, { affixLookup, typeLookup, tier: 'light', threshold: 2 });
  const helm = r.filter.rules.find(x => x.name.includes('Helm'));
  assert.equal(helm.conditions.some(c => c.type === COND.ITEM_TYPE_MATCH), false);
  assert.equal(helm.conditions.find(c => c.type === COND.HAS_REQUIRED_AFFIXES).params.length, 1);
});

test('прятки отключены целиком, пока хоть один тип вещи не подтверждён', () => {
  const r = buildFilter(profile, { affixLookup, typeLookup, tier: 'light', threshold: 2 });
  assert.equal(r.filter.rules.some(x => x.visibility === VISIBILITY.HIDE_ALL), false);
});

test('когда типы подтверждены, прятки появляются и не содержат условий про аффиксы', () => {
  const allTypes = name => ({ ring: { id: 900 }, helm: { id: 901 } }[name] ?? null);
  const r = buildFilter(profile, { affixLookup, typeLookup: allTypes, tier: 'light', threshold: 2 });
  const hides = r.filter.rules.filter(x => x.visibility === VISIBILITY.HIDE_ALL);
  assert.ok(hides.length > 0, 'правила пряток должны существовать');
  for (const h of hides) {
    assert.equal(h.conditions.some(c =>
      c.type === COND.HAS_REQUIRED_AFFIXES || c.type === COND.HAS_OPTIONAL_AFFIXES), false);
  }
});

test('порог совпадения попадает в правило', () => {
  const r = buildFilter(profile, { affixLookup, typeLookup, tier: 'light', threshold: 2 });
  const ring = r.filter.rules.find(x => x.name.includes('Ring'));
  assert.equal(ring.conditions.find(c => c.type === COND.HAS_REQUIRED_AFFIXES).value1, 2);
});

test('база на месте: мифики, древние уникумы, кодекс', () => {
  const r = buildFilter(profile, { affixLookup, typeLookup, tier: 'light', threshold: 2 });
  assert.ok(r.filter.rules.some(x => x.conditions.some(c => c.type === COND.CODEX_UPGRADE_CHECK)));
  assert.ok(r.filter.rules.some(x => x.visibility === VISIBILITY.SHOW));
});
```

- [ ] **Step 2: Запустить, убедиться что падает**

```bash
node --test test/rules.test.js
```

Ожидается: FAIL, `Cannot find module .../src/rules.js`

- [ ] **Step 3: Реализовать**

`src/rules.js`:

```js
import {
  VISIBILITY, COND, RARITY, PROPERTY,
  NON_ANCESTRAL_MAX_POWER, DEFAULT_HIGHLIGHT_COLOR, CODEX_COLOR,
} from './constants.js';

const cond = (type, { params = [], value1 = 0, value2 = 0, value3 = 0 } = {}) =>
  ({ type, params, value1, value2, value3 });

function baseRules() {
  return [
    {
      name: 'Мифики', visibility: VISIBILITY.RECOLOR, color: DEFAULT_HIGHLIGHT_COLOR, enabled: true,
      conditions: [
        cond(COND.ITEM_PROPERTIES, { value1: PROPERTY.MYTHIC }),
        cond(COND.ITEM_RARITY_MATCH, { value1: RARITY.UNIQUE | RARITY.MYTHIC }),
      ],
    },
    {
      name: 'Древние уникумы и мифики', visibility: VISIBILITY.SHOW, color: null, enabled: true,
      conditions: [
        cond(COND.ITEM_PROPERTIES, { value1: PROPERTY.ANCESTRAL }),
        cond(COND.ITEM_RARITY_MATCH, { value1: RARITY.UNIQUE | RARITY.MYTHIC }),
      ],
    },
    {
      name: 'Апгрейд кодекса', visibility: VISIBILITY.RECOLOR, color: CODEX_COLOR, enabled: true,
      // Флаг кодекса живёт в value3 (поле 6), не в value1.
      // Выяснено при исполнении: с value1 наш код расходился с экспортом игры.
      conditions: [cond(COND.CODEX_UPGRADE_CHECK, { value3: 1 })],
    },
  ];
}

const HIDE_TIERS = {
  light: [[RARITY.COMMON | RARITY.MAGIC, 'обычное и магическое']],
  medium: [
    [RARITY.COMMON | RARITY.MAGIC | RARITY.RARE, 'обычное, магическое и редкое'],
    [RARITY.LEGENDARY, 'легендарное'],
  ],
  strict: [
    [RARITY.COMMON | RARITY.MAGIC | RARITY.RARE, 'обычное, магическое и редкое'],
    [RARITY.LEGENDARY, 'легендарное'],
    [RARITY.UNIQUE, 'уникальное'],
  ],
};

function hideRules(tier) {
  return (HIDE_TIERS[tier] || HIDE_TIERS.light).map(([mask, label]) => ({
    name: `Прятать недревнее: ${label}`,
    visibility: VISIBILITY.HIDE_ALL,
    color: null,
    enabled: true,
    conditions: [
      cond(COND.ITEM_RARITY_MATCH, { value1: mask }),
      cond(COND.ITEM_POWER_RANGE, { value2: NON_ANCESTRAL_MAX_POWER }),
    ],
  }));
}

export function buildFilter(profile, { affixLookup, typeLookup, tier = 'light', threshold = 2 }) {
  const untranslated = { affixes: [], types: [] };
  const groups = new Map();

  for (const slot of profile.slots) {
    const ids = [];
    for (const name of slot.affixes) {
      const hit = affixLookup(name);
      if (hit) ids.push(hit.id);
      else if (!untranslated.affixes.includes(name)) untranslated.affixes.push(name);
    }
    if (ids.length === 0) continue;

    const typeHit = typeLookup(slot.itemType);
    if (!typeHit && !untranslated.types.includes(slot.itemType)) untranslated.types.push(slot.itemType);

    const key = `${slot.itemType}|${ids.slice().sort((a, b) => a - b).join(',')}`;
    const group = groups.get(key) || { slots: [], ids, typeId: typeHit ? typeHit.id : null };
    group.slots.push(slot.slot);
    groups.set(key, group);
  }

  const highlight = [...groups.values()].map(g => {
    const conditions = [];
    if (g.typeId != null) conditions.push(cond(COND.ITEM_TYPE_MATCH, { params: [g.typeId] }));
    conditions.push(cond(COND.HAS_REQUIRED_AFFIXES, {
      params: g.ids,
      value1: Math.min(threshold, g.ids.length),
    }));
    return {
      name: `${profile.name} · ${g.slots.join(', ')}`,
      visibility: VISIBILITY.RECOLOR,
      color: DEFAULT_HIGHLIGHT_COLOR,
      enabled: true,
      conditions,
    };
  });

  // Прятки требуют подтверждённого типа: иначе заденут талисманы. Пока типов нет — не создаём.
  const hides = untranslated.types.length > 0 ? [] : hideRules(tier);

  return {
    filter: {
      name: profile.name.slice(0, 40),
      rules: [...baseRules(), ...highlight, ...hides],
      meta3: 3,
      meta4: 3,
    },
    untranslated,
  };
}
```

- [ ] **Step 4: Запустить**

```bash
node --test test/rules.test.js
```

Ожидается: PASS, 7 тестов.

Два теста про прятки проверяют обе стороны правила безопасности: пока тип не подтверждён —
пряток нет вовсе; когда подтверждён — прятки есть, и ни в одном из них нет условия про аффиксы.

- [ ] **Step 5: Коммит**

```bash
git add src/rules.js test/rules.test.js
git commit -m "feat: assemble filter rules from a build profile

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 11: Страница самопроверки

**Files:**
- Create: `selftest.html`

- [ ] **Step 1: Создать страницу**

`selftest.html` — прогоняет в браузере тот же инвариант, что и тесты Node, чтобы убедиться: в браузере кодек ведёт себя так же.

```html
<!doctype html>
<html lang="ru">
<meta charset="utf-8">
<title>d4-build2filter · самопроверка</title>
<body style="font:16px/1.5 system-ui;max-width:48rem;margin:2rem auto;padding:0 1rem">
<h1>Самопроверка</h1>
<pre id="out">запуск…</pre>
<script type="module">
import { decodeFilter } from './src/decode.js';
import { encodeFilter } from './src/encode.js';

const out = document.getElementById('out');
const log = [];
let failed = 0;

function check(name, fn) {
  try { fn(); log.push('OK   ' + name); }
  catch (e) { failed++; log.push('FAIL ' + name + '\n     ' + e.message); }
}

const code = (await fetch('./test/fixtures/maxroll-light.txt').then(r => r.text())).trim();

check('чужой код разбирается', () => {
  if (decodeFilter(code).rules.length < 7) throw new Error('слишком мало правил');
});

check('круг разбор → сборка → разбор совпадает', () => {
  const a = decodeFilter(code);
  const b = decodeFilter(encodeFilter(a));
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error('расхождение после круга');
});

out.textContent = log.join('\n') + '\n\n' + (failed ? `ПРОВАЛОВ: ${failed}` : 'всё зелёное');
out.style.color = failed ? '#b00' : '#060';
</script>
</body>
</html>
```

- [ ] **Step 2: Проверить в браузере**

Поднять локально и открыть `http://localhost:8080/selftest.html`:

```bash
python -m http.server 8080
```

Ожидается: две строки `OK` и «всё зелёное».

- [ ] **Step 3: Коммит**

```bash
git add selftest.html
git commit -m "test: browser-side selftest page

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 12: Главная страница

**Files:**
- Create: `index.html`, `src/app.js`

- [ ] **Step 1: Создать `src/app.js`**

Единственный модуль, который ходит в сеть. Самопроверка стоит **до** показа кода.

```js
import { resolveBuildRef } from './resolve.js';
import { firestoreToProfile } from './profile.js';
import { makeLookup } from './ids.js';
import { buildFilter } from './rules.js';
import { encodeFilter } from './encode.js';
import { decodeFilter } from './decode.js';

const DB = 'https://firestore.googleapis.com/v1/projects/d4builds-a3254/databases/(default)/documents/builds/';
const DAY = 24 * 60 * 60 * 1000;

const json = path => fetch(path).then(r => r.json());

async function fetchBuild(id) {
  const key = 'build:' + id;
  try {
    const hit = JSON.parse(localStorage.getItem(key) || 'null');
    if (hit && Date.now() - hit.at < DAY) return hit.doc;
  } catch { /* приватное окно — просто идём в сеть */ }

  const res = await fetch(DB + id);
  if (res.status === 403 || res.status === 404) throw new Error('Билд не найден или закрыт автором.');
  if (!res.ok) throw new Error('d4builds сейчас не отвечает, попробуйте позже.');
  const doc = await res.json();
  try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), doc })); } catch { /* ok */ }
  return doc;
}

export async function run(url, { tier, threshold }) {
  const [metaMap, affixTable, typeTable] = await Promise.all([
    json('./data/meta-builds.json'),
    json('./data/affix-ids.json'),
    json('./data/type-ids.json'),
  ]);

  const ref = resolveBuildRef(url, metaMap);
  if (!ref.ok) {
    const messages = {
      'not-a-url': 'Это не похоже на ссылку. Пример: https://d4builds.gg/builds/…',
      'not-d4builds': 'Нужна ссылка именно с d4builds.gg.',
      'no-build-in-url': 'В ссылке нет билда.',
      'slug-not-in-map': `Витринный билд «${ref.slug}» ещё не в справочнике. Откройте билд и скопируйте адрес с длинным идентификатором.`,
    };
    throw new Error(messages[ref.reason] ?? `Не удалось разобрать ссылку (${ref.reason}).`);
  }

  const profile = firestoreToProfile(await fetchBuild(ref.id), ref.id);
  const { filter, untranslated } = buildFilter(profile, {
    affixLookup: makeLookup(affixTable.affixes),
    typeLookup: makeLookup(typeTable.types),
    tier, threshold,
  });

  if (filter.rules.length === 0) throw new Error('Из этого билда не вышло ни одного правила.');

  const code = encodeFilter(filter);
  const roundTrip = decodeFilter(code);
  if (JSON.stringify(roundTrip) !== JSON.stringify(filter)) {
    throw new Error('Самопроверка не прошла: код собрался, но разобрался иначе. Код не показан намеренно.');
  }

  return { profile, filter, code, untranslated };
}
```

- [ ] **Step 2: Создать `index.html`**

```html
<!doctype html>
<html lang="ru">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>d4-build2filter</title>
<style>
  :root { color-scheme: light dark; }
  body { font:16px/1.6 system-ui; max-width:46rem; margin:2rem auto; padding:0 1rem; }
  input,select,button { font:inherit; padding:.5rem; }
  #url { width:100%; box-sizing:border-box; }
  #code { width:100%; height:8rem; font-family:ui-monospace,monospace; font-size:12px; }
  .warn { background:#fff4d6; border-left:4px solid #e0a800; padding:.75rem; margin:1rem 0; }
  .err  { background:#ffe9e9; border-left:4px solid #c00; padding:.75rem; margin:1rem 0; }
  footer { margin-top:3rem; font-size:.9rem; opacity:.75 }
</style>
<body>
<h1>Билд с d4builds → лут-фильтр</h1>

<p><label for="url">Ссылка на билд</label>
<input id="url" placeholder="https://d4builds.gg/builds/…"></p>

<p>
  Прятать:
  <select id="tier">
    <option value="light" selected>мягко</option>
    <option value="medium">средне</option>
    <option value="strict">строго</option>
  </select>
  Порог совпадения:
  <select id="threshold"><option>1</option><option selected>2</option><option>3</option><option>4</option></select>
  <button id="go">Собрать фильтр</button>
</p>

<div id="msg"></div>
<div id="result" hidden>
  <h2 id="buildName"></h2>
  <p><button id="copy">Скопировать код</button></p>
  <textarea id="code" readonly></textarea>
  <div id="notes"></div>
</div>

<footer>
  Данные билда берутся с <a href="https://d4builds.gg">d4builds.gg</a> и принадлежат их авторам.
  <a href="./selftest.html">Самопроверка</a> · <a href="./verify.html">Сверка id</a>
</footer>

<script type="module">
import { run } from './src/app.js';

const $ = id => document.getElementById(id);

$('go').onclick = async () => {
  $('msg').innerHTML = 'собираю…';
  $('result').hidden = true;
  try {
    const r = await run($('url').value, {
      tier: $('tier').value,
      threshold: Number($('threshold').value),
    });
    $('msg').innerHTML = '';
    $('buildName').textContent = r.profile.name + ' — ' + r.filter.rules.length + ' правил';
    $('code').value = r.code;
    const notes = [];
    if (r.untranslated.affixes.length) {
      notes.push(`<div class="warn"><b>Не перенесено в фильтр:</b><br>${r.untranslated.affixes.join('<br>')}</div>`);
    }
    if (r.untranslated.types.length) {
      notes.push(`<div class="warn"><b>Типы вещей не подтверждены</b>, поэтому прятки отключены,
        а подсветка работает по всем вещам: ${r.untranslated.types.join(', ')}.
        Подтвердить можно на странице сверки.</div>`);
    }
    const temper = r.profile.slots.flatMap(s => s.tempering);
    if (temper.length) {
      notes.push(`<div class="warn"><b>Закалка в фильтр не переносится</b> — это не свойство падающей вещи,
        её наносят у Кузнеца: ${[...new Set(temper)].join('; ')}</div>`);
    }
    $('notes').innerHTML = notes.join('');
    $('result').hidden = false;
  } catch (e) {
    $('msg').innerHTML = `<div class="err">${e.message}</div>`;
  }
};

$('copy').onclick = () => { $('code').select(); document.execCommand('copy'); };
</script>
</body>
</html>
```

- [ ] **Step 3: Проверить вживую**

```bash
python -m http.server 8080
```

Открыть `http://localhost:8080/`, вставить `https://d4builds.gg/builds/blazing-scream-warlock-leveling/?var=0`, нажать «Собрать фильтр».

Ожидается на этом шаге: билд читается, название показано, **жёлтые предупреждения про непереведённые свойства** — потому что таблицы id пока пусты. Это правильное поведение до круга сверки, а не поломка.

- [ ] **Step 4: Коммит**

```bash
git add index.html src/app.js
git commit -m "feat: main page — URL in, filter code out

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 13: Страница сверки id

**Files:**
- Create: `verify.html`

- [ ] **Step 1: Создать страницу**

```html
<!doctype html>
<html lang="ru">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>d4-build2filter · сверка id</title>
<style>
  body { font:16px/1.6 system-ui; max-width:46rem; margin:2rem auto; padding:0 1rem; }
  textarea { width:100%; height:6rem; font-family:ui-monospace,monospace; font-size:12px; }
  table { border-collapse:collapse; width:100% } td,th { border:1px solid #8884; padding:.35rem .5rem; text-align:left }
</style>
<body>
<h1>Сверка id по экспорту из игры</h1>
<ol>
  <li>В игре создайте фильтр с одним-единственным условием на нужный признак.</li>
  <li>Экспортируйте его и вставьте код сюда.</li>
  <li>Впишите название признака ровно так, как оно пишется на d4builds.</li>
</ol>
<p><input id="name" placeholder="Critical Strike Chance" size="40"></p>
<p><textarea id="code" placeholder="код из игры"></textarea></p>
<p><button id="go">Разобрать</button></p>
<div id="out"></div>
<script type="module">
import { decodeFilter } from './src/decode.js';
import { COND } from './src/constants.js';

document.getElementById('go').onclick = () => {
  const out = document.getElementById('out');
  try {
    const f = decodeFilter(document.getElementById('code').value);
    const found = [];
    for (const r of f.rules) {
      for (const c of r.conditions) {
        const condName = Object.keys(COND).find(k => COND[k] === c.type);
        for (const id of c.params) found.push({ rule: r.name, cond: condName, id });
      }
    }
    const rows = found
      .map(x => `<tr><td>${x.rule}</td><td>${x.cond}</td><td>${x.id}</td></tr>`)
      .join('');
    const name = document.getElementById('name').value.trim();
    const today = new Date().toISOString().slice(0, 10);
    const line = found.length === 1 && name
      ? `<p>Готовая строка для таблицы:</p><pre>{ "name": ${JSON.stringify(name)}, "id": ${found[0].id}, "source": "game-export", "verified": "${today}" }</pre>`
      : `<p>Найдено чисел: ${found.length}. Для сверки оставьте в фильтре ровно одно условие с одним признаком и впишите его название выше.</p>`;
    out.innerHTML = `<table><tr><th>правило</th><th>условие</th><th>id</th></tr>${rows}</table>${line}`;
  } catch (e) {
    out.innerHTML = `<p style="color:#c00">Не удалось разобрать код: ${e.message}</p>`;
  }
};
</script>
</body>
</html>
```

- [ ] **Step 2: Проверить на чужом коде**

Открыть `http://localhost:8080/verify.html`, вставить содержимое `test/fixtures/maxroll-light.txt`.

Ожидается: таблица с десятками строк и сообщение «Найдено чисел: N» с N заметно больше единицы — в этом фильтре много условий, и это правильный ответ, а не ошибка.

- [ ] **Step 3: Коммит**

```bash
git add verify.html
git commit -m "feat: id verification page driven by in-game exports

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 14: Публикация

**Files:**
- Modify: `README.md` (подставить настоящий адрес страницы)

- [ ] **Step 1: Прогнать все тесты**

```bash
npm test
```

Ожидается: все файлы `test/*.test.js` зелёные, ноль провалов.

- [ ] **Step 2: Создать репозиторий и запушить**

```bash
gh repo create d4-build2filter --public --source=. --remote=origin --push
```

- [ ] **Step 3: Включить публикацию страницы**

```bash
gh api -X POST repos/:owner/d4-build2filter/pages -f "source[branch]=main" -f "source[path]=/"
```

Если ответ `409 Conflict` — публикация уже включена, перейти к следующему шагу.

- [ ] **Step 4: Проверить живой адрес**

```bash
gh api repos/:owner/d4-build2filter/pages --jq .html_url
```

Открыть полученный адрес, дождаться первой сборки (до минуты), вставить ссылку на билд.

Ожидается: страница открывается, билд читается, показаны жёлтые предупреждения про пустые таблицы id.

- [ ] **Step 5: Подставить адрес в README и закоммитить**

```bash
git add README.md
git commit -m "docs: add live page URL

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push
```

---

## Task 15: Круг сверки на живой игре

Единственная задача, которую нельзя выполнить без владельца и без ПК с игрой. До неё инструмент честно показывает жёлтые предупреждения; после неё начинает выдавать настоящие фильтры.

- [ ] **Step 1: Собрать в игре фильтр с одним условием на тип вещи «кольцо», экспортировать**
- [ ] **Step 2: Прогнать код через `verify.html`, получить строку для `data/type-ids.json`**
- [ ] **Step 3: Повторить для типов, встречающихся в билде: helm, chest, gloves, pants, boots, amulet, ring, offhand, weapon**
- [ ] **Step 4: Повторить для аффиксов билда: Willpower, Maximum Life, Critical Strike Chance, Critical Strike Damage Multiplier, Attack Speed, Maximum Resource, Wrath Regeneration, Resistance to All Elements, All Damage Multiplier, Movement Speed, Cooldown Reduction**
- [ ] **Step 5: Записать все строки в таблицы и в журнал `AFFIX-IDS.md` с датой**
- [ ] **Step 6: Собрать фильтр на странице, вставить в игру, экспортировать обратно, прогнать через `verify.html`**

**Критерий успеха всего проекта:** экспорт из игры совпадает с тем, что страница собиралась закодировать. Ноль расхождений.

- [ ] **Step 7: Коммит**

```bash
git add data/ AFFIX-IDS.md
git commit -m "data: verified affix and type ids from live game exports

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push
```
