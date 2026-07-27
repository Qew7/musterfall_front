import { useMemo, useState } from 'react'
import { RecruitmentPanel } from '../components/roster/RecruitmentPanel'
import { RosterEntitiesPanel } from '../components/roster/RosterEntitiesPanel'
import { FormationBoard } from '../components/roster/FormationBoard'
import { TabBar } from '../components/TabBar'
import { getPlayerSummary } from '../game/selectors'

export function RosterScreen({ campaign, catalog, activePlayers, selectedPlayer, onSelectPlayer, dispatchCommand, onNextPreparation, onBeginRound, isBusy }) {
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
  const isFormation = activePrepTab === 'formation'

  return (
    <section className={`screen-grid screen-grid--locked ${isFormation ? 'screen-grid--field' : ''}`}>
      <TabBar
        tabs={playerTabs}
        activeId={selectedPlayer.id}
        onChange={onSelectPlayer}
        ariaLabel="Игроки"
      />
      <TabBar
        tabs={prepTabs}
        activeId={activePrepTab}
        onChange={setActivePrepTab}
        ariaLabel="Подготовка"
      />

      <section className="screen-body">
        {activePrepTab === 'roster' && (
          <section className="roster-layout">
            <RecruitmentPanel catalog={catalog} selectedPlayer={selectedPlayer} dispatchCommand={dispatchCommand} />
            <RosterEntitiesPanel catalog={catalog} selectedPlayer={selectedPlayer} dispatchCommand={dispatchCommand} />
          </section>
        )}

        {isFormation && (
          <FormationBoard
            catalog={catalog}
            selectedPlayer={selectedPlayer}
            dispatchCommand={dispatchCommand}
            roundNumber={campaign.round}
            hasMultiplePlayers={hasMultiplePlayers}
            isBusy={isBusy}
            onNextPreparation={onNextPreparation}
            onBeginRound={onBeginRound}
          />
        )}
      </section>

      {!isFormation && (
        <div className="menu-actions">
          <button type="button" className="ghost-button" onClick={onNextPreparation} disabled={!hasMultiplePlayers}>
            Следующий игрок
          </button>
          <button type="button" className="primary-button" onClick={onBeginRound} disabled={isBusy}>
            Начать раунд {campaign.round}
          </button>
        </div>
      )}
    </section>
  )
}