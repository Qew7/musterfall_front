import { useState } from 'react'
import { createRemoteGame, saveRoundSnapshot, updateRemoteGame } from '../api/gameApi'
import { buildMetaReward, createCampaign, prepareCampaignForRound, runCampaignRound } from '../game/engine'

export function useCampaignSession(apiBaseUrl, catalog) {
  const [screen, setScreen] = useState('menu')
  const [playerCount, setPlayerCount] = useState(4)
  const [campaign, setCampaign] = useState(() => createCampaign(4))
  const [activePlayerId, setActivePlayerId] = useState('player-1')
  const [remoteGameId, setRemoteGameId] = useState(null)
  const [operationState, setOperationState] = useState({ busy: false, error: null })
  const [metaProgress, setMetaProgress] = useState({
    experience: 0,
    essence: 0,
    crowns: 0,
    lastChampion: null,
  })

  const activePlayers = campaign.players.filter((player) => player.status === 'active' && !player.isBot)
  const selectedPlayer = activePlayers.find((player) => player.id === activePlayerId) ?? activePlayers[0] ?? campaign.players[0]
  const canAdvanceFromFactions = Boolean(catalog)
  const champion = campaign.winnerId ? campaign.players.find((player) => player.id === campaign.winnerId) : null

  async function startCampaign() {
    if (!catalog) {
      return
    }

    const nextCampaign = createCampaign(playerCount)
    setOperationState({ busy: true, error: null })

    try {
      const remoteGame = await createRemoteGame(apiBaseUrl, {
        playerCount,
        currentRound: nextCampaign.round,
        status: 'active',
        statePayload: { campaign: nextCampaign },
      })

      setCampaign(nextCampaign)
      setRemoteGameId(remoteGame.id)
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
      const preparedCampaign = prepareCampaignForRound(campaign, catalog)

      await saveRoundSnapshot(apiBaseUrl, remoteGameId, {
        roundNumber: preparedCampaign.round,
        phase: 'pre_round',
        state: { campaign: preparedCampaign },
      })

      const nextCampaign = runCampaignRound(preparedCampaign, catalog)

      await saveRoundSnapshot(apiBaseUrl, remoteGameId, {
        roundNumber: preparedCampaign.round,
        phase: 'post_round',
        state: { campaign: nextCampaign },
        battles: nextCampaign.lastRoundReport.matchups.map((battle) => ({
          roundNumber: nextCampaign.lastRoundReport.round,
          ...battle,
        })),
      })

      await updateRemoteGame(apiBaseUrl, remoteGameId, {
        currentRound: nextCampaign.round,
        status: nextCampaign.winnerId ? 'finished' : 'active',
        statePayload: { campaign: nextCampaign },
      })

      setCampaign(nextCampaign)

      if (nextCampaign.winnerId) {
        const reward = buildMetaReward(nextCampaign)
        if (reward) {
          setMetaProgress((current) => ({
            experience: current.experience + reward.experience,
            essence: current.essence + reward.essence,
            crowns: current.crowns + 1,
            lastChampion: reward,
          }))
        }
      }

      setScreen('battle')
      setOperationState({ busy: false, error: null })
    } catch (error) {
      setOperationState({
        busy: false,
        error: error instanceof Error ? error.message : 'Не удалось сохранить снапшоты раунда',
      })
    }
  }

  function continueFromFactions() {
    if (!catalog) {
      return
    }

    const nextCampaign = prepareCampaignForRound(campaign, catalog)
    const nextPlayer = nextCampaign.players.find((player) => player.status === 'active' && !player.isBot)

    setCampaign(nextCampaign)
    if (nextPlayer) {
      setActivePlayerId(nextPlayer.id)
    }
    setScreen('roster')
  }

  function prepareNextRound() {
    if (campaign.winnerId) {
      setScreen('menu')
      return
    }

    const nextCampaign = catalog ? prepareCampaignForRound(campaign, catalog) : campaign
    const nextPlayer = nextCampaign.players.find((player) => player.status === 'active' && !player.isBot)

    setCampaign(nextCampaign)
    if (nextPlayer) {
      setActivePlayerId(nextPlayer.id)
    }
    setScreen('roster')
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
    setCampaign,
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