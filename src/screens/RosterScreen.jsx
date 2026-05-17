import { useMemo, useState } from 'react'
import { RecruitmentPanel } from '../components/roster/RecruitmentPanel'
import { RosterEntitiesPanel } from '../components/roster/RosterEntitiesPanel'
import { FormationBoard } from '../components/roster/FormationBoard'
import { TabBar } from '../components/TabBar'
import { getPlayerSummary } from '../game/selectors'

export function RosterScreen({ campaign, catalog, activePlayers, selectedPlayer, onSelectPlayer, setCampaign, onNextPreparation, onBeginRound, isBusy }) {
  const hasMultiplePlayers = activePlayers.length > 1
  const playerTabs = useMemo(
    () => activePlayers.map((player) => {
      const summary = getPlayerSummary(player)

      return {
        id: player.id,
        label: player.name,
        meta: `${summary.ready} в строю`,
      }
    }),
    [activePlayers],
  )
  const prepTabs = [
    { id: 'roster', label: 'Найм и строй', meta: 'юниты и герои' },
    { id: 'formation', label: 'Расстановка', meta: 'позиции на поле' },
  ]
  const [activePrepTab, setActivePrepTab] = useState('roster')

  return (
    <section className="screen-grid screen-grid--locked">
      <TabBar tabs={playerTabs} activeId={selectedPlayer.id} onChange={onSelectPlayer} ariaLabel="Игроки" />
      <TabBar tabs={prepTabs} activeId={activePrepTab} onChange={setActivePrepTab} ariaLabel="Подготовка" className="tab-bar--compact" />

      <section className="screen-body">
        {activePrepTab === 'roster' && (
          <section className="roster-layout">
            <RecruitmentPanel campaign={campaign} catalog={catalog} selectedPlayer={selectedPlayer} setCampaign={setCampaign} />
            <RosterEntitiesPanel campaign={campaign} catalog={catalog} selectedPlayer={selectedPlayer} setCampaign={setCampaign} />
          </section>
        )}

        {activePrepTab === 'formation' && (
          <FormationBoard campaign={campaign} catalog={catalog} selectedPlayer={selectedPlayer} setCampaign={setCampaign} />
        )}
      </section>

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