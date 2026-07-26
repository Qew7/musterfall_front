import { projectBattleReplay } from '../battle/replayProjection'
import { syncEntityCounterFromCampaign } from '../entities'

export function enrichCampaignBattles(campaign) {
  if (!campaign) {
    return campaign
  }

  syncEntityCounterFromCampaign(campaign)

  if (!campaign?.lastRoundReport?.matchups) {
    return campaign
  }

  return {
    ...campaign,
    lastRoundReport: {
      ...campaign.lastRoundReport,
      byes: campaign.lastRoundReport.byes ?? [],
      matchups: campaign.lastRoundReport.matchups.map((battle) => {
        const battleId = battle.battleId ?? `${battle.left?.playerId}-${battle.right?.playerId}-r${campaign.lastRoundReport.round}`
        const initialSnapshot = battle.initialSnapshot ?? []
        const replay = projectBattleReplay({ battle, initialSnapshot })
        return {
          ...battle,
          battleId,
          replay,
        }
      }),
    },
  }
}
