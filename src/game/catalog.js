function expectArray(value, fieldName) {
  if (!Array.isArray(value)) {
    throw new Error(`Catalog field ${fieldName} must be an array`)
  }

  return value
}

function expectString(value, fieldName) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Catalog field ${fieldName} must be a non-empty string`)
  }

  return value
}

function expectNumber(value, fieldName) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`Catalog field ${fieldName} must be a number`)
  }

  return value
}

function normalizeFormationRules(entry) {
  return {
    maxFiles: expectNumber(entry.maxFiles, 'formationRules.maxFiles'),
  }
}

function normalizeModelClass(entry) {
  return {
    id: expectString(entry.id, 'modelClasses[].id'),
    baseWidth: expectNumber(entry.baseWidth, 'modelClasses[].baseWidth'),
    baseDepth: expectNumber(entry.baseDepth, 'modelClasses[].baseDepth'),
  }
}

function normalizeFaction(entry) {
  return {
    id: expectString(entry.id, 'factions[].id'),
    name: expectString(entry.name, 'factions[].name'),
    vibe: expectString(entry.vibe, 'factions[].vibe'),
    passive: expectString(entry.passive, 'factions[].passive'),
    color: expectString(entry.color, 'factions[].color'),
    unitPool: expectArray(entry.unitPool, 'factions[].unitPool').map((value) => expectString(value, 'factions[].unitPool[]')),
    heroPool: expectArray(entry.heroPool, 'factions[].heroPool').map((value) => expectString(value, 'factions[].heroPool[]')),
  }
}

function normalizeTemplate(entry) {
  return {
    id: expectString(entry.id, 'templates[].id'),
    kind: expectString(entry.kind, 'templates[].kind'),
    factionId: expectString(entry.factionId, 'templates[].factionId'),
    name: expectString(entry.name, 'templates[].name'),
    cost: expectNumber(entry.cost, 'templates[].cost'),
    models: expectNumber(entry.models, 'templates[].models'),
    modelHealth: expectNumber(entry.modelHealth, 'templates[].modelHealth'),
    frontage: expectNumber(entry.frontage, 'templates[].frontage'),
    modelClass: expectString(entry.modelClass, 'templates[].modelClass'),
    modelBaseWidth: expectNumber(entry.modelBaseWidth, 'templates[].modelBaseWidth'),
    modelBaseDepth: expectNumber(entry.modelBaseDepth, 'templates[].modelBaseDepth'),
    armorType: expectString(entry.armorType, 'templates[].armorType'),
    weaponType: expectString(entry.weaponType, 'templates[].weaponType'),
    melee: expectNumber(entry.melee, 'templates[].melee'),
    ranged: expectNumber(entry.ranged, 'templates[].ranged'),
    spell: expectNumber(entry.spell, 'templates[].spell'),
    movement: expectNumber(entry.movement, 'templates[].movement'),
    morale: expectNumber(entry.morale, 'templates[].morale'),
    shootingRange: expectNumber(entry.shootingRange, 'templates[].shootingRange'),
    spellRange: expectNumber(entry.spellRange, 'templates[].spellRange'),
    shootingTemplate: expectString(entry.shootingTemplate, 'templates[].shootingTemplate'),
    spellTemplate: expectString(entry.spellTemplate, 'templates[].spellTemplate'),
    requiresLineOfSight: Boolean(entry.requiresLineOfSight),
    initiative: expectNumber(entry.initiative, 'templates[].initiative'),
    abilities: expectArray(entry.abilities, 'templates[].abilities').map((value) => expectString(value, 'templates[].abilities[]')),
    mounted: Boolean(entry.mounted),
  }
}

function normalizeAbility(entry) {
  return {
    id: expectString(entry.id, 'abilities[].id'),
    name: expectString(entry.name, 'abilities[].name'),
    category: expectString(entry.category, 'abilities[].category'),
    description: expectString(entry.description, 'abilities[].description'),
  }
}

function normalizeUpgrade(entry) {
  return {
    id: expectString(entry.id, 'hero_upgrades[].id'),
    name: expectString(entry.name, 'hero_upgrades[].name'),
    category: expectString(entry.category, 'hero_upgrades[].category'),
    summary: expectString(entry.summary, 'hero_upgrades[].summary'),
  }
}

export function createCatalog(payload) {
  const formationRules = normalizeFormationRules(payload?.formationRules ?? {})
  const modelClasses = expectArray(payload?.modelClasses, 'modelClasses').map(normalizeModelClass)
  const factions = expectArray(payload?.factions, 'factions').map(normalizeFaction)
  const units = expectArray(payload?.units, 'units').map((entry) => normalizeTemplate({ ...entry, kind: 'unit' }))
  const heroes = expectArray(payload?.heroes, 'heroes').map((entry) => normalizeTemplate({ ...entry, kind: 'hero' }))
  const templates = [...units, ...heroes]
  const abilities = expectArray(payload?.abilities, 'abilities').map(normalizeAbility)
  const heroUpgrades = expectArray(payload?.hero_upgrades, 'hero_upgrades').map(normalizeUpgrade)

  return {
    formationRules,
    modelClasses,
    modelClassesById: new Map(modelClasses.map((entry) => [entry.id, entry])),
    factions,
    factionsById: new Map(factions.map((entry) => [entry.id, entry])),
    abilities,
    abilitiesById: new Map(abilities.map((entry) => [entry.id, entry])),
    units,
    heroes,
    templates,
    templatesById: new Map(templates.map((entry) => [entry.id, entry])),
    heroUpgrades,
    heroUpgradesById: new Map(heroUpgrades.map((entry) => [entry.id, entry])),
  }
}

export function listAvailableFactions(catalog) {
  return catalog.factions
}

export function getFaction(catalog, factionId) {
  return catalog.factionsById.get(factionId) ?? null
}

export function getTemplate(catalog, templateId) {
  return catalog.templatesById.get(templateId) ?? null
}

export function listUnitTemplates(catalog, factionId) {
  const faction = getFaction(catalog, factionId)
  return faction ? faction.unitPool.map((templateId) => getTemplate(catalog, templateId)).filter(Boolean) : []
}

export function listHeroTemplates(catalog, factionId) {
  const faction = getFaction(catalog, factionId)
  return faction ? faction.heroPool.map((templateId) => getTemplate(catalog, templateId)).filter(Boolean) : []
}

export function getHeroUpgrade(catalog, upgradeId) {
  return catalog.heroUpgradesById.get(upgradeId) ?? null
}

export function getAbility(catalog, abilityId) {
  return catalog.abilitiesById.get(abilityId) ?? null
}