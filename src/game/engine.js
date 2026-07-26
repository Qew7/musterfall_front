import { getTemplate, listHeroTemplates, listUnitTemplates } from './catalog'
import { clampDeploymentPosition, createDefaultDeployment, rotateFacing, syncFormationSlotsFromDeployment } from './battlefield'
import { laneOrder, rowOrder } from './constants'
import { cloneState, createHeroEntity, createUnitEntity } from './entities'
import { applyHeroUpgrade } from './upgrades'

const battleRows = rowOrder.filter((row) => row !== 'reserve')
const startingTreasury = 36

export function createCampaign(playerCount) {
  return {
    round: 1,
    winnerId: null,
    lastRoundReport: null,
    players: Array.from({ length: playerCount }, (_, index) => ({
      id: `player-${index + 1}`,
      name: index === 0 ? 'Полководец 1' : `Бот ${index}`,
      isBot: index > 0,
      status: 'active',
      factionId: null,
      treasury: startingTreasury,
      roster: [],
      victories: 0,
      roundNotes: [],
    })),
  }
}

export function assignFaction(campaign, catalog, playerId, factionId) {
  const next = cloneState(campaign)
  const player = next.players.find((entry) => entry.id === playerId)

  if (!player) {
    return campaign
  }

  if (player.factionId === factionId) {
    return next
  }

  applyFactionAssignment(player, catalog, factionId)

  return next
}

export function recruitEntity(campaign, catalog, playerId, templateId) {
  const next = cloneState(campaign)
  const player = next.players.find((entry) => entry.id === playerId)
  const template = getTemplate(catalog, templateId)

  if (!player || !template || player.status !== 'active') {
    return campaign
  }

  if (player.treasury < template.cost) {
    return campaign
  }

  const entity = template.kind === 'hero'
    ? createHeroEntity(catalog, templateId, playerId)
    : createUnitEntity(catalog, templateId, playerId)

  player.treasury -= template.cost
  player.roster.push(entity)

  return next
}

export function dismissEntity(campaign, playerId, entityId) {
  const next = cloneState(campaign)
  const player = next.players.find((entry) => entry.id === playerId)
  const entity = player?.roster.find((entry) => entry.id === entityId)

  if (!player || !entity) {
    return campaign
  }

  if (entity.kind === 'hero' && entity.components.economy.cost === 0) {
    return campaign
  }

  player.treasury += Math.max(1, Math.floor(entity.components.economy.cost / 2))
  player.roster = player.roster.filter((entry) => entry.id !== entityId)
  player.roster.forEach((entry) => {
    if (entry.kind === 'unit') {
      entry.state.attachedHeroIds = entry.state.attachedHeroIds.filter((id) => id !== entityId)
    }
    if (entry.kind === 'hero' && entry.state.attachedTo === entityId) {
      entry.state.attachedTo = null
      entry.state.attachedSlot = null
    }
  })

  return next
}

export function attachHero(campaign, playerId, heroId, unitId) {
  const next = cloneState(campaign)
  const player = next.players.find((entry) => entry.id === playerId)
  const hero = player?.roster.find((entry) => entry.id === heroId)
  const unit = player?.roster.find((entry) => entry.id === unitId)

  if (!player || !hero || !unit || hero.kind !== 'hero' || unit.kind !== 'unit') {
    return campaign
  }

  if (hero.components.hero.mounted) {
    return campaign
  }

  if (hero.state.attachedTo === unitId) {
    hero.state.attachedTo = null
    hero.state.attachedSlot = null
    unit.state.attachedHeroIds = unit.state.attachedHeroIds.filter((entry) => entry !== heroId)
    return next
  }

  player.roster.forEach((entry) => {
    if (entry.kind === 'unit') {
      entry.state.attachedHeroIds = entry.state.attachedHeroIds.filter((entryId) => entryId !== heroId)
    }
  })

  hero.state.attachedTo = unitId
  hero.state.attachedSlot = pickAttachedHeroSlot(player, unitId, heroId)
  syncAttachedHeroFormation(hero, unit)
  unit.state.attachedHeroIds = [...new Set([...unit.state.attachedHeroIds, heroId])]

  return next
}

export function setEntityBattlefieldTransform(campaign, playerId, entityId, placement) {
  const next = cloneState(campaign)
  const entity = findEntity(next, playerId, entityId)

  if (!entity) {
    return campaign
  }

  const position = clampDeploymentPosition({
    x: placement.x,
    y: placement.y,
    facing: placement.facing ?? entity.components.formation.facing,
  })

  entity.components.formation.x = position.x
  entity.components.formation.y = position.y
  entity.components.formation.facing = position.facing
  Object.assign(entity.components.formation, syncFormationSlotsFromDeployment(position))

  if (entity.kind === 'hero' && entity.state.attachedTo) {
    return campaign
  }

  return next
}

export function rotateEntityOnBattlefield(campaign, playerId, entityId, direction) {
  const next = cloneState(campaign)
  const entity = findEntity(next, playerId, entityId)

  if (!entity) {
    return campaign
  }

  entity.components.formation.facing = rotateFacing(entity.components.formation.facing, direction === 'left' ? -45 : 45)
  return next
}

export function toggleEntityReserve(campaign, playerId, entityId) {
  const next = cloneState(campaign)
  const entity = findEntity(next, playerId, entityId)

  if (!entity) {
    return campaign
  }

  if (entity.components.formation.row === 'reserve') {
    applyFormationSlot(entity, 'rear', entity.components.formation.lane)
  } else {
    applyFormationSlot(entity, 'reserve', entity.components.formation.lane)
  }

  return next
}

export function autoDeployPlayer(campaign, playerId) {
  const next = cloneState(campaign)
  const player = next.players.find((entry) => entry.id === playerId)

  if (!player) {
    return campaign
  }

  deployPlayerInPlace(player)

  return next
}

export function pickHeroDraft(campaign, playerId, heroId, upgradeId) {
  const next = cloneState(campaign)
  const hero = findEntity(next, playerId, heroId)

  if (!hero || hero.kind !== 'hero') {
    return campaign
  }

  if (!hero.components.progression.pendingDraft.includes(upgradeId)) {
    return campaign
  }

  applyHeroUpgrade(hero, upgradeId)
  return next
}

export function getRecruitmentOptions(catalog, player) {
  return {
    units: listUnitTemplates(catalog, player.factionId),
    heroes: listHeroTemplates(catalog, player.factionId),
  }
}

function findEntity(campaign, playerId, entityId) {
  return campaign.players.find((entry) => entry.id === playerId)?.roster.find((entry) => entry.id === entityId) ?? null
}

function applyFactionAssignment(player, catalog, factionId) {
  player.factionId = factionId
  player.roster = []
  player.treasury = startingTreasury
  const defaultHero = listHeroTemplates(catalog, factionId)[0]

  if (!defaultHero) {
    return
  }

  const hero = createHeroEntity(catalog, defaultHero.id, player.id, true)
  applyFormationSlot(hero, 'support', 'center')
  player.roster.push(hero)
}

function deployPlayerInPlace(player) {
  const living = player.roster.filter((entry) => entry.state.currentHealth > 0)

  living.forEach((entity, index) => {
    if (entity.kind === 'hero' && entity.state.attachedTo) {
      return
    }

    entity.components.formation.row = battleRows[Math.min(2, Math.floor(index / 3))]
    entity.components.formation.lane = laneOrder[index % laneOrder.length]
    Object.assign(entity.components.formation, createDefaultDeployment(entity.components.formation.row, entity.components.formation.lane))
  })
}

function applyFormationSlot(entity, row, lane) {
  const position = createDefaultDeployment(row, lane)
  entity.components.formation.row = row
  entity.components.formation.lane = lane
  entity.components.formation.x = position.x
  entity.components.formation.y = position.y
}

function syncAttachedHeroFormation(hero, host) {
  hero.components.formation.lane = host.components.formation.lane
  hero.components.formation.row = host.components.formation.row
  hero.components.formation.x = host.components.formation.x
  hero.components.formation.y = host.components.formation.y
  hero.components.formation.facing = host.components.formation.facing
}

function pickAttachedHeroSlot(player, unitId, heroId) {
  const slotOrder = ['front', 'left', 'right', 'rear']
  const occupiedSlots = new Set(
    player.roster
      .filter((entry) => entry.kind === 'hero')
      .filter((entry) => entry.id !== heroId)
      .filter((entry) => entry.state.attachedTo === unitId)
      .map((entry) => entry.state.attachedSlot)
      .filter(Boolean),
  )

  return slotOrder.find((slot) => !occupiedSlots.has(slot)) ?? 'rear'
}
