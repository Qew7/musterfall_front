import { createBattlePhase, resolveAttackPhase } from './BattlePhase'

export function playShootingPhase({ actingSide, targetSide, roundNumber }) {
  return resolveAttackPhase({
    phase: createBattlePhase('shooting', 'Фаза стрельбы'),
    actingSide,
    targetSide,
    roundNumber,
    attackType: 'shooting',
  })
}