import { getTemplate, listHeroTemplates, listUnitTemplates } from './catalog'
import { clampDeploymentPosition, createDefaultDeployment, rotateFacing, syncFormationSlotsFromDeployment } from './battlefield'
import { laneOrder, rowOrder } from './constants'
import { simulateBattle } from './battle'
import { cloneState, createHeroEntity, createUnitEntity, isDeployable } from './entities'
import { applyHeroUpgrade, isHeroLevelReady, rollHeroDraft } from './upgrades'

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

export function cycleEntityPosition(campaign, playerId, entityId, axis) {
  const next = cloneState(campaign)
  const player = next.players.find((entry) => entry.id === playerId)
  const entity = player?.roster.find((entry) => entry.id === entityId)

  if (!player || !entity) {
    return campaign
  }

  const sequence = axis === 'lane' ? laneOrder : rowOrder
  const current = entity.components.formation[axis]
  const index = sequence.indexOf(current)
  const nextValue = sequence[(index + 1 + sequence.length) % sequence.length]

  if (axis === 'lane') {
    applyFormationSlot(entity, entity.components.formation.row, nextValue)
  } else {
    applyFormationSlot(entity, nextValue, entity.components.formation.lane)
  }

  if (entity.kind === 'hero' && entity.state.attachedTo) {
    const host = player.roster.find((entry) => entry.id === entity.state.attachedTo)
    if (host) {
      syncAttachedHeroFormation(entity, host)
    }
  }

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

export function placeEntityOnBattlefield(campaign, playerId, entityId, x, y) {
  return setEntityBattlefieldTransform(campaign, playerId, entityId, { x, y })
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

export function prepareCampaignForRound(campaign, catalog, random = Math.random) {
  const next = cloneState(campaign)

  assignRandomFactions(next, catalog, random)
  prepareBots(next, catalog, random)

  return next
}

export function prepareHeroDraft(campaign, catalog, playerId, heroId) {
  const next = cloneState(campaign)
  const hero = findEntity(next, playerId, heroId)

  if (!hero || hero.kind !== 'hero' || !isHeroLevelReady(hero)) {
    return campaign
  }

  hero.components.progression.pendingDraft = rollHeroDraft(hero, catalog)
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

export function runCampaignRound(campaign, catalog) {
  const next = cloneState(campaign)
  const activePlayers = next.players.filter((player) => player.status === 'active')

  if (activePlayers.length <= 1) {
    return next
  }

  activePlayers.forEach((player) => ensureDeployment(player))

  const report = {
    round: next.round,
    matchups: [],
    byes: [],
  }

  const queue = [...activePlayers]

  while (queue.length > 1) {
    const attacker = queue.shift()
    const defender = queue.shift()
    const battle = simulateBattle(attacker, defender, catalog)
    report.matchups.push(battle)

    const loserId = battle.winnerId === attacker.id ? defender.id : attacker.id
    const winner = next.players.find((player) => player.id === battle.winnerId)
    const loser = next.players.find((player) => player.id === loserId)

    if (winner) {
      winner.treasury += 12
      winner.victories += 1
      winner.roundNotes = [`Победа в раунде ${next.round}: +12 припасов`]
    }

    if (loser) {
      loser.status = 'eliminated'
      loser.roundNotes = [`Разбит в раунде ${next.round}`]
    }
  }

  if (queue.length === 1) {
    const byePlayer = queue[0]
    byePlayer.treasury += 8
    byePlayer.roundNotes = [`Раунд ${next.round}: свободный проход, +8 припасов`]
    report.byes.push({ playerId: byePlayer.id, playerName: byePlayer.name })
  }

  const survivors = next.players.filter((player) => player.status === 'active')
  if (survivors.length === 1) {
    next.winnerId = survivors[0].id
  }

  next.lastRoundReport = report
  next.round += 1
  return next
}

export function buildMetaReward(campaign) {
  if (!campaign.winnerId) {
    return null
  }

  const winner = campaign.players.find((player) => player.id === campaign.winnerId)
  if (!winner) {
    return null
  }

  return {
    playerId: winner.id,
    playerName: winner.name,
    factionId: winner.factionId,
    experience: 25 + winner.victories * 5,
    essence: 3 + winner.victories,
  }
}

function findEntity(campaign, playerId, entityId) {
  return campaign.players.find((entry) => entry.id === playerId)?.roster.find((entry) => entry.id === entityId) ?? null
}

function ensureDeployment(player) {
  const deployable = player.roster.filter((entry) => entry.state.currentHealth > 0)
  const visible = deployable.filter((entry) => isDeployable(entry) || (entry.kind === 'hero' && entry.state.attachedTo))

  if (visible.length > 0) {
    return
  }

  deployPlayerInPlace(player)
}

function assignRandomFactions(campaign, catalog, random) {
  campaign.players.forEach((player) => {
    if (player.factionId) {
      return
    }

    const factionId = pickRandomFactionId(catalog, random)
    if (!factionId) {
      return
    }

    applyFactionAssignment(player, catalog, factionId)
  })
}

function prepareBots(campaign, catalog, random) {
  campaign.players.forEach((player) => {
    if (!player.isBot || player.status !== 'active' || !player.factionId) {
      return
    }

    recruitBotUnits(player, catalog, random)
    deployPlayerInPlace(player)
  })
}

function recruitBotUnits(player, catalog, random) {
  const unitTemplates = listUnitTemplates(catalog, player.factionId).sort((left, right) => left.cost - right.cost)
  const cheapestUnitCost = unitTemplates[0]?.cost ?? null

  if (!cheapestUnitCost) {
    return
  }

  while (player.treasury >= cheapestUnitCost) {
    const affordableUnits = unitTemplates.filter((template) => template.cost <= player.treasury)
    const selectedTemplate = pickRandomEntry(affordableUnits, random)

    if (!selectedTemplate) {
      return
    }

    player.roster.push(createUnitEntity(catalog, selectedTemplate.id, player.id))
    player.treasury -= selectedTemplate.cost
  }
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

function pickRandomFactionId(catalog, random) {
  return pickRandomEntry(catalog.factions, random)?.id ?? null
}

function pickRandomEntry(entries, random) {
  if (entries.length === 0) {
    return null
  }

  const index = Math.floor(random() * entries.length)
  return entries[index]
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
