import { getFacingLabel } from '../../game/battlefield'
import { attachHero, dismissEntity, pickHeroDraft, prepareHeroDraft, rotateEntityOnBattlefield, toggleEntityReserve } from '../../game/engine'
import { buildFormationLayout } from '../../game/formation'
import { describeHero, getEntityCardData, getFactionPalette, getUpgradeSummary } from '../../game/selectors'

export function RosterEntitiesPanel({ campaign, catalog, selectedPlayer, setCampaign }) {
  return (
    <article className="panel panel--roster">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Строй игрока</p>
          <h2>{selectedPlayer.name}</h2>
        </div>
      </div>

      <div className="entity-list">
        {selectedPlayer.roster.map((entity) => {
          const data = getEntityCardData(catalog, entity)
          const factionColor = getFactionPalette(catalog, selectedPlayer.factionId)
          const formationLayout = buildFormationLayout({
            modelsRemaining: data.modelsRemaining,
            frontage: entity.components.formation.frontage,
            maxFiles: entity.components.formation.maxFiles,
            modelWidth: entity.components.formation.modelWidth,
            modelDepth: entity.components.formation.modelDepth,
          })

          return (
            <article key={entity.id} className="entity-card" style={{ '--accent-color': factionColor }}>
              <div className="entity-card__top">
                <div>
                  <strong>{entity.name}</strong>
                  <p>
                    {entity.kind === 'unit'
                      ? `${data.modelsRemaining}/${entity.components.formation.models} моделей`
                      : `HP ${entity.state.currentHealth}/${entity.components.health.max}`}
                  </p>
                </div>
                <button type="button" className="dismiss-button" onClick={() => setCampaign(dismissEntity(campaign, selectedPlayer.id, entity.id))}>
                  Распустить
                </button>
              </div>

              <div className="entity-card__stats">
                <span>{entity.components.combat.armorType}</span>
                <span>{entity.components.combat.weaponType}</span>
                <span>MV {entity.components.combat.movement}</span>
                <span>MO {entity.components.combat.morale}</span>
                <span>SK {entity.components.combat.skill}</span>
                <span>{entity.components.formation.row === 'reserve' ? 'Резерв' : getFacingLabel(entity.components.formation.facing)}</span>
              </div>

              <div className="entity-card__formation">
                <div className="entity-card__formation-metrics">
                  <span>{formationLayout.files} в ряд</span>
                  <span>{formationLayout.ranks} в глубину</span>
                  <span>{entity.components.formation.width}x{entity.components.formation.depth} footprint</span>
                  <span>{entity.components.formation.modelClass}</span>
                </div>

                {formationLayout.slots.length > 0 && (
                  <div
                    className="entity-card__formation-grid"
                    style={{ '--formation-columns': formationLayout.gridWidth, '--formation-rows': formationLayout.gridDepth }}
                  >
                    {formationLayout.slots.map((slot) => (
                      <span
                        key={slot.id}
                        className={`entity-card__formation-model entity-card__formation-model--${entity.components.formation.modelClass}`}
                        style={{
                          gridColumn: `${slot.x + 1} / span ${slot.width}`,
                          gridRow: `${slot.y + 1} / span ${slot.depth}`,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="entity-card__actions">
                <button type="button" className="ghost-button" onClick={() => setCampaign(rotateEntityOnBattlefield(campaign, selectedPlayer.id, entity.id, 'left'))}>
                  Повернуть влево
                </button>
                <button type="button" className="ghost-button" onClick={() => setCampaign(rotateEntityOnBattlefield(campaign, selectedPlayer.id, entity.id, 'right'))}>
                  Повернуть вправо
                </button>
                <button type="button" className="ghost-button" onClick={() => setCampaign(toggleEntityReserve(campaign, selectedPlayer.id, entity.id))}>
                  {entity.components.formation.row === 'reserve' ? 'Выставить' : 'В резерв'}
                </button>
                {entity.kind === 'hero' && <span className="hero-copy">{describeHero(entity)}</span>}
              </div>

              {entity.kind === 'hero' && !entity.components.hero.mounted && (
                <div className="attach-strip">
                  {selectedPlayer.roster.filter((candidate) => candidate.kind === 'unit').map((unit) => (
                    <button
                      key={unit.id}
                      type="button"
                      className={`attach-chip ${entity.state.attachedTo === unit.id ? 'attach-chip--active' : ''}`}
                      onClick={() => setCampaign(attachHero(campaign, selectedPlayer.id, entity.id, unit.id))}
                    >
                      {entity.state.attachedTo === unit.id ? `В отряде ${unit.name}` : `Встроить в ${unit.name}`}
                    </button>
                  ))}
                </div>
              )}

              {entity.kind === 'hero' && data.canLevel && entity.components.progression.pendingDraft.length === 0 && (
                <button type="button" className="primary-button primary-button--small" onClick={() => setCampaign(prepareHeroDraft(campaign, catalog, selectedPlayer.id, entity.id))}>
                  Открыть draft улучшений
                </button>
              )}

              {entity.kind === 'hero' && entity.components.progression.pendingDraft.length > 0 && (
                <div className="draft-grid">
                  {entity.components.progression.pendingDraft.map((upgradeId) => {
                    const upgrade = getUpgradeSummary(catalog, upgradeId)
                    return (
                      <button
                        key={upgradeId}
                        type="button"
                        className="draft-card"
                        onClick={() => setCampaign(pickHeroDraft(campaign, selectedPlayer.id, entity.id, upgradeId))}
                      >
                        <strong>{upgrade?.name}</strong>
                        <span>{upgrade?.category}</span>
                        <small>{upgrade?.summary}</small>
                      </button>
                    )
                  })}
                </div>
              )}
            </article>
          )
        })}
      </div>
    </article>
  )
}