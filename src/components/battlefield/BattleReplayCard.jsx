import { useEffect, useState } from 'react'
import { BattlefieldBoard } from './BattlefieldBoard'

export function BattleReplayCard({ battle, roundNumber }) {
  const frames = battle.replay?.frames ?? []
  const [frameIndex, setFrameIndex] = useState(0)

  useEffect(() => {
    if (frames.length <= 1) {
      return undefined
    }

    const timer = window.setInterval(() => {
      setFrameIndex((current) => (current >= frames.length - 1 ? current : current + 1))
    }, 900)

    return () => window.clearInterval(timer)
  }, [frames.length])

  const frame = frames[frameIndex] ?? { units: [], label: 'Нет кадров боя', summary: 'Replay не содержит кадров.' }

  return (
    <article className="battle-card">
      <div className="battle-card__header">
        <div>
          <p className="eyebrow">Раунд {roundNumber}</p>
          <h2>{battle.summary}</h2>
        </div>
        <strong className="battle-winner">Победил: {battle.winnerName}</strong>
      </div>

      <div className="battle-card__status">
        <strong>{frame.label}</strong>
        <span>
          Кадр {Math.min(frameIndex + 1, Math.max(frames.length, 1))}/{Math.max(frames.length, 1)}
        </span>
      </div>

      <BattlefieldBoard snapshot={{ units: frame.units }} selectedUnitId={frame.overlay?.activeUnitId ?? null} tacticalOverlay={frame.overlay ?? null} />

      <div className="battle-replay-card__summary">
        <strong>{frame.phaseType ?? 'replay'}</strong>
        <p>{frame.summary}</p>
      </div>

      <div className="battle-log">
        {battle.events.map((entry, index) => (
          <p key={`${battle.battleId}-${index}`}>{entry}</p>
        ))}
      </div>
    </article>
  )
}