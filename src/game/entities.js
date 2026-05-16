import { getTemplate } from './catalog'
import { createDefaultDeployment } from './battlefield'
import { getFormationMetrics } from './formation'

let entityCounter = 1

export function createUnitEntity(catalog, templateId, ownerId) {
  const template = getTemplate(catalog, templateId)
  const maxHealth = template.models * template.modelHealth

  const entity = {
    id: `unit-${entityCounter++}`,
    ownerId,
    templateId,
    name: template.name,
    kind: 'unit',
    components: {
      identity: { factionId: template.factionId, archetype: 'formation' },
      combat: {
        armorType: template.armorType,
        weaponType: template.weaponType,
        melee: template.melee,
        ranged: template.ranged,
        spell: 0,
        skill: template.skill,
        movement: template.movement,
        morale: template.morale,
        shootingRange: template.shootingRange,
        spellRange: template.spellRange,
        shootingTemplate: template.shootingTemplate,
        spellTemplate: template.spellTemplate,
        requiresLineOfSight: template.requiresLineOfSight,
        initiative: template.initiative,
        attacks: template.attacks,
      },
      formation: {
        models: template.models,
        frontage: template.frontage,
        maxFiles: catalog.formationRules.maxFiles,
        files: 0,
        ranks: 0,
        width: 0,
        depth: 0,
        modelClass: template.modelClass,
        modelWidth: template.modelBaseWidth,
        modelDepth: template.modelBaseDepth,
        lane: 'center',
        row: 'reserve',
        ...createDefaultDeployment('reserve', 'center'),
      },
      abilities: [...template.abilities],
      health: {
        modelHealth: template.modelHealth,
        max: maxHealth,
      },
      economy: { cost: template.cost },
    },
    state: {
      currentHealth: maxHealth,
      attachedHeroIds: [],
      isRouting: false,
    },
  }

  return syncEntityFormationFootprint(entity)
}

export function createHeroEntity(catalog, templateId, ownerId, free = false) {
  const template = getTemplate(catalog, templateId)

  const entity = {
    id: `hero-${entityCounter++}`,
    ownerId,
    templateId,
    name: template.name,
    kind: 'hero',
    components: {
      identity: { factionId: template.factionId, archetype: 'character' },
      combat: {
        armorType: template.armorType,
        weaponType: template.weaponType,
        melee: template.melee,
        ranged: template.ranged,
        spell: template.spell,
        skill: template.skill,
        movement: template.movement,
        morale: template.morale,
        shootingRange: template.shootingRange,
        spellRange: template.spellRange,
        shootingTemplate: template.shootingTemplate,
        spellTemplate: template.spellTemplate,
        requiresLineOfSight: template.requiresLineOfSight,
        initiative: template.initiative,
        attacks: template.attacks,
      },
      formation: {
        models: template.models,
        frontage: template.frontage,
        maxFiles: catalog.formationRules.maxFiles,
        files: 0,
        ranks: 0,
        width: 0,
        depth: 0,
        modelClass: template.modelClass,
        modelWidth: template.modelBaseWidth,
        modelDepth: template.modelBaseDepth,
        lane: 'center',
        row: 'reserve',
        ...createDefaultDeployment('reserve', 'center'),
      },
      abilities: [...template.abilities],
      health: {
        modelHealth: template.modelHealth,
        max: template.modelHealth,
      },
      progression: {
        level: 1,
        experience: 0,
        spentExperience: 0,
        pendingDraft: [],
        pickedUpgradeIds: [],
      },
      economy: { cost: free ? 0 : template.cost },
      hero: { mounted: template.mounted },
    },
    state: {
      currentHealth: template.modelHealth,
      attachedTo: null,
      attachedSlot: null,
      isRouting: false,
    },
  }

  return syncEntityFormationFootprint(entity)
}

export function cloneState(value) {
  return structuredClone(value)
}

export function healthToModels(entity) {
  return Math.max(0, Math.ceil(entity.state.currentHealth / entity.components.health.modelHealth))
}

export function syncEntityFormationFootprint(entity) {
  const modelsRemaining = healthToModels(entity)
  const metrics = getFormationMetrics({
    modelsRemaining,
    frontage: entity.components.formation.frontage,
    maxFiles: entity.components.formation.maxFiles,
    modelWidth: entity.components.formation.modelWidth,
    modelDepth: entity.components.formation.modelDepth,
  })

  entity.components.formation.files = metrics.files
  entity.components.formation.ranks = metrics.ranks
  entity.components.formation.width = metrics.footprintWidth
  entity.components.formation.depth = metrics.footprintDepth

  return entity
}

export function isDeployable(entity) {
  return entity.components.formation.row !== 'reserve' && entity.state.currentHealth > 0
}