import { useMemo, useState } from 'react'
import { getFacingLabel } from '../../game/battlefield'
import { attachHero, dismissEntity, pickHeroDraft, prepareHeroDraft, rotateEntityOnBattlefield, toggleEntityReserve } from '../../game/engine'
import { buildFormationLayout } from '../../game/formation'
import { describeHero, getEntityCardData, getFactionPalette, getUpgradeSummary } from '../../game/selectors'
import { TabBar } from '../TabBar'

export function RosterEntitiesPanel({ campaign, catalog, selectedPlayer, setCampaign }) {
  const entityTabs = useMemo(
    () => selectedPlayer.roster.map((entity) => ({
      id: entity.id,
      label: entity.name,
      meta: entity.kind === 'hero' ? 'герой' : 'отряд',
    })),
    [selectedPlayer.roster],
  )
  const [activeEntityId, setActiveEntityId] = useState(() => entityTabs[0]?.id ?? null)
  const activeEntity = selectedPlayer.roster.find((entity) => entity.id === activeEntityId) ?? selectedPlayer.roster[0]

  if (!activeEntity) {
    return (
      <article className="panel panel--roster">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Строй игрока</p>
            <h2>{selectedPlayer.name}</h2>
          </div>
        </div>
        <p>Пока нет юнитов в составе.</p>
      </article>
    )
  }

  const data = getEntityCardData(catalog, activeEntity)
  const factionColor = getFactionPalette(catalog, selectedPlayer.factionId)
  const formationLayout = buildFormationLayout({
    modelsRemaining: data.modelsRemaining,
    frontage: activeEntity.components.formation.frontage,
    maxFiles: activeEntity.components.formation.maxFiles,
    modelWidth: activeEntity.components.formation.modelWidth,
    modelDepth: activeEntity.components.formation.modelDepth,
  })

  return (
    <article className="panel panel--roster">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Строй игрока</p>
          <h2>{selectedPlayer.name}</h2>
        </div>
      </div>

      <TabBar
        tabs={entityTabs}
        activeId={activeEntity.id}
        onChange={setActiveEntityId}
        ariaLabel="Сущности в строю"
        className="tab-bar--compact"
      />

      <article className="entity-card" style={{ '--accent-color': factionColor }}>
        <div className="entity-card__top">
          <div>
            <strong>{activeEntity.name}</strong>
            <p>
              {activeEntity.kind === 'unit'
                ? `${data.modelsRemaining}/${activeEntity.components.formation.models} моделей`
                : `HP ${activeEntity.state.currentHealth}/${activeEntity.components.health.max}`}
            </p>
          </div>
          <button type="button" className="dismiss-button" onClick={() => setCampaign(dismissEntity(campaign, selectedPlayer.id, activeEntity.id))}>
            Распустить
          </button>
        </div>

        <div className="entity-card__stats">
          <span>{activeEntity.components.combat.armorType}</span>
          <span>{activeEntity.components.combat.weaponType}</span>
          <span>MV {activeEntity.components.combat.movement}</span>
          <span>MO {activeEntity.components.combat.morale}</span>
          <span>SK {activeEntity.components.combat.skill}</span>
          <span>{activeEntity.components.formation.row === 'reserve' ? 'Резерв' : getFacingLabel(activeEntity.components.formation.facing)}</span>
        </div>

        <div className="entity-card__formation">
          <div className="entity-card__formation-metrics">
            <span>{formationLayout.files} в ряд</span>
            <span>{formationLayout.ranks} в глубину</span>
            <span>{activeEntity.components.formation.width}x{activeEntity.components.formation.depth} footprint</span>
            <span>{activeEntity.components.formation.modelClass}</span>
          </div>

          {formationLayout.slots.length > 0 && (
            <div
              className="entity-card__formation-grid"
              style={{ '--formation-columns': formationLayout.gridWidth, '--formation-rows': formationLayout.gridDepth }}
            >
              {formationLayout.slots.map((slot) => (
                <span
                  key={slot.id}
                  className={`entity-card__formation-model entity-card__formation-model--${activeEntity.components.formation.modelClass}`}
                  style={{
                    '--model-color': factionColor,
                    gridColumn: `${slot.x + 1} / span ${slot.width}`,
                    gridRow: `${slot.y + 1} / span ${slot.depth}`,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="entity-card__actions">
          <button type="button" className="ghost-button" onClick={() => setCampaign(rotateEntityOnBattlefield(campaign, selectedPlayer.id, activeEntity.id, 'left'))}>
            Повернуть влево
          </button>
          <button type="button" className="ghost-button" onClick={() => setCampaign(rotateEntityOnBattlefield(campaign, selectedPlayer.id, activeEntity.id, 'right'))}>
            Повернуть вправо
          </button>
          <button type="button" className="ghost-button" onClick={() => setCampaign(toggleEntityReserve(campaign, selectedPlayer.id, activeEntity.id))}>
            {activeEntity.components.formation.row === 'reserve' ? 'Выставить' : 'В резерв'}
          </button>
          {activeEntity.kind === 'hero' && <span className="hero-copy">{describeHero(activeEntity)}</span>}
        </div>

        {activeEntity.kind === 'hero' && !activeEntity.components.hero.mounted && (
          <div className="attach-strip">
            {selectedPlayer.roster.filter((candidate) => candidate.kind === 'unit').map((unit) => (
              <button
                key={unit.id}
                type="button"
                className={`attach-chip ${activeEntity.state.attachedTo === unit.id ? 'attach-chip--active' : ''}`}
                onClick={() => setCampaign(attachHero(campaign, selectedPlayer.id, activeEntity.id, unit.id))}
              >
                {activeEntity.state.attachedTo === unit.id ? `В отряде ${unit.name}` : `Встроить в ${unit.name}`}
              </button>
            ))}
          </div>
        )}

        {activeEntity.kind === 'hero' && data.canLevel && activeEntity.components.progression.pendingDraft.length === 0 && (
          <button type="button" className="primary-button primary-button--small" onClick={() => setCampaign(prepareHeroDraft(campaign, catalog, selectedPlayer.id, activeEntity.id))}>
            Открыть draft улучшений
          </button>
        )}

        {activeEntity.kind === 'hero' && activeEntity.components.progression.pendingDraft.length > 0 && (
          <div className="draft-grid">
            {activeEntity.components.progression.pendingDraft.map((upgradeId) => {
              const upgrade = getUpgradeSummary(catalog, upgradeId)
              return (
                <button
                  key={upgradeId}
                  type="button"
                  className="draft-card"
                  onClick={() => setCampaign(pickHeroDraft(campaign, selectedPlayer.id, activeEntity.id, upgradeId))}
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
    </article>
  )
}