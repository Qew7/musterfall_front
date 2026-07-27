import { describe, expect, it } from 'vitest'
import {
  localBoardSide,
  projectOverlayToViewer,
  projectUnitsToViewer,
  shouldFlipForViewer,
  toViewerPose,
} from './viewerFrame.js'

describe('viewerFrame', () => {
  const battle = {
    left: { playerId: 'p-left' },
    right: { playerId: 'p-right' },
  }

  it('resolves local board side from focusPlayerId', () => {
    expect(localBoardSide(battle, 'p-left')).toBe('left')
    expect(localBoardSide(battle, 'p-right')).toBe('right')
    expect(localBoardSide(battle, 'spectator')).toBe(null)
    expect(localBoardSide(battle, null)).toBe(null)
  })

  it('flips only when local side is right', () => {
    expect(shouldFlipForViewer('left')).toBe(false)
    expect(shouldFlipForViewer('right')).toBe(true)
    expect(shouldFlipForViewer(null)).toBe(false)
  })

  it('mirrors pose like backend mirror_deployment', () => {
    expect(toViewerPose({ x: 2, y: 3, facing: 0 }, { width: 40, height: 24 })).toEqual({
      x: 37,
      y: 20,
      facing: 180,
    })
    expect(toViewerPose({ x: 37, y: 20, facing: 180 }, { width: 40, height: 24 })).toEqual({
      x: 2,
      y: 3,
      facing: 0,
    })
  })

  it('projects units only when flip is enabled', () => {
    const units = [{ entityId: 'u1', x: 2, y: 3, facing: 0, sideKey: 'right' }]
    expect(projectUnitsToViewer(units, false)).toBe(units)
    expect(projectUnitsToViewer(units, true, { width: 40, height: 24 })).toEqual([
      { entityId: 'u1', x: 37, y: 20, facing: 180, sideKey: 'right' },
    ])
  })

  it('projects overlay motion samples without rewriting world geometry', () => {
    const overlay = {
      path: { start: { x: 1, y: 2 }, end: { x: 3, y: 4 } },
      unitMotions: {
        u1: {
          kind: 'march',
          samples: [
            { x: 2, y: 3, facing: 0 },
            { x: 4, y: 5, facing: 45 },
          ],
        },
      },
    }

    const projected = projectOverlayToViewer(overlay, true, { width: 40, height: 24 })
    expect(projected.path).toEqual(overlay.path)
    expect(projected.unitMotions.u1.samples).toEqual([
      { x: 37, y: 20, facing: 180 },
      { x: 35, y: 18, facing: 225 },
    ])
    expect(projectOverlayToViewer(overlay, false)).toBe(overlay)
  })
})
