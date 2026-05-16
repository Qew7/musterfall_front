import { createBattlePhase, resolveAttackPhase } from './BattlePhase'

export function playMagicPhase({ actingSide, targetSide, roundNumber }) {
  return resolveAttackPhase({
    phase: createBattlePhase('magic', 'Фаза магии'),
    actingSide,
    targetSide,
    roundNumber,
    attackType: 'magic',
  })
}