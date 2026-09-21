const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Ссылка на билд бывает двух видов:
//   .../builds/<uuid>/            — билд, созданный игроком: id прямо в адресе
//   .../builds/<короткое-имя>/    — витринный билд сайта: id только через карту
// Искать по имени в базе нельзя — правила доступа запрещают запросы, разрешено
// только чтение документа по идентификатору.
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
