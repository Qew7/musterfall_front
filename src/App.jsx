import './App.css'
import { AppHeader } from './components/AppHeader'
import { useBootstrapData } from './hooks/useBootstrapData'
import { useCampaignSession } from './hooks/useCampaignSession'
import { listAvailableFactions } from './game/catalog'
import { assignFaction } from './game/engine'
import { BattleScreen } from './screens/BattleScreen'
import { FactionsScreen } from './screens/FactionsScreen'
import { MenuScreen } from './screens/MenuScreen'
import { RosterScreen } from './screens/RosterScreen'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'

function App() {
  const { apiState, catalogState } = useBootstrapData(apiBaseUrl)
  const catalog = catalogState.payload
  const {
    screen,
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
  } = useCampaignSession(apiBaseUrl, catalog)
  const factions = catalog ? listAvailableFactions(catalog) : []
  const championFactionName = metaProgress.lastChampion
    ? factions.find((entry) => entry.id === metaProgress.lastChampion.factionId)?.name ?? metaProgress.lastChampion.factionId
    : null
  const winnerFactionName = champion ? factions.find((entry) => entry.id === champion.factionId)?.name ?? champion.factionId : null

  return (
    <main className="app-shell">
      <AppHeader apiStatus={apiState.status} metaProgress={metaProgress} />

      {catalogState.error && <p className="lead">Каталог не загрузился: {catalogState.error}</p>}
      {operationState.error && <p className="lead">Ошибка операции: {operationState.error}</p>}

      {screen === 'menu' && (
        <MenuScreen
          playerCount={playerCount}
          setPlayerCount={setPlayerCount}
          startCampaign={startCampaign}
          metaProgress={metaProgress}
          championFactionName={championFactionName}
          catalogReady={catalogState.status === 'success' && !operationState.busy}
        />
      )}

      {screen === 'factions' && catalog && (
        <FactionsScreen
          campaign={campaign}
          factions={factions}
          canAdvance={canAdvanceFromFactions}
          onAssignFaction={(playerId, factionId) => setCampaign(assignFaction(campaign, catalog, playerId, factionId))}
          onContinue={continueFromFactions}
        />
      )}

      {screen === 'roster' && selectedPlayer && catalog && (
        <RosterScreen
          campaign={campaign}
          catalog={catalog}
          activePlayers={activePlayers}
          selectedPlayer={selectedPlayer}
          onSelectPlayer={setActivePlayerId}
          setCampaign={setCampaign}
          onNextPreparation={nextPreparation}
          onBeginRound={beginRound}
          isBusy={operationState.busy}
        />
      )}

      {screen === 'battle' && campaign.lastRoundReport && (
        <BattleScreen
          campaign={campaign}
          champion={champion}
          championFactionName={winnerFactionName}
          onContinue={prepareNextRound}
        />
      )}
    </main>
  )
}

export default App
