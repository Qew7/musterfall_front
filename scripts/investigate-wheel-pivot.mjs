#!/usr/bin/env node
/**
 * Wheel pivot check: rigid sampleWheelPoses and synced WAAPI keyframes
 * must keep the front-corner pivot fixed.
 *
 * Run: npm run investigate:wheel
 */
import {
  buildSyncedMotionKeyframes,
  getUnitCorners,
  getWheelPivot,
  sampleWheelPoses,
} from '../src/game/battlefield.js'

function pivotCorner(unit, delta) {
  const corners = getUnitCorners(unit)
  return delta < 0 ? corners[0] : corners[1]
}

const origin = { x: 20, y: 12, facing: 0, baseWidth: 4, baseDepth: 2 }
const delta = -60
const pivot = getWheelPivot(origin, delta)
const samples = sampleWheelPoses(origin, delta, 20)

console.log('Rigid sampleWheelPoses:')
let rigidMax = 0
samples.forEach((sample, index) => {
  const corner = pivotCorner({ ...origin, ...sample }, delta)
  const drift = Math.hypot(corner.x - pivot.x, corner.y - pivot.y)
  rigidMax = Math.max(rigidMax, drift)
  if (index % 5 === 0) {
    console.log(`  i=${index} facing=${sample.facing.toFixed(1)} drift=${drift.toFixed(4)}`)
  }
})
console.log(`  rigid max pivot drift = ${rigidMax.toFixed(4)}\n`)

const keyframes = buildSyncedMotionKeyframes(samples, {
  width: 48,
  height: 36,
  startFacing: origin.facing,
})

console.log('Synced WAAPI keyframes (left/top/--facing from same samples):')
let syncedMax = 0
keyframes.forEach((frame, index) => {
  const sample = samples[index]
  const corner = pivotCorner({
    ...origin,
    x: sample.x,
    y: sample.y,
    facing: frame.facing,
  }, delta)
  const drift = Math.hypot(corner.x - pivot.x, corner.y - pivot.y)
  syncedMax = Math.max(syncedMax, drift)
  if (index % 5 === 0) {
    console.log(`  i=${index} facing=${frame.facing.toFixed(1)} drift=${drift.toFixed(4)}`)
  }
})
console.log(`  synced max pivot drift = ${syncedMax.toFixed(4)}`)
