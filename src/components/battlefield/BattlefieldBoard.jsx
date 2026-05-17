import { battlefieldConfig } from '../../game/battlefield'
import { buildFormationLayout } from '../../game/formation'
import { getFacingZonePolygons, getFootprintGeometry } from '../../game/placementPreview'

export function BattlefieldBoard({
  snapshot,
  selectedUnitId = null,
  onSelectUnit,
  onCellClick,
  onCellHover,
  onUnitPointerDown,
  onUnitRotateStart,
  onSurfacePointerUp,
  onRotatePreview,
  interactiveZone = null,
  previewPlacement = null,
  tacticalOverlay = null,
  showFacingZones = true,
  showCornerMarkers = true,
}) {
  const width = snapshot?.width ?? battlefieldConfig.width
  const height = snapshot?.height ?? battlefieldConfig.height
  const units = snapshot?.units ?? []
  const cells = Array.from({ length: width * height }, (_, index) => {
    const x = index % width
    const y = Math.floor(index / width)
    const isInteractive = interactiveZone
      ? x >= interactiveZone.xMin && x <= interactiveZone.xMax && y >= interactiveZone.yMin && y <= interactiveZone.yMax
      : Boolean(onCellClick)

    return { x, y, isInteractive }
  })
  const selectedUnit = previewPlacement?.entityId === selectedUnitId
    ? previewPlacement
    : units.find((unit) => unit.entityId === selectedUnitId) ?? null
  const selectedZones = showFacingZones && selectedUnit ? getFacingZonePolygons(selectedUnit) : null
  const previewGeometry = previewPlacement ? getFootprintGeometry(previewPlacement) : null

  return (
    <div className="battlefield-board" style={{ '--board-columns': width, '--board-rows': height }}>
      <div className="battlefield-board__surface" onPointerUp={() => onSurfacePointerUp?.()}>
        <svg className="battlefield-board__overlay" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          {selectedZones && (
            <>
              <polygon className="battlefield-board__zone battlefield-board__zone--front" points={selectedZones.front.map((point) => `${point.x},${point.y}`).join(' ')} />
              <polygon className="battlefield-board__zone battlefield-board__zone--flank" points={selectedZones.left.map((point) => `${point.x},${point.y}`).join(' ')} />
              <polygon className="battlefield-board__zone battlefield-board__zone--rear" points={selectedZones.rear.map((point) => `${point.x},${point.y}`).join(' ')} />
              <polygon className="battlefield-board__zone battlefield-board__zone--flank" points={selectedZones.right.map((point) => `${point.x},${point.y}`).join(' ')} />
            </>
          )}

          {previewPlacement?.overlay && (
            <>
              <line
                className={`battlefield-board__path ${previewPlacement.isLegal ? '' : 'battlefield-board__path--illegal'}`}
                x1={previewPlacement.overlay.path.start.x}
                y1={previewPlacement.overlay.path.start.y}
                x2={previewPlacement.overlay.path.end.x}
                y2={previewPlacement.overlay.path.end.y}
              />

              {previewPlacement.overlay.wheelArc && (
                <path
                  className={`battlefield-board__wheel ${previewPlacement.wheelBlocked ? 'battlefield-board__wheel--blocked' : ''}`}
                  d={previewPlacement.overlay.wheelArc}
                />
              )}
            </>
          )}

          {previewGeometry && (
            <polygon
              className={`battlefield-board__footprint ${previewPlacement.isLegal ? '' : 'battlefield-board__footprint--illegal'}`}
              points={previewGeometry.boardCorners.map((point) => `${point.x},${point.y}`).join(' ')}
            />
          )}

          {tacticalOverlay?.path && (
            <line
              className="battlefield-board__path battlefield-board__path--tactical"
              x1={tacticalOverlay.path.start.x + 0.5}
              y1={tacticalOverlay.path.start.y + 0.5}
              x2={tacticalOverlay.path.end.x + 0.5}
              y2={tacticalOverlay.path.end.y + 0.5}
            />
          )}

          {tacticalOverlay?.wheelArc && <path className="battlefield-board__wheel" d={tacticalOverlay.wheelArc} />}

          {tacticalOverlay?.los && (
            <line
              className={`battlefield-board__los ${tacticalOverlay.los.blocked ? 'battlefield-board__los--blocked' : ''}`}
              x1={tacticalOverlay.los.start.x + 0.5}
              y1={tacticalOverlay.los.start.y + 0.5}
              x2={tacticalOverlay.los.end.x + 0.5}
              y2={tacticalOverlay.los.end.y + 0.5}
            />
          )}

          {tacticalOverlay?.template?.shape === 'circle' && (
            <circle
              className="battlefield-board__template"
              cx={tacticalOverlay.template.center.x + 0.5}
              cy={tacticalOverlay.template.center.y + 0.5}
              r={tacticalOverlay.template.radius}
            />
          )}

          {tacticalOverlay?.template?.shape === 'cone' && (
            <polygon
              className="battlefield-board__template"
              points={tacticalOverlay.template.polygon.map((point) => `${point.x},${point.y}`).join(' ')}
            />
          )}
        </svg>

        {cells.map((cell) => {
          const className = `battlefield-board__cell ${cell.isInteractive ? 'battlefield-board__cell--interactive' : ''}`

          if (!onCellClick || !cell.isInteractive) {
            return <div key={`${cell.x}-${cell.y}`} className={className} />
          }

          return (
            <button
              key={`${cell.x}-${cell.y}`}
              type="button"
              className={className}
              onClick={() => onCellClick(cell.x, cell.y)}
              onPointerEnter={() => onCellHover?.(cell.x, cell.y)}
              aria-label={`Поставить отряд в точку ${cell.x}, ${cell.y}`}
            />
          )
        })}

        {previewPlacement && (
          <div
            className="battlefield-unit battlefield-unit--preview"
            style={{
              left: `${((previewPlacement.x + 0.5) / width) * 100}%`,
              top: `${((previewPlacement.y + 0.5) / height) * 100}%`,
              width: `${(previewPlacement.baseWidth / width) * 100}%`,
              height: `${(previewPlacement.baseDepth / height) * 100}%`,
              '--facing': `${previewPlacement.facing}deg`,
            }}
          >
            <span className="battlefield-unit__base">
              <span className="battlefield-unit__face battlefield-unit__face--front" />
              <span className="battlefield-unit__face battlefield-unit__face--rear" />
              <span className="battlefield-unit__face battlefield-unit__face--left" />
              <span className="battlefield-unit__face battlefield-unit__face--right" />
              {showCornerMarkers && (
                <>
                  <span className="battlefield-unit__corner battlefield-unit__corner--front-left" />
                  <span className="battlefield-unit__corner battlefield-unit__corner--front-right" />
                  <span className="battlefield-unit__corner battlefield-unit__corner--rear-right" />
                  <span className="battlefield-unit__corner battlefield-unit__corner--rear-left" />
                </>
              )}
              <BattlefieldUnitModels unit={previewPlacement} />
              <span className="battlefield-unit__arrow" />
            </span>
            <span className="battlefield-unit__label">
              <strong>{previewPlacement.name}</strong>
              <small>{previewPlacement.isLegal ? 'preview ready' : 'illegal placement'}</small>
            </span>
          </div>
        )}

        {units.map((unit) => {
          const widthPercent = `${(unit.baseWidth / width) * 100}%`
          const heightPercent = `${(unit.baseDepth / height) * 100}%`
          const leftPercent = `${((unit.x + 0.5) / width) * 100}%`
          const topPercent = `${((unit.y + 0.5) / height) * 100}%`
          const isSelected = unit.entityId === selectedUnitId
          const toneClass = unit.sideKey === 'right' ? 'battlefield-unit--enemy' : 'battlefield-unit--ally'
          const isTarget = tacticalOverlay?.targetIds?.includes(unit.entityId)
          const isAffected = tacticalOverlay?.affectedIds?.includes(unit.entityId)
          const isBlocked = tacticalOverlay?.blockedIds?.includes(unit.entityId)
          const contactClass = tacticalOverlay?.contactTargetId === unit.entityId && tacticalOverlay.contactVector
            ? `battlefield-unit--contact-${tacticalOverlay.contactVector}`
            : ''

          return (
            <div
              key={unit.entityId}
              className="battlefield-unit-shell"
              style={{ left: leftPercent, top: topPercent, width: widthPercent, height: heightPercent, '--facing': `${unit.facing}deg` }}
            >
              <button
                type="button"
                className={`battlefield-unit ${toneClass} ${isSelected ? 'battlefield-unit--selected' : ''} ${isTarget ? 'battlefield-unit--targeted' : ''} ${isAffected ? 'battlefield-unit--affected' : ''} ${isBlocked ? 'battlefield-unit--blocked' : ''} ${contactClass}`}
                onPointerDown={(event) => onUnitPointerDown?.(unit.entityId, event)}
                onClick={() => onSelectUnit?.(unit.entityId)}
              >
                <span className="battlefield-unit__base">
                  <span className="battlefield-unit__face battlefield-unit__face--front" />
                  <span className="battlefield-unit__face battlefield-unit__face--rear" />
                  <span className="battlefield-unit__face battlefield-unit__face--left" />
                  <span className="battlefield-unit__face battlefield-unit__face--right" />
                  {showCornerMarkers && (
                    <>
                      <span className="battlefield-unit__corner battlefield-unit__corner--front-left" />
                      <span className="battlefield-unit__corner battlefield-unit__corner--front-right" />
                      <span className="battlefield-unit__corner battlefield-unit__corner--rear-right" />
                      <span className="battlefield-unit__corner battlefield-unit__corner--rear-left" />
                    </>
                  )}
                  <BattlefieldUnitModels unit={unit} />
                  <span className="battlefield-unit__arrow" />
                </span>
                <span className="battlefield-unit__label">
                  <strong>{unit.name}</strong>
                  <small>
                    {unit.modelsRemaining > 0 ? `${unit.modelsRemaining} мод.` : `${unit.currentHealth}/${unit.maxHealth} HP`}
                  </small>
                  {unit.isRouting && <small className="battlefield-unit__routing">Белый флаг</small>}
                  {unit.attachedHeroes?.length > 0 && (
                    <small className="battlefield-unit__attachment">
                      Герой: {unit.attachedHeroes.map((hero) => hero.name).join(', ')}
                    </small>
                  )}
                </span>
                {unit.isRouting && <span className="battlefield-unit__flag" aria-hidden="true">&#9872;</span>}
              </button>

              {onUnitRotateStart && (
                <span className="battlefield-unit__corner-controls" aria-hidden="true">
                  {['front-left', 'front-right', 'rear-right', 'rear-left'].map((corner) => (
                    <button
                      key={corner}
                      type="button"
                      className={`battlefield-unit__corner-control battlefield-unit__corner--${corner}`}
                      onPointerDown={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        onUnitRotateStart(unit.entityId, event)
                      }}
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                      }}
                      aria-label={`Повернуть ${unit.name} от угла ${corner}`}
                    />
                  ))}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BattlefieldUnitModels({ unit }) {
  const formationLayout = buildFormationLayout({
    modelsRemaining: unit.modelsRemaining ?? 0,
    frontage: unit.frontage ?? unit.files ?? 1,
    maxFiles: unit.maxFiles ?? unit.files ?? 1,
    modelWidth: unit.modelWidth ?? 1,
    modelDepth: unit.modelDepth ?? 1,
  })

  if (formationLayout.slots.length === 0 || formationLayout.gridWidth === 0 || formationLayout.gridDepth === 0) {
    return null
  }

  const heroSlotMap = getHeroSlotMap(formationLayout, unit.attachedHeroes ?? [])

  return (
    <span className="battlefield-unit__models" aria-hidden="true">
      {formationLayout.slots.map((slot) => (
        <span
          key={slot.id}
          className={`battlefield-unit__model battlefield-unit__model--${unit.modelClass ?? 'infantry'} ${heroSlotMap.has(slot.id) ? 'battlefield-unit__model--hero' : ''}`}
          title={heroSlotMap.get(slot.id)?.name ?? undefined}
          style={{
            left: `${(slot.x / formationLayout.gridWidth) * 100}%`,
            top: `${(slot.y / formationLayout.gridDepth) * 100}%`,
            width: `${(slot.width / formationLayout.gridWidth) * 100}%`,
            height: `${(slot.depth / formationLayout.gridDepth) * 100}%`,
          }}
        >
          {heroSlotMap.has(slot.id) && <span className="battlefield-unit__hero-mark" />}
        </span>
      ))}
    </span>
  )
}

function getHeroSlotMap(layout, attachedHeroes) {
  const map = new Map()

  attachedHeroes.forEach((hero) => {
    const slot = findHeroModelSlot(layout, hero.slot)
    if (slot) {
      map.set(slot.id, hero)
    }
  })

  return map
}

function findHeroModelSlot(layout, heroSide) {
  if (!heroSide || layout.slots.length === 0) {
    return null
  }

  const centerFile = (layout.files - 1) / 2
  const centerRank = (layout.ranks - 1) / 2

  const matches = layout.slots.filter((slot) => {
    if (heroSide === 'front') {
      return slot.rank === 0
    }

    if (heroSide === 'rear') {
      return slot.rank === layout.ranks - 1
    }

    if (heroSide === 'left') {
      return slot.file === 0
    }

    if (heroSide === 'right') {
      return slot.file === layout.files - 1
    }

    return false
  })

  if (matches.length === 0) {
    return null
  }

  return matches
    .slice()
    .sort((left, right) => {
      const leftDistance = heroSide === 'front' || heroSide === 'rear'
        ? Math.abs(left.file - centerFile)
        : Math.abs(left.rank - centerRank)
      const rightDistance = heroSide === 'front' || heroSide === 'rear'
        ? Math.abs(right.file - centerFile)
        : Math.abs(right.rank - centerRank)

      return leftDistance - rightDistance || left.index - right.index
    })[0]
}