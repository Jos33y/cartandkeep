// Base developer tier. Active listings only; sold velocity is behind Marketplace Insights.

const BROWSE = 'https://api.ebay.com/buy/browse/v1'

export const id = 'ebay_browse'
export const provides = ['pricing', 'depth']

export async function token({ clientId, clientSecret }) {
  const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'https://api.ebay.com/oauth/api_scope',
    }),
  })
  if (!res.ok) throw new Error(`ebay auth failed: ${res.status}`)
  const json = await res.json()
  return json.access_token
}

// Inverted: more competing listings is a worse signal, not a better one.
function depthSignal(count, ceiling = 400) {
  const capped = Math.min(count, ceiling)
  return 1 - capped / ceiling
}

// Narrow IQR against the median means sellers have converged, so little pricing room.
function compressionSignal(prices) {
  if (prices.length < 4) return null
  const sorted = [...prices].sort((a, b) => a - b)
  const at = (q) => sorted[Math.floor(sorted.length * q)]
  const median = at(0.5)
  if (!median) return null
  const spread = (at(0.75) - at(0.25)) / median
  return Math.max(0, Math.min(1, spread))
}

export async function fetchSignals({ tenant, config, credentials, query }) {
  const access = await token(credentials)
  const marketplace = tenant.marketplace ?? 'EBAY_GB'
  const signals = []

  for (const term of query.terms) {
    const url = new URL(`${BROWSE}/item_summary/search`)
    url.searchParams.set('q', term)
    url.searchParams.set('limit', String(config.limit ?? 200))
    if (config.categoryIds) url.searchParams.set('category_ids', config.categoryIds)

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${access}`,
        'X-EBAY-C-MARKETPLACE-ID': marketplace,
      },
    })
    if (!res.ok) throw new Error(`ebay browse ${res.status} for "${term}"`)

    const body = await res.json()
    const items = body.itemSummaries ?? []
    if (!items.length) continue

    const prices = items
      .map((i) => Number(i.price?.value))
      .filter((n) => Number.isFinite(n) && n > 0)

    const compression = compressionSignal(prices)
    const lead = items[0]

    signals.push({
      externalRef: lead.epid ?? lead.itemId ?? term,
      title: lead.title ?? term,
      category: lead.categories?.[0]?.categoryName,
      imageUrl: lead.image?.imageUrl,
      kind: 'depth',
      value: depthSignal(body.total ?? items.length),
      price: prices.length ? prices[Math.floor(prices.length / 2)] : undefined,
      raw: { term, total: body.total, sampled: items.length },
    })

    if (compression !== null) {
      signals.push({
        externalRef: lead.epid ?? lead.itemId ?? term,
        title: lead.title ?? term,
        kind: 'pricing',
        value: compression,
        raw: { term, compression },
      })
    }
  }

  return signals
}

export { fetchSignals as fetch }
