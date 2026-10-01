# Shops: probed, collected, not yet

Updated 30 September 2026. Probe with `node scripts/probes/shop-probe.mjs --base=<url>`, then move the shop to the right section. Count what is on file with `node scripts/count-shelves.cjs`.

About 820,000 different products on file, from 44 shops, out of 98 shops probed. About 285,000 carry a price; the rest are named from sitemaps.

The counting script reads lines, so Shopify shelves with variants or long descriptions read high (Towsure 81,413 lines for 16,552 products). The figures below use the collection log where it is known; "lines" marks a figure only from the count, which may be higher than the true number of products.

## Got products, with prices

| Shop | Products | How | Rotation |
|---|---|---|---|
| Trade Door Handles | 45,620 lines | collected 30 Sept | Hardware: new, not drafted |
| Toolstation | 35,705 | pages | lower |
| Decorating Centre Online | 27,314 lines | collected 30 Sept | Hardware: new, not drafted |
| Medisave | 25,000 or more (30,736 lines) | Shopify | parked, mostly clinical |
| Towsure | 16,552 | Shopify | middle |
| Lakeland | 11,532 | Shopify | parts subset only |
| B&M | 10,416 | pages | high |
| Hannworld | 9,832 | Shopify | high |
| Electricals Online | 8,500 lines | collected 30 Sept | Hardware: new, not drafted |
| Savers | 6,432 | pages | high |
| Essential Aids | 5,581 | pages | high |
| QD Stores | 4,717 | Shopify, not drafted yet | |
| Home Bargains | 4,460 | page data (three files: hb, hb-seasonal, hb-costed) | done |
| Ability Superstore | 4,023 | Shopify | top, care set |
| The Works | 3,386 | pages | high |
| Lights4fun | 3,029 | Shopify | store candidate |
| MonsterShop | 2,835 | Shopify | store candidate |
| Manage at Home | 2,337 | Shopify | top, care set |
| Complete Care Shop | 1,952 | Shopify | done |
| The Switch Depot | 1,527 lines | collected 30 Sept | Hardware: new, not drafted |
| Poundland | 1,487 | Shopify | high |
| Maplin | 1,382 | Shopify | parked, own label |
| Home Discount | 1,373 | Shopify | store candidate |
| Millercare | 1,358 | Shopify | top, care set |
| Festive Lights | 1,011 | Shopify; the collector divides its prices by 1,000 | top until November |
| Minky | 400 | Shopify, collected 30 Sept | own brand: matching, not buying |
| Bathroom Tiles | 159 lines | collected 30 Sept | Hardware: new |

## Got products, named from sitemaps (no prices)

| Shop | Products | Rotation |
|---|---|---|
| John Lewis | 172,260 (3,678 home brands drafted) | test slice |
| Harts of Stur | 93,232 | named models only |
| City Plumbing | 84,686 | lower |
| Studio | 61,516 | parked |
| Halfords | 59,216 | parked, own label |
| Wickes | 37,117 (349 priced) | done |
| Pets at Home | 14,142 | top, with Pet Shop |
| Longacres | 9,489 | parked, plants and ornaments |
| CPC | 7,880 | parked: about 5 cards per 1,000 calls |
| Healf | 7,384 | supplements: test slice, she registers as a food business |
| Pet Shop | 7,102 | top, with Pets at Home |
| Vet Shop | 7,090 | same catalogue as Pet Shop, not drafted |
| Swell UK | 6,822 | parked, livestock mixed in |
| Safe.co.uk | 6,364 | parked, many names are only numbers |
| Spares2you | 5,513 | top, appliance spares |
| Nature's Fix | 4,369 | supplements, with Healf; tinctures and test kits left out |
| Howe Tools | 4,092 | middle |
| Homescapes | 3,516 | own brand: matching, not buying |
| Wood Finishes Direct | 873 | Hardware: new |

## Google best sellers (Merchant Center, UK)

Not shops, but the strongest source: about 35 cards per 1,000 eBay calls against 5 to 30 for shop shelves.

| Category | Picks | Confirmed at a UK shop | State |
|---|---|---|---|
| Home & Garden | 4,488 (rerun, big brands left out) | 882 queries | done: scanned, gated, imported |
| Health & Beauty | 7,395 | 539 queries | done: scanned, gated, imported |
| Hardware | 5,195 | 615 queries | list built; scan and gate next |
| Animals & Pet Supplies | | | export next |

## Answered, no products yet

| Shop | Why |
|---|---|
| Screwfix, Easylife, Connevans | need their own reader |
| TLC Direct | about 73,000 links carrying only codes; needs page reading |
| Flying Tiger | Shopify under /en-gb, small reader change |
| Zooplus, KMS Direct | answered 8 Sept, never collected |
| garden.co.uk, homestoreandmore.co.uk | no prices on the page, second look |
| Careshop, Plumbbase, Tack24 | sitemap found no products |
| Pest Expert | sitemap holds one page; products built in the browser. Parked |
| Hughes, Sonic Direct | parked, large appliances |
| JYSK, Dusk, Living and Home, Habitat, Debenhams | price to beat only |
| Harbour Housewares | 50 products, skipped; own label |
| Dustpan and Brush Store | product links 404 |
| bulbs.co.uk | flower bulbs for planting, wrong fit |
| Very | sitemaps list categories only; pages blocked |

## Out

- Refused: Safelincs, Ransom Spares, BuySpares, 4ourhouse, eSpares, Partmaster, Qualtex, Smyths, Hobbycraft, Mobility Smart, Aidapt, Plumbworld, Plumbnation, CEF, Selco, Leisureshop Direct, Garden4less, The Range, Wilko, Robert Dyas, Dunelm, B&Q, Argos, Homebase, Nisbets, VonHaus, ProCook, Cookology, Christmas Tree World, Boots, Superdrug, CareCo, JML, Coopers of Stortford, Gear4music, Studiospares, Menkind, Electrical Discount UK, Salter, TOFS, Ethical Superstore, Iceland, Asda, Costco
- No answer (domain may be wrong): healthcarepro.co.uk, maidenhead-aquatics.co.uk
- Wrong fit: Scope, Matalan, Tesco, Sainsbury's, Ocado
- Affiliate feed only: Argos, Very, The Range

## Not probed

All shops on the list have now been probed. Add new ones here as they come up.
