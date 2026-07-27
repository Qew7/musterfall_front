import { describe, expect, it } from 'vitest'
import {
  buildSyncedMotionKeyframes,
  getUnitCorners,
  getWheelPivot,
  sampleWheelPoses,
} from '../battlefield.js'
import { projectBattleReplay } from './replayProjection.js'

function pivotCorner(unit, delta) {
  const corners = getUnitCorners(unit)
  return delta < 0 ? corners[0] : corners[1]
}

describe('wheel geometry', () => {
  it('keeps the pivot front corner fixed across sampleWheelPoses', () => {
    const origin = { x: 20, y: 12, facing: 0, baseWidth: 4, baseDepth: 2 }
    for (const delta of [-60, 45, 90]) {
      const pivot = getWheelPivot(origin, delta)
      const samples = sampleWheelPoses(origin, delta, 12)
      samples.forEach((sample, index) => {
        const corner = pivotCorner({ ...origin, ...sample }, delta)
        expect(corner.x, `delta=${delta} i=${index}`).toBeCloseTo(pivot.x, 5)
        expect(corner.y, `delta=${delta} i=${index}`).toBeCloseTo(pivot.y, 5)
      })
    }
  })
})

describe('synced wheel motion keyframes', () => {
  it('replay wheel samples include facing for WAAPI', () => {
    const initial = [{
      entityId: 'a',
      name: 'A',
      x: 8,
      y: 20,
      facing: 0,
      baseWidth: 4,
      baseDepth: 2,
      sideKey: 'left',
    }]
    const after = [{
      ...initial[0],
      x: 10,
      y: 20.5,
      facing: 315,
    }]
    const battle = {
      rounds: [{
        number: 1,
        turns: [{
          playerId: 'p1',
          playerName: 'P',
          phases: [{
            type: 'movement',
            label: 'Движение',
            events: [],
            actions: [{
              type: 'movement',
              actorId: 'a',
              actorName: 'A',
              summary: 'A wheels',
              from: { x: 8, y: 20, facing: 0 },
              wheel: { x: 9.2, y: 20.4, facing: 315, delta: -45, cost: 3 },
              to: { x: 10, y: 20.5, facing: 315 },
              snapshot: after,
            }],
          }],
        }],
      }],
    }

    const { frames } = projectBattleReplay({ battle, initialSnapshot: initial })
    const wheelFrame = frames.find((frame) => frame.id?.endsWith('-wheel'))
    const samples = wheelFrame.overlay.unitMotions.a.samples

    expect(samples.length).toBeGreaterThan(2)
    expect(samples[0]).toHaveProperty('facing')
    expect(samples.at(-1).facing).toBeCloseTo(315, 5)
  })

  it('keeps pivot fixed when left/top/--facing share one sample timeline', () => {
    const origin = { x: 20, y: 12, facing: 0, baseWidth: 4, baseDepth: 2 }
    const delta = -60
    const pivot = getWheelPivot(origin, delta)
    const samples = sampleWheelPoses(origin, delta, 20)
    const keyframes = buildSyncedMotionKeyframes(samples, {
      width: 48,
      height: 36,
      startFacing: origin.facing,
    })

    let maxDrift = 0
    keyframes.forEach((frame, index) => {
      const sample = samples[index]
      const corner = pivotCorner({
        ...origin,
        x: sample.x,
        y: sample.y,
        facing: frame.facing,
      }, delta)
      maxDrift = Math.max(maxDrift, Math.hypot(corner.x - pivot.x, corner.y - pivot.y))
      expect(frame).toHaveProperty('--facing', `${frame.facing}deg`)
    })

    expect(maxDrift).toBeLessThan(0.001)
  })
})
