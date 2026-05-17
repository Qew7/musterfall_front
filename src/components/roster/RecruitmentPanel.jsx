import { useMemo, useState } from 'react'
import { autoDeployPlayer, getRecruitmentOptions, recruitEntity } from '../../game/engine'
import { TabBar } from '../TabBar'

export function RecruitmentPanel({ campaign, catalog, selectedPlayer, setCampaign }) {
  const recruitmentOptions = getRecruitmentOptions(catalog, selectedPlayer)
  const categoryTabs = useMemo(
    () => [
      { id: 'units', label: 'Отряды', meta: String(recruitmentOptions.units.length) },
      { id: 'heroes', label: 'Герои', meta: String(recruitmentOptions.heroes.length) },
    ],
    [recruitmentOptions.heroes.length, recruitmentOptions.units.length],
  )
  const [activeCategory, setActiveCategory] = useState('units')
  const entries = activeCategory === 'units' ? recruitmentOptions.units : recruitmentOptions.heroes

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

      <TabBar tabs={categoryTabs} activeId={activeCategory} onChange={setActiveCategory} ariaLabel="Категория найма" className="tab-bar--compact" />

      <div className="market-grid">
        {entries.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className="shop-card"
            onClick={() => setCampaign(recruitEntity(campaign, catalog, selectedPlayer.id, entry.id))}
          >
            <strong>{entry.name}</strong>
            <span>{entry.cost} припасов</span>
            {activeCategory === 'units' && (
              <small>
                {entry.models} моделей, {entry.armorType}, {entry.weaponType}
              </small>
            )}
            {activeCategory === 'heroes' && (
              <small>{entry.abilities.includes('wizard') ? 'Волшебник' : 'Боец'}{entry.mounted ? ', верхом' : ', пеший'}</small>
            )}
          </button>
        ))}
      </div>
    </article>
  )
}