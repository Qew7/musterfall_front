import { useEffect, useRef, useState } from 'react'
import { BattlefieldBoard } from './BattlefieldBoard'

export function BattleReplayCard({ battle, roundNumber, compact = false, onPlaybackProgress }) {
  const frames = battle.replay?.frames ?? []
  const [frameIndex, setFrameIndex] = useState(0)
  // Отключаем transitions на первом кадре нового боя, чтобы юниты не "съезжались" с начала
  const isFirstFrameRef = useRef(true)

  useEffect(() => {
    setFrameIndex(0)
    isFirstFrameRef.current = true
  }, [battle.battleId])

  useEffect(() => {
    if (frames.length <= 1) {
      return undefined
    }

    const timer = window.setInterval(() => {
      setFrameIndex((current) => {
        if (current >= frames.length - 1) return current
        isFirstFrameRef.current = false
        return current + 1
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [frames.length])

  const frame = frames[frameIndex] ?? { units: [], label: 'Нет кадров боя', summary: 'Replay не содержит кадров.', logEntries: [] }
  const isFinalFrame = frames.length === 0 || frameIndex >= frames.length - 1
  const battleTitle = `${battle.left.playerName} vs ${battle.right.playerName}`
  const sideColors = {
    left: battle.left?.faction?.color,
    right: battle.right?.faction?.color,
  }
  const frameUnits = (frame.units ?? []).map((unit) => ({
    ...unit,
    factionColor: sideColors[unit.sideKey] ?? unit.factionColor,
  }))
  const progressiveLog = frames.length > 0
    ? frames
        .slice(0, frameIndex + 1)
        .map((entry, index) => {
          const item = entry.logEntries?.find((logLine) => Boolean(logLine)) ?? entry.summary ?? `Кадр ${index + 1}`
          return { id: `${entry.id ?? index}`, text: item, frameNumber: index + 1 }
        })
        .reverse()
    : battle.events.slice(0, compact ? 6 : 24).map((item, index) => ({ id: `fallback-${index}`, text: item, frameNumber: index + 1 }))

  useEffect(() => {
    onPlaybackProgress?.(battle.battleId, isFinalFrame)
  }, [battle.battleId, isFinalFrame, onPlaybackProgress])

  return (
    <article className="battle-card">
      <div className="battle-card__header">
        <div>
          <p className="eyebrow">Раунд {roundNumber}</p>
          <h2>{battleTitle}</h2>
        </div>
        {isFinalFrame && <strong className="battle-winner">Победил: {battle.winnerName}</strong>}
      </div>

      <div className="battle-card__status">
        <strong>{frame.label}</strong>
      </div>

      <div className="battle-card__body">
        <BattlefieldBoard
          snapshot={{ units: frameUnits }}
          selectedUnitId={frame.overlay?.activeUnitId ?? null}
          tacticalOverlay={frame.overlay ?? null}
          showFacingZones={false}
          showCornerMarkers={false}
          phaseType={frame.phaseType ?? null}
          overlayAnimKey={frame.id ?? frameIndex}
          instantUnits={isFirstFrameRef.current}
        />

        <aside className="battle-card__side">
          <div className="battle-replay-card__summary">
            <strong>{frame.phaseType ?? 'replay'}</strong>
            <p>{frame.summary}</p>
          </div>

          <div className="battle-log">
            <div className="battle-log__title-row">
              <strong>Логи боя</strong>
              <span>{progressiveLog.length}</span>
            </div>
            {progressiveLog.map((entry) => (
              <p key={`${battle.battleId}-${entry.id}`} className="battle-log__item">
                <span className="battle-log__index">{entry.frameNumber}</span>
                <span>{entry.text}</span>
              </p>
            ))}
          </div>
        </aside>
      </div>
    </article>
  )
}