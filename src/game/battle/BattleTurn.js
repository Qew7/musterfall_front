import { playStartPhase } from './MoralePhase'
import { playMovementPhase } from './MovementPhase'
import { playMagicPhase } from './MagicPhase'
import { playShootingPhase } from './ShootingPhase'
import { playMeleePhase } from './MeleePhase'

export function playBattleTurn({ battle, roundNumber, actingSide, targetSide }) {
  const turn = {
    playerId: actingSide.playerId,
    playerName: actingSide.playerName,
    phases: [],
  }

  const phaseContext = { battle, roundNumber, actingSide, targetSide, turn }

  turn.phases.push(playStartPhase(phaseContext))
  turn.phases.push(playMovementPhase(phaseContext))
  turn.phases.push(playMagicPhase(phaseContext))
  turn.phases.push(playShootingPhase(phaseContext))
  turn.phases.push(playMeleePhase(phaseContext))

  return turn
}