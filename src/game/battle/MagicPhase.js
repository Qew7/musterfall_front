import { createBattlePhase, resolveAttackPhase } from './BattlePhase'
import { resolvePostMissileMorale } from './MoralePhase'

export function playMagicPhase({ actingSide, targetSide, roundNumber }) {
  const phase = resolveAttackPhase({
    phase: createBattlePhase('magic', 'Фаза магии'),
    actingSide,
    targetSide,
    roundNumber,
    attackType: 'magic',
  })

  return resolvePostMissileMorale({ phase, actingSide, targetSide, roundNumber, attackType: 'magic' })
}