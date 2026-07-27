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
  it('emits wheel then march frames per action and keeps other units still', () => {
    const initial = [
      unit({ entityId: 'a', name: 'A', x: 8, y: 20 }),
      unit({ entityId: 'b', name: 'B', x: 10, y: 10 }),
    ]
    const afterA = [
      unit({ entityId: 'a', name: 'A', x: 10.27, y: 20.04, facing: 338.6 }),
      unit({ entityId: 'b', name: 'B', x: 10, y: 10 }),
    ]
    const afterB = [
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
                snapshot: afterA,
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
                snapshot: afterB,
              },
            ],
          }],
        }],
      }],
    }

    const { frames } = projectBattleReplay({ battle, initialSnapshot: initial })
    const movement = frames.filter((frame) => frame.phaseType === 'movement')

    expect(movement.map((frame) => frame.id)).toEqual([
      '1-p1-movement-0-0-wheel',
      '1-p1-movement-0-0',
      '1-p1-movement-0-1-wheel',
      '1-p1-movement-0-1',
    ])

    const firstWheel = movement[0]
    expect(firstWheel.units.find((entry) => entry.entityId === 'a')).toMatchObject({
      x: 8.87,
      y: 20.59,
      facing: 338.6,
    })
    expect(firstWheel.units.find((entry) => entry.entityId === 'b')).toMatchObject({ x: 10, y: 10 })
    expect(firstWheel.overlay.unitMotions.a.kind).toBe('wheel')
    expect(firstWheel.logEntries).toEqual(['A moves'])
    expect(firstWheel.devLogEntries).toEqual(['dev A'])

    const firstMarch = movement[1]
    expect(firstMarch.units).toEqual(afterA)
    expect(firstMarch.overlay.unitMotions.a.kind).toBe('march')
    expect(firstMarch.overlay.path.start).toMatchObject({ x: 8.87, y: 20.59 })
    expect(firstMarch.logEntries).toEqual([])

    const secondWheel = movement[2]
    expect(secondWheel.units.find((entry) => entry.entityId === 'a')).toMatchObject({
      x: 10.27,
      y: 20.04,
    })
    expect(secondWheel.overlay.activeUnitId).toBe('b')
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
