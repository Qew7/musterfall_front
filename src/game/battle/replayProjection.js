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
  const actions = phase.actions
  const summaries = actions.map((action) => action.summary ?? summarizeAction(action, phase.type))
  const details = actions.flatMap((action) => (
    Array.isArray(action.details) && action.details.length > 0
      ? action.details
      : [action.summary ?? summarizeAction(action, phase.type)]
  ))
  const base = {
    phaseType: 'movement',
    label: `Раунд ${round.number} · ${turn.playerName} · ${phase.label}`,
    summary: summaries.join(' '),
    logEntries: summaries,
    devLogEntries: details,
  }

  const wheeledActions = actions.filter((action) => Math.abs(action.wheel?.delta ?? 0) > 0.05)
  let unitsAfterWheel = previousUnits

  if (wheeledActions.length > 0) {
    unitsAfterWheel = applyWheelWaypoints(previousUnits, actions)
    frames.push({
      ...base,
      id: `${round.number}-${turn.playerId}-${phase.type}-${phaseIndex}-wheel`,
      units: unitsAfterWheel,
      overlay: buildMovementWheelOverlay(actions, previousUnits),
      durationMs: WHEEL_MOTION_DURATION_MS + 80,
    })
  }

  const marchOverlay = buildMovementMarchOverlay(actions)
  const finalUnits = actions.at(-1)?.snapshot ?? unitsAfterWheel
  frames.push({
    ...base,
    id: `${round.number}-${turn.playerId}-${phase.type}-${phaseIndex}`,
    // Avoid duplicating the same log lines on the march subframe after a shared wheel.
    logEntries: wheeledActions.length > 0 ? [] : summaries,
    devLogEntries: wheeledActions.length > 0 ? [] : details,
    units: finalUnits,
    overlay: marchOverlay,
    durationMs: marchOverlay ? 1000 : wheeledActions.length > 0 ? 220 : 700,
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
  const unitMotions = {}
  const paths = []
  let activeUnitId = null

  actions.forEach((action) => {
    if (!action.from || !action.to) {
      return
    }

    const start = action.wheel && Math.abs(action.wheel.delta) > 0.05
      ? { x: action.wheel.x, y: action.wheel.y, facing: action.wheel.facing }
      : action.from
    const distance = Math.hypot(action.to.x - start.x, action.to.y - start.y)
    if (distance <= 0.05) {
      return
    }

    unitMotions[action.actorId] = {
      kind: 'march',
      durationMs: 550,
      samples: [
        { x: start.x, y: start.y, facing: start.facing },
        { x: action.to.x, y: action.to.y, facing: action.to.facing },
      ],
    }
    paths.push({ start, end: action.to })
    activeUnitId = action.actorId
  })

  if (Object.keys(unitMotions).length === 0) {
    return null
  }

  return {
    activeUnitId,
    path: paths[0] ?? null,
    wheelArc: null,
    wheelArcs: [],
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

  if (template.shape === 'polygon' && Array.isArray(template.points)) {
    return {
      ...template,
      polygon: template.points.map((point) => ({
        x: point.x + 0.5,
        y: point.y + 0.5,
      })),
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
