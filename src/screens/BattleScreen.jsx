import { BattleReplayCard } from '../components/battlefield/BattleReplayCard'

export function BattleScreen({ campaign, champion, championFactionName, onContinue }) {
  return (
    <section className="screen-grid">
      <article className="hero-panel hero-panel--compact">
        <p className="eyebrow">Шаг 3</p>
        <h2>Экран боя</h2>
        <p className="lead">
          Бой теперь идёт на общем поле: отряды появляются в своих deployment-зонах, ближний бой двигается через charge и wheel, а фланг и тыл считаются от facing каждого отряда.
        </p>
      </article>

      {campaign.lastRoundReport.byes.length > 0 && (
        <article className="panel">
          <h3>Свободный проход</h3>
          {campaign.lastRoundReport.byes.map((entry) => (
            <p key={entry.playerId}>{entry.playerName} пережидает раунд и получает +8 припасов.</p>
          ))}
        </article>
      )}

      <section className="battle-list">
        {campaign.lastRoundReport.matchups.map((battle) => <BattleReplayCard key={battle.battleId} battle={battle} roundNumber={campaign.lastRoundReport.round} />)}
      </section>

      {champion && (
        <article className="champion-card champion-card--final">
          <p className="eyebrow">Финал кампании</p>
          <strong>{champion.name}</strong>
          <p>{championFactionName} пережил всех и получает мета-награду.</p>
        </article>
      )}

      <div className="menu-actions">
        <button type="button" className="primary-button" onClick={onContinue}>
          {campaign.winnerId ? 'Вернуться в меню' : 'К следующему набору'}
        </button>
      </div>
    </section>
  )
}