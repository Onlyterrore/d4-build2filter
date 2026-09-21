// Документ билда из базы d4builds → BuildProfile.
// Все значения в документе обёрнуты в указатели типа Firestore
// ({"stringValue": "..."}), поэтому сначала снимаем обёртку.

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
    // Пустые места в списке — слоты, которые автор билда не заполнил.
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
