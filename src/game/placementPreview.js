import {
  battlefieldConfig,
  getFrontCenter,
  getShortestFacingDelta,
  getUnitCorners,
  getUnitDimensions,
  rectanglesOverlap,
} from './battlefield'

const ARC_SAMPLE_STEPS = 14

function toBoardPoint(point) {
  return {
    x: point.x + 0.5,
    y: point.y + 0.5,
  }
}

export function getBoardBounds(boardWidth = battlefieldConfig.width, boardHeight = battlefieldConfig.height, interactiveZone = null) {
  if (!interactiveZone) {
    return {
      minX: -0.5,
      maxX: boardWidth - 0.5,
      minY: -0.5,
      maxY: boardHeight - 0.5,
    }
  }

  return {
    minX: interactiveZone.xMin - 0.5,
    maxX: interactiveZone.xMax + 0.5,
    minY: interactiveZone.yMin - 0.5,
    maxY: interactiveZone.yMax + 0.5,
  }
}

export function getFootprintGeometry(unit) {
  const corners = getUnitCorners(unit)
  const [frontLeft, frontRight, rearRight, rearLeft] = corners

  return {
    corners,
    edges: {
      front: [frontLeft, frontRight],
      right: [frontRight, rearRight],
      rear: [rearRight, rearLeft],
      left: [rearLeft, frontLeft],
    },
    boardCorners: corners.map(toBoardPoint),
    boardCenter: toBoardPoint(unit),
    boardFrontCenter: toBoardPoint(getFrontCenter(unit)),
  }
}

export function getFacingZonePolygons(unit, radius = Math.max(unit.baseWidth ?? 1, unit.baseDepth ?? 1) * 2.8) {
  return {
    front: getSectorPolygon(unit, -60, 60, radius),
    right: getSectorPolygon(unit, 60, 120, radius),
    rear: getSectorPolygon(unit, 120, 240, radius),
    left: getSectorPolygon(unit, 240, 300, radius),
  }
}

export function buildSectorPolygon(unit, startOffset, endOffset, radius) {
  return getSectorPolygon(unit, startOffset, endOffset, radius)
}

export function getRotateHandlePositions(unit) {
  const { halfWidth } = getUnitDimensions(unit)
  const geometry = getFootprintGeometry(unit)
  const frontCenter = geometry.boardFrontCenter
  const offset = halfWidth + 0.7
  const radians = unit.facing * (Math.PI / 180)
  const rightX = Math.cos(radians + Math.PI / 2)
  const rightY = Math.sin(radians + Math.PI / 2)

  return {
    left: {
      x: frontCenter.x - rightX * offset,
      y: frontCenter.y - rightY * offset,
    },
    right: {
      x: frontCenter.x + rightX * offset,
      y: frontCenter.y + rightY * offset,
    },
  }
}

export function getPlacementDiagnostics({
  candidate,
  units,
  interactiveZone = null,
  boardWidth = battlefieldConfig.width,
  boardHeight = battlefieldConfig.height,
  ignoreEntityId = null,
}) {
  const bounds = getBoardBounds(boardWidth, boardHeight, interactiveZone)
  const corners = getUnitCorners(candidate)
  const overlapUnits = units.filter((unit) => unit.entityId !== ignoreEntityId && unit.entityId !== candidate.entityId && rectanglesOverlap(candidate, unit))
  const outOfBounds = corners.some((corner) => corner.x < bounds.minX || corner.x > bounds.maxX || corner.y < bounds.minY || corner.y > bounds.maxY)
  const reasons = []

  if (outOfBounds) {
    reasons.push(interactiveZone ? 'Footprint выходит за пределы deployment zone.' : 'Footprint выходит за границы поля.')
  }

  if (overlapUnits.length > 0) {
    reasons.push(`Footprint перекрывает ${overlapUnits.map((unit) => unit.name).join(', ')}.`)
  }

  return {
    isLegal: reasons.length === 0,
    overlapUnits,
    outOfBounds,
    reasons,
  }
}

export function getWheelSweepDiagnostics({
  candidate,
  fromFacing,
  toFacing,
  units,
  interactiveZone = null,
  boardWidth = battlefieldConfig.width,
  boardHeight = battlefieldConfig.height,
  ignoreEntityId = null,
}) {
  const delta = getShortestFacingDelta(fromFacing, toFacing)

  if (delta === 0) {
    return { isBlocked: false, reasons: [] }
  }

  const steps = Math.max(3, Math.ceil(Math.abs(delta) / 15))

  for (let step = 1; step <= steps; step += 1) {
    const facing = fromFacing + (delta * step) / steps
    const diagnostics = getPlacementDiagnostics({
      candidate: { ...candidate, facing },
      units,
      interactiveZone,
      boardWidth,
      boardHeight,
      ignoreEntityId,
    })

    if (!diagnostics.isLegal) {
      return {
        isBlocked: true,
        reasons: [`Wheel блокируется на ${Math.round(facing)}°.`],
        blockingPlacement: diagnostics,
      }
    }
  }

  return { isBlocked: false, reasons: [] }
}

export function getPreviewOverlay({ origin, preview }) {
  if (!origin || !preview) {
    return null
  }

  const turnDelta = getShortestFacingDelta(origin.facing, preview.facing)
  const radius = Math.max(0.85, Math.max(preview.baseWidth ?? 1, preview.baseDepth ?? 1) * 0.9)

  return {
    path: {
      start: toBoardPoint(origin),
      end: toBoardPoint(preview),
    },
    wheelArc: Math.abs(turnDelta) > 0
      ? buildArcPath({
          origin: toBoardPoint(preview),
          fromAngle: origin.facing,
          toAngle: preview.facing,
          radius,
        })
      : null,
  }
}

function getSectorPolygon(unit, startOffset, endOffset, radius) {
  const points = [toBoardPoint(unit)]

  for (let index = 0; index <= ARC_SAMPLE_STEPS; index += 1) {
    const progress = index / ARC_SAMPLE_STEPS
    const angle = unit.facing + startOffset + (endOffset - startOffset) * progress
    const radians = angle * (Math.PI / 180)
    points.push({
      x: unit.x + Math.cos(radians) * radius + 0.5,
      y: unit.y + Math.sin(radians) * radius + 0.5,
    })
  }

  return points
}

function buildArcPath({ origin, fromAngle, toAngle, radius }) {
  const delta = getShortestFacingDelta(fromAngle, toAngle)
  const sweepFlag = delta >= 0 ? 1 : 0
  const largeArcFlag = Math.abs(delta) > 180 ? 1 : 0
  const start = getArcPoint(origin, fromAngle, radius)
  const end = getArcPoint(origin, toAngle, radius)

  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}`
}

function getArcPoint(origin, angle, radius) {
  const radians = angle * (Math.PI / 180)
  return {
    x: origin.x + Math.cos(radians) * radius,
    y: origin.y + Math.sin(radians) * radius,
  }
}