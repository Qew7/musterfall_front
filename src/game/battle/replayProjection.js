import { buildSectorPolygon, getPreviewOverlay } from '../placementPreview'

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
            units: phase.snapshot ?? frames.at(-1)?.units ?? initialSnapshot,
            overlay: null,
          })
          return
        }

        phase.actions.forEach((action, actionIndex) => {
          frames.push({
            id: `${round.number}-${turn.playerId}-${phase.type}-${phaseIndex}-${actionIndex}`,
            phaseType: phase.type,
            label: `Раунд ${round.number} · ${turn.playerName} · ${phase.label}`,
            summary: action.summary ?? summarizeAction(action, phase.type),
            logEntries: [action.summary ?? summarizeAction(action, phase.type)],
            units: action.snapshot,
            overlay: projectActionOverlay(action, action.snapshot),
          })
        })
      })
    })
  })

  return { frames }
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

  if (action.type === 'movement') {
    return {
      activeUnitId: action.actorId,
      path: { start: action.from, end: action.to },
      wheelArc: getPreviewOverlay({
        origin: { ...action.from, baseWidth: actor?.baseWidth ?? 1, baseDepth: actor?.baseDepth ?? 1 },
        preview: { ...action.to, baseWidth: actor?.baseWidth ?? 1, baseDepth: actor?.baseDepth ?? 1 },
      })?.wheelArc ?? null,
      targetIds: [],
      affectedIds: [],
      blockedIds: [],
      template: null,
      contactVector: null,
      contactTargetId: null,
      los: null,
    }
  }

  return {
    activeUnitId: action.actorUnitId ?? action.actorId,
    path: action.charge ? { start: action.charge.start, end: action.charge.destination } : action.template?.shape === 'line' ? action.template : null,
    wheelArc: action.charge
      ? getPreviewOverlay({
          origin: { ...action.charge.start, baseWidth: actor?.baseWidth ?? 1, baseDepth: actor?.baseDepth ?? 1 },
          preview: { ...action.charge.destination, baseWidth: actor?.baseWidth ?? 1, baseDepth: actor?.baseDepth ?? 1 },
        })?.wheelArc ?? null
      : null,
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