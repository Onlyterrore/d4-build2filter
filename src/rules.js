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
      name: 'Древние', visibility: VISIBILITY.SHOW, color: null, enabled: true,
      conditions: [
        cond(COND.ITEM_PROPERTIES, { value1: PROPERTY.ANCESTRAL }),
        cond(COND.ITEM_RARITY_MATCH, { value1: RARITY.UNIQUE | RARITY.MYTHIC }),
      ],
    },
    {
      name: 'Кодекс', visibility: VISIBILITY.RECOLOR, color: CODEX_COLOR, enabled: true,
      // Флаг кодекса живёт в value3 (поле 6), не в value1 — замер по эталону.
      conditions: [cond(COND.CODEX_UPGRADE_CHECK, { value3: 1 })],
    },
  ];
}

// Что прячем на каждом уровне. Только редкость — никаких аффиксов.
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

function hideRules(tier, groups) {
  const rules = (HIDE_TIERS[tier] || HIDE_TIERS.light).map(([mask, label]) => ({
    name: `Мусор: ${label}`,
    visibility: VISIBILITY.HIDE_ALL,
    color: null,
    enabled: true,
    conditions: [
      cond(COND.ITEM_TYPE_MATCH, { params: groups.allExceptTalismans.ids }),
      cond(COND.ITEM_RARITY_MATCH, { value1: mask }),
      cond(COND.ITEM_POWER_RANGE, { value2: NON_ANCESTRAL_MAX_POWER }),
    ],
  }));

  // Талисманы отдельным правилом: у них нет "древности", поэтому
  // ограничение по силе предмета здесь не ставится.
  rules.push({
    name: 'Талисманы',
    visibility: VISIBILITY.HIDE_ALL,
    color: null,
    enabled: true,
    conditions: [
      cond(COND.ITEM_TYPE_MATCH, { params: groups.talismans.ids }),
      cond(COND.ITEM_RARITY_MATCH, { value1: RARITY.COMMON | RARITY.MAGIC | RARITY.RARE }),
    ],
  });

  return rules;
}

export function buildFilter(profile, { affixLookup, typeLookup, typeGroups, tier = 'light', threshold = 2 }) {
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
    // Тип не подтверждён — условие выбрасываем. Подсветится лишнее,
    // но ничего нужного не потеряется.
    if (g.typeId != null) conditions.push(cond(COND.ITEM_TYPE_MATCH, { params: [g.typeId] }));
    // Игра при отметке аффиксов выдаёт именно HAS_OPTIONAL_AFFIXES со счётчиком
    // в value1. Счётчик означает "не меньше N" — так написано в самом редакторе
    // правил: "Must have at least [N] of the selected affixes". Замер 2026-09-21.
    //
    // Осторожно с высоким порогом: при импорте игра молча выбрасывает часть
    // аффиксов (см. FINDINGS.md), а порог оставляет прежним — правило от этого
    // становится СТРОЖЕ задуманного. Поэтому по умолчанию порог 1.
    conditions.push(cond(COND.HAS_OPTIONAL_AFFIXES, {
      params: g.ids,
      value1: Math.min(threshold, g.ids.length),
    }));
    return {
      // Короткое имя, без названия билда. Замер импорта в игру 2026-09-21:
      // длинные имена правил игра при импорте выбрасывает, короткие сохраняет.
      name: g.slots.join(', '),
      visibility: VISIBILITY.RECOLOR,
      color: DEFAULT_HIGHLIGHT_COLOR,
      enabled: true,
      conditions,
    };
  });

  return {
    filter: {
      name: profile.name.slice(0, 40),
      rules: [...baseRules(), ...highlight, ...hideRules(tier, typeGroups)],
      meta3: 3,
      meta4: 3,
    },
    untranslated,
  };
}
