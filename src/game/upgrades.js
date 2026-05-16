const upgradeEffects = {
  rune_blade(hero) {
    hero.components.combat.melee += 2
    hero.components.combat.weaponType = 'slash'
  },
  meteor_hammer(hero) {
    hero.components.combat.melee += 2
    hero.components.combat.weaponType = 'blunt'
  },
  dragonspear(hero) {
    hero.components.combat.melee += 1
    hero.components.combat.weaponType = 'puncture'
    hero.components.abilities.push('antiLarge')
  },
  gilded_plate(hero) {
    hero.components.combat.armorType = 'heavy'
    hero.components.health.max += 1
    hero.state.currentHealth += 1
  },
  shadow_cloak(hero) {
    hero.components.abilities.push('skirmisher', 'dodge')
  },
  war_banner(hero) {
    hero.components.abilities.push('bannerAura')
  },
  arcane_focus(hero) {
    hero.components.combat.spell += 2
  },
  gryphon_hide(hero) {
    hero.components.combat.armorType = 'magic'
    hero.components.abilities.push('regen')
  },
  longbow_mastery(hero) {
    hero.components.combat.ranged += 2
    hero.components.abilities.push('precision')
  },
  veteran_drill(hero) {
    hero.components.health.max += 1
    hero.state.currentHealth += 1
    hero.components.combat.melee += 1
  },
  battle_prayer(hero) {
    hero.components.abilities.push('steadfastAura')
  },
  hellfire_breath(hero) {
    hero.components.combat.ranged += 2
    hero.components.combat.weaponType = 'breath'
  },
}

export function getExperienceThreshold(hero) {
  return hero.components.progression.level + 3
}

export function isHeroLevelReady(hero) {
  const availableExperience = hero.components.progression.experience - hero.components.progression.spentExperience
  return availableExperience >= getExperienceThreshold(hero)
}

export function rollHeroDraft(hero, catalog, random = Math.random) {
  const blockedIds = new Set(hero.components.progression.pickedUpgradeIds)
  const pool = catalog.heroUpgrades.filter((entry) => !blockedIds.has(entry.id))
  const picks = []

  while (picks.length < 3 && pool.length > 0) {
    const index = Math.floor(random() * pool.length)
    picks.push(pool.splice(index, 1)[0].id)
  }

  return picks
}

export function applyHeroUpgrade(hero, upgradeId) {
  const apply = upgradeEffects[upgradeId]

  if (!apply) {
    return hero
  }

  const cost = getExperienceThreshold(hero)
  apply(hero)
  hero.components.progression.level += 1
  hero.components.progression.spentExperience += cost
  hero.components.progression.pickedUpgradeIds.push(upgradeId)
  hero.components.progression.pendingDraft = []

  return hero
}