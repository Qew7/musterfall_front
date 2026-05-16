import { getLaneLabel, getRowLabel } from '../game/constants'

export function ArmyPreview({ side, mirrored = false }) {
  return (
    <section className={`army-preview ${mirrored ? 'army-preview--mirrored' : ''}`}>
      <header className="army-preview__header" style={{ '--accent-color': side.faction?.color ?? '#6a4a35' }}>
        <strong>{side.playerName}</strong>
        <span>{side.faction?.name}</span>
      </header>

      <div className="army-preview__grid">
        {side.combatants.map((combatant) => (
          <article key={combatant.entityId} className="unit-formation">
            <div className="unit-formation__labels">
              <span>{getLaneLabel(combatant.lane)}</span>
              <span>{getRowLabel(combatant.row)}</span>
            </div>
            <div className="unit-formation__front">Front</div>
            <div className="unit-formation__models">
              {Array.from({ length: combatant.modelsRemaining }).map((_, index) => (
                <span key={`${combatant.entityId}-${index}`} className={`model-dot ${combatant.kind === 'hero' ? 'model-dot--hero' : ''}`} />
              ))}
            </div>
            <div className="unit-formation__sides">
              <span>Flank</span>
              <strong>{combatant.name}</strong>
              <span>Flank</span>
            </div>
            <div className="unit-formation__rear">Rear</div>
          </article>
        ))}
      </div>
    </section>
  )
}