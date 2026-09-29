# Categories: how products are organised

29 September 2026 · internal · decided with Joseph

Every product is organised by what it is, using Google's product taxonomy, never by where it was found. Where it came from (Google best seller, B&M, Toolstation) and which channel (Store, eBay) are labels on the card.

- Source of truth: `research/google/taxonomy-with-ids.en-GB.txt`, Google's file as downloaded (version 2021-09-21, 5,595 categories). Refresh it only if Google publishes a new version.
- Cards store the category **ID**, not the name. Names can differ (the UK file calls 166 "Clothing & Accessories"; Merchant Center shows "Apparel & Accessories"), the ID does not.
- The same ID is the product's `google_product_category` in her store's feed. Set once, used twice.

## Tabs: Google top categories

A tab shows only once it has products.

| ID | Top category | For her |
|---|---|---|
| 1 | Animals & Pet Supplies | yes |
| 632 | Hardware | yes |
| 469 | Health & Beauty | yes, healthcare and personal care only |
| 536 | Home & Garden | yes, the largest |
| 1239 | Toys & Games | yes, Christmas |
| 922 | Office Supplies | some |
| 222 | Electronics | some, accessories and consumables |
| 988 | Sporting Goods | some |
| 537 | Baby & Toddler | cautious |
| 111 | Business & Industrial | some |
| 888 | Vehicles & Parts | car care only; parts for one vehicle stay out |
| 166 | Clothing & Accessories | no, sized |
| 412 | Food, Beverages & Tobacco | no, restricted |
| 772 | Mature | no |
| 436 | Furniture | no, too bulky |
| 8, 141, 783, 2092, 5605, 5181 | Arts & Entertainment, Cameras & Optics, Media, Software, Religious & Ceremonial, Luggage & Bags | no, poor fit |

## Her subcategories

Level two under the tabs that fit her. "Section" is a suggestion for her store; she decides.

### Home & Garden (536)

| ID | Subcategory | Use | Store section |
|---|---|---|---|
| 1679 | Flood, Fire & Gas Safety | yes | Safety & Alarms |
| 359 | Business & Home Security | yes | Safety & Alarms |
| 5835 | Emergency Preparedness | yes | Safety & Alarms |
| 3348 | Household Appliance Accessories | yes | Filters & Parts |
| 630 | Household Supplies | yes | Cleaning, Pest & Damp |
| 574 | Bathroom Accessories | yes | Bathroom |
| 638 | Kitchen & Dining | yes | Kitchen |
| 2956 | Lighting Accessories | yes | Bulbs & Lighting |
| 594 | Lighting | selective | Bulbs & Lighting |
| 2862 | Fireplace & Wood Stove Accessories | yes | Winter & Heating |
| 4171 | Linens & Bedding | selective, electric blankets and throws | Winter & Heating |
| 689 | Lawn & Garden | selective, tools and care, not plants | Garden |
| 696 | Decor | selective | Home |
| 604 | Household Appliances | selective, small only | Home |
| 985, 729, 600, 6792, 2639, 4358, 6173 | Plants, Pool & Spa, Smoking Accessories, Fireplaces, Wood Stoves, Parasols & Rain Umbrellas, Umbrella Sleeves & Cases | no | |

### Hardware (632)

| ID | Subcategory | Use | Store section |
|---|---|---|---|
| 133 | Plumbing | yes | Heating & Plumbing |
| 499873 | Heating, Ventilation & Air Conditioning | yes | Heating & Plumbing |
| 127 | Power & Electrical Supplies | yes | Electrical |
| 1974 | Locks & Keys | yes | Safety & Alarms |
| 2878 | Hardware Accessories | yes | DIY |
| 3650 | Tool Accessories | yes | DIY |
| 1167 | Tools | selective, hand tools and batteries | DIY |
| 503739 | Building Consumables | selective | DIY |
| 115, 128, 543575, 502975, 500096, 499982, 1910 | Building Materials, Fencing & Barriers, Fuel, Fuel Containers & Tanks, Hardware Pumps, Small Engines, Storage Tanks | no | |

### Health & Beauty (469)

| ID | Subcategory | Use | Store section |
|---|---|---|---|
| 491 | Healthcare | yes: mobility, daily living, monitors, supports. Not medicines | Care & Mobility |
| 2915 | Personal Care | selective: shaver heads, toothbrush heads, hair tools. Not fragrance | Personal Care |
| 5573 | Jewellery Cleaning & Care | no | |

### Animals & Pet Supplies (1)

| ID | Subcategory | Use | Store section |
|---|---|---|---|
| 2 | Pet Supplies | yes. Not vet-prescribed food | Pet Essentials |
| 3237 | Live Animals | no | |

### Toys & Games (1239)

| ID | Subcategory | Use | Store section |
|---|---|---|---|
| 1253 | Toys | yes, Christmas | Toys & Gifts |
| 3793 | Games | yes, Christmas | Toys & Gifts |
| 3867 | Puzzles | yes | Toys & Gifts |
| 1249, 4648 | Outdoor Play Equipment, Game Timers | no | |

### Office Supplies (922)

| ID | Subcategory | Use | Store section |
|---|---|---|---|
| 932 | General Office Supplies | selective, label tape and ink | Office |
| 950 | Office Equipment | selective, label printers and shredders | Office |
| 2636 | Delivery Supplies | selective | Office |
| others | | no | |

### Electronics (222)

| ID | Subcategory | Use | Store section |
|---|---|---|---|
| 2082 | Electronics Accessories | yes: cables, batteries, chargers | Electronics |
| 345 | Print, Copy, Scan & Fax | selective, ink and toner | Office |
| 342 | Networking | selective, extenders and powerline | Electronics |
| 262 | Communications | selective, big-button and DECT phones | Care & Mobility |
| 223, 278 | Audio, Computers | selective, accessories | Electronics |
| 1270 | Video-Game Console Accessories | selective | Electronics |
| others | | no | |

### The rest, by exception

- Sporting Goods (988): Exercise & Fitness (990) only where it is care-adjacent (hand exercisers, resistance bands).
- Baby & Toddler (537): Baby Safety (540) only. Everything else carries strict product-safety rules.
- Business & Industrial (111): Work Safety Protective Equipment (2047) and Cleaning Carts & Containers (500086), selective.
- Vehicles & Parts (888): Vehicle Parts & Accessories (5613), car care only.

## How products get their category

1. Google best sellers: export per subcategory in Merchant Center; the file's filter line names it, and this taxonomy gives its ID.
2. Cards already in the portal: map the eBay category of the listing that proved each card to one of the tabs above. No eBay calls; the gate snapshots hold it. Anything unplaced goes to Home & Garden (536) for her to move.
3. New shop shelves: the shop's own category field where it has one, otherwise the same eBay mapping when the card is gated.

Decisions (approved, later, rejected) never change when a card moves tab.
