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
