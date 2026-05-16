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
      },
    }),
  })
}

export function saveBattleReport(apiBaseUrl, gameId, payload) {
  return fetchJson(`${apiBaseUrl}/api/games/${gameId}/battles`, {
    method: 'POST',
    body: JSON.stringify({
      battle: {
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
            })),
          })),
        })),
      },
    }),
  })
}