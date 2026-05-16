import { getFaction } from '../catalog'
import { createBattlePosition, createDefaultDeployment, getFrontCenter } from '../battlefield'
import { isDeployable } from '../entities'
import { getFormationMetrics } from '../formation'

export function createBattleState(playerA, playerB, catalog) {
  return {
    catalog,
    players: {
      left: playerA,
      right: playerB,
    },
    sides: {
      left: buildSide(playerA, 'left', 0),
      right: buildSide(playerB, 'right', 1),
    },
    rounds: [],
  }
}

export function hasLivingCombatants(side) {
  return side.combatants.some((entry) => entry.currentHealth > 0)
}

export function applyFactionPassives(side) {
  const events = []

  if (side.factionId === 'undead') {
    const wounded = side.combatants.find((entry) => entry.currentHealth > 0 && entry.currentHealth < entry.maxHealth)
    if (wounded) {
      wounded.currentHealth = Math.min(wounded.maxHealth, wounded.currentHealth + 1)
      syncCombatantFootprint(wounded)
      events.push(`${side.playerName}: ${wounded.name} восстанавливает 1 здоровье.`)
    }
  }

  return events
}

export function getSideHealth(side) {
  return side.combatants.reduce((sum, entry) => sum + entry.currentHealth, 0)
}

export function snapshotSide(player, side, catalog) {
  return {
    playerId: player.id,
    playerName: player.name,
    faction: getFaction(catalog, player.factionId),
    combatants: side.combatants.map((entry) => ({
      entityId: entry.entityId,
      name: entry.name,
      kind: entry.kind,
      lane: entry.lane,
      row: entry.row,
      currentHealth: entry.currentHealth,
      maxHealth: entry.maxHealth,
      modelsRemaining: entry.modelsRemaining,
      x: entry.x,
      y: entry.y,
      facing: entry.facing,
      frontage: entry.frontage,
      maxFiles: entry.maxFiles,
      files: entry.files,
      ranks: entry.ranks,
      baseWidth: entry.baseWidth,
      baseDepth: entry.baseDepth,
      modelClass: entry.modelClass,
      modelWidth: entry.modelWidth,
      modelDepth: entry.modelDepth,
      movement: entry.movement,
      shootingRange: entry.shootingRange,
      spellRange: entry.spellRange,
      shootingTemplate: entry.shootingTemplate,
      spellTemplate: entry.spellTemplate,
      requiresLineOfSight: entry.requiresLineOfSight,
    })),
  }
}

export function projectCombatantPosition(sideIndex, row, lane, fallbackFacing = sideIndex === 0 ? 0 : 180) {
  return createBattlePosition(
    {
      ...createDefaultDeployment(row, lane),
      facing: fallbackFacing,
    },
    sideIndex,
  )
}

export function snapshotBattlefieldState(sides) {
  return sides
    .flatMap((side) => side.combatants)
    .filter((entry) => entry.currentHealth > 0)
    .map((entry) => ({
      entityId: entry.entityId,
      sideKey: entry.sideKey,
      name: entry.name,
      x: entry.x,
      y: entry.y,
      facing: entry.facing,
      frontage: entry.frontage,
      maxFiles: entry.maxFiles,
      files: entry.files,
      ranks: entry.ranks,
      baseWidth: entry.baseWidth,
      baseDepth: entry.baseDepth,
      modelClass: entry.modelClass,
      modelWidth: entry.modelWidth,
      modelDepth: entry.modelDepth,
      currentHealth: entry.currentHealth,
      maxHealth: entry.maxHealth,
      modelsRemaining: entry.modelsRemaining,
      movement: entry.movement,
      shootingRange: entry.shootingRange,
      spellRange: entry.spellRange,
      shootingTemplate: entry.shootingTemplate,
      spellTemplate: entry.spellTemplate,
      requiresLineOfSight: entry.requiresLineOfSight,
    }))
}

export function syncBattleState(battle) {
  syncSide(battle.players.left, battle.sides.left)
  syncSide(battle.players.right, battle.sides.right)
}

function buildSide(player, sideKey, sideIndex) {
  const unitsById = new Map(player.roster.filter((entry) => entry.kind === 'unit').map((entry) => [entry.id, entry]))
  const heroesByHost = new Map()

  player.roster
    .filter((entry) => entry.kind === 'hero' && entry.state.currentHealth > 0 && entry.state.attachedTo)
    .forEach((hero) => {
      const list = heroesByHost.get(hero.state.attachedTo) ?? []
      list.push(hero)
      heroesByHost.set(hero.state.attachedTo, list)
    })

  const combatants = player.roster
    .filter((entry) => entry.state.currentHealth > 0)
    .filter((entry) => {
      if (entry.kind === 'hero' && entry.state.attachedTo && unitsById.has(entry.state.attachedTo)) {
        return false
      }

      return isDeployable(entry)
    })
    .map((entity) => {
      const attachedHeroes = entity.kind === 'unit' ? heroesByHost.get(entity.id) ?? [] : []
      return buildCombatant(entity, attachedHeroes, sideKey, sideIndex)
    })

  return {
    playerId: player.id,
    playerName: player.name,
    factionId: player.factionId,
    combatants,
  }
}

function buildCombatant(entity, attachedHeroes, sideKey, sideIndex) {
  const abilities = new Set(entity.components.abilities)
  const meleeContributors = [{ entityId: entity.id, kind: entity.kind, power: entity.components.combat.melee, experienceGain: 0 }]
  const rangedContributors = []
  let melee = entity.components.combat.melee
  let ranged = entity.components.combat.ranged
  let spell = entity.components.combat.spell
  let weaponType = entity.components.combat.weaponType

  if (ranged > 0 || spell > 0) {
    rangedContributors.push({ entityId: entity.id, kind: entity.kind, power: Math.max(ranged, spell), experienceGain: 0 })
  }

  attachedHeroes.forEach((hero) => {
    melee += hero.components.combat.melee
    ranged += hero.components.combat.ranged
    spell += hero.components.combat.spell
    meleeContributors.push({ entityId: hero.id, kind: hero.kind, power: hero.components.combat.melee, experienceGain: 0 })

    if (hero.components.combat.ranged > 0 || hero.components.combat.spell > 0) {
      rangedContributors.push({ entityId: hero.id, kind: hero.kind, power: Math.max(hero.components.combat.ranged, hero.components.combat.spell), experienceGain: 0 })
    }

    hero.components.abilities.forEach((ability) => abilities.add(ability))
    if (hero.components.combat.spell > spell) {
      weaponType = 'magic'
    }
  })

  if (abilities.has('bannerAura')) {
    melee += 1
  }

  if (abilities.has('steadfastAura')) {
    abilities.add('steadfast')
  }

  const projectedPosition = createBattlePosition(
    {
      x: entity.components.formation.x,
      y: entity.components.formation.y,
      facing: entity.components.formation.facing,
    },
    sideIndex,
  )

  return syncCombatantFootprint({
    entityId: entity.id,
    name: entity.name,
    kind: entity.kind,
    sideKey,
    sideIndex,
    lane: entity.components.formation.lane,
    row: entity.components.formation.row,
    x: projectedPosition.x,
    y: projectedPosition.y,
    facing: projectedPosition.facing,
    frontage: entity.components.formation.frontage,
    maxFiles: entity.components.formation.maxFiles,
    files: entity.components.formation.files,
    ranks: entity.components.formation.ranks,
    baseWidth: entity.components.formation.width,
    baseDepth: entity.components.formation.depth,
    modelClass: entity.components.formation.modelClass,
    modelWidth: entity.components.formation.modelWidth,
    modelDepth: entity.components.formation.modelDepth,
    movement: entity.components.combat.movement,
    shootingRange: entity.components.combat.shootingRange,
    spellRange: entity.components.combat.spellRange,
    shootingTemplate: entity.components.combat.shootingTemplate,
    spellTemplate: entity.components.combat.spellTemplate,
    requiresLineOfSight: entity.components.combat.requiresLineOfSight,
    armorType: entity.components.combat.armorType,
    weaponType,
    melee,
    ranged,
    spell,
    initiative: entity.components.combat.initiative,
    currentHealth: entity.state.currentHealth,
    maxHealth: entity.components.health.max,
    modelHealth: entity.components.health.modelHealth,
    abilities,
    contributors: {
      melee: meleeContributors,
      ranged: rangedContributors,
    },
  })
}

function syncSide(player, side) {
  side.combatants.forEach((combatant) => {
    const entity = player.roster.find((entry) => entry.id === combatant.entityId)
    if (entity) {
      entity.state.currentHealth = combatant.currentHealth
      entity.components.formation.files = combatant.files
      entity.components.formation.ranks = combatant.ranks
      entity.components.formation.row = combatant.row
      entity.components.formation.lane = combatant.lane
      entity.components.formation.width = combatant.baseWidth
      entity.components.formation.depth = combatant.baseDepth
    }
  })

  side.combatants.forEach((combatant) => {
    const contributors = [...combatant.contributors.melee, ...combatant.contributors.ranged]
    contributors
      .filter((entry) => entry.kind === 'hero' && entry.experienceGain)
      .forEach((entry) => {
        const hero = player.roster.find((candidate) => candidate.id === entry.entityId)
        if (hero) {
          hero.components.progression.experience += entry.experienceGain
        }
      })
  })

  player.roster.forEach((entity) => {
    if (entity.kind === 'unit') {
      entity.state.attachedHeroIds = entity.state.attachedHeroIds.filter((heroId) => {
        const hero = player.roster.find((candidate) => candidate.id === heroId)
        return hero && hero.state.currentHealth > 0
      })
    }
  })
}

export function syncCombatantFootprint(combatant) {
  const frontCenter = combatant.baseDepth > 0 ? getFrontCenter(combatant) : null
  const modelsRemaining = combatant.currentHealth > 0 ? Math.max(1, Math.ceil(combatant.currentHealth / combatant.modelHealth)) : 0
  const metrics = getFormationMetrics({
    modelsRemaining,
    frontage: combatant.frontage,
    maxFiles: combatant.maxFiles,
    modelWidth: combatant.modelWidth,
    modelDepth: combatant.modelDepth,
  })

  combatant.modelsRemaining = modelsRemaining
  combatant.files = metrics.files
  combatant.ranks = metrics.ranks
  combatant.baseWidth = metrics.footprintWidth
  combatant.baseDepth = metrics.footprintDepth

  if (frontCenter && combatant.baseDepth > 0) {
    const radians = combatant.facing * (Math.PI / 180)
    const halfDepth = combatant.baseDepth / 2
    combatant.x = frontCenter.x - Math.cos(radians) * halfDepth
    combatant.y = frontCenter.y - Math.sin(radians) * halfDepth
  }

  return combatant
}