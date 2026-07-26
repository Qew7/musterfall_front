import {
  assignFaction,
  attachHero,
  autoDeployPlayer,
  dismissEntity,
  pickHeroDraft,
  recruitEntity,
  rotateEntityOnBattlefield,
  setEntityBattlefieldTransform,
  toggleEntityReserve,
} from '../engine'

export function applyOptimisticCommand(campaign, catalog, command) {
  switch (command.type) {
    case 'assign_faction':
      return assignFaction(campaign, catalog, command.playerId, command.factionId)
    case 'recruit':
      return recruitEntity(campaign, catalog, command.playerId, command.templateId)
    case 'dismiss':
      return dismissEntity(campaign, command.playerId, command.entityId)
    case 'attach_hero':
      return attachHero(campaign, command.playerId, command.heroId, command.unitId)
    case 'deploy_transform':
      return setEntityBattlefieldTransform(campaign, command.playerId, command.entityId, {
        x: command.x,
        y: command.y,
        facing: command.facing,
      })
    case 'deploy_rotate':
      return rotateEntityOnBattlefield(campaign, command.playerId, command.entityId, command.direction)
    case 'deploy_reserve':
      return toggleEntityReserve(campaign, command.playerId, command.entityId)
    case 'deploy_auto':
      return autoDeployPlayer(campaign, command.playerId)
    case 'prepare_hero_draft':
      return campaign
    case 'pick_hero_draft':
      return pickHeroDraft(campaign, command.playerId, command.heroId, command.upgradeId)
    default:
      return campaign
  }
}
