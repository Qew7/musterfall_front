import { createBattlePhase, resolveAttackPhase } from './BattlePhase'
import { resolvePostMissileMorale } from './MoralePhase'

export function playShootingPhase({ actingSide, targetSide, roundNumber }) {
  const phase = resolveAttackPhase({
    phase: createBattlePhase('shooting', 'Фаза стрельбы'),
    actingSide,
    targetSide,
    roundNumber,
    attackType: 'shooting',
  })

  return resolvePostMissileMorale({ phase, actingSide, targetSide, roundNumber, attackType: 'shooting' })
}