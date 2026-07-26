import { laneOrder, rowOrder } from './constants'

export const battlefieldConfig = {
  width: 40,
  height: 24,
  deploymentDepth: 10,
  frontArcDegrees: 120,
  wheelStepDegrees: 45,
  contactPadding: 0.35,
  meleeContactTolerance: 0.4,
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

/** Continuous (unnormalized) facing for CSS angle transitions along the shortest arc. */
export function advanceContinuousFacing(previousDisplayFacing, targetFacing, { snap = false } = {}) {
  const normalizedTarget = normalizeFacing(targetFacing)
  if (previousDisplayFacing == null || snap) {
    return normalizedTarget
  }

  return previousDisplayFacing + getShortestFacingDelta(previousDisplayFacing, normalizedTarget)
}

export function getUnitDimensions(unit) {
  return {
    halfWidth: Math.max(0, (unit.baseWidth ?? unit.width ?? 0) / 2),
    halfDepth: Math.max(0, (unit.baseDepth ?? unit.depth ?? 0) / 2),
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

/** Front-right for positive (right) wheel, front-left for negative (left) wheel. */
export function getWheelPivot(unit, delta) {
  const corners = getUnitCorners(unit)
  return delta < 0 ? corners[0] : corners[1]
}

/** Rotate unit center around the chosen front corner by delta degrees. */
export function getWheelPose(unit, delta) {
  if (Math.abs(delta) < 0.0001) {
    return {
      x: unit.x,
      y: unit.y,
      facing: normalizeFacing(unit.facing),
    }
  }

  const pivot = getWheelPivot(unit, delta)
  const radians = delta * (Math.PI / 180)
  const cosA = Math.cos(radians)
  const sinA = Math.sin(radians)
  const vx = unit.x - pivot.x
  const vy = unit.y - pivot.y

  return {
    x: pivot.x + vx * cosA - vy * sinA,
    y: pivot.y + vx * sinA + vy * cosA,
    facing: normalizeFacing(unit.facing + delta),
  }
}

export function sampleWheelPoses(unit, delta, steps = 10) {
  const samples = []
  const count = Math.max(2, steps)

  for (let index = 0; index <= count; index += 1) {
    samples.push(getWheelPose(unit, (delta * index) / count))
  }

  return samples
}

export function rectanglesOverlap(left, right) {
  const axes = [...getSeparatingAxes(left), ...getSeparatingAxes(right)]
  return axes.every((axis) => {
    const leftProjection = projectUnitOntoAxis(left, axis)
    const rightProjection = projectUnitOntoAxis(right, axis)
    return leftProjection.max >= rightProjection.min && rightProjection.max >= leftProjection.min
  })
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
