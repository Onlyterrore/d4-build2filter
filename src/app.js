import { resolveBuildRef } from './resolve.js';
import { firestoreToProfile } from './profile.js';
import { makeLookup } from './ids.js';
import { buildFilter } from './rules.js';
import { encodeFilter } from './encode.js';
import { decodeFilter } from './decode.js';

const DB = 'https://firestore.googleapis.com/v1/projects/d4builds-a3254/databases/(default)/documents/builds/';
const DAY = 24 * 60 * 60 * 1000;

const json = path => fetch(path).then(r => r.json());

// Кешируем на сутки: не бьём по чужому серверу при каждом открытии.
async function fetchBuild(id) {
  const key = 'build:' + id;
  try {
    const hit = JSON.parse(localStorage.getItem(key) || 'null');
    if (hit && Date.now() - hit.at < DAY) return hit.doc;
  } catch { /* приватное окно — просто идём в сеть */ }

  let res;
  try {
    res = await fetch(DB + id);
  } catch {
    throw new Error('Не получилось достучаться до d4builds. Проверьте сеть и попробуйте ещё раз.');
  }
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
      'slug-not-in-map': `Витринный билд «${ref.slug}» ещё не в справочнике. Откройте билд на d4builds и скопируйте адрес с длинным идентификатором.`,
    };
    throw new Error(messages[ref.reason] ?? `Не удалось разобрать ссылку (${ref.reason}).`);
  }

  const profile = firestoreToProfile(await fetchBuild(ref.id), ref.id);
  const { filter, untranslated } = buildFilter(profile, {
    affixLookup: makeLookup(affixTable.affixes),
    typeLookup: makeLookup(typeTable.types),
    typeGroups: typeTable.groups,
    tier,
    threshold,
  });

  const code = encodeFilter(filter);

  // Самопроверка ДО показа: разбираем свой же код и собираем заново.
  // Сравниваем коды, а не объекты: JSON.stringify чувствителен к порядку
  // ключей, и на этом проверка ложно срабатывала, хотя кодек был исправен.
  if (encodeFilter(decodeFilter(code)) !== code) {
    throw new Error('Самопроверка не прошла: код собрался, но разобрался иначе. Код не показан намеренно.');
  }

  return { profile, filter, code, untranslated };
}
