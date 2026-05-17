import { useEffect, useState } from 'react'
import { BattlefieldBoard } from './BattlefieldBoard'

export function BattleReplayCard({ battle, roundNumber, compact = false, onPlaybackProgress }) {
  const frames = battle.replay?.frames ?? []
  const [frameIndex, setFrameIndex] = useState(0)

  useEffect(() => {
    setFrameIndex(0)
  }, [battle.battleId])

  useEffect(() => {
    if (frames.length <= 1) {
      return undefined
    }

    const timer = window.setInterval(() => {
      setFrameIndex((current) => (current >= frames.length - 1 ? current : current + 1))
    }, 900)

    return () => window.clearInterval(timer)
  }, [frames.length])

  const frame = frames[frameIndex] ?? { units: [], label: 'Нет кадров боя', summary: 'Replay не содержит кадров.', logEntries: [] }
  const isFinalFrame = frames.length === 0 || frameIndex >= frames.length - 1
  const battleTitle = `${battle.left.playerName} vs ${battle.right.playerName}`
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
          snapshot={{ units: frame.units }}
          selectedUnitId={frame.overlay?.activeUnitId ?? null}
          tacticalOverlay={frame.overlay ?? null}
          showFacingZones={false}
          showCornerMarkers={false}
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