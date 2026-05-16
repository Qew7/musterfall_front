import { playBattleTurn } from './BattleTurn'
import { applyFactionPassives, hasLivingCombatants } from './support'

export function playBattleRound({ battle, roundNumber }) {
  const round = {
    number: roundNumber,
    turns: [],
    events: [],
  }

  const turnPairs = [
    { actingSide: battle.sides.left, targetSide: battle.sides.right },
    { actingSide: battle.sides.right, targetSide: battle.sides.left },
  ]

  turnPairs.forEach(({ actingSide, targetSide }) => {
    if (!hasLivingCombatants(actingSide) || !hasLivingCombatants(targetSide)) {
      return
    }

    round.turns.push(playBattleTurn({ battle, roundNumber, actingSide, targetSide }))
  })

  round.events.push(...applyFactionPassives(battle.sides.left))
  round.events.push(...applyFactionPassives(battle.sides.right))

  return round
}