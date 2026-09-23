// scripts/ebay-auth.js
// Consent once, then hold a refresh token for eighteen months.
//
// The Browse API the gate uses talks to eBay as the application. Listing talks
// to eBay as her, which needs her consent and a different kind of token.
//
//   node scripts/ebay-auth.js --url            print the link she opens
//   node scripts/ebay-auth.js --code=v^1.1#... exchange it, once
//   node scripts/ebay-auth.js --check          is the token good
//   node scripts/ebay-auth.js --policies       the ids an offer needs

import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs'
import { parseEnv } from './gate.js'

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, ...v] = a.replace(/^--/, '').split('=')
    return [k, v.length ? v.join('=') : true]
  })
)

const ENV_FILE = '.env.local'
const API = 'https://api.ebay.com'
const MARKETPLACE = args.marketplace || 'EBAY_GB'

// Listing needs all three. inventory creates the item and the offer, account
// reads the business policies an offer must reference, fulfillment reads the
// orders once something sells.
const SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.account',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
]

function env (name, required = true) {
  const fromProcess = process.env[name]
  if (fromProcess) return fromProcess
  for (const f of [ENV_FILE, '.env']) {
    try {
      const v = parseEnv(readFileSync(f, 'utf8'))[name]
      if (v) return v
    } catch { /* absent is normal */ }
  }
  if (required) {
    console.error(`${name} is not in ${ENV_FILE}.`)
    process.exit(1)
  }
  return null
}

const CLIENT_ID = env('EBAY_CLIENT_ID')
const CLIENT_SECRET = env('EBAY_CLIENT_SECRET')
// Not the URL. eBay wants the RuName in the redirect_uri field, which is the
// single most common way this exchange fails.
const RU_NAME = env('EBAY_RU_NAME')

const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')

async function token (form) {
  const res = await fetch(`${API}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams(form).toString(),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error(`\n${res.status} from eBay`)
    console.error(JSON.stringify(body, null, 1))
    if (body.error === 'invalid_grant') {
      console.error('\ninvalid_grant usually means the code was already used, has expired')
      console.error('(they last five minutes), or redirect_uri is not the RuName.')
    }
    process.exit(1)
  }
  return body
}

// A user token, refreshed on demand. Exported so the listing script does not
// repeat any of this.
export async function accessToken () {
  const refresh = env('EBAY_REFRESH_TOKEN', false)
  if (!refresh) {
    console.error('No EBAY_REFRESH_TOKEN. Run --url, grant consent, then --code=...')
    process.exit(1)
  }
  const t = await token({
    grant_type: 'refresh_token',
    refresh_token: refresh,
    scope: SCOPES.join(' '),
  })
  return t.access_token
}

async function api (path, accessTok) {
  const res = await fetch(`${API}${path}`, {
    headers: {
      authorization: `Bearer ${accessTok}`,
      'content-type': 'application/json',
      'X-EBAY-C-MARKETPLACE-ID': MARKETPLACE,
    },
  })
  const body = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, body }
}

if (args.url) {
  const url = new URL('https://auth.ebay.com/oauth2/authorize')
  url.searchParams.set('client_id', CLIENT_ID)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', RU_NAME)
  url.searchParams.set('scope', SCOPES.join(' '))

  console.log('\nSend her this. She signs in as the seller and approves.\n')
  console.log(url.toString())
  console.log('\neBay then sends her to the accepted URL with ?code=... in the address bar.')
  console.log('That page does not have to exist. Copy the code out of the bar and run:\n')
  console.log('  node scripts/ebay-auth.js --code=<the code>\n')
  console.log('The code expires in five minutes and works once.')
  process.exit(0)
}

if (args.code) {
  // eBay url-encodes the code into the address bar, so it arrives escaped.
  const code = decodeURIComponent(String(args.code))
  const t = await token({
    grant_type: 'authorization_code',
    code,
    redirect_uri: RU_NAME,
  })

  const line = `EBAY_REFRESH_TOKEN=${t.refresh_token}`
  const current = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf8') : ''

  if (current.includes('EBAY_REFRESH_TOKEN=')) {
    writeFileSync(ENV_FILE, current.replace(/EBAY_REFRESH_TOKEN=.*/g, line))
    console.log(`\nEBAY_REFRESH_TOKEN replaced in ${ENV_FILE}`)
  } else {
    appendFileSync(ENV_FILE, `${current.endsWith('\n') || !current ? '' : '\n'}${line}\n`)
    console.log(`\nEBAY_REFRESH_TOKEN written to ${ENV_FILE}`)
  }

  const days = Math.round((t.refresh_token_expires_in ?? 0) / 86400)
  console.log(`Good for about ${days} days. The access token lasts ${t.expires_in}s and is fetched as needed.`)
  console.log('\nNow run --policies to get the ids an offer references.')
  process.exit(0)
}

if (args.check) {
  const tok = await accessToken()
  const me = await api('/sell/account/v1/privilege', tok)
  console.log(me.ok ? '\nToken works.' : `\n${me.status} from eBay`)
  console.log(JSON.stringify(me.body, null, 1))
  process.exit(me.ok ? 0 : 1)
}

if (args.policies) {
  const tok = await accessToken()

  for (const [name, path] of [
    ['Postage', `/sell/account/v1/fulfillment_policy?marketplace_id=${MARKETPLACE}`],
    ['Payment', `/sell/account/v1/payment_policy?marketplace_id=${MARKETPLACE}`],
    ['Returns', `/sell/account/v1/return_policy?marketplace_id=${MARKETPLACE}`],
  ]) {
    const r = await api(path, tok)
    console.log(`\n${name}`)
    if (!r.ok) {
      console.log(`  ${r.status}  ${JSON.stringify(r.body).slice(0, 200)}`)
      continue
    }
    const list = r.body.fulfillmentPolicies ?? r.body.paymentPolicies ?? r.body.returnPolicies ?? []
    if (!list.length) console.log('  none. Create it in Seller Hub under Business Policies.')
    for (const p of list) {
      console.log(`  ${p.fulfillmentPolicyId ?? p.paymentPolicyId ?? p.returnPolicyId}  ${p.name}`)
    }
  }

  const loc = await api('/sell/inventory/v1/location?limit=20', tok)
  console.log('\nInventory location')
  if (!loc.ok) {
    console.log(`  ${loc.status}  ${JSON.stringify(loc.body).slice(0, 200)}`)
  } else if (!(loc.body.locations ?? []).length) {
    console.log('  none. One has to exist before anything publishes, and it needs her trading address.')
  } else {
    for (const l of loc.body.locations) {
      const a = l.location?.address ?? {}
      console.log(`  ${l.merchantLocationKey}  ${[a.city, a.postalCode].filter(Boolean).join(', ')}`)
    }
  }

  console.log('\nPut the ones you want in .env.local:')
  console.log('  EBAY_FULFILLMENT_POLICY_ID=\n  EBAY_PAYMENT_POLICY_ID=\n  EBAY_RETURN_POLICY_ID=\n  EBAY_LOCATION_KEY=')
  process.exit(0)
}

console.log('One of --url, --code=..., --check, --policies')
