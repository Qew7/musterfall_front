import { sampleWheelPoses } from '../battlefield'
import { buildCenterWheelArcPath, buildSectorPolygon, getPreviewOverlay } from '../placementPreview'

const WHEEL_MOTION_DURATION_MS = 600
const WHEEL_SAMPLE_STEPS = 12

export function projectBattleReplay({ battle, initialSnapshot }) {
  const frames = [
    {
      id: 'deployment',
      phaseType: 'deployment',
      label: 'Исходная расстановка',
      summary: 'Отряды занимают позиции перед первым ходом.',
      logEntries: ['Отряды занимают позиции перед первым ходом.'],
      units: initialSnapshot,
      overlay: null,
      durationMs: 1000,
    },
  ]

  battle.rounds.forEach((round) => {
    round.turns.forEach((turn) => {
      turn.phases.forEach((phase, phaseIndex) => {
        if (phase.actions.length === 0) {
          frames.push({
            id: `${round.number}-${turn.playerId}-${phase.type}-${phaseIndex}`,
            phaseType: phase.type,
            label: `Раунд ${round.number} · ${turn.playerName} · ${phase.label}`,
            summary: phase.events[0] ?? 'Фаза без результата.',
            logEntries: phase.events,
            devLogEntries: phase.events,
            units: phase.snapshot ?? frames.at(-1)?.units ?? initialSnapshot,
            overlay: null,
            durationMs: 1000,
          })
          return
        }

        if (phase.type === 'movement') {
          pushMovementFrames(frames, {
            round,
            turn,
            phase,
            phaseIndex,
            previousUnits: frames.at(-1)?.units ?? initialSnapshot,
          })
          return
        }

        // Атаки (melee, shooting, magic): каждое действие — отдельный кадр, поочередно
        phase.actions.forEach((action, actionIndex) => {
          const summary = action.summary ?? summarizeAction(action, phase.type)
          frames.push({
            id: `${round.number}-${turn.playerId}-${phase.type}-${phaseIndex}-${actionIndex}`,
            phaseType: phase.type,
            label: `Раунд ${round.number} · ${turn.playerName} · ${phase.label}`,
            summary,
            logEntries: [summary],
            devLogEntries: Array.isArray(action.details) && action.details.length > 0 ? action.details : [summary],
            units: action.snapshot,
            overlay: projectActionOverlay(action, action.snapshot),
            durationMs: 1000,
          })
        })
      })
    })
  })

  return { frames }
}

function pushMovementFrames(frames, { round, turn, phase, phaseIndex, previousUnits }) {
  let currentUnits = previousUnits
  const base = {
    phaseType: 'movement',
    label: `Раунд ${round.number} · ${turn.playerName} · ${phase.label}`,
  }

  phase.actions.forEach((action, actionIndex) => {
    const summary = action.summary ?? summarizeAction(action, phase.type)
    const details = Array.isArray(action.details) && action.details.length > 0
      ? action.details
      : [summary]
    const hasWheel = Math.abs(action.wheel?.delta ?? 0) > 0.05
    const marchStart = hasWheel
      ? { x: action.wheel.x, y: action.wheel.y, facing: action.wheel.facing }
      : action.from
    const hasMarch = Boolean(
      marchStart
      && action.to
      && Math.hypot(action.to.x - marchStart.x, action.to.y - marchStart.y) > 0.05,
    )
    const frameMeta = {
      ...base,
      summary,
      logEntries: [summary],
      devLogEntries: details,
    }

    if (hasWheel) {
      const wheelUnits = applyWheelWaypoints(currentUnits, [action])
      frames.push({
        ...frameMeta,
        id: `${round.number}-${turn.playerId}-${phase.type}-${phaseIndex}-${actionIndex}-wheel`,
        units: wheelUnits,
        overlay: buildMovementWheelOverlay([action], currentUnits),
        durationMs: WHEEL_MOTION_DURATION_MS + 80,
      })
      currentUnits = wheelUnits
      // Avoid duplicating the same summary on the march subframe.
      frameMeta.logEntries = []
      frameMeta.devLogEntries = []
    }

    frames.push({
      ...frameMeta,
      id: `${round.number}-${turn.playerId}-${phase.type}-${phaseIndex}-${actionIndex}`,
      units: action.snapshot,
      overlay: hasMarch ? buildMovementMarchOverlay([action]) : null,
      durationMs: hasMarch ? 1000 : hasWheel ? 220 : 700,
    })
    currentUnits = action.snapshot ?? currentUnits
  })
}

function applyWheelWaypoints(previousUnits, actions) {
  const byId = new Map((previousUnits ?? []).map((unit) => [unit.entityId, { ...unit }]))

  actions.forEach((action) => {
    const current = byId.get(action.actorId)
    if (!current) {
      return
    }

    if (!action.wheel || Math.abs(action.wheel.delta) <= 0.05) {
      return
    }

    byId.set(action.actorId, {
      ...current,
      x: action.wheel.x,
      y: action.wheel.y,
      facing: action.wheel.facing,
      row: action.to?.row ?? current.row,
      lane: action.to?.lane ?? current.lane,
    })
  })

  return (previousUnits ?? []).map((unit) => byId.get(unit.entityId) ?? unit)
}

function buildMovementWheelOverlay(actions, previousUnits) {
  const byId = new Map((previousUnits ?? []).map((unit) => [unit.entityId, unit]))
  const unitMotions = {}
  const wheelArcs = []
  let activeUnitId = null

  actions.forEach((action) => {
    const delta = action.wheel?.delta ?? 0
    if (Math.abs(delta) <= 0.05 || !action.from) {
      return
    }

    const previous = byId.get(action.actorId)
    const origin = {
      x: action.from.x,
      y: action.from.y,
      facing: action.from.facing,
      baseWidth: previous?.baseWidth ?? 1,
      baseDepth: previous?.baseDepth ?? 1,
    }
    const samples = sampleWheelPoses(origin, delta, WHEEL_SAMPLE_STEPS)
    unitMotions[action.actorId] = {
      kind: 'wheel',
      durationMs: WHEEL_MOTION_DURATION_MS,
      samples,
    }
    const arc = buildCenterWheelArcPath(origin, delta)
    if (arc) {
      wheelArcs.push(arc)
    }
    activeUnitId = action.actorId
  })

  if (Object.keys(unitMotions).length === 0) {
    return null
  }

  return {
    activeUnitId,
    path: null,
    wheelArc: wheelArcs[0] ?? null,
    wheelArcs,
    unitMotions,
    targetIds: [],
    affectedIds: [],
    blockedIds: [],
    template: null,
    contactVector: null,
    contactTargetId: null,
    los: null,
  }
}

function buildMovementMarchOverlay(actions) {
  const marched = actions.find((action) => {
    if (!action.from || !action.to) {
      return false
    }
    if (action.wheel && Math.abs(action.wheel.delta) > 0.05) {
      const wx = action.wheel.x - action.to.x
      const wy = action.wheel.y - action.to.y
      return Math.hypot(wx, wy) > 0.05
    }
    return Math.hypot(action.to.x - action.from.x, action.to.y - action.from.y) > 0.05
  })

  if (!marched) {
    return null
  }

  const start = marched.wheel && Math.abs(marched.wheel.delta) > 0.05
    ? { x: marched.wheel.x, y: marched.wheel.y, facing: marched.wheel.facing }
    : marched.from

  return {
    activeUnitId: marched.actorId,
    path: { start, end: marched.to },
    wheelArc: null,
    wheelArcs: [],
    unitMotions: {
      [marched.actorId]: {
        kind: 'march',
        durationMs: 550,
        samples: [
          { x: start.x, y: start.y, facing: start.facing },
          { x: marched.to.x, y: marched.to.y, facing: marched.to.facing },
        ],
      },
    },
    targetIds: [],
    affectedIds: [],
    blockedIds: [],
    template: null,
    contactVector: null,
    contactTargetId: null,
    los: null,
  }
}

function summarizeAction(action, phaseType) {
  const actorLabel = describeActor(action)

  if (phaseType === 'movement') {
    return `${actorLabel} перестраивается: ${action.from.row} -> ${action.to.row}.`
  }

  if (phaseType === 'melee') {
    return `${actorLabel} входит в ${describeVector(action.vector)} ${action.targetName} и наносит ${action.damage} урона.`
  }

  if (phaseType === 'shooting') {
    return `${actorLabel} стреляет по ${action.targetName}; затронуто целей: ${action.affectedIds.length}.`
  }

  if (phaseType === 'magic') {
    return `${actorLabel} атакует ${action.targetName} магией; затронуто целей: ${action.affectedIds.length}.`
  }

  return actorLabel
}

function projectActionOverlay(action, units) {
  const unitById = new Map(units.map((unit) => [unit.entityId, unit]))
  const actor = unitById.get(action.actorId)
  const target = action.targetId ? unitById.get(action.targetId) : null

  const chargeOrigin = action.charge
    ? {
        ...action.charge.start,
        baseWidth: actor?.baseWidth ?? 1,
        baseDepth: actor?.baseDepth ?? 1,
      }
    : null
  const chargePreview = action.charge
    ? {
        ...action.charge.destination,
        baseWidth: actor?.baseWidth ?? 1,
        baseDepth: actor?.baseDepth ?? 1,
      }
    : null

  return {
    activeUnitId: action.actorUnitId ?? action.actorId,
    path: action.charge ? { start: action.charge.start, end: action.charge.destination } : action.template?.shape === 'line' ? action.template : null,
    wheelArc: chargeOrigin && chargePreview ? getPreviewOverlay({ origin: chargeOrigin, preview: chargePreview })?.wheelArc ?? null : null,
    targetIds: target ? [target.entityId] : [],
    affectedIds: action.affectedIds ?? [],
    blockedIds: action.blockers ?? [],
    template: projectTemplate(action.template),
    contactVector: action.vector ?? null,
    contactTargetId: action.targetId ?? null,
    los: actor && target
      ? {
          start: { x: actor.x, y: actor.y },
          end: { x: target.x, y: target.y },
          blocked: (action.blockers ?? []).length > 0,
          blockerIds: action.blockers ?? [],
        }
      : null,
  }
}

function describeActor(action) {
  return action.actorRole === 'hero' ? `Герой ${action.actorName}` : `Отряд ${action.actorName}`
}

function projectTemplate(template) {
  if (!template) {
    return null
  }

  if (template.shape === 'cone') {
    return {
      ...template,
      polygon: buildSectorPolygon({ x: template.origin.x, y: template.origin.y, facing: template.facing }, -35, 35, template.radius),
    }
  }

  return template
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
