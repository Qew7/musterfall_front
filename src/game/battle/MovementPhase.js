import { createBattlePhase, addPhaseEvent } from './BattlePhase'
import { getChargeDestination, getDistanceBetween, getDistanceBetweenUnits, getHeadingTo, moveAlongFacing } from '../battlefield'
import { projectCombatantPosition, snapshotBattlefieldState, snapshotCombatantState } from './support'

const advancingRows = {
  rear: 'support',
  support: 'front',
}

const contactTolerance = 0.4

export function playMovementPhase({ actingSide, targetSide }) {
  const phase = createBattlePhase('movement', 'Фаза движения')
  const mobileCombatants = actingSide.combatants
    .filter((entry) => entry.currentHealth > 0)
    .filter((entry) => !entry.isRouting)
    .filter((entry) => entry.melee > entry.ranged + entry.spell)

  let movedCount = 0

  mobileCombatants.forEach((combatant) => {
    const targetRow = advancingRows[combatant.row]
    if (!targetRow) {
      return
    }

    const occupied = actingSide.combatants.some((entry) => {
      return entry.currentHealth > 0 && entry.entityId !== combatant.entityId && entry.lane === combatant.lane && entry.row === targetRow
    })

    if (occupied) {
      return
    }

    const from = {
      x: combatant.x,
      y: combatant.y,
      facing: combatant.facing,
      row: combatant.row,
      lane: combatant.lane,
    }
    const actorStateBefore = snapshotCombatantState(combatant)

    combatant.row = targetRow
    Object.assign(combatant, projectCombatantPosition(combatant.sideIndex, targetRow, combatant.lane, combatant.facing))
    movedCount += 1
    addPhaseEvent(phase, `${combatant.name} выдвигается в ряд ${targetRow}.`)
    const actorStateAfter = snapshotCombatantState(combatant)
    phase.actions.push({
      type: 'movement',
      actorId: combatant.entityId,
      actorName: combatant.name,
      actorStateBefore,
      actorStateAfter,
      summary: `${combatant.name} выдвигается в ряд ${targetRow}.`,
      details: buildMovementDetails({ actorName: combatant.name, actorStateBefore, actorStateAfter, from, to: {
        x: combatant.x,
        y: combatant.y,
        facing: combatant.facing,
        row: combatant.row,
        lane: combatant.lane,
      } }),
      from,
      to: {
        x: combatant.x,
        y: combatant.y,
        facing: combatant.facing,
        row: combatant.row,
        lane: combatant.lane,
      },
      snapshot: snapshotBattlefieldState([actingSide, targetSide]),
    })
  })

  mobileCombatants.forEach((combatant) => {
    const nearestEnemy = findNearestEnemy(combatant, targetSide.combatants)
    if (!nearestEnemy || getDistanceBetweenUnits(combatant, nearestEnemy) <= contactTolerance) {
      return
    }

    const heading = getHeadingTo(combatant, nearestEnemy)
    const engagementPosition = getChargeDestination(combatant, nearestEnemy, heading)
    const travelDistance = Math.min(combatant.movement, getDistanceBetween(combatant, engagementPosition))

    if (travelDistance <= 0.05) {
      return
    }

    const destination = travelDistance + 0.05 >= getDistanceBetween(combatant, engagementPosition)
      ? engagementPosition
      : moveAlongFacing({ ...combatant, facing: heading }, travelDistance)
    const projectedCombatant = {
      ...combatant,
      x: destination.x,
      y: destination.y,
      facing: destination.facing,
    }
    const blocked = actingSide.combatants.some((entry) => {
      return entry.currentHealth > 0 && entry.entityId !== combatant.entityId && getDistanceBetweenUnits(projectedCombatant, entry) < contactTolerance
    })

    if (blocked) {
      return
    }

    const from = {
      x: combatant.x,
      y: combatant.y,
      facing: combatant.facing,
      row: combatant.row,
      lane: combatant.lane,
    }
    const actorStateBefore = snapshotCombatantState(combatant)

    combatant.x = destination.x
    combatant.y = destination.y
    combatant.facing = destination.facing
    movedCount += 1
    addPhaseEvent(phase, `${combatant.name} сближается с ${nearestEnemy.name}.`)
    const actorStateAfter = snapshotCombatantState(combatant)
    phase.actions.push({
      type: 'movement',
      actorId: combatant.entityId,
      actorName: combatant.name,
      actorStateBefore,
      actorStateAfter,
      summary: `${combatant.name} сближается с ${nearestEnemy.name}.`,
      details: buildMovementDetails({ actorName: combatant.name, actorStateBefore, actorStateAfter, from, to: {
        x: combatant.x,
        y: combatant.y,
        facing: combatant.facing,
        row: combatant.row,
        lane: combatant.lane,
      } }),
      from,
      to: {
        x: combatant.x,
        y: combatant.y,
        facing: combatant.facing,
        row: combatant.row,
        lane: combatant.lane,
      },
      snapshot: snapshotBattlefieldState([actingSide, targetSide]),
    })
  })

  if (movedCount === 0) {
    addPhaseEvent(phase, 'Строй удерживает позиции.')
  }

  phase.snapshot = snapshotBattlefieldState([actingSide, targetSide])

  return phase
}

function findNearestEnemy(combatant, enemies) {
  const living = enemies.filter((entry) => entry.currentHealth > 0)
  if (living.length === 0) {
    return null
  }

  return [...living].sort((left, right) => getDistanceBetweenUnits(combatant, left) - getDistanceBetweenUnits(combatant, right))[0]
}

function buildMovementDetails({ actorName, actorStateBefore, actorStateAfter, from, to }) {
  return [
    `${actorName} до движения: ${actorStateBefore.row}/${actorStateBefore.lane}, facing ${actorStateBefore.facing}, HP ${actorStateBefore.currentHealth}/${actorStateBefore.maxHealth}, моделей ${actorStateBefore.modelsRemaining}`,
    `Маршрут: (${formatPoint(from.x)}, ${formatPoint(from.y)}) -> (${formatPoint(to.x)}, ${formatPoint(to.y)})`,
    `${actorName} после движения: ${actorStateAfter.row}/${actorStateAfter.lane}, facing ${actorStateAfter.facing}, HP ${actorStateAfter.currentHealth}/${actorStateAfter.maxHealth}, моделей ${actorStateAfter.modelsRemaining}`,
  ]
}

function formatPoint(value) {
  return Number(value).toFixed(1)
}