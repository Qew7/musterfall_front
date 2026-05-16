export function getFormationMetrics({ modelsRemaining, frontage, maxFiles, modelWidth, modelDepth }) {
  if (modelsRemaining <= 0) {
    return {
      files: 0,
      ranks: 0,
      footprintWidth: 0,
      footprintDepth: 0,
      gridWidth: 0,
      gridDepth: 0,
    }
  }

  const files = Math.max(1, Math.min(maxFiles, frontage, modelsRemaining))
  const ranks = Math.ceil(modelsRemaining / files)

  return {
    files,
    ranks,
    footprintWidth: files * modelWidth,
    footprintDepth: ranks * modelDepth,
    gridWidth: files * modelWidth,
    gridDepth: ranks * modelDepth,
  }
}

export function buildFormationLayout({ modelsRemaining, frontage, maxFiles, modelWidth, modelDepth }) {
  const metrics = getFormationMetrics({ modelsRemaining, frontage, maxFiles, modelWidth, modelDepth })
  const slots = Array.from({ length: modelsRemaining }, (_, index) => {
    const file = metrics.files === 0 ? 0 : index % metrics.files
    const rank = metrics.files === 0 ? 0 : Math.floor(index / metrics.files)

    return {
      id: `${file}-${rank}-${index}`,
      x: file * modelWidth,
      y: rank * modelDepth,
      width: modelWidth,
      depth: modelDepth,
    }
  })

  return {
    ...metrics,
    slots,
  }
}