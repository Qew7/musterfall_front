import { ApiError } from '../../api/http'
import {
  assignFactionCommand,
  attachHeroCommand,
  deployCommand,
  dismissCommand,
  pickHeroDraftCommand,
  prepareHeroDraftCommand,
  recruitCommand,
} from '../../api/gameApi'

function toApiCall(apiBaseUrl, gameId, baseVersion, command) {
  switch (command.type) {
    case 'assign_faction':
      return assignFactionCommand(apiBaseUrl, gameId, {
        baseVersion,
        playerId: command.playerId,
        factionId: command.factionId,
      })
    case 'recruit':
      return recruitCommand(apiBaseUrl, gameId, {
        baseVersion,
        playerId: command.playerId,
        templateId: command.templateId,
      })
    case 'dismiss':
      return dismissCommand(apiBaseUrl, gameId, {
        baseVersion,
        playerId: command.playerId,
        entityId: command.entityId,
      })
    case 'attach_hero':
      return attachHeroCommand(apiBaseUrl, gameId, {
        baseVersion,
        playerId: command.playerId,
        heroId: command.heroId,
        unitId: command.unitId,
      })
    case 'deploy_transform':
      return deployCommand(apiBaseUrl, gameId, {
        baseVersion,
        playerId: command.playerId,
        action: 'transform',
        entityId: command.entityId,
        x: command.x,
        y: command.y,
        facing: command.facing,
      })
    case 'deploy_rotate':
      return deployCommand(apiBaseUrl, gameId, {
        baseVersion,
        playerId: command.playerId,
        action: 'rotate',
        entityId: command.entityId,
        direction: command.direction,
      })
    case 'deploy_reserve':
      return deployCommand(apiBaseUrl, gameId, {
        baseVersion,
        playerId: command.playerId,
        action: 'reserve',
        entityId: command.entityId,
      })
    case 'deploy_auto':
      return deployCommand(apiBaseUrl, gameId, {
        baseVersion,
        playerId: command.playerId,
        action: 'auto',
      })
    case 'prepare_hero_draft':
      return prepareHeroDraftCommand(apiBaseUrl, gameId, {
        baseVersion,
        playerId: command.playerId,
        heroId: command.heroId,
      })
    case 'pick_hero_draft':
      return pickHeroDraftCommand(apiBaseUrl, gameId, {
        baseVersion,
        playerId: command.playerId,
        heroId: command.heroId,
        upgradeId: command.upgradeId,
      })
    default:
      return Promise.reject(new Error(`Unknown command ${command.type}`))
  }
}

export function createCommandQueue({ apiBaseUrl, getGameId, getVersion, setVersion, onCampaign, onError }) {
  const queue = []
  let flushing = false

  async function flush() {
    if (flushing) {
      return
    }

    flushing = true
    try {
      while (queue.length > 0) {
        const command = queue[0]
        const gameId = getGameId()
        if (!gameId) {
          break
        }

        try {
          const response = await toApiCall(apiBaseUrl, gameId, getVersion(), command)
          setVersion(response.version)
          queue.shift()
          if (queue.length === 0 || command.type === 'prepare_hero_draft') {
            onCampaign(response.campaign)
          }
        } catch (error) {
          if (error instanceof ApiError && error.status === 409 && error.body?.campaign) {
            setVersion(error.body.version)
            onCampaign(error.body.campaign)
            queue.length = 0
            onError(error.message)
            break
          }

          queue.shift()
          onError(error instanceof Error ? error.message : 'Ошибка синхронизации')
          break
        }
      }
    } finally {
      flushing = false
      if (queue.length > 0) {
        flush()
      }
    }
  }

  function enqueue(command) {
    queue.push(command)
    flush()
  }

  async function drain() {
    while (queue.length > 0 || flushing) {
      await flush()
      if (queue.length > 0 || flushing) {
        await new Promise((resolve) => window.setTimeout(resolve, 16))
      }
    }
  }

  return { enqueue, drain }
}
