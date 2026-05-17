import { useMemo, useState } from 'react'
import { TabBar } from '../components/TabBar'

export function FactionsScreen({ campaign, factions, canAdvance, onAssignFaction, onContinue }) {
  const playerTabs = useMemo(
    () => campaign.players.map((player) => ({
      id: player.id,
      label: player.name,
      meta: player.isBot ? 'Бот' : 'Игрок',
    })),
    [campaign.players],
  )
  const [activePlayerId, setActivePlayerId] = useState(() => playerTabs[0]?.id ?? null)
  const activePlayer = campaign.players.find((player) => player.id === activePlayerId) ?? campaign.players[0]

  return (
    <section className="screen-grid screen-grid--locked">
      <TabBar
        tabs={playerTabs}
        activeId={activePlayer.id}
        onChange={setActivePlayerId}
        ariaLabel="Выбор игрока"
      />

      <section className="player-picks player-picks--single">
        <article className="player-card">
          <div className="player-card__header">
            <div>
              <p className="eyebrow">{activePlayer.name}</p>
              <strong>{factions.find((entry) => entry.id === activePlayer.factionId)?.name ?? 'Фракция не выбрана'}</strong>
              <p>{activePlayer.isBot ? 'Бот' : 'Игрок'}</p>
            </div>
          </div>

          <div className="faction-grid">
            {factions.map((faction) => (
              <button
                key={faction.id}
                type="button"
                className={`faction-card ${activePlayer.factionId === faction.id ? 'faction-card--selected' : ''}`}
                style={{ '--accent-color': faction.color }}
                onClick={() => onAssignFaction(activePlayer.id, faction.id)}
              >
                <strong>{faction.name}</strong>
                <span>{faction.vibe}</span>
                <small>{faction.passive}</small>
              </button>
            ))}
          </div>
        </article>
      </section>

      <div className="menu-actions">
        <button type="button" className="primary-button" disabled={!canAdvance} onClick={onContinue}>
          К экрану набора и расстановки
        </button>
      </div>
    </section>
  )
}