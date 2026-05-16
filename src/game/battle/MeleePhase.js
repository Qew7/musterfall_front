import { createBattlePhase, resolveAttackPhase } from './BattlePhase'
import { resolvePostMeleeMorale } from './MoralePhase'

export function playMeleePhase({ actingSide, targetSide, roundNumber }) {
  const phase = createBattlePhase('melee', 'Фаза боя')

  resolveAttackPhase({
    phase,
    actingSide,
    targetSide,
    roundNumber,
    attackType: 'melee',
  })

  resolveAttackPhase({
    phase,
    actingSide: targetSide,
    targetSide: actingSide,
    roundNumber,
    attackType: 'melee',
  })

  return resolvePostMeleeMorale({ phase, actingSide, targetSide, roundNumber })
}