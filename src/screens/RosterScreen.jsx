import { RecruitmentPanel } from '../components/roster/RecruitmentPanel'
import { RosterEntitiesPanel } from '../components/roster/RosterEntitiesPanel'
import { FormationBoard } from '../components/roster/FormationBoard'
import { getPlayerSummary } from '../game/selectors'

export function RosterScreen({ campaign, catalog, activePlayers, selectedPlayer, onSelectPlayer, setCampaign, onNextPreparation, onBeginRound, isBusy }) {
  const hasMultiplePlayers = activePlayers.length > 1

  return (
    <section className="screen-grid">
      <article className="hero-panel hero-panel--compact">
        <p className="eyebrow">Шаг 2</p>
        <h2>Набор, герои и расстановка</h2>
        <p className="lead">Игроки тратят припасы между боями, перестраивают фронт, тыл и фланги и распределяют героев по отрядам.</p>
      </article>

      <div className="player-tabs">
        {activePlayers.map((player) => {
          const summary = getPlayerSummary(player)
          return (
            <button
              key={player.id}
              type="button"
              className={`player-tab ${player.id === selectedPlayer.id ? 'player-tab--active' : ''}`}
              onClick={() => onSelectPlayer(player.id)}
            >
              <strong>{player.name}</strong>
              <span>{catalog.factions.find((entry) => entry.id === player.factionId)?.name}</span>
              <small>{summary.ready} в строю</small>
            </button>
          )
        })}
      </div>

      <section className="roster-layout">
        <RecruitmentPanel campaign={campaign} catalog={catalog} selectedPlayer={selectedPlayer} setCampaign={setCampaign} />
        <RosterEntitiesPanel campaign={campaign} catalog={catalog} selectedPlayer={selectedPlayer} setCampaign={setCampaign} />
      </section>

      <FormationBoard campaign={campaign} selectedPlayer={selectedPlayer} setCampaign={setCampaign} />

      <div className="menu-actions">
        <button type="button" className="ghost-button" onClick={onNextPreparation} disabled={!hasMultiplePlayers}>
          Следующий игрок
        </button>
        <button type="button" className="primary-button" onClick={onBeginRound} disabled={isBusy}>
          Начать раунд {campaign.round}
        </button>
      </div>
    </section>
  )
}