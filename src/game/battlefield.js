import { laneOrder, rowOrder } from './constants'

export const battlefieldConfig = {
  width: 32,
  height: 24,
  deploymentDepth: 10,
  frontArcDegrees: 120,
  wheelStepDegrees: 45,
  contactPadding: 0.35,
  blastRadius: 1.6,
  volleyRadius: 1.4,
}

function createLaneAnchors() {
  const segment = Math.floor(battlefieldConfig.height / 3)

  return {
    left: Math.max(1, Math.floor(segment / 2)),
    center: Math.floor(battlefieldConfig.height / 2),
    right: Math.min(battlefieldConfig.height - 2, segment * 2 + Math.floor(segment / 2)),
  }
}

function createRowAnchors() {
  return {
    reserve: 0,
    rear: Math.max(1, Math.floor(battlefieldConfig.deploymentDepth * 0.2)),
    support: Math.max(2, Math.floor(battlefieldConfig.deploymentDepth * 0.4)),
    front: Math.max(3, battlefieldConfig.deploymentDepth - 2),
  }
}

const laneAnchors = createLaneAnchors()
const rowAnchors = createRowAnchors()

export function normalizeFacing(value) {
  return ((value % 360) + 360) % 360
}

export function rotateFacing(facing, delta) {
  return normalizeFacing(facing + delta)
}

export function getFacingVector(facing) {
  const radians = normalizeFacing(facing) * (Math.PI / 180)
  return {
    x: Math.cos(radians),
    y: Math.sin(radians),
  }
}

export function getRightVector(facing) {
  const radians = normalizeFacing(facing + 90) * (Math.PI / 180)
  return {
    x: Math.cos(radians),
    y: Math.sin(radians),
  }
}

export function getFacingLabel(facing) {
  const normalized = normalizeFacing(facing)

  if (normalized >= 337.5 || normalized < 22.5) {
    return 'Восток'
  }

  if (normalized < 67.5) {
    return 'Юго-восток'
  }

  if (normalized < 112.5) {
    return 'Юг'
  }

  if (normalized < 157.5) {
    return 'Юго-запад'
  }

  if (normalized < 202.5) {
    return 'Запад'
  }

  if (normalized < 247.5) {
    return 'Северо-запад'
  }

  if (normalized < 292.5) {
    return 'Север'
  }

  return 'Северо-восток'
}

export function createDefaultDeployment(row = 'reserve', lane = 'center') {
  return {
    x: rowAnchors[row] ?? rowAnchors.reserve,
    y: laneAnchors[lane] ?? laneAnchors.center,
    facing: 0,
  }
}

export function clampDeploymentPosition(position) {
  return {
    x: Math.max(0, Math.min(battlefieldConfig.deploymentDepth - 1, Math.round(position.x))),
    y: Math.max(0, Math.min(battlefieldConfig.height - 1, Math.round(position.y))),
    facing: normalizeFacing(position.facing),
  }
}

export function clampBattlefieldPosition(position) {
  return {
    x: Math.max(0, Math.min(battlefieldConfig.width - 1, position.x)),
    y: Math.max(0, Math.min(battlefieldConfig.height - 1, position.y)),
    facing: normalizeFacing(position.facing),
  }
}

export function syncFormationSlotsFromDeployment(position) {
  const laneBoundary = battlefieldConfig.height / 3
  const lane = position.y < laneBoundary ? laneOrder[0] : position.y < laneBoundary * 2 ? laneOrder[1] : laneOrder[2]

  const reserveLimit = Math.max(0, Math.floor(battlefieldConfig.deploymentDepth * 0.15) - 1)
  const rearLimit = Math.max(reserveLimit + 1, Math.floor(battlefieldConfig.deploymentDepth * 0.3) - 1)
  const supportLimit = Math.max(rearLimit + 1, Math.floor(battlefieldConfig.deploymentDepth * 0.5) - 1)

  if (position.x <= reserveLimit) {
    return { lane, row: rowOrder[3] }
  }

  if (position.x <= rearLimit) {
    return { lane, row: rowOrder[2] }
  }

  if (position.x <= supportLimit) {
    return { lane, row: rowOrder[1] }
  }

  return { lane, row: rowOrder[0] }
}

export function mirrorDeployment(position) {
  return {
    x: battlefieldConfig.width - 1 - position.x,
    y: battlefieldConfig.height - 1 - position.y,
    facing: normalizeFacing(position.facing + 180),
  }
}

export function createBattlePosition(position, sideIndex) {
  const local = clampDeploymentPosition(position)
  return sideIndex === 0 ? local : mirrorDeployment(local)
}

export function getAngleBetween(facing, from, to) {
  const forward = getFacingVector(facing)
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy) || 1
  const dot = (forward.x * dx + forward.y * dy) / length
  const clampedDot = Math.max(-1, Math.min(1, dot))
  return Math.acos(clampedDot) * (180 / Math.PI)
}

export function isInFrontArc(origin, target, facing, arc = battlefieldConfig.frontArcDegrees) {
  return getAngleBetween(facing, origin, target) <= arc / 2
}

export function getDistanceBetween(left, right) {
  return Math.hypot(right.x - left.x, right.y - left.y)
}

export function getHeadingTo(origin, target) {
  return normalizeFacing(Math.atan2(target.y - origin.y, target.x - origin.x) * (180 / Math.PI))
}

export function getShortestFacingDelta(fromFacing, toFacing) {
  const delta = normalizeFacing(toFacing) - normalizeFacing(fromFacing)

  if (delta > 180) {
    return delta - 360
  }

  if (delta < -180) {
    return delta + 360
  }

  return delta
}

export function moveAlongFacing(position, distance) {
  const vector = getFacingVector(position.facing)
  return {
    ...position,
    x: position.x + vector.x * distance,
    y: position.y + vector.y * distance,
  }
}

export function getUnitDimensions(unit) {
  return {
    halfWidth: Math.max(0.5, (unit.baseWidth ?? unit.width ?? 1) / 2),
    halfDepth: Math.max(0.5, (unit.baseDepth ?? unit.depth ?? 1) / 2),
  }
}

export function getUnitCorners(unit) {
  const { halfWidth, halfDepth } = getUnitDimensions(unit)
  const forward = getFacingVector(unit.facing)
  const right = getRightVector(unit.facing)

  return [
    {
      x: unit.x + forward.x * halfDepth - right.x * halfWidth,
      y: unit.y + forward.y * halfDepth - right.y * halfWidth,
    },
    {
      x: unit.x + forward.x * halfDepth + right.x * halfWidth,
      y: unit.y + forward.y * halfDepth + right.y * halfWidth,
    },
    {
      x: unit.x - forward.x * halfDepth + right.x * halfWidth,
      y: unit.y - forward.y * halfDepth + right.y * halfWidth,
    },
    {
      x: unit.x - forward.x * halfDepth - right.x * halfWidth,
      y: unit.y - forward.y * halfDepth - right.y * halfWidth,
    },
  ]
}

export function getFrontCenter(unit) {
  const { halfDepth } = getUnitDimensions(unit)
  const forward = getFacingVector(unit.facing)
  return {
    x: unit.x + forward.x * halfDepth,
    y: unit.y + forward.y * halfDepth,
  }
}

export function getRearCenter(unit) {
  const { halfDepth } = getUnitDimensions(unit)
  const forward = getFacingVector(unit.facing)
  return {
    x: unit.x - forward.x * halfDepth,
    y: unit.y - forward.y * halfDepth,
  }
}

export function getPointInLocalUnitSpace(point, unit) {
  const forward = getFacingVector(unit.facing)
  const right = getRightVector(unit.facing)
  const dx = point.x - unit.x
  const dy = point.y - unit.y

  return {
    lateral: dx * right.x + dy * right.y,
    longitudinal: dx * forward.x + dy * forward.y,
  }
}

export function isPointInsideUnit(point, unit) {
  const { halfWidth, halfDepth } = getUnitDimensions(unit)
  const local = getPointInLocalUnitSpace(point, unit)
  return Math.abs(local.lateral) <= halfWidth && Math.abs(local.longitudinal) <= halfDepth
}

export function getClosestPointOnUnit(point, unit) {
  const { halfWidth, halfDepth } = getUnitDimensions(unit)
  const forward = getFacingVector(unit.facing)
  const right = getRightVector(unit.facing)
  const local = getPointInLocalUnitSpace(point, unit)
  const clampedLateral = Math.max(-halfWidth, Math.min(halfWidth, local.lateral))
  const clampedLongitudinal = Math.max(-halfDepth, Math.min(halfDepth, local.longitudinal))

  return {
    x: unit.x + right.x * clampedLateral + forward.x * clampedLongitudinal,
    y: unit.y + right.y * clampedLateral + forward.y * clampedLongitudinal,
  }
}

export function getDistancePointToSegment(point, segmentStart, segmentEnd) {
  const dx = segmentEnd.x - segmentStart.x
  const dy = segmentEnd.y - segmentStart.y
  const lengthSquared = dx * dx + dy * dy

  if (lengthSquared === 0) {
    return getDistanceBetween(point, segmentStart)
  }

  const projection = ((point.x - segmentStart.x) * dx + (point.y - segmentStart.y) * dy) / lengthSquared
  const t = Math.max(0, Math.min(1, projection))
  const closest = {
    x: segmentStart.x + dx * t,
    y: segmentStart.y + dy * t,
  }

  return getDistanceBetween(point, closest)
}

export function getUnitEdges(unit) {
  const corners = getUnitCorners(unit)
  return corners.map((corner, index) => [corner, corners[(index + 1) % corners.length]])
}

export function getDistanceBetweenUnits(left, right) {
  if (rectanglesOverlap(left, right)) {
    return 0
  }

  let minDistance = Infinity

  getUnitCorners(left).forEach((corner) => {
    getUnitEdges(right).forEach(([start, end]) => {
      minDistance = Math.min(minDistance, getDistancePointToSegment(corner, start, end))
    })
  })

  getUnitCorners(right).forEach((corner) => {
    getUnitEdges(left).forEach(([start, end]) => {
      minDistance = Math.min(minDistance, getDistancePointToSegment(corner, start, end))
    })
  })

  return minDistance
}

export function rectanglesOverlap(left, right) {
  const axes = [...getSeparatingAxes(left), ...getSeparatingAxes(right)]
  return axes.every((axis) => {
    const leftProjection = projectUnitOntoAxis(left, axis)
    const rightProjection = projectUnitOntoAxis(right, axis)
    return leftProjection.max >= rightProjection.min && rightProjection.max >= leftProjection.min
  })
}

export function getChargeDestination(attacker, defender, facing = getHeadingTo(attacker, defender)) {
  const forward = getFacingVector(facing)
  const attackerDimensions = getUnitDimensions({ ...attacker, facing })
  const impactPoint = getClosestPointOnUnit(attacker, defender)

  return clampBattlefieldPosition({
    x: impactPoint.x - forward.x * (attackerDimensions.halfDepth + battlefieldConfig.contactPadding),
    y: impactPoint.y - forward.y * (attackerDimensions.halfDepth + battlefieldConfig.contactPadding),
    facing,
  })
}

export function wheelUnit(unit, delta, distance = 0) {
  const corners = getUnitCorners(unit)
  const pivot = delta >= 0 ? corners[0] : corners[1]
  const nextFacing = rotateFacing(unit.facing, delta)
  const nextForward = getFacingVector(nextFacing)
  const nextRight = getRightVector(nextFacing)
  const { halfWidth, halfDepth } = getUnitDimensions(unit)
  const pivotSign = delta >= 0 ? -1 : 1
  const pivotAdjusted = {
    x: pivot.x - nextForward.x * halfDepth + nextRight.x * halfWidth * pivotSign,
    y: pivot.y - nextForward.y * halfDepth + nextRight.y * halfWidth * pivotSign,
    facing: nextFacing,
  }

  return clampBattlefieldPosition(moveAlongFacing(pivotAdjusted, distance))
}

export function hasLineOfSight(attacker, defender, blockers) {
  return getLineOfSightBlockers(attacker, defender, blockers).length === 0
}

export function getLineOfSightBlockers(attacker, defender, blockers) {
  const lineStart = getFrontCenter(attacker)
  const lineEnd = getClosestPointOnUnit(lineStart, defender)

  return blockers.filter((blocker) => {
    if (blocker.entityId === attacker.entityId || blocker.entityId === defender.entityId || blocker.currentHealth <= 0) {
      return false
    }

    return lineIntersectsUnit(lineStart, lineEnd, blocker)
  })
}

export function getAttackTemplate(attacker, attackType) {
  return attackType === 'magic' ? attacker.spellTemplate : attacker.shootingTemplate
}

export function getAttackVictims(attacker, primaryTarget, enemies, attackType) {
  const template = getAttackTemplate(attacker, attackType)
  const living = enemies.filter((entry) => entry.currentHealth > 0)

  if (template === 'volley') {
    const victims = living
      .filter((entry) => getDistanceBetween(entry, primaryTarget) <= battlefieldConfig.volleyRadius)
      .sort((left, right) => getDistanceBetween(left, primaryTarget) - getDistanceBetween(right, primaryTarget))
      .slice(0, 2)

    return victims.map((entry, index) => ({ target: entry, multiplier: index === 0 ? 1 : 0.65 }))
  }

  if (template === 'blast') {
    return living
      .filter((entry) => getDistanceBetween(entry, primaryTarget) <= battlefieldConfig.blastRadius)
      .map((entry) => ({ target: entry, multiplier: entry.entityId === primaryTarget.entityId ? 1 : 0.75 }))
  }

  if (template === 'breath') {
    return living
      .filter((entry) => isInFrontArc(attacker, entry, attacker.facing, 70))
      .filter((entry) => getDistanceBetween(attacker, entry) <= getDistanceBetween(attacker, primaryTarget) + 1.5)
      .map((entry) => ({ target: entry, multiplier: entry.entityId === primaryTarget.entityId ? 1 : 0.85 }))
  }

  return [{ target: primaryTarget, multiplier: 1 }]
}

function getSeparatingAxes(unit) {
  const forward = getFacingVector(unit.facing)
  const right = getRightVector(unit.facing)
  return [forward, right]
}

function projectUnitOntoAxis(unit, axis) {
  const points = getUnitCorners(unit)
  const dots = points.map((point) => point.x * axis.x + point.y * axis.y)
  return {
    min: Math.min(...dots),
    max: Math.max(...dots),
  }
}

function lineIntersectsUnit(start, end, unit) {
  if (isPointInsideUnit(start, unit) || isPointInsideUnit(end, unit)) {
    return true
  }

  return getUnitEdges(unit).some(([edgeStart, edgeEnd]) => segmentsIntersect(start, end, edgeStart, edgeEnd))
}

function segmentsIntersect(leftStart, leftEnd, rightStart, rightEnd) {
  const leftOrientationA = orientation(leftStart, leftEnd, rightStart)
  const leftOrientationB = orientation(leftStart, leftEnd, rightEnd)
  const rightOrientationA = orientation(rightStart, rightEnd, leftStart)
  const rightOrientationB = orientation(rightStart, rightEnd, leftEnd)

  if (leftOrientationA !== leftOrientationB && rightOrientationA !== rightOrientationB) {
    return true
  }

  return false
}

function orientation(start, middle, end) {
  const value = (middle.y - start.y) * (end.x - middle.x) - (middle.x - start.x) * (end.y - middle.y)
  if (Math.abs(value) < 0.0001) {
    return 0
  }

  return value > 0 ? 1 : 2
}

export function classifyAttackVector(attacker, defender) {
  const angle = getAngleBetween(defender.facing, defender, attacker)

  if (angle <= 60) {
    return 'front'
  }

  if (angle >= 120) {
    return 'rear'
  }

  return 'flank'
}