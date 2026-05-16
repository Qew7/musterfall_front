import { createBattlePhase, resolveAttackPhase } from './BattlePhase'
import { resolvePostMeleeMorale } from './MoralePhase'

export function playMeleePhase({ actingSide, targetSide, roundNumber }) {
  const phase = createBattlePhase('melee', 'Фаза боя')
  phase.allowRoutingMelee = false

  resolveAttackPhase({
    phase,
    actingSide,
    targetSide,
    roundNumber,
    attackType: 'melee',
  })

  phase.allowRoutingMelee = true
  resolveAttackPhase({
    phase,
    actingSide: targetSide,
    targetSide: actingSide,
    roundNumber,
    attackType: 'melee',
  })

  return resolvePostMeleeMorale({ phase, actingSide, targetSide, roundNumber })
}