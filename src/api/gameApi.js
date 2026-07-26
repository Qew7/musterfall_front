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
      },
    }),
  })
}

function postCommand(apiBaseUrl, gameId, path, payload) {
  return fetchJson(`${apiBaseUrl}/api/games/${gameId}/${path}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function assignFactionCommand(apiBaseUrl, gameId, { baseVersion, playerId, factionId }) {
  return postCommand(apiBaseUrl, gameId, 'assign_faction', {
    base_version: baseVersion,
    player_id: playerId,
    faction_id: factionId,
  })
}

export function recruitCommand(apiBaseUrl, gameId, { baseVersion, playerId, templateId }) {
  return postCommand(apiBaseUrl, gameId, 'recruit', {
    base_version: baseVersion,
    player_id: playerId,
    template_id: templateId,
  })
}

export function dismissCommand(apiBaseUrl, gameId, { baseVersion, playerId, entityId }) {
  return postCommand(apiBaseUrl, gameId, 'dismiss', {
    base_version: baseVersion,
    player_id: playerId,
    entity_id: entityId,
  })
}

export function attachHeroCommand(apiBaseUrl, gameId, { baseVersion, playerId, heroId, unitId }) {
  return postCommand(apiBaseUrl, gameId, 'attach_hero', {
    base_version: baseVersion,
    player_id: playerId,
    hero_id: heroId,
    unit_id: unitId,
  })
}

export function deployCommand(apiBaseUrl, gameId, { baseVersion, playerId, action, entityId, x, y, facing, direction }) {
  return postCommand(apiBaseUrl, gameId, 'deploy', {
    base_version: baseVersion,
    player_id: playerId,
    deploy_mode: action,
    entity_id: entityId,
    x,
    y,
    facing,
    direction,
  })
}

export function prepareHeroDraftCommand(apiBaseUrl, gameId, { baseVersion, playerId, heroId }) {
  return postCommand(apiBaseUrl, gameId, 'prepare_hero_draft', {
    base_version: baseVersion,
    player_id: playerId,
    hero_id: heroId,
  })
}

export function pickHeroDraftCommand(apiBaseUrl, gameId, { baseVersion, playerId, heroId, upgradeId }) {
  return postCommand(apiBaseUrl, gameId, 'pick_hero_draft', {
    base_version: baseVersion,
    player_id: playerId,
    hero_id: heroId,
    upgrade_id: upgradeId,
  })
}

export function prepareRoundCommand(apiBaseUrl, gameId, { baseVersion }) {
  return postCommand(apiBaseUrl, gameId, 'prepare_round', {
    base_version: baseVersion,
  })
}

export function advanceRoundCommand(apiBaseUrl, gameId, { baseVersion }) {
  return postCommand(apiBaseUrl, gameId, 'advance_round', {
    base_version: baseVersion,
  })
}
