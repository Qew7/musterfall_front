import { autoDeployPlayer, getRecruitmentOptions, recruitEntity } from '../../game/engine'

export function RecruitmentPanel({ campaign, catalog, selectedPlayer, setCampaign }) {
  const recruitmentOptions = getRecruitmentOptions(catalog, selectedPlayer)

  return (
    <article className="panel panel--market">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Припасы</p>
          <h2>{selectedPlayer.treasury}</h2>
        </div>
        <button type="button" className="ghost-button" onClick={() => setCampaign(autoDeployPlayer(campaign, selectedPlayer.id))}>
          Авторасставить
        </button>
      </div>

      <div className="market-columns">
        <div>
          <h3>Отряды</h3>
          {recruitmentOptions.units.map((unit) => (
            <button
              key={unit.id}
              type="button"
              className="shop-card"
              onClick={() => setCampaign(recruitEntity(campaign, catalog, selectedPlayer.id, unit.id))}
            >
              <strong>{unit.name}</strong>
              <span>{unit.cost} припасов</span>
              <small>
                {unit.models} моделей, {unit.armorType}, {unit.weaponType}
              </small>
            </button>
          ))}
        </div>

        <div>
          <h3>Герои</h3>
          {recruitmentOptions.heroes.map((hero) => (
            <button
              key={hero.id}
              type="button"
              className="shop-card"
              onClick={() => setCampaign(recruitEntity(campaign, catalog, selectedPlayer.id, hero.id))}
            >
              <strong>{hero.name}</strong>
              <span>{hero.cost} припасов</span>
              <small>{hero.abilities.includes('wizard') ? 'Волшебник' : 'Боец'}{hero.mounted ? ', верхом' : ', пеший'}</small>
            </button>
          ))}
        </div>
      </div>
    </article>
  )
}