import { battlefieldConfig, normalizeFacing } from '../battlefield'

/** Board side of the local player in absolute world coords, or null when spectating. */
export function localBoardSide(battle, focusPlayerId) {
  if (focusPlayerId == null) {
    return null
  }

  if (battle?.left?.playerId === focusPlayerId) {
    return 'left'
  }

  if (battle?.right?.playerId === focusPlayerId) {
    return 'right'
  }

  return null
}

/** Flip when the local player is on the absolute right so they appear on the left of the screen. */
export function shouldFlipForViewer(localSide) {
  return localSide === 'right'
}

/** Same math as backend Geometry::Battlefield.mirror_deployment. */
export function toViewerPose(pose, { width = battlefieldConfig.width, height = battlefieldConfig.height } = {}) {
  if (!pose || typeof pose.x !== 'number' || typeof pose.y !== 'number') {
    return pose
  }

  const next = {
    ...pose,
    x: width - 1 - pose.x,
    y: height - 1 - pose.y,
  }

  if (pose.facing != null) {
    next.facing = normalizeFacing(pose.facing + 180)
  }

  return next
}

export function projectUnitsToViewer(units, flip, config) {
  if (!flip) {
    return units
  }

  return (units ?? []).map((unit) => ({
    ...unit,
    ...toViewerPose(unit, config),
  }))
}

/**
 * Flip motion samples used by HTML WAAPI. Other overlay geometry stays in world space
 * and is mirrored via an SVG transform on the board overlay.
 */
export function projectOverlayToViewer(overlay, flip, config) {
  if (!flip || !overlay) {
    return overlay
  }

  const unitMotions = overlay.unitMotions
  if (!unitMotions) {
    return overlay
  }

  const nextMotions = {}
  for (const [entityId, motion] of Object.entries(unitMotions)) {
    nextMotions[entityId] = {
      ...motion,
      samples: (motion.samples ?? []).map((sample) => toViewerPose(sample, config)),
    }
  }

  return {
    ...overlay,
    unitMotions: nextMotions,
  }
}
