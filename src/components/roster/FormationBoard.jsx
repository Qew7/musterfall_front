import { useMemo, useState } from 'react'
import { BattlefieldBoard } from '../battlefield/BattlefieldBoard'
import { battlefieldConfig, getFacingLabel, getHeadingTo, rotateFacing } from '../../game/battlefield'
import { autoDeployPlayer, rotateEntityOnBattlefield, setEntityBattlefieldTransform, toggleEntityReserve } from '../../game/engine'
import { healthToModels } from '../../game/entities'
import { getPlacementDiagnostics, getPreviewOverlay, getWheelSweepDiagnostics } from '../../game/placementPreview'

export function FormationBoard({ campaign, selectedPlayer, setCampaign }) {
  const movableEntities = useMemo(() => {
    return selectedPlayer.roster.filter((entity) => !(entity.kind === 'hero' && entity.state.attachedTo))
  }, [selectedPlayer.roster])

  const [selectedEntityId, setSelectedEntityId] = useState(() => movableEntities[0]?.id ?? null)
  const [dragState, setDragState] = useState(null)
  const selectedEntity = movableEntities.find((entity) => entity.id === selectedEntityId) ?? movableEntities[0] ?? null
  const interactiveZone = { xMin: 0, xMax: battlefieldConfig.deploymentDepth - 1, yMin: 0, yMax: battlefieldConfig.height - 1 }

  const snapshot = {
    units: movableEntities
      .filter((entity) => entity.components.formation.row !== 'reserve')
      .map((entity) => ({
        entityId: entity.id,
        kind: entity.kind,
        sideKey: 'left',
        name: entity.name,
        x: entity.components.formation.x,
        y: entity.components.formation.y,
        facing: entity.components.formation.facing,
        frontage: entity.components.formation.frontage,
        maxFiles: entity.components.formation.maxFiles,
        files: entity.components.formation.files,
        ranks: entity.components.formation.ranks,
        baseWidth: entity.components.formation.width,
        baseDepth: entity.components.formation.depth,
        modelClass: entity.components.formation.modelClass,
        modelWidth: entity.components.formation.modelWidth,
        modelDepth: entity.components.formation.modelDepth,
        currentHealth: entity.state.currentHealth,
        maxHealth: entity.components.health.max,
        modelsRemaining: healthToModels(entity),
      })),
  }
  const previewDiagnostics = dragState
    ? getPlacementDiagnostics({
        candidate: {
          entityId: dragState.entity.id,
          name: dragState.entity.name,
          x: dragState.preview.x,
          y: dragState.preview.y,
          facing: dragState.preview.facing,
          baseWidth: dragState.entity.components.formation.width,
          baseDepth: dragState.entity.components.formation.depth,
        },
        units: snapshot.units,
        interactiveZone,
        ignoreEntityId: dragState.entity.id,
      })
    : null
  const wheelDiagnostics = dragState
    ? getWheelSweepDiagnostics({
        candidate: {
          entityId: dragState.entity.id,
          name: dragState.entity.name,
          x: dragState.preview.x,
          y: dragState.preview.y,
          facing: dragState.preview.facing,
          baseWidth: dragState.entity.components.formation.width,
          baseDepth: dragState.entity.components.formation.depth,
        },
        fromFacing: dragState.origin.facing,
        toFacing: dragState.preview.facing,
        units: snapshot.units,
        interactiveZone,
        ignoreEntityId: dragState.entity.id,
      })
    : null

  function commitPreviewPlacement(previewState) {
    setCampaign(
      setEntityBattlefieldTransform(campaign, selectedPlayer.id, previewState.entity.id, {
        x: previewState.preview.x,
        y: previewState.preview.y,
        facing: previewState.preview.facing,
      }),
    )
    setDragState(null)
  }

  function getPlacementStateForCell(previewState, x, y) {
    const isRotateMode = previewState.mode === 'rotate'
    const nextX = isRotateMode ? previewState.preview.x : x
    const nextY = isRotateMode ? previewState.preview.y : y
    const facing = x === nextX && y === nextY
      ? previewState.preview.facing
      : getHeadingTo({ x: nextX, y: nextY }, { x, y })
    const nextState = {
      ...previewState,
      preview: { x: nextX, y: nextY, facing },
    }
    const candidate = {
      entityId: nextState.entity.id,
      name: nextState.entity.name,
      x: nextX,
      y: nextY,
      facing,
      baseWidth: nextState.entity.components.formation.width,
      baseDepth: nextState.entity.components.formation.depth,
    }
    const nextDiagnostics = getPlacementDiagnostics({
      candidate,
      units: snapshot.units,
      interactiveZone,
      ignoreEntityId: nextState.entity.id,
    })
    const nextWheelDiagnostics = getWheelSweepDiagnostics({
      candidate,
      fromFacing: nextState.origin.facing,
      toFacing: facing,
      units: snapshot.units,
      interactiveZone,
      ignoreEntityId: nextState.entity.id,
    })

    return {
      nextState,
      isLegal: nextDiagnostics.isLegal && !nextWheelDiagnostics.isBlocked,
    }
  }

  const previewPlacement = dragState
    ? {
        entityId: dragState.entity.id,
      kind: dragState.entity.kind,
        name: dragState.entity.name,
        x: dragState.preview.x,
        y: dragState.preview.y,
        facing: dragState.preview.facing,
      frontage: dragState.entity.components.formation.frontage,
      maxFiles: dragState.entity.components.formation.maxFiles,
      files: dragState.entity.components.formation.files,
      ranks: dragState.entity.components.formation.ranks,
        baseWidth: dragState.entity.components.formation.width,
        baseDepth: dragState.entity.components.formation.depth,
      modelClass: dragState.entity.components.formation.modelClass,
      modelWidth: dragState.entity.components.formation.modelWidth,
      modelDepth: dragState.entity.components.formation.modelDepth,
        modelsRemaining: healthToModels(dragState.entity),
        isLegal: Boolean(previewDiagnostics?.isLegal) && !wheelDiagnostics?.isBlocked,
        reasons: [...(previewDiagnostics?.reasons ?? []), ...(wheelDiagnostics?.reasons ?? [])],
        wheelBlocked: Boolean(wheelDiagnostics?.isBlocked),
        overlay: getPreviewOverlay({
          origin: {
            x: dragState.origin.x,
            y: dragState.origin.y,
            facing: dragState.origin.facing,
            baseWidth: dragState.entity.components.formation.width,
            baseDepth: dragState.entity.components.formation.depth,
          },
          preview: {
            x: dragState.preview.x,
            y: dragState.preview.y,
            facing: dragState.preview.facing,
            baseWidth: dragState.entity.components.formation.width,
            baseDepth: dragState.entity.components.formation.depth,
          },
        }),
      }
    : null

  return (
    <section className="formation-board">
      <div className="formation-board__header">
        <div>
          <h2>Поле расстановки</h2>
          <p>Выбирайте отряд, кликайте по клетке своей зоны и задавайте facing. Во время боя противник появится напротив на том же поле.</p>
          <p>Можно перетаскивать отряд: направление drag задаёт его facing, а preview сразу показывает реальный footprint, wheel и illegal placement.</p>
        </div>
        <button type="button" className="ghost-button" onClick={() => setCampaign(autoDeployPlayer(campaign, selectedPlayer.id))}>
          Авторасстановка
        </button>
      </div>

      <BattlefieldBoard
        snapshot={snapshot}
        selectedUnitId={selectedEntity?.id ?? null}
        onSelectUnit={setSelectedEntityId}
        onCellClick={(x, y) => {
          if (!selectedEntity) {
            return
          }

          if (dragState && dragState.entity.id === selectedEntity.id) {
            const { nextState, isLegal } = getPlacementStateForCell(dragState, x, y)
            setDragState(nextState)

            if (isLegal) {
              commitPreviewPlacement(nextState)
            }

            return
          }

          setCampaign(setEntityBattlefieldTransform(campaign, selectedPlayer.id, selectedEntity.id, { x, y }))
        }}
        onCellHover={(x, y) => {
          if (!dragState) {
            return
          }

          const { nextState } = getPlacementStateForCell(dragState, x, y)
          setDragState(nextState)
        }}
        onUnitPointerDown={(entityId) => {
          const entity = movableEntities.find((entry) => entry.id === entityId)
          if (!entity) {
            return
          }

          setSelectedEntityId(entityId)
          setDragState({
            mode: 'move',
            entity,
            origin: {
              x: entity.components.formation.x,
              y: entity.components.formation.y,
              facing: entity.components.formation.facing,
            },
            preview: {
              x: entity.components.formation.x,
              y: entity.components.formation.y,
              facing: entity.components.formation.facing,
            },
          })
        }}
        onUnitRotateStart={(entityId) => {
          const entity = movableEntities.find((entry) => entry.id === entityId)
          if (!entity) {
            return
          }

          setSelectedEntityId(entityId)
          setDragState({
            mode: 'rotate',
            entity,
            origin: {
              x: entity.components.formation.x,
              y: entity.components.formation.y,
              facing: entity.components.formation.facing,
            },
            preview: {
              x: entity.components.formation.x,
              y: entity.components.formation.y,
              facing: entity.components.formation.facing,
            },
          })
        }}
        onSurfacePointerUp={() => {
          if (!dragState) {
            return
          }
        }}
        onRotatePreview={(direction) => {
          setDragState((current) => {
            if (!current) {
              return current
            }

            return {
              ...current,
              preview: {
                ...current.preview,
                facing: rotateFacing(current.preview.facing, direction === 'left' ? -45 : 45),
              },
            }
          })
        }}
        interactiveZone={interactiveZone}
        previewPlacement={previewPlacement}
      />

      {dragState && previewPlacement && (
        <div className="formation-board__preview-bar">
          <div className={`formation-board__preview-status ${previewPlacement.isLegal ? 'formation-board__preview-status--legal' : 'formation-board__preview-status--illegal'}`}>
            <strong>{previewPlacement.isLegal ? 'Preview ready' : 'Placement blocked'}</strong>
            <span>
              {previewPlacement.name}: {previewPlacement.x}, {previewPlacement.y} · {getFacingLabel(previewPlacement.facing)}
            </span>
          </div>

          {previewPlacement.reasons.length > 0 && (
            <div className="formation-board__preview-reasons">
              {previewPlacement.reasons.map((reason) => (
                <span key={reason}>{reason}</span>
              ))}
            </div>
          )}

          <div className="entity-card__actions">
            <button
              type="button"
              className="ghost-button"
              onClick={() => commitPreviewPlacement(dragState)}
              disabled={!previewPlacement.isLegal}
            >
              Commit preview
            </button>
            <button type="button" className="ghost-button" onClick={() => setDragState(null)}>
              Cancel preview
            </button>
          </div>
        </div>
      )}

      <div className="formation-board__controls">
        {movableEntities.map((entity) => (
          <button
            key={entity.id}
            type="button"
            className={`player-tab ${entity.id === selectedEntity?.id ? 'player-tab--active' : ''}`}
            onClick={() => setSelectedEntityId(entity.id)}
          >
            <strong>{entity.name}</strong>
            <span>{entity.components.formation.row === 'reserve' ? 'Резерв' : `Facing: ${getFacingLabel(entity.components.formation.facing)}`}</span>
            <small>{entity.kind === 'unit' ? `${healthToModels(entity)} моделей` : `${entity.state.currentHealth} HP`}</small>
          </button>
        ))}
      </div>

      {selectedEntity && (
        <div className="entity-card__actions">
          <button
            type="button"
            className="ghost-button"
            onClick={() => setCampaign(rotateEntityOnBattlefield(campaign, selectedPlayer.id, selectedEntity.id, 'left'))}
          >
            Повернуть влево
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => setCampaign(rotateEntityOnBattlefield(campaign, selectedPlayer.id, selectedEntity.id, 'right'))}
          >
            Повернуть вправо
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => setCampaign(toggleEntityReserve(campaign, selectedPlayer.id, selectedEntity.id))}
          >
            {selectedEntity.components.formation.row === 'reserve' ? 'Выставить на поле' : 'Убрать в резерв'}
          </button>
        </div>
      )}
    </section>
  )
}