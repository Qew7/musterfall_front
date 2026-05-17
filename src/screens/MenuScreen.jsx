export function MenuScreen({ playerCount, setPlayerCount, startCampaign, metaProgress, championFactionName, catalogReady }) {
  return (
    <section className="screen-grid screen-grid--menu screen-grid--locked">
      <article className="hero-panel hero-panel--campaign">
        <div>
          <p className="eyebrow">Метакампания</p>
          <p className="lead">Короткая сессия: выбор фракций, подготовка строя, автобой, переход к новому раунду.</p>
        </div>

        <div className="dial-row">
          <label htmlFor="players">Игроков</label>
          <input
            id="players"
            type="range"
            min="4"
            max="8"
            value={playerCount}
            onChange={(event) => setPlayerCount(Number(event.target.value))}
          />
          <strong>{playerCount}</strong>
        </div>

        <div className="menu-actions">
          <button type="button" className="primary-button" onClick={startCampaign} disabled={!catalogReady}>
            Начать кампанию
          </button>
        </div>

        {metaProgress.lastChampion && (
          <div className="champion-card champion-card--compact">
            <p className="eyebrow">Последний победитель</p>
            <strong>{metaProgress.lastChampion.playerName}</strong>
            <p>
              Фракция {championFactionName}, награда {metaProgress.lastChampion.experience} XP и {metaProgress.lastChampion.essence} essence.
            </p>
          </div>
        )}
      </article>

      <article className="details-panel details-panel--spec">
        <div>
          <h2>Как проходит раунд</h2>
          <ul>
            <li>Фракции выбираются по игрокам через табы.</li>
            <li>Подготовка делится на найм и расстановку.</li>
            <li>Бой можно смотреть по табам: свой и остальные.</li>
          </ul>
        </div>

        <div>
          <h2>Метапрогресс</h2>
          <ul>
            <li>Победитель раунда получает преимущества кампании.</li>
            <li>Герои развиваются через draft улучшений.</li>
            <li>Сезон накапливает XP, essence и crowns.</li>
          </ul>
        </div>
      </article>
    </section>
  )
}