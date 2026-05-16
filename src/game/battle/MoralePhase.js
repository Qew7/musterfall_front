import { createBattlePhase, addPhaseEvent } from './BattlePhase'
import {
  battlefieldConfig,
  clampBattlefieldPosition,
  getDistanceBetween,
  getDistanceBetweenUnits,
  getHeadingTo,
  moveAlongFacing,
} from '../battlefield'
import { snapshotBattlefieldState, snapshotCombatantState, syncCombatantFootprint } from './support'

export function playStartPhase({ actingSide, targetSide, roundNumber }) {
  const phase = createBattlePhase('start', 'Фаза начала')
  const routedCombatants = actingSide.combatants.filter((combatant) => combatant.currentHealth > 0 && combatant.isRouting)

  if (routedCombatants.length === 0) {
    addPhaseEvent(phase, 'Бегущих отрядов нет.')
    phase.snapshot = snapshotBattlefieldState([actingSide, targetSide])
    return phase
  }

  routedCombatants.forEach((combatant, sequence) => {
    const action = resolveMoraleAction({
      combatant,
      allies: actingSide.combatants,
      enemies: targetSide.combatants,
      roundNumber,
      phaseType: 'start',
      combatScoreDelta: 0,
      sequence,
      engagedEnemies: [],
    })

    action.snapshot = snapshotBattlefieldState([actingSide, targetSide])
    phase.actions.push(action)
    addPhaseEvent(phase, action.summary)
  })

  phase.snapshot = snapshotBattlefieldState([actingSide, targetSide])
  return phase
}

export function resolvePostMeleeMorale({ phase, actingSide, targetSide, roundNumber }) {
  const engagements = buildMeleeEngagements(actingSide, targetSide)

  engagements.forEach((engagement, engagementIndex) => {
    const score = scoreEngagement(phase.actions, engagement)
    if (score.left <= score.right) {
      resolveLosingSideMorale({
        phase,
        loserSide: actingSide,
        loserCombatants: engagement.left,
        winnerCombatants: engagement.right,
        battleSides: [actingSide, targetSide],
        roundNumber,
        engagementIndex,
        combatScoreDelta: score.right - score.left,
      })
    }

    if (score.right <= score.left) {
      resolveLosingSideMorale({
        phase,
        loserSide: targetSide,
        loserCombatants: engagement.right,
        winnerCombatants: engagement.left,
        battleSides: [actingSide, targetSide],
        roundNumber,
        engagementIndex,
        combatScoreDelta: score.left - score.right,
      })
    }
  })

  phase.snapshot = snapshotBattlefieldState([actingSide, targetSide])
  return phase
}

export function resolvePostMissileMorale({ phase, actingSide, targetSide, roundNumber, attackType }) {
  const turnMoraleKey = `${roundNumber}:${actingSide.playerId}`
  const impactedCombatants = collectPhaseCasualtyTriggers(phase.actions, attackType, targetSide.combatants)

  impactedCombatants.forEach((entry, index) => {
    if (entry.combatant.currentHealth <= 0 || entry.combatant.isRouting) {
      return
    }

    if (entry.combatant.lastMissileMoraleTurnKey === turnMoraleKey) {
      return
    }

    const action = resolveMoraleAction({
      combatant: entry.combatant,
      allies: targetSide.combatants,
      enemies: actingSide.combatants,
      roundNumber,
      phaseType: attackType,
      combatScoreDelta: 0,
      sequence: index,
      engagedEnemies: [],
      trigger: {
        reason: entry.reason,
        phaseDamage: entry.phaseDamage,
        lostModels: entry.lostModels,
        startingModels: entry.combatant.startingModels,
        phaseStartModels: entry.phaseStartModels,
        thresholdModels: entry.thresholdModels,
      },
    })

    entry.combatant.lastMissileMoraleTurnKey = turnMoraleKey
    action.snapshot = snapshotBattlefieldState([actingSide, targetSide])
    phase.actions.push(action)
    addPhaseEvent(phase, action.summary)
  })

  phase.snapshot = snapshotBattlefieldState([actingSide, targetSide])
  return phase
}

function resolveLosingSideMorale({ phase, loserSide, loserCombatants, winnerCombatants, battleSides, roundNumber, engagementIndex, combatScoreDelta }) {
  if (combatScoreDelta <= 0) {
    return
  }

  loserCombatants
    .filter((combatant) => combatant.currentHealth > 0)
    .forEach((combatant, combatantIndex) => {
      const action = resolveMoraleAction({
        combatant,
        allies: loserSide.combatants,
        enemies: winnerCombatants,
        roundNumber,
        phaseType: 'melee',
        combatScoreDelta,
        sequence: engagementIndex * 10 + combatantIndex,
        engagedEnemies: winnerCombatants,
      })

      action.snapshot = snapshotBattlefieldState(battleSides)
      phase.actions.push(action)
      addPhaseEvent(phase, action.summary)
    })
}

function resolveMoraleAction({ combatant, allies, enemies, roundNumber, phaseType, combatScoreDelta, sequence, engagedEnemies, trigger = null }) {
  const actorStateBefore = snapshotCombatantState(combatant)
  const from = snapshotPosition(combatant)
  const moraleCheck = resolveMoraleCheck({ combatant, allies, enemies, roundNumber, phaseType, combatScoreDelta, sequence })

  let damage = 0
  let to = null
  let retreatEdge = null
  let actorStateAfter
  let summary

  if (moraleCheck.passed) {
    if (combatant.isRouting) {
      combatant.isRouting = false
      const nearestEnemy = findNearestEnemy(combatant, enemies)
      if (nearestEnemy) {
        combatant.facing = getHeadingTo(combatant, nearestEnemy)
      }
      syncCombatantFootprint(combatant)
      to = snapshotPosition(combatant)
      summary = `${combatant.name} собирается с духом и перестаёт бежать.`
    } else {
      summary = `${combatant.name} выдерживает проверку морали.`
    }
  } else if (combatant.abilities.has('undead')) {
    damage = moraleCheck.failureMargin
    combatant.currentHealth = Math.max(0, combatant.currentHealth - damage)
    syncCombatantFootprint(combatant)
    summary = `${combatant.name} проваливает проверку морали и теряет ${damage} здоровья вместо бегства.`
  } else {
    combatant.isRouting = true
    if (engagedEnemies.length > 0) {
      combatant.facing = getHeadingAwayFromEnemies(combatant, engagedEnemies)
    }

    const retreat = retreatTowardNearestEdge(combatant, combatant.movement)
    combatant.x = retreat.destination.x
    combatant.y = retreat.destination.y
    retreatEdge = retreat.edge
    syncCombatantFootprint(combatant)
    to = snapshotPosition(combatant)
    summary = phaseType === 'start'
      ? `${combatant.name} не может восстановить строй и продолжает бегство.`
      : `${combatant.name} ломает строй и обращается в бегство.`
  }

  actorStateAfter = snapshotCombatantState(combatant)

  return {
    type: 'morale',
    actorId: combatant.entityId,
    actorUnitId: combatant.entityId,
    actorName: combatant.name,
    actorRole: combatant.kind === 'hero' ? 'hero' : 'unit',
    damage,
    from,
    to,
    actorStateBefore,
    actorStateAfter,
    summary,
    details: buildMoraleDetails({ moraleCheck, combatScoreDelta, damage, phaseType, combatant, retreatEdge }),
    moraleCheck: buildMoraleLog({
      moraleCheck,
      trigger,
      combatant,
      phaseType,
      combatScoreDelta,
      damage,
      retreatEdge,
      statusBefore: actorStateBefore.isRouting,
      statusAfter: actorStateAfter.isRouting,
    }),
    snapshot: null,
  }
}

function buildMoraleDetails({ moraleCheck, combatScoreDelta, damage, phaseType, combatant, retreatEdge }) {
  return [
    `Бросок морали: ${moraleCheck.roll} против порога ${moraleCheck.threshold}.`,
    `Использована мораль: ${moraleCheck.effectiveMorale} (${moraleCheck.source}).`,
    `Штраф за очки боя: ${combatScoreDelta}.`,
    `Фаза: ${phaseType}, отряд: ${combatant.name}.`,
    retreatEdge ? `Отступление к краю поля: ${retreatEdge}.` : 'Отступление не потребовалось.',
    damage > 0 ? `Потеря здоровья из-за провала: ${damage}.` : `Запас провала: ${moraleCheck.failureMargin}.`,
  ]
}

function buildMoraleLog({ moraleCheck, trigger, combatant, phaseType, combatScoreDelta, damage, retreatEdge, statusBefore, statusAfter }) {
  return {
    sourcePhase: phaseType,
    trigger: trigger?.reason ?? (phaseType === 'melee' ? 'combat_score' : phaseType === 'start' ? 'rally' : 'phase_casualties'),
    effectiveMorale: moraleCheck.effectiveMorale,
    moraleSource: moraleCheck.source,
    threshold: moraleCheck.threshold,
    roll: moraleCheck.roll,
    passed: moraleCheck.passed,
    failureMargin: moraleCheck.failureMargin,
    combatScoreDelta,
    phaseDamage: trigger?.phaseDamage ?? 0,
    lostModels: trigger?.lostModels ?? 0,
    startingModels: trigger?.startingModels ?? combatant.startingModels,
    phaseStartModels: trigger?.phaseStartModels ?? 0,
    thresholdModels: trigger?.thresholdModels ?? 0,
    statusBefore,
    statusAfter,
    damageApplied: damage,
    retreatEdge,
  }
}

function resolveMoraleCheck({ combatant, allies, enemies, roundNumber, phaseType, combatScoreDelta, sequence }) {
  const moraleSource = resolveEffectiveMorale(combatant, allies)
  const fearPenalty = enemies.some((enemy) => enemy.abilities?.has('fear')) ? 1 : 0
  const disciplineBonus = combatant.abilities.has('disciplined') ? 1 : 0
  const threshold = Math.max(2, moraleSource.value + disciplineBonus - combatScoreDelta - fearPenalty)
  const roll = rollMoraleDice(`${phaseType}:${roundNumber}:${sequence}:${combatant.entityId}`)

  return {
    effectiveMorale: moraleSource.value,
    source: moraleSource.label,
    threshold,
    roll,
    passed: roll <= threshold,
    failureMargin: Math.max(0, roll - threshold),
  }
}

function resolveEffectiveMorale(combatant, allies) {
  if (combatant.kind === 'hero') {
    return { value: combatant.morale, label: combatant.name }
  }

  const sources = collectMusterSources(allies)
    .filter((source) => source.morale > combatant.morale)
    .filter((source) => getDistanceBetween(combatant, source) <= source.morale)
    .sort((left, right) => right.morale - left.morale || getDistanceBetween(combatant, left) - getDistanceBetween(combatant, right))

  if (sources.length === 0) {
    return { value: combatant.morale, label: combatant.name }
  }

  return {
    value: sources[0].morale,
    label: `Muster от ${sources[0].name}`,
  }
}

function collectMusterSources(allies) {
  const sources = []

  allies.forEach((combatant) => {
    if (combatant.kind === 'hero' && combatant.abilities.has('muster')) {
      sources.push({
        entityId: combatant.entityId,
        name: combatant.name,
        morale: combatant.morale,
        x: combatant.x,
        y: combatant.y,
      })
    }

    ;(combatant.attachedHeroes ?? []).forEach((hero) => {
      const heroAbilities = new Set(hero.abilities ?? [])
      if (!heroAbilities.has('muster')) {
        return
      }

      sources.push({
        entityId: hero.entityId,
        name: hero.name,
        morale: hero.morale,
        x: combatant.x,
        y: combatant.y,
      })
    })
  })

  return sources
}

function buildMeleeEngagements(actingSide, targetSide) {
  const living = [...actingSide.combatants, ...targetSide.combatants].filter((combatant) => combatant.currentHealth > 0)
  const visited = new Set()
  const engagements = []

  living.forEach((combatant) => {
    if (visited.has(combatant.entityId)) {
      return
    }

    const queue = [combatant]
    const cluster = []

    while (queue.length > 0) {
      const current = queue.shift()
      if (!current || visited.has(current.entityId)) {
        continue
      }

      visited.add(current.entityId)
      cluster.push(current)

      living.forEach((candidate) => {
        if (visited.has(candidate.entityId) || candidate.sideKey === current.sideKey) {
          return
        }

        if (getDistanceBetweenUnits(current, candidate) <= battlefieldConfig.meleeContactTolerance) {
          queue.push(candidate)
        }
      })
    }

    const left = cluster.filter((entry) => entry.sideKey === actingSide.sideKey)
    const right = cluster.filter((entry) => entry.sideKey === targetSide.sideKey)

    if (left.length > 0 && right.length > 0) {
      engagements.push({ left, right })
    }
  })

  return engagements
}

function scoreEngagement(actions, engagement) {
  const leftIds = new Set(engagement.left.map((combatant) => combatant.entityId))
  const rightIds = new Set(engagement.right.map((combatant) => combatant.entityId))

  return actions
    .filter((action) => action.type === 'melee')
    .reduce((score, action) => {
      if (leftIds.has(action.actorUnitId) && rightIds.has(action.targetId)) {
        score.left += action.damage ?? 0
      }

      if (rightIds.has(action.actorUnitId) && leftIds.has(action.targetId)) {
        score.right += action.damage ?? 0
      }

      return score
    }, { left: 0, right: 0 })
}

function rollMoraleDice(seed) {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(index)
    hash |= 0
  }

  const normalized = Math.abs(hash)
  const dieA = 1 + (normalized % 6)
  const dieB = 1 + (Math.floor(normalized / 7) % 6)
  return dieA + dieB
}

function getHeadingAwayFromEnemies(combatant, enemies) {
  const center = enemies.reduce((accumulator, enemy) => ({
    x: accumulator.x + enemy.x,
    y: accumulator.y + enemy.y,
  }), { x: 0, y: 0 })

  const averageEnemy = {
    x: center.x / enemies.length,
    y: center.y / enemies.length,
  }

  return getHeadingTo(averageEnemy, combatant)
}

function retreatTowardNearestEdge(combatant, distance) {
  const edge = findNearestEdge(combatant)
  const heading = getHeadingTo(combatant, edge.point)
  const destination = clampBattlefieldPosition(moveAlongFacing({ ...combatant, facing: heading }, distance))

  return {
    edge: edge.label,
    destination,
  }
}

function findNearestEdge(combatant) {
  const edges = [
    { label: 'west', distance: combatant.x, point: { x: 0, y: combatant.y } },
    { label: 'east', distance: battlefieldConfig.width - 1 - combatant.x, point: { x: battlefieldConfig.width - 1, y: combatant.y } },
    { label: 'north', distance: combatant.y, point: { x: combatant.x, y: 0 } },
    { label: 'south', distance: battlefieldConfig.height - 1 - combatant.y, point: { x: combatant.x, y: battlefieldConfig.height - 1 } },
  ]

  return edges.sort((left, right) => left.distance - right.distance)[0]
}

function findNearestEnemy(combatant, enemies) {
  return enemies
    .filter((enemy) => enemy.currentHealth > 0)
    .sort((left, right) => getDistanceBetween(combatant, left) - getDistanceBetween(combatant, right))[0] ?? null
}

function collectPhaseCasualtyTriggers(actions, attackType, combatants) {
  const combatantsById = new Map(combatants.map((combatant) => [combatant.entityId, combatant]))
  const casualties = new Map()

  actions
    .filter((action) => action.type === attackType)
    .forEach((action) => {
      if (!action.targetId || !action.targetStateBefore || !action.targetStateAfter) {
        return
      }

      const current = casualties.get(action.targetId) ?? {
        firstBefore: action.targetStateBefore,
        lastAfter: action.targetStateAfter,
        phaseDamage: 0,
      }

      current.phaseDamage += action.damage ?? 0
      current.lastAfter = action.targetStateAfter
      casualties.set(action.targetId, current)
    })

  return [...casualties.entries()]
    .map(([targetId, entry]) => {
      const combatant = combatantsById.get(targetId)
      if (!combatant) {
        return null
      }

      const phaseStartModels = entry.firstBefore.modelsRemaining ?? combatant.modelsRemaining ?? 0
      const remainingModels = entry.lastAfter.modelsRemaining ?? combatant.modelsRemaining ?? 0
      const lostModels = Math.max(0, phaseStartModels - remainingModels)

      const battleStartThreshold = combatant.startingModels * 0.25
      const phaseLossThreshold = phaseStartModels * 0.25
      const atBattleCriticalRemains = remainingModels <= battleStartThreshold
      const reachedPhaseLossThreshold = lostModels >= phaseLossThreshold

      if (!atBattleCriticalRemains && !reachedPhaseLossThreshold) {
        return null
      }

      const reason = atBattleCriticalRemains && reachedPhaseLossThreshold
        ? 'battle_and_phase_casualties'
        : atBattleCriticalRemains
          ? 'battle_remaining_critical'
          : 'phase_casualties'

      return {
        combatant,
        phaseDamage: entry.phaseDamage,
        lostModels,
        phaseStartModels,
        thresholdModels: atBattleCriticalRemains ? battleStartThreshold : phaseLossThreshold,
        reason,
      }
    })
    .filter(Boolean)
}

function snapshotPosition(combatant) {
  return {
    x: combatant.x,
    y: combatant.y,
    facing: combatant.facing,
    row: combatant.row,
    lane: combatant.lane,
  }
}
