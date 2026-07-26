import { useMemo, useRef, useState } from 'react'
import {
  advanceRoundCommand,
  createRemoteGame,
  prepareRoundCommand,
} from '../api/gameApi'
import { createCampaign } from '../game/engine'
import { applyOptimisticCommand } from '../game/commands/optimisticEngine'
import { createCommandQueue } from '../game/commands/commandQueue'
import { enrichCampaignBattles } from '../game/commands/enrichBattleReport'

export function useCampaignSession(apiBaseUrl, catalog) {
  const [screen, setScreen] = useState('menu')
  const [playerCount, setPlayerCount] = useState(4)
  const [campaign, setCampaign] = useState(() => createCampaign(4))
  const [campaignVersion, setCampaignVersion] = useState(0)
  const [activePlayerId, setActivePlayerId] = useState('player-1')
  const [remoteGameId, setRemoteGameId] = useState(null)
  const [operationState, setOperationState] = useState({ busy: false, error: null })
  const [metaProgress, setMetaProgress] = useState({
    experience: 0,
    essence: 0,
    crowns: 0,
    lastChampion: null,
  })

  const versionRef = useRef(0)
  const gameIdRef = useRef(null)
  versionRef.current = campaignVersion
  gameIdRef.current = remoteGameId

  const queue = useMemo(
    () => createCommandQueue({
      apiBaseUrl,
      getGameId: () => gameIdRef.current,
      getVersion: () => versionRef.current,
      setVersion: (version) => {
        versionRef.current = version
        setCampaignVersion(version)
      },
      onCampaign: (nextCampaign) => {
        setCampaign(enrichCampaignBattles(nextCampaign))
      },
      onError: (message) => {
        setOperationState({ busy: false, error: message })
      },
    }),
    [apiBaseUrl],
  )

  const activePlayers = campaign.players.filter((player) => player.status === 'active' && !player.isBot)
  const selectedPlayer = activePlayers.find((player) => player.id === activePlayerId) ?? activePlayers[0] ?? campaign.players[0]
  const canAdvanceFromFactions = Boolean(catalog) && Boolean(remoteGameId)
  const champion = campaign.winnerId ? campaign.players.find((player) => player.id === campaign.winnerId) : null

  function dispatchCommand(command) {
    if (!catalog || !remoteGameId) {
      return
    }

    setCampaign((current) => applyOptimisticCommand(current, catalog, command))
    setOperationState((current) => ({ ...current, error: null }))
    queue.enqueue(command)
  }

  async function startCampaign() {
    if (!catalog) {
      return
    }

    setOperationState({ busy: true, error: null })

    try {
      const remoteGame = await createRemoteGame(apiBaseUrl, { playerCount })
      const nextCampaign = enrichCampaignBattles(remoteGame.campaign)
      setCampaign(nextCampaign)
      setCampaignVersion(remoteGame.version ?? 0)
      versionRef.current = remoteGame.version ?? 0
      setRemoteGameId(remoteGame.id)
      gameIdRef.current = remoteGame.id
      setActivePlayerId(nextCampaign.players.find((player) => !player.isBot)?.id ?? nextCampaign.players[0].id)
      setScreen('factions')
      setOperationState({ busy: false, error: null })
    } catch (error) {
      setOperationState({
        busy: false,
        error: error instanceof Error ? error.message : 'Не удалось создать игру на бэке',
      })
    }
  }

  async function beginRound() {
    if (!catalog || !remoteGameId) {
      return
    }

    setOperationState({ busy: true, error: null })

    try {
      await queue.drain()
      const response = await advanceRoundCommand(apiBaseUrl, remoteGameId, {
        baseVersion: versionRef.current,
      })
      const nextCampaign = enrichCampaignBattles(response.campaign)
      setCampaign(nextCampaign)
      setCampaignVersion(response.version)
      versionRef.current = response.version

      if (response.metaReward) {
        setMetaProgress((current) => ({
          experience: current.experience + response.metaReward.experience,
          essence: current.essence + response.metaReward.essence,
          crowns: current.crowns + 1,
          lastChampion: response.metaReward,
        }))
      }

      setScreen('battle')
      setOperationState({ busy: false, error: null })
    } catch (error) {
      if (error?.status === 409 && error.body?.campaign) {
        setCampaign(enrichCampaignBattles(error.body.campaign))
        setCampaignVersion(error.body.version)
        versionRef.current = error.body.version
      }
      setOperationState({
        busy: false,
        error: error instanceof Error ? error.message : 'Не удалось провести раунд',
      })
    }
  }

  async function continueFromFactions() {
    if (!catalog || !remoteGameId) {
      return
    }

    setOperationState({ busy: true, error: null })
    try {
      await queue.drain()
      const response = await prepareRoundCommand(apiBaseUrl, remoteGameId, {
        baseVersion: versionRef.current,
      })
      const nextCampaign = enrichCampaignBattles(response.campaign)
      setCampaign(nextCampaign)
      setCampaignVersion(response.version)
      versionRef.current = response.version
      const nextPlayer = nextCampaign.players.find((player) => player.status === 'active' && !player.isBot)
      if (nextPlayer) {
        setActivePlayerId(nextPlayer.id)
      }
      setScreen('roster')
      setOperationState({ busy: false, error: null })
    } catch (error) {
      setOperationState({
        busy: false,
        error: error instanceof Error ? error.message : 'Не удалось подготовить раунд',
      })
    }
  }

  async function prepareNextRound() {
    if (campaign.winnerId) {
      setScreen('menu')
      return
    }

    await continueFromFactions()
  }

  function nextPreparation() {
    if (activePlayers.length === 0) {
      return
    }

    const currentIndex = activePlayers.findIndex((player) => player.id === activePlayerId)
    const nextPlayer = activePlayers[(currentIndex + 1 + activePlayers.length) % activePlayers.length]
    if (nextPlayer) {
      setActivePlayerId(nextPlayer.id)
    }
  }

  return {
    screen,
    setScreen,
    playerCount,
    setPlayerCount,
    campaign,
    dispatchCommand,
    setActivePlayerId,
    activePlayers,
    selectedPlayer,
    canAdvanceFromFactions,
    champion,
    operationState,
    metaProgress,
    startCampaign,
    continueFromFactions,
    beginRound,
    prepareNextRound,
    nextPreparation,
  }
}
