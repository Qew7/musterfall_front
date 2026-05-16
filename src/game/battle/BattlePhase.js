import { laneOrder, rowOrder, weaponVsArmor } from '../constants'
import {
  battlefieldConfig,
  classifyAttackVector,
  getAttackVictims,
  getChargeDestination,
  getClosestPointOnUnit,
  getDistanceBetweenUnits,
  getFacingVector,
  getHeadingTo,
  getPointInLocalUnitSpace,
  isInFrontArc,
  getLineOfSightBlockers,
  getUnitCorners,
  getRightVector,
} from '../battlefield'
import { snapshotBattlefieldState, snapshotCombatantState, syncCombatantFootprint } from './support'

const battleRows = rowOrder.filter((row) => row !== 'reserve')
const contactTolerance = battlefieldConfig.meleeContactTolerance

export function createBattlePhase(type, label) {
  return {
    type,
    label,
    events: [],
    actions: [],
    snapshot: null,
  }
}

export function addPhaseEvent(phase, event) {
  phase.events.push(event)
}

export function resolveAttackPhase({ phase, actingSide, targetSide, roundNumber, attackType }) {
  const allCombatants = [...actingSide.combatants, ...targetSide.combatants]
  const attackers = actingSide.combatants
    .filter((entry) => entry.currentHealth > 0)
    .filter((entry) => canAttack(entry, attackType))
    .sort((left, right) => right.initiative - left.initiative)

  if (attackers.length === 0) {
    addPhaseEvent(phase, 'Подходящих атакующих нет.')
    return phase
  }

  attackers.forEach((attacker) => {
    const targetSelection = chooseTarget(attacker, targetSide.combatants, attackType, allCombatants)
    if (!targetSelection) {
      return
    }

    const { target, vector } = targetSelection
    const blockers = attacker.requiresLineOfSight ? getLineOfSightBlockers(attacker, target, allCombatants) : []
    const victims = attackType === 'melee' ? [{ target, multiplier: 1 }] : getAttackVictims(attacker, target, targetSide.combatants, attackType)
    const attackEntries = attackType === 'melee'
      ? buildMeleeAttackEntries(attacker, target, vector, roundNumber)
      : [{
          actorId: attacker.entityId,
          actorUnitId: attacker.entityId,
          actorName: attacker.name,
          actorRole: attacker.kind === 'hero' ? 'hero' : 'unit',
          profile: attacker,
          damage: calculateDamage(attacker, target, attackType, vector, roundNumber),
        }]

    attackEntries.forEach((entry) => {
      if (target.currentHealth <= 0 || entry.damage <= 0) {
        return
      }

      const actorState = snapshotCombatantState(attacker)
      const targetStateBefore = snapshotCombatantState(target)

      target.currentHealth = Math.max(0, target.currentHealth - entry.damage)
      syncCombatantFootprint(target)

      const targetStateAfter = snapshotCombatantState(target)

      if (attackType === 'melee') {
        distributeContributorExperience(entry.profile, entry.damage)
      } else {
        distributeExperience(attacker, attackType, entry.damage)
      }

      addPhaseEvent(phase, `${formatBattleActor(entry.actorRole, entry.actorName)} наносит ${entry.damage} урона по ${target.name} (${vector})`)
      const action = {
        type: attackType,
        actorId: entry.actorId,
        actorUnitId: entry.actorUnitId,
        actorName: entry.actorName,
        actorRole: entry.actorRole,
        targetId: target.entityId,
        targetName: target.name,
        vector,
        damage: entry.damage,
        blockers: blockers.map((blocker) => blocker.entityId),
        requiresLineOfSight: attacker.requiresLineOfSight,
        template: attackType === 'melee' ? null : getAttackTemplateDescriptor(attacker, target, victims, attackType),
        affectedIds: victims.map((victim) => victim.target.entityId),
        actorState,
        targetStateBefore,
        targetStateAfter,
        charge: attackType === 'melee' && getDistanceBetweenUnits(attacker, target) > contactTolerance
          ? {
              start: { x: attacker.x, y: attacker.y, facing: attacker.facing },
              destination: getChargeDestination(attacker, target, getHeadingTo(attacker, target)),
              contactPoint: getClosestPointOnUnit(attacker, target),
              vector,
            }
          : null,
        snapshot: snapshotBattlefieldState([actingSide, targetSide]),
      }

      action.summary = summarizeAttackAction(action, phase.type)
      action.details = buildAttackActionDetails(action)
      phase.actions.push(action)
    })
  })

  if (phase.events.length === 0) {
    addPhaseEvent(phase, 'Эта фаза прошла без результата.')
  }

  phase.snapshot = snapshotBattlefieldState([actingSide, targetSide])

  return phase
}

function getAttackTemplateDescriptor(attacker, target, victims, attackType) {
  const templateKind = attackType === 'magic' ? attacker.spellTemplate : attacker.shootingTemplate

  if (templateKind === 'blast' || templateKind === 'volley') {
    return {
      shape: 'circle',
      radius: templateKind === 'blast' ? battlefieldConfig.blastRadius : battlefieldConfig.volleyRadius,
      center: { x: target.x, y: target.y },
      kind: templateKind,
      affectedIds: victims.map((entry) => entry.target.entityId),
    }
  }

  if (templateKind === 'breath') {
    return {
      shape: 'cone',
      radius: Math.max(attacker.shootingRange, attacker.spellRange, 2.4),
      facing: attacker.facing,
      origin: { x: attacker.x, y: attacker.y },
      kind: templateKind,
      affectedIds: victims.map((entry) => entry.target.entityId),
    }
  }

  return {
    shape: 'line',
    start: { x: attacker.x, y: attacker.y },
    end: { x: target.x, y: target.y },
    kind: templateKind,
    affectedIds: victims.map((entry) => entry.target.entityId),
  }
}

function summarizeAttackAction(action, phaseType) {
  const actorLabel = formatBattleActor(action.actorRole, action.actorName)

  if (phaseType === 'melee') {
    return `${actorLabel} атакует ${action.targetName} в ${describeVector(action.vector)} и наносит ${action.damage} урона.`
  }

  if (phaseType === 'shooting') {
    return `${actorLabel} стреляет по ${action.targetName} и наносит ${action.damage} урона.`
  }

  return `${actorLabel} применяет магию по ${action.targetName} и наносит ${action.damage} урона.`
}

function buildAttackActionDetails(action) {
  const details = [
    `Атакующий до удара: ${formatCombatantState(action.actorState)}`,
    `Цель до удара: ${formatCombatantState(action.targetStateBefore)}`,
    `Урон: ${action.damage}, направление: ${describeVector(action.vector)}, затронуто целей: ${(action.affectedIds ?? []).length}`,
    `Цель после удара: ${formatCombatantState(action.targetStateAfter)}`,
  ]

  if ((action.blockers ?? []).length > 0) {
    details.push(`Помехи по линии атаки: ${(action.blockers ?? []).join(', ')}`)
  }

  return details
}

function formatCombatantState(state) {
  if (!state) {
    return 'нет данных'
  }

  return `${state.name} HP ${state.currentHealth}/${state.maxHealth}, моделей ${state.modelsRemaining}, строй ${state.row}/${state.lane}, ряды ${state.ranks}, файлы ${state.files}`
}

function describeVector(vector) {
  if (vector === 'rear') {
    return 'тыл'
  }

  if (vector === 'flank') {
    return 'фланг'
  }

  return 'фронт'
}

function canAttack(attacker, attackType) {
  if (attacker.isRouting) {
    return false
  }

  if (attackType === 'magic') {
    return attacker.spell > 0
  }

  if (attackType === 'shooting') {
    return attacker.ranged > 0
  }

  return attacker.melee > 0
}

function chooseTarget(attacker, enemies, attackType, allCombatants = enemies) {
  const living = enemies.filter((entry) => entry.currentHealth > 0)
  if (living.length === 0) {
    return null
  }

  if (attackType === 'melee') {
    const engaged = living
      .map((target) => ({
        target,
        distance: getDistanceBetweenUnits(attacker, target),
        vector: classifyAttackVector(attacker, target),
      }))
      .filter((entry) => entry.distance <= contactTolerance)
      .sort((left, right) => left.distance - right.distance || getVectorPriority(left.vector) - getVectorPriority(right.vector))

    if (engaged.length === 0) {
      return null
    }

    return {
      target: engaged[0].target,
      vector: engaged[0].vector,
    }
  }

  const availableTargets = attackType === 'shooting'
    ? living.filter((target) => canTargetWithRangedAttack(attacker, target, allCombatants))
    : living

  if (availableTargets.length === 0) {
    return null
  }

  const sameLane = battleRows.flatMap((row) => availableTargets.filter((entry) => entry.lane === attacker.lane && entry.row === row))
  if (sameLane.length > 0) {
    const target = sameLane[0]
    return {
      target,
      vector: target.row === 'front' ? 'front' : 'rear',
    }
  }

  const adjacent = laneOrder
    .filter((lane) => lane !== attacker.lane)
    .flatMap((lane) => battleRows.flatMap((row) => availableTargets.filter((entry) => entry.lane === lane && entry.row === row)))

  if (adjacent.length > 0) {
    return {
      target: adjacent[0],
      vector: 'flank',
    }
  }

  return { target: availableTargets[0], vector: 'front' }
}

function canTargetWithRangedAttack(attacker, target, allCombatants) {
  if (!attacker.abilities.has('skirmisher') && !isInFrontArc(attacker, target, attacker.facing)) {
    return false
  }

  if (isInMeleeContact(target, allCombatants)) {
    return false
  }

  return getLineOfSightBlockers(attacker, target, allCombatants).length === 0
}

function isInMeleeContact(unit, allCombatants) {
  return allCombatants.some((entry) => (
    entry.entityId !== unit.entityId
      && entry.currentHealth > 0
      && getDistanceBetweenUnits(unit, entry) <= contactTolerance
  ))
}

function getVectorPriority(vector) {
  if (vector === 'rear') {
    return 0
  }

  if (vector === 'flank') {
    return 1
  }

  return 2
}

function calculateDamage(attacker, defender, attackType, vector, roundNumber) {
  const basePower = getBasePower(attacker, attackType)
  if (basePower <= 0) {
    return 0
  }

  const attackAbilities = attacker.abilities ?? new Set()
  const weaponType = attackType === 'magic' ? 'magic' : attacker.weaponType
  const armorFactor = weaponVsArmor[defender.armorType]?.[weaponType] ?? 1
  const facingFactor = defender.abilities.has('skirmisher')
    ? 1
    : vector === 'rear'
      ? 1.55
      : vector === 'flank'
        ? 1.25
        : 1
  const phaseFactor = attackType === 'shooting' ? 0.9 : 1
  const chargeFactor = attackAbilities.has('charge') && roundNumber === 1 && attackType === 'melee' ? 1.3 : 1
  const steadyFactor = defender.abilities.has('steadfast') && vector === 'front' ? 0.85 : 1
  const ferociousFactor = attackAbilities.has('ferocious') && attackType === 'melee' ? 1.1 : 1
  const machineFactor = attackAbilities.has('machine') && attackType === 'shooting' ? 1.25 : 1
  const raw = basePower * armorFactor * facingFactor * phaseFactor * chargeFactor * steadyFactor * ferociousFactor * machineFactor

  return Math.max(1, Math.round(raw / 2.2))
}

function buildMeleeAttackEntries(attacker, defender, vector, roundNumber) {
  const engagedModelCount = getEngagedModelCount(attacker, defender)
  const attackerContactSide = getDetailedContactSide(attacker, defender)

  if (engagedModelCount <= 0) {
    return []
  }

  const [primaryContributor, ...attachedContributors] = attacker.contributors.melee
  const entries = []

  if (primaryContributor) {
    const primaryProfile = {
      ...primaryContributor,
      melee: primaryContributor.power * engagedModelCount,
    }

    entries.push({
      actorId: primaryContributor.entityId,
      actorUnitId: attacker.entityId,
      actorName: primaryContributor.kind === 'unit' && engagedModelCount > 1
        ? `${attacker.name} (${engagedModelCount} моделей)`
        : primaryContributor.name,
      actorRole: primaryContributor.kind === 'hero' ? 'hero' : 'unit',
      profile: primaryProfile,
      damage: calculateDamage(primaryProfile, defender, 'melee', vector, roundNumber),
    })
  }

  attachedContributors
    .filter((contributor) => contributor.kind === 'hero')
    .filter((contributor) => isHeroContributorEligibleForSide(contributor, attackerContactSide))
    .forEach((contributor) => {
      entries.push({
        actorId: contributor.entityId,
        actorUnitId: attacker.entityId,
        actorName: contributor.name,
        actorRole: 'hero',
        profile: {
          ...contributor,
          melee: contributor.power,
        },
        damage: calculateDamage({ ...contributor, melee: contributor.power }, defender, 'melee', vector, roundNumber),
      })
    })

  return entries
}

function getEngagedModelCount(attacker, defender) {
  const contactSide = getDetailedContactSide(attacker, defender)
  const sideCapacity = getSideModelCapacity(attacker, contactSide)

  if (sideCapacity <= 0) {
    return 0
  }

  const contactSpan = getContactSpan(attacker, defender, contactSide)
  const modelSpan = getModelSpan(attacker, contactSide)

  if (modelSpan <= 0) {
    return Math.max(1, sideCapacity)
  }

  const engagedModels = Math.ceil((contactSpan + contactTolerance) / modelSpan)
  return Math.max(1, Math.min(sideCapacity, engagedModels))
}

function getSideModelCapacity(unit, contactSide) {
  if (unit.kind === 'hero') {
    return unit.currentHealth > 0 ? 1 : 0
  }

  if (contactSide === 'left' || contactSide === 'right') {
    return Math.max(0, unit.ranks ?? 0)
  }

  return Math.max(0, unit.files ?? 0)
}

function getModelSpan(unit, contactSide) {
  if (contactSide === 'left' || contactSide === 'right') {
    return Math.max(unit.modelDepth ?? 0, 0)
  }

  return Math.max(unit.modelWidth ?? 0, 0)
}

function getContactSpan(attacker, defender, contactSide) {
  const axis = getContactAxis(attacker, contactSide)
  const attackerProjection = projectUnitOntoAxis(attacker, axis)
  const defenderProjection = projectUnitOntoAxis(defender, axis)
  const overlap = Math.min(attackerProjection.max, defenderProjection.max) - Math.max(attackerProjection.min, defenderProjection.min)

  return Math.max(0, overlap)
}

function getContactAxis(unit, contactSide) {
  if (contactSide === 'left' || contactSide === 'right') {
    return getFacingVector(unit.facing)
  }

  return getRightVector(unit.facing)
}

function projectUnitOntoAxis(unit, axis) {
  const dots = getUnitCorners(unit).map((point) => point.x * axis.x + point.y * axis.y)

  return {
    min: Math.min(...dots),
    max: Math.max(...dots),
  }
}

function getBasePower(attacker, attackType) {
  if (attackType === 'magic') {
    return attacker.spell
  }

  if (attackType === 'shooting') {
    return attacker.ranged
  }

  return attacker.melee
}

function distributeContributorExperience(contributor, damage) {
  if (contributor.kind !== 'hero') {
    return
  }

  contributor.experienceGain += Math.max(1, damage)
}

function getDetailedContactSide(unit, opponent) {
  const local = getPointInLocalUnitSpace(opponent, unit)

  if (Math.abs(local.longitudinal) >= Math.abs(local.lateral)) {
    return local.longitudinal >= 0 ? 'front' : 'rear'
  }

  return local.lateral >= 0 ? 'right' : 'left'
}

function isHeroContributorEligibleForSide(contributor, contactSide) {
  if (!contributor.attachedSlot) {
    return true
  }

  return contributor.attachedSlot === contactSide
}

function formatBattleActor(actorRole, actorName) {
  return actorRole === 'hero' ? `Герой ${actorName}` : `Отряд ${actorName}`
}

function distributeExperience(attacker, attackType, damage) {
  const contributors = attacker.contributors[attackType === 'melee' ? 'melee' : 'ranged'] ?? []
  const totalPower = contributors.reduce((sum, entry) => sum + entry.power, 0)

  contributors.forEach((entry) => {
    if (entry.kind !== 'hero') {
      return
    }

    const ratio = totalPower > 0 ? entry.power / totalPower : 0
    entry.experienceGain += Math.max(1, Math.round(damage * ratio))
  })
}