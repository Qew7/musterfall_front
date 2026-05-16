import { createBattlePhase, resolveAttackPhase } from './BattlePhase'

export function playMeleePhase({ actingSide, targetSide, roundNumber }) {
  return resolveAttackPhase({
    phase: createBattlePhase('melee', 'Фаза боя'),
    actingSide,
    targetSide,
    roundNumber,
    attackType: 'melee',
  })
}