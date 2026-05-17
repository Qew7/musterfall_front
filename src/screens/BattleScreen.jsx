import { useEffect, useMemo, useState } from 'react'
import { BattleReplayCard } from '../components/battlefield/BattleReplayCard'
import { TabBar } from '../components/TabBar'

export function BattleScreen({ campaign, champion, championFactionName, focusPlayerId, onContinue }) {
  const matchups = campaign.lastRoundReport.matchups
  const [completedBattleIds, setCompletedBattleIds] = useState(() => new Set())
  const ownBattles = useMemo(
    () => matchups.filter((battle) => battle.left.playerId === focusPlayerId || battle.right.playerId === focusPlayerId),
    [focusPlayerId, matchups],
  )
  const otherBattles = useMemo(
    () => matchups.filter((battle) => battle.left.playerId !== focusPlayerId && battle.right.playerId !== focusPlayerId),
    [focusPlayerId, matchups],
  )
  const contextTabs = ownBattles.length > 0
    ? [
        { id: 'own', label: 'Мой бой', meta: String(ownBattles.length) },
        { id: 'others', label: 'Другие бои', meta: String(otherBattles.length) },
      ]
    : [{ id: 'others', label: 'Бои раунда', meta: String(matchups.length) }]
  const [activeContextTab, setActiveContextTab] = useState(contextTabs[0].id)
  const visibleBattles = activeContextTab === 'own' ? ownBattles : otherBattles
  const battleTabs = visibleBattles.map((battle) => ({
    id: battle.battleId,
    label: `${battle.left.playerName} vs ${battle.right.playerName}`,
  }))
  const [activeBattleId, setActiveBattleId] = useState(() => battleTabs[0]?.id ?? null)
  const activeBattle = visibleBattles.find((battle) => battle.battleId === activeBattleId) ?? visibleBattles[0] ?? null

  useEffect(() => {
    if (!contextTabs.some((tab) => tab.id === activeContextTab)) {
      setActiveContextTab(contextTabs[0].id)
    }
  }, [activeContextTab, contextTabs])

  useEffect(() => {
    if (activeContextTab === 'others' && otherBattles.length === 0 && ownBattles.length > 0) {
      setActiveContextTab('own')
    }
  }, [activeContextTab, otherBattles.length, ownBattles.length])

  useEffect(() => {
    if (battleTabs.length > 0 && !battleTabs.some((tab) => tab.id === activeBattleId)) {
      setActiveBattleId(battleTabs[0].id)
    }
  }, [activeBattleId, battleTabs])

  useEffect(() => {
    setCompletedBattleIds(new Set())
  }, [campaign.lastRoundReport.round])

  const allBattlesCompleted = matchups.length === 0 || matchups.every((battle) => completedBattleIds.has(battle.battleId))

  function handlePlaybackProgress(battleId, isFinalFrame) {
    if (!isFinalFrame) {
      return
    }

    setCompletedBattleIds((current) => {
      if (current.has(battleId)) {
        return current
      }

      const next = new Set(current)
      next.add(battleId)
      return next
    })
  }

  return (
    <section className="screen-grid screen-grid--locked">
      <TabBar tabs={contextTabs} activeId={activeContextTab} onChange={setActiveContextTab} ariaLabel="Контекст боя" />

      {battleTabs.length > 1 && (
        <TabBar tabs={battleTabs} activeId={activeBattle?.battleId ?? battleTabs[0].id} onChange={setActiveBattleId} ariaLabel="Матч" className="tab-bar--compact" />
      )}

      {campaign.lastRoundReport.byes.length > 0 && (
        <article className="panel">
          <h3>Свободный проход</h3>
          {campaign.lastRoundReport.byes.map((entry) => (
            <p key={entry.playerId}>{entry.playerName} пережидает раунд и получает +8 припасов.</p>
          ))}
        </article>
      )}

      <section className="screen-body">
        {activeBattle && (
          <BattleReplayCard
            battle={activeBattle}
            roundNumber={campaign.lastRoundReport.round}
            compact
            onPlaybackProgress={handlePlaybackProgress}
          />
        )}
      </section>

      {champion && allBattlesCompleted && (
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