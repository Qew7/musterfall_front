import { getFaction, getHeroUpgrade, getTemplate } from './catalog'
import { healthToModels, isDeployable } from './entities'
import { getExperienceThreshold, isHeroLevelReady } from './upgrades'

export function getPlayerSummary(player) {
  const ready = player.roster.filter((entry) => isDeployable(entry) || (entry.kind === 'hero' && entry.state.attachedTo)).length
  return {
    livingUnits: player.roster.filter((entry) => entry.state.currentHealth > 0 && entry.kind === 'unit').length,
    livingHeroes: player.roster.filter((entry) => entry.state.currentHealth > 0 && entry.kind === 'hero').length,
    ready,
  }
}

export function describeHero(hero) {
  const threshold = getExperienceThreshold(hero)
  return `${hero.components.progression.experience}/${threshold} XP, ур. ${hero.components.progression.level}`
}

export function getUpgradeSummary(catalog, upgradeId) {
  return getHeroUpgrade(catalog, upgradeId)
}

export function getEntityCardData(catalog, entity) {
  return {
    template: getTemplate(catalog, entity.templateId),
    modelsRemaining: healthToModels(entity),
    canLevel: entity.kind === 'hero' ? isHeroLevelReady(entity) : false,
  }
}

export function getFactionPalette(catalog, factionId) {
  return getFaction(catalog, factionId)?.color ?? '#6a4a35'
}