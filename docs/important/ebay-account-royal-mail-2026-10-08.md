# eBay account, real fees and Royal Mail postage

8 October 2026 · Cart & Keep · for the research pipeline and the portal

## What we found

| | Before | Now |
|---|---|---|
| Her eBay account | priced as business | **private** (eBay: `bellatique`, INDIVIDUAL) |
| Selling fee | 12.8% plus 30p a sale | **none** |
| What eBay actually charged, 90 days | estimated about £95 | **£5.59**, all international fee on buyers abroad |
| Promoted listings | 3% assumed | **no campaign running** (eBay's Marketing API returns none) |
| Postage | Evri to 5kg, £2.62 plus 40p packing | **Royal Mail**, labels bought on eBay, **£2.99** a parcel (her 23 UK labels: £2.85 on 13, £2.94 on 6, £3.10 to £3.65 on 4) plus 30p packing |
| Buyer Protection fee | not shown | paid by the buyer on top of her price: 10p, 7% to £20, 4% £20 to £300, 2% £300 to £4,000 |

## The model now

**eBay, private seller**
- No selling fee, no per-order fee.
- Ad rate: a listing's own campaign rate; a listed card not promoted, nothing; a card not listed yet, her usual rate. The research keeps 3% as the cost of promoting.
- Buyers see her price plus the Buyer Protection fee. Shown, never taken from her price.

**Postage on eBay, Royal Mail**

| Band | Up to | Postage | Packing |
|---|---|---|---|
| `rm-small` | 2kg | £2.99 (her UK labels' average) | £0.30 |
| `rm-medium-10` | 10kg | £7.35 | £0.50 |
| `rm-medium-20` | 20kg | £11.85 | £0.60 |

Old bands map to these: `evri5` and `parcel` to `rm-small`, `evri10` and `rmMedium` to `rm-medium-10`, `evri15` to `rm-medium-20`. Large letters stay as they were. Over 20kg is courier only, costed at the 20kg price.

**Business**, if she registers a company: the switch in Settings, Selling on eBay. Prices go back to 12.8% plus 30p and the ad rate. Scripts: `fvfPct: 0.128, fvfFixed: 0.30` in `scripts/lib/cost.js`.

## Research pipeline (this delivery)

| File | Change |
|---|---|
| `scripts/lib/cost.js` | `D.account 'private'`, `fvfPct 0`, `fvfFixed 0`, `adRate 0.03`; Royal Mail bands; `band 'rm-small'`; `AS_ROYAL_MAIL`, `bandKeyOf`, `bandOf` costs any old band as Royal Mail |
| `scripts/lib/row.js` | margins written with the Royal Mail band, label and costs |
| `scripts/sweep.js` | £2.99 plus 30p, private fees |
| `scripts/audit.js` | Royal Mail bands, private fees, `--band=rm-small` |
| `scripts/lib/weight.js` | no change: it reads `EBAY_BANDS` from `src/lib/pricing.js`, now Royal Mail |

Checked: £24.99 leaves £20.95 before goods (was £17.72); the lowest price worth listing a small parcel at is £5.76; a 3kg product moves to the £7.35 medium parcel.

Effect on runs: more products pass the £2 profit gate, since 12.8% no longer comes off; a heavy product between 2kg and 5kg costs more (Evri took it for £2.62, Royal Mail medium is £7.35).

## Portal and functions (already delivered)

| Delivery | What |
|---|---|
| `0150_ebay_account.sql` | `ebay_account`, `ebay_ads`, `set_ebay_seller`, `put_ebay_read`; Cart & Keep set to private |
| `0151_real_ebay_fees.sql` | `channel_sales.ad_fees`, `fee_detail`; profit and margin views by account |
| `0152_ebay_signing_keys.sql` | eBay's signing key for UK Finances calls; service role only |
| `0153_postage_from_labels.sql` | `channel_sales.postage_paid`; profit view uses the label |
| `ebay-account` | reads account type, campaigns, 90 days of charges |
| `ebay-sales` | real fees, ad fees and label postage per sale line |
| `src/lib/ebayAccount.js`, `assess.js`, `pricing.js` | every card prices for the account and Royal Mail |
| Settings | Selling on eBay: the switch, campaigns, what eBay charged |
| Finance | real fees, postage from labels, a plain note in place of the warning |

## Open

- **International label.** One order abroad (Revvies, £57.15) took a £15.65 label and the £4.39 international fee. Abroad is costed at nothing in card pricing; worth a look if more sales go abroad.

- **Campaigns.** She believes she runs 8 to 10%; eBay returns none. Check Seller Hub, Marketing, Advertising.
- **Costs.** 5 of 35 sold products have a cost: 21 on her shop, 6 sold only on eBay.
- **Live listings** were priced on the old model, about 13% high. A bulk reprice to the new floor, with her approval per listing, is the next build.
- **International fee** (about 1% on sales abroad) is not in card pricing. Small; left out.
