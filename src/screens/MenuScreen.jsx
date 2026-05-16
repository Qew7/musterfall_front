export function MenuScreen({ playerCount, setPlayerCount, startCampaign, metaProgress, championFactionName, catalogReady }) {
  return (
    <section className="screen-grid screen-grid--menu">
      <article className="hero-panel hero-panel--campaign">
        <div>
          <p className="eyebrow">Метакампания</p>
          <p className="lead">
            Кампания на 4-8 игроков: выбор армии, добор и расстановка, автобой с фронтом, тылом и флангами, герои с опытом,
            заклинаниями и draft-апгрейдами 1 из 3.
          </p>
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
          <h2>Боевая математика</h2>
          <ul>
            <li>Матрица оружия и брони учитывает heavy, medium, light, machine и magic armor.</li>
            <li>Прямоугольные формации живут как сущности с компонентами combat, health, formation и abilities.</li>
            <li>Фронт, фланг и тыл меняют множитель урона, а скирмишеры игнорируют штрафы facing.</li>
          </ul>
        </div>

        <div>
          <h2>Герои и кампания</h2>
          <ul>
            <li>Пешие герои могут входить в отряды, верховые всегда остаются отдельными моделями.</li>
            <li>За каждый снятый героем HP он получает 1 XP и при пороге 3 + уровень открывает draft 1 из 3.</li>
            <li>Последний выживший игрок берет мета XP, essence и crown сезона.</li>
          </ul>
        </div>
      </article>
    </section>
  )
}