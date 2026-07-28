import { useEffect, useMemo, useRef, useState } from 'react'
import {
  localBoardSide,
  projectOverlayToViewer,
  projectUnitsToViewer,
  shouldFlipForViewer,
} from '../../game/battle/viewerFrame'
import { BattlefieldBoard } from './BattlefieldBoard'

export function BattleReplayCard({
  battle,
  roundNumber,
  compact = false,
  focusPlayerId = null,
  onPlaybackProgress,
  continueLabel,
  onContinue,
}) {
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

    let cancelled = false
    let timerId = 0
    let index = 0

    const advance = () => {
      if (cancelled || index >= frames.length - 1) {
        return
      }

      const delay = frames[index]?.durationMs ?? 1000
      timerId = window.setTimeout(() => {
        if (cancelled) {
          return
        }
        isFirstFrameRef.current = false
        index += 1
        setFrameIndex(index)
        advance()
      }, delay)
    }

    advance()

    return () => {
      cancelled = true
      window.clearTimeout(timerId)
    }
  }, [frames, battle.battleId])

  const frame = frames[frameIndex] ?? { units: [], label: 'Нет кадров боя', summary: 'Replay не содержит кадров.', logEntries: [], devLogEntries: [] }
  const isFinalFrame = frames.length === 0 || frameIndex >= frames.length - 1
  const battleTitle = `${battle.left.playerName} vs ${battle.right.playerName}`
  const localSide = localBoardSide(battle, focusPlayerId)
  const flipBoard = shouldFlipForViewer(localSide)
  const allySideKey = localSide ?? 'left'
  const leftFactionColor = battle.left?.faction?.color
  const rightFactionColor = battle.right?.faction?.color
  const frameUnits = useMemo(() => {
    const sideColors = { left: leftFactionColor, right: rightFactionColor }
    const colored = (frame.units ?? []).map((unit) => ({
      ...unit,
      factionColor: sideColors[unit.sideKey] ?? unit.factionColor,
    }))
    return projectUnitsToViewer(colored, flipBoard)
  }, [frame.units, flipBoard, leftFactionColor, rightFactionColor])
  const tacticalOverlay = useMemo(
    () => projectOverlayToViewer(frame.overlay ?? null, flipBoard),
    [frame.overlay, flipBoard],
  )
  const progressiveLog = frames.length > 0
    ? frames
        .slice(0, frameIndex + 1)
        .flatMap((entry, index) => {
          const lines = (entry.logEntries?.length ? entry.logEntries : [entry.summary]).filter(Boolean)
          return lines.map((text, lineIndex) => ({
            id: `${entry.id ?? index}-${lineIndex}`,
            text,
            frameNumber: index + 1,
          }))
        })
        .reverse()
    : battle.events.slice(0, compact ? 6 : 24).map((item, index) => ({ id: `fallback-${index}`, text: item, frameNumber: index + 1 }))
  const progressiveDevLog = frames.length > 0
    ? frames
        .slice(0, frameIndex + 1)
        .flatMap((entry, index) => {
          const lines = (entry.devLogEntries?.length ? entry.devLogEntries : entry.logEntries ?? [entry.summary]).filter(Boolean)
          return lines.map((text, lineIndex) => ({
            id: `dev-${entry.id ?? index}-${lineIndex}`,
            text,
            frameNumber: index + 1,
          }))
        })
        .reverse()
    : []

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
        <div className="battle-card__header-actions">
          {isFinalFrame && <strong className="battle-winner">Победил: {battle.winnerName}</strong>}
          {onContinue && (
            <button type="button" className="primary-button" onClick={onContinue}>
              {continueLabel}
            </button>
          )}
        </div>
      </div>

      <div className="battle-card__status">
        <strong>{frame.label}</strong>
      </div>

      <div className="battle-card__body">
        <BattlefieldBoard
          key={`${battle.battleId}-${flipBoard ? 'flip' : 'world'}`}
          snapshot={{ units: frameUnits }}
          terrain={battle.terrain ?? []}
          selectedUnitId={tacticalOverlay?.activeUnitId ?? frame.overlay?.activeUnitId ?? null}
          tacticalOverlay={tacticalOverlay}
          allySideKey={allySideKey}
          flipBoard={flipBoard}
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
              <strong>Лог боя</strong>
              <span>{progressiveLog.length}</span>
            </div>
            {progressiveLog.map((entry) => (
              <p key={`${battle.battleId}-${entry.id}`} className="battle-log__item">
                <span className="battle-log__index">{entry.frameNumber}</span>
                <span>{entry.text}</span>
              </p>
            ))}
          </div>

          {!compact && progressiveDevLog.length > 0 && (
            <div className="battle-log battle-log--dev">
              <div className="battle-log__title-row">
                <strong>Лог разработки</strong>
                <span>{progressiveDevLog.length}</span>
              </div>
              {progressiveDevLog.map((entry) => (
                <p key={`${battle.battleId}-${entry.id}`} className="battle-log__item battle-log__item--dev">
                  <span className="battle-log__index">{entry.frameNumber}</span>
                  <span>{entry.text}</span>
                </p>
              ))}
            </div>
          )}
        </aside>
      </div>
    </article>
  )
}
