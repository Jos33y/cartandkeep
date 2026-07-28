// The margin example in scope 4.1.a is a contract artefact. If the pipeline stops
// matching it, that should fail here and not in front of her.

import assert from 'node:assert/strict'
import { computeMargin, computeConfidence, classify, passesFilter } from './scoring.js'

const fees = {
  ebay: { pct: 0.128, fixed: 0.3 },
  payment: { pct: 0.029, fixed: 0.3 },
  tiktok: { pct: 0.065, fixed: 0.0 },
  store: { pct: 0.015, fixed: 0.2 },
}

{
  const m = computeMargin({ salePrice: 22.0, landedCost: 6.0, channel: 'ebay', fees })
  assert.equal(m.platform_fee, 3.12, 'eBay fee must match the scope document')
  assert.equal(m.payment_fee, 0.94, 'payment fee must match the scope document')
  assert.equal(m.net, 11.94, 'net profit must match the scope document')
  console.log('scope margin example reproduces exactly:', m.net)
}

{
  const weights = { ebay_browse: 1, aliexpress: 1, google_trends: 0.8 }

  const full = computeConfidence({
    signals: [
      { sourceId: 'ebay_browse', kind: 'depth', value: 0.8 },
      { sourceId: 'aliexpress', kind: 'demand', value: 0.9 },
      { sourceId: 'google_trends', kind: 'demand', value: 0.7 },
    ],
    weights,
  })

  const degraded = computeConfidence({
    signals: [
      { sourceId: 'ebay_browse', kind: 'depth', value: 0.8 },
      { sourceId: 'aliexpress', kind: 'demand', value: 0.9 },
    ],
    weights,
  })

  assert.equal(full.signalCount, 3)
  assert.equal(degraded.signalCount, 2)
  assert.ok(degraded.confidence > 70, 'losing one source must not collapse the score')
  console.log('confidence full:', full.confidence, 'degraded:', degraded.confidence)
}

{
  const weights = { ebay_browse: 1, aliexpress: 1 }
  const spammy = computeConfidence({
    signals: [
      { sourceId: 'aliexpress', kind: 'demand', value: 1.0 },
      { sourceId: 'aliexpress', kind: 'demand', value: 1.0 },
      { sourceId: 'aliexpress', kind: 'demand', value: 1.0 },
      { sourceId: 'ebay_browse', kind: 'depth', value: 0.2 },
    ],
    weights,
  })
  assert.equal(spammy.signalCount, 2, 'repeat signals from one source count once')
  assert.equal(spammy.confidence, 60)
  console.log('volume does not dominate:', spammy.confidence)
}

{
  assert.equal(classify({ signals: [{ kind: 'velocity' }, { kind: 'depth' }] }), 'evergreen')
  assert.equal(classify({ signals: [{ kind: 'seasonality' }] }), 'trend_spike')
  assert.equal(classify({ signals: [] }), 'unknown')
  console.log('classification ok')
}

{
  const scoring = { margin_floor: 4.0, min_signals: 2 }
  const good = computeMargin({ salePrice: 22, landedCost: 6, channel: 'ebay', fees })
  const thin = computeMargin({ salePrice: 12, landedCost: 6, channel: 'ebay', fees })

  assert.ok(passesFilter({ margin: good, signalCount: 3, scoring }))
  assert.ok(!passesFilter({ margin: thin, signalCount: 3, scoring }), 'thin margin rejected')
  assert.ok(!passesFilter({ margin: good, signalCount: 1, scoring }), 'single source rejected')
  console.log('filter gates ok, thin margin net was', thin.net)
}

console.log('\nall assertions passed')
