export function FactionsScreen({ campaign, factions, canAdvance, onAssignFaction, onContinue }) {
  return (
    <section className="screen-grid">
      <article className="hero-panel hero-panel--compact">
        <p className="eyebrow">Шаг 1</p>
        <h2>Выбор армии</h2>
        <p className="lead">Каждому игроку выберите фракцию. Если кого-то пропустили, игра назначит её случайно, а боты сразу соберут базовую армию и применят авторасстановку.</p>
      </article>

      <section className="player-picks">
        {campaign.players.map((player) => (
          <article key={player.id} className="player-card">
            <div className="player-card__header">
              <div>
                <p className="eyebrow">{player.name}</p>
                <strong>{factions.find((entry) => entry.id === player.factionId)?.name ?? 'Фракция не выбрана'}</strong>
                <p>{player.isBot ? 'Базовый бот' : 'Игрок'}</p>
              </div>
            </div>

            <div className="faction-grid">
              {factions.map((faction) => (
                <button
                  key={faction.id}
                  type="button"
                  className={`faction-card ${player.factionId === faction.id ? 'faction-card--selected' : ''}`}
                  style={{ '--accent-color': faction.color }}
                  onClick={() => onAssignFaction(player.id, faction.id)}
                >
                  <strong>{faction.name}</strong>
                  <span>{faction.vibe}</span>
                  <small>{faction.passive}</small>
                </button>
              ))}
            </div>
          </article>
        ))}
      </section>

      <div className="menu-actions">
        <button type="button" className="primary-button" disabled={!canAdvance} onClick={onContinue}>
          К экрану набора и расстановки
        </button>
      </div>
    </section>
  )
}