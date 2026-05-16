import { playBattleRound } from './BattleRound'
import { projectBattleReplay } from './replayProjection'
import {
  areAllLivingCombatantsRouting,
  createBattleState,
  getSideHealth,
  hasLivingCombatants,
  snapshotBattlefieldState,
  snapshotSide,
  syncBattleState,
} from './support'

const maxBattleRounds = 6

export function simulateBattle(playerA, playerB, catalog) {
  const battle = createBattleState(playerA, playerB, catalog)
  const initialSnapshot = snapshotBattlefieldState([battle.sides.left, battle.sides.right])

  for (let roundNumber = 1; roundNumber <= maxBattleRounds; roundNumber += 1) {
    if (!hasLivingCombatants(battle.sides.left) || !hasLivingCombatants(battle.sides.right)) {
      break
    }

    if (areAllLivingCombatantsRouting([battle.sides.left, battle.sides.right])) {
      break
    }

    battle.rounds.push(playBattleRound({ battle, roundNumber }))
  }

  const totalA = getSideHealth(battle.sides.left)
  const totalB = getSideHealth(battle.sides.right)
  const winnerId = totalA >= totalB ? playerA.id : playerB.id

  syncBattleState(battle)

  return {
    battleId: `${playerA.id}-${playerB.id}-r${Date.now()}`,
    rounds: battle.rounds,
    initialSnapshot,
    left: snapshotSide(playerA, battle.sides.left, catalog),
    right: snapshotSide(playerB, battle.sides.right, catalog),
    winnerId,
    winnerName: winnerId === playerA.id ? playerA.name : playerB.name,
    summary: `${playerA.name} ${totalA} vs ${totalB} ${playerB.name}`,
    events: flattenBattleEvents(battle.rounds).slice(0, 24),
    replay: projectBattleReplay({ battle, initialSnapshot }),
  }
}

function flattenBattleEvents(rounds) {
  return rounds.flatMap((round) => {
    const turnEvents = round.turns.flatMap((turn) => {
      const phaseEvents = turn.phases.flatMap((phase) => {
        if (phase.actions.length > 0) {
          return phase.actions.map((action) => action.summary)
        }

        return phase.events.slice(0, 1).map((entry) => `${phase.label}: ${entry}`)
      })

      return [`Ход игрока: ${turn.playerName}`, ...phaseEvents]
    })

    return [`Раунд ${round.number}`, ...turnEvents, ...round.events]
  })
}