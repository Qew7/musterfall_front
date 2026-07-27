import { describe, expect, it } from 'vitest'
import { projectBattleReplay } from './replayProjection.js'

function unit(overrides) {
  return {
    entityId: 'u1',
    name: 'A',
    x: 8,
    y: 20,
    facing: 0,
    baseWidth: 2,
    baseDepth: 2,
    sideKey: 'left',
    ...overrides,
  }
}

describe('projectBattleReplay movement frames', () => {
  it('animates all side movers together on shared wheel then march frames', () => {
    const initial = [
      unit({ entityId: 'a', name: 'A', x: 8, y: 20 }),
      unit({ entityId: 'b', name: 'B', x: 10, y: 10 }),
    ]
    const afterBoth = [
      unit({ entityId: 'a', name: 'A', x: 10.27, y: 20.04, facing: 338.6 }),
      unit({ entityId: 'b', name: 'B', x: 14, y: 12, facing: 20 }),
    ]

    const battle = {
      rounds: [{
        number: 1,
        turns: [{
          playerId: 'p1',
          playerName: 'Полководец',
          phases: [{
            type: 'movement',
            label: 'Движение',
            events: [],
            actions: [
              {
                type: 'movement',
                actorId: 'a',
                actorName: 'A',
                summary: 'A moves',
                details: ['dev A'],
                from: { x: 8, y: 20, facing: 0, row: 'front', lane: 'right' },
                wheel: { x: 8.87, y: 20.59, facing: 338.6, delta: -21.4, cost: 1.5 },
                to: { x: 10.27, y: 20.04, facing: 338.6, row: 'front', lane: 'right' },
                snapshot: afterBoth,
              },
              {
                type: 'movement',
                actorId: 'b',
                actorName: 'B',
                summary: 'B moves',
                details: ['dev B'],
                from: { x: 10, y: 10, facing: 0, row: 'front', lane: 'left' },
                wheel: { x: 10.2, y: 10.1, facing: 20, delta: 20, cost: 1 },
                to: { x: 14, y: 12, facing: 20, row: 'front', lane: 'left' },
                snapshot: afterBoth,
              },
            ],
          }],
        }],
      }],
    }

    const { frames } = projectBattleReplay({ battle, initialSnapshot: initial })
    const movement = frames.filter((frame) => frame.phaseType === 'movement')

    expect(movement.map((frame) => frame.id)).toEqual([
      '1-p1-movement-0-wheel',
      '1-p1-movement-0',
    ])

    const wheel = movement[0]
    expect(wheel.units.find((entry) => entry.entityId === 'a')).toMatchObject({
      x: 8.87,
      y: 20.59,
      facing: 338.6,
    })
    expect(wheel.units.find((entry) => entry.entityId === 'b')).toMatchObject({
      x: 10.2,
      y: 10.1,
      facing: 20,
    })
    expect(Object.keys(wheel.overlay.unitMotions).sort()).toEqual(['a', 'b'])
    expect(wheel.logEntries).toEqual(['A moves', 'B moves'])

    const march = movement[1]
    expect(march.units).toEqual(afterBoth)
    expect(Object.keys(march.overlay.unitMotions).sort()).toEqual(['a', 'b'])
    expect(march.logEntries).toEqual([])
  })

  it('splits player summaries from developer details on attack frames', () => {
    const units = [unit({ entityId: 'a' })]
    const battle = {
      rounds: [{
        number: 1,
        turns: [{
          playerId: 'p1',
          playerName: 'Полководец',
          phases: [{
            type: 'melee',
            label: 'Ближний бой',
            events: [],
            actions: [{
              type: 'melee',
              actorId: 'a',
              actorName: 'A',
              actorRole: 'unit',
              targetName: 'B',
              vector: 'front',
              damage: 2,
              summary: 'A hits B',
              details: ['hits=2', 'wounds=1'],
              snapshot: units,
              affectedIds: [],
              blockers: [],
            }],
          }],
        }],
      }],
    }

    const { frames } = projectBattleReplay({ battle, initialSnapshot: units })
    const melee = frames.find((frame) => frame.phaseType === 'melee')
    expect(melee.logEntries).toEqual(['A hits B'])
    expect(melee.devLogEntries).toEqual(['hits=2', 'wounds=1'])
  })
})
