import { laneOrder, rowOrder, weaponVsArmor } from '../constants'
import {
  battlefieldConfig,
  classifyAttackVector,
  getAttackVictims,
  getChargeDestination,
  getClosestPointOnUnit,
  getDistanceBetweenUnits,
  getHeadingTo,
  isInFrontArc,
  getLineOfSightBlockers,
} from '../battlefield'
import { snapshotBattlefieldState, syncCombatantFootprint } from './support'

const battleRows = rowOrder.filter((row) => row !== 'reserve')
const contactTolerance = 0.4

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
    const damage = calculateDamage(attacker, target, attackType, vector, roundNumber)

    if (damage <= 0) {
      return
    }

    target.currentHealth = Math.max(0, target.currentHealth - damage)
    syncCombatantFootprint(target)
    distributeExperience(attacker, attackType, damage)
    addPhaseEvent(phase, `${attacker.name} наносит ${damage} урона по ${target.name} (${vector})`)
    phase.actions.push({
      type: attackType,
      actorId: attacker.entityId,
      actorName: attacker.name,
      targetId: target.entityId,
      targetName: target.name,
      vector,
      damage,
      blockers: blockers.map((entry) => entry.entityId),
      requiresLineOfSight: attacker.requiresLineOfSight,
      template: attackType === 'melee' ? null : getAttackTemplateDescriptor(attacker, target, victims, attackType),
      affectedIds: victims.map((entry) => entry.target.entityId),
      charge: attackType === 'melee' && getDistanceBetweenUnits(attacker, target) > contactTolerance
        ? {
            start: { x: attacker.x, y: attacker.y, facing: attacker.facing },
            destination: getChargeDestination(attacker, target, getHeadingTo(attacker, target)),
            contactPoint: getClosestPointOnUnit(attacker, target),
            vector,
          }
        : null,
      snapshot: snapshotBattlefieldState([actingSide, targetSide]),
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

function canAttack(attacker, attackType) {
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
  const chargeFactor = attacker.abilities.has('charge') && roundNumber === 1 && attackType === 'melee' ? 1.3 : 1
  const steadyFactor = defender.abilities.has('steadfast') && vector === 'front' ? 0.85 : 1
  const ferociousFactor = attacker.abilities.has('ferocious') && attackType === 'melee' ? 1.1 : 1
  const machineFactor = attacker.abilities.has('machine') && attackType === 'shooting' ? 1.25 : 1
  const raw = basePower * armorFactor * facingFactor * phaseFactor * chargeFactor * steadyFactor * ferociousFactor * machineFactor

  return Math.max(1, Math.round(raw / 2.2))
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