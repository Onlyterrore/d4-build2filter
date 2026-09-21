// Пробный фильтр: одно правило, все известные аффиксы, БЕЗ условия на тип вещи.
// Нужен, чтобы отделить "игра не принимает эти id" от "игра сверяет их с типом вещи".
import { readFileSync } from 'node:fs';
const ROOT = 'C:/Users/dased/OneDrive/Документы/Claude/Projects/Other/d4-build2filter';
const { encodeFilter } = await import(`file:///${ROOT}/src/encode.js`);
const { COND, VISIBILITY, DEFAULT_HIGHLIGHT_COLOR } = await import(`file:///${ROOT}/src/constants.js`);

const table = JSON.parse(readFileSync(`${ROOT}/data/affix-ids.json`, 'utf8'));
const ids = table.affixes.map(a => a.id);

const filter = {
  name: 'Probe',
  meta3: 3,
  meta4: 3,
  rules: [{
    name: 'Probe',
    visibility: VISIBILITY.RECOLOR,
    color: DEFAULT_HIGHLIGHT_COLOR,
    enabled: true,
    conditions: [
      { type: COND.HAS_OPTIONAL_AFFIXES, params: ids, value1: 1, value2: 0, value3: 0 },
    ],
  }],
};

if (process.argv[2] === '--ids') {
  console.log(JSON.stringify(ids));
} else {
  process.stdout.write(encodeFilter(filter));
}
