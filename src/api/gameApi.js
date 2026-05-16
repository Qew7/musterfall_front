import { fetchJson } from './http'

export function fetchStatus(apiBaseUrl) {
  return fetchJson(`${apiBaseUrl}/api/status`)
}

export function fetchGameCatalog(apiBaseUrl) {
  return fetchJson(`${apiBaseUrl}/api/game_catalog`)
}

export function createRemoteGame(apiBaseUrl, payload) {
  return fetchJson(`${apiBaseUrl}/api/games`, {
    method: 'POST',
    body: JSON.stringify({
      game: {
        player_count: payload.playerCount,
        current_round: payload.currentRound,
        status: payload.status,
        state_payload: payload.statePayload,
      },
    }),
  })
}

export function updateRemoteGame(apiBaseUrl, gameId, payload) {
  return fetchJson(`${apiBaseUrl}/api/games/${gameId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      game: {
        current_round: payload.currentRound,
        status: payload.status,
        state_payload: payload.statePayload,
      },
    }),
  })
}

export function saveRoundSnapshot(apiBaseUrl, gameId, payload) {
  return fetchJson(`${apiBaseUrl}/api/games/${gameId}/round_snapshots`, {
    method: 'POST',
    body: JSON.stringify({
      round_snapshot: {
        round_number: payload.roundNumber,
        phase: payload.phase,
        payload: payload.state,
        battles: Array.isArray(payload.battles) ? payload.battles.map(serializeBattlePayload) : undefined,
      },
    }),
  })
}

export function saveBattleReport(apiBaseUrl, gameId, payload) {
  return fetchJson(`${apiBaseUrl}/api/games/${gameId}/battles`, {
    method: 'POST',
    body: JSON.stringify({
      battle: serializeBattlePayload(payload),
    }),
  })
}

function serializeBattlePayload(payload) {
  return {
    round_number: payload.roundNumber,
    left_player_id: payload.left.playerId,
    left_player_name: payload.left.playerName,
    right_player_id: payload.right.playerId,
    right_player_name: payload.right.playerName,
    winner_id: payload.winnerId,
    winner_name: payload.winnerName,
    summary: payload.summary,
    left_payload: payload.left,
    right_payload: payload.right,
    events: payload.events,
    rounds: payload.rounds.map((round) => ({
      number: round.number,
      events: round.events,
      turns: round.turns.map((turn, turnIndex) => ({
        position: turnIndex,
        player_id: turn.playerId,
        player_name: turn.playerName,
        phases: turn.phases.map((phase, phaseIndex) => ({
          position: phaseIndex,
          phase_type: phase.type,
          label: phase.label,
          events: phase.events,
          actions: phase.actions.map(serializePhaseAction),
        })),
      })),
    })),
  }
}

function serializePhaseAction(action) {
  return {
    type: action.type,
    summary: action.summary,
    details: action.details,
    actor_id: action.actorId,
    actor_unit_id: action.actorUnitId,
    actor_name: action.actorName,
    actor_role: action.actorRole,
    target_id: action.targetId,
    target_name: action.targetName,
    vector: action.vector,
    damage: action.damage,
    blockers: action.blockers,
    requires_line_of_sight: action.requiresLineOfSight,
    affected_ids: action.affectedIds,
    from: serializePosition(action.from),
    to: serializePosition(action.to),
    actor_state: serializeCombatantState(action.actorState),
    actor_state_before: serializeCombatantState(action.actorStateBefore),
    actor_state_after: serializeCombatantState(action.actorStateAfter),
    target_state_before: serializeCombatantState(action.targetStateBefore),
    target_state_after: serializeCombatantState(action.targetStateAfter),
    morale_check: serializeMoraleCheck(action.moraleCheck),
    template: serializeTemplate(action.template),
    charge: serializeCharge(action.charge),
  }
}

function serializeCombatantState(state) {
  if (!state) {
    return undefined
  }

  return {
    entity_id: state.entityId,
    name: state.name,
    kind: state.kind,
    side_key: state.sideKey,
    lane: state.lane,
    row: state.row,
    x: state.x,
    y: state.y,
    facing: state.facing,
    current_health: state.currentHealth,
    max_health: state.maxHealth,
    model_health: state.modelHealth,
    models_remaining: state.modelsRemaining,
    starting_models: state.startingModels,
    frontage: state.frontage,
    max_files: state.maxFiles,
    files: state.files,
    ranks: state.ranks,
    base_width: state.baseWidth,
    base_depth: state.baseDepth,
    movement: state.movement,
    morale: state.morale,
    melee: state.melee,
    ranged: state.ranged,
    spell: state.spell,
    is_routing: state.isRouting,
    armor_type: state.armorType,
    weapon_type: state.weaponType,
    attached_heroes: Array.isArray(state.attachedHeroes)
      ? state.attachedHeroes.map((hero) => ({
        entity_id: hero.entityId,
        name: hero.name,
        slot: hero.slot,
      }))
      : [],
  }
}

function serializeMoraleCheck(moraleCheck) {
  if (!moraleCheck) {
    return undefined
  }

  return {
    source_phase: moraleCheck.sourcePhase,
    trigger: moraleCheck.trigger,
    effective_morale: moraleCheck.effectiveMorale,
    morale_source: moraleCheck.moraleSource,
    threshold: moraleCheck.threshold,
    roll: moraleCheck.roll,
    passed: moraleCheck.passed,
    failure_margin: moraleCheck.failureMargin,
    combat_score_delta: moraleCheck.combatScoreDelta,
    phase_damage: moraleCheck.phaseDamage,
    lost_models: moraleCheck.lostModels,
    starting_models: moraleCheck.startingModels,
    phase_start_models: moraleCheck.phaseStartModels,
    threshold_models: moraleCheck.thresholdModels,
    status_before: moraleCheck.statusBefore,
    status_after: moraleCheck.statusAfter,
    damage_applied: moraleCheck.damageApplied,
    retreat_edge: moraleCheck.retreatEdge,
  }
}

function serializePosition(position) {
  if (!position) {
    return undefined
  }

  return {
    x: position.x,
    y: position.y,
    facing: position.facing,
    row: position.row,
    lane: position.lane,
  }
}

function serializeTemplate(template) {
  if (!template) {
    return undefined
  }

  return {
    shape: template.shape,
    radius: template.radius,
    kind: template.kind,
    facing: template.facing,
    affected_ids: template.affectedIds,
    center: serializePoint(template.center),
    origin: serializePoint(template.origin),
    start: serializePoint(template.start),
    end: serializePoint(template.end),
  }
}

function serializeCharge(charge) {
  if (!charge) {
    return undefined
  }

  return {
    vector: charge.vector,
    start: serializePosition(charge.start),
    destination: serializePosition(charge.destination),
    contact_point: serializePoint(charge.contactPoint),
  }
}

function serializePoint(point) {
  if (!point) {
    return undefined
  }

  return {
    x: point.x,
    y: point.y,
    facing: point.facing,
  }
}