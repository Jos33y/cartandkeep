// Sporting Goods only. Tried on six exports (October to December 2025, July to September 2026), 33,731 products.

// Decathlon sells its own sports brands under the brand's name, not Decathlon's, so the Brand column often names the
// range (Quechua, Kalenji). Argos sells Zinc, Hy-Pro and Pro Fitness the same way. None can be bought for less than
// the shop sells them. Decathlon, Kipsta, Domyos and Btwin are already in ../own-label.mjs.
export const OWN_LABEL = [
  'quechua', 'forclaz', 'kalenji', 'kiprun', 'nabaiji', 'kuikma', 'canaveral', 'rockrider', 'triban', 'van rysel',
  'artengo', 'inesis', 'tribord', 'olaian', 'caperlan', 'solognac', 'wedze', 'simond', 'corength', 'itiwit', 'subea',
  'oxelo', 'tarmak', 'newfeel', 'fouganza', 'aptonia', 'geologic', 'offload', 'perfly', 'kipsta', "b'twin",
  'zinc', 'hy-pro', 'hy pro', 'pro fitness', 'opti', 'mp',
  // Mountain Warehouse sells only its own brand; Advanta is Angling Direct's own tackle range.
  'mountain warehouse', 'advanta',
  // Frasers Group's Gelert tents and camping kit (Gelert pet food is another company, so not in ../own-label.mjs).
  'gelert',
  // Go Outdoors' own camping brands.
  'eurohike', 'oex', 'hi gear', 'hi-gear',
];

// The same ranges named in the title while the Brand column names something else ("Decathlon 3 Man Tent" under
// Quechua is caught by the brand; "Btwin Kids Balance Bike" under B'TWIN is caught here).
export const OWN_TITLE = String.raw`\b(slazenger|karrimor|gelert|everlast|donnay|lonsdale|muddyfox|pinnacle|yogamatters|mountain warehouse|advanta|eurohike|oex|hi[- ]gear|decathlon|quechua|forclaz|kalenji|kiprun|nabaiji|kuikma|canaveral|rockrider|triban|van rysel|artengo|inesis|tribord|olaian|caperlan|solognac|wedze|oxelo|btwin|b'twin|domyos|kipsta|hy-?pro|pro fitness)\b|\bzinc\b(?=[^|]*\b(?:scooters?|skates?|helmets?|bikes?|trampolines?)\b)`;

// Kit worn to size (decided 3 October): wetsuits, rash vests, swimwear, riding tights, waders, skates and sports
// footwear come in many sizes and drive returns. Gloves, socks, caps, helmets, life jackets, swim and float vests
// and horse boots are one-size or S/M/L and pass, and so do adjustable skates.
const HORSE = String.raw`equilibrium|tri-zone|brushing|hoof|mud fever|over ?reach|tendon|fetlock|turnout|travel|stable|ice boots?|wrap boots?|snug boots?|schooling|cavallo|horses?|equine|ponies|pony`;
const FOOT_KIT = String.raw`bags?|dryers?|cleaners?|cleaning|care|spray|laces?|insoles?|studs?|spikes? (?:replacement|keys?|spanner)|stretchers?|horns?|trees?|covers?|grips?|socks?|rack|tool|deodori[sz]ers?|guards?|toe stops?|wheels?|bearings?|ramps?|pads?|protect\w*|sharpeners?|blade covers?|shin pads?|shinpads?|key`;

// The title is about fishing: a rod, pole or whip in any other sport passes this rule.
const FISH = String.raw`fishing|angling|carp|feeder|coarse|specimen|barbel|pike|predator|lure|lures|spod|marker|float|tench|bream|beach|surf|sea|boat|bass|reel|reels|spinning|baitcaster|quiver ?tip|picker|method|stalker|daiwa|shimano|korda|nash|sonik|ngt|korum|preston|drennan|fox|trakker|avid|wychwood|shakespeare|penn|abu garcia|greys|guru|maver|matrix|middy|free ?spirit|tf ?gear|leeda|okuma|ugly stik|savage gear|westin|kodex|tactic|mitchell|ron thompson|dam|sportex|century|cygnet`;

export const NOT_SHELF = [
  // Complete bikes: a kids' 12 inch bike or a mountain bike is a courier parcel. Balance bikes, trikes and 2 in 1
  // training bikes pass (Keepr notes the box size). Parts and accessories named after the bike pass.
  [String.raw`(?:mountain|road|gravel|hybrid|electric|kids'?|boys'?|girls'?|men'?s|women'?s|ladies'?|bmx|commuter|folding|city) (?:bikes?|bicycles?)|\d{2}(?:\.\d)? ?(?:"|inch|in)\b[^|,]*\b(?:bikes?|bicycles?)\b|\be-?bikes?|\bebikes?|electric bicycles?`,
    null,
    String.raw`helmets?|tyres?|tires?|tubes?|stabili[sz]ers?|seats?|saddles?|pedals?|grips?|gloves?|wheels?|covers?|locks?|lights?|pumps?|racks?|stands?|mounts?|holders?|bags?|panniers?|bells?|mirrors?|mudguards?|fenders?|chains?|brakes?|cables?|cassettes?|batter(?:y|ies)|chargers?|motors?|conversion|shorts|jerseys?|shoes|trainers?|turbo|carriers?|hooks?|storage|tools?|cleaning|kit|parts?|spares?|shed|tents?|toy|lego|playmobil|figures?|puzzles?|balance|training|trikes?|tricycles?|forks?|frames?|clug`],
  // Gym machines and benches: furniture-sized, courier only. Mini pedal exercisers, steppers and bands pass.
  [String.raw`treadmills?|walking pads?|(?<!mini )exercise bikes?|spin bikes?|rowing machines?|rowers?|cross ?trainers?|ellipticals?|multi ?gyms?|home gym (?:systems?|stations?|machines?)|power racks?|squat racks?|power towers?|smith machines?|(?:weight|workout|gym|utility|ab|sit[- ]?up|adjustable|flat|incline|decline|folding) bench(?:es)?|bench press(?! bars?)`,
    null, String.raw`mats?|covers?|lubricants?|belts?|parts?|safety keys?|seats?|cushions?|bands?|handles?|clips?|collars?|pads?`],
  // Trampolines (not trampoline scooters), games tables and roof tents: too big for a parcel.
  [String.raw`trampolines?`, null, String.raw`scooters?|nets?|covers?|anchors?|pegs|springs?|ladders?|socks|pads?|parts?|tools?`],
  [String.raw`(?:pool|snooker|billiards?|football|air hockey|table tennis|ping pong|multi[- ]?games?|games?|foosball) tables?`, null, String.raw`table ?top|tabletop|bats?|balls?|nets?|covers?|cues?|chalk|cloths?|brush(?:es)?|cushions?|rests?|triangles?|racks?|tips?|\d+ ?in(?:ch)?\b|20"|mini|electronic|hockey game|game set`],
  [String.raw`roof tents?`],
  // Paddleboards, kayaks and canoes, hard or inflatable: big and heavy. Paddles, pumps, leashes and bags pass.
  [String.raw`paddle ?boards?|sup boards?|stand[- ]?up paddle|kayaks?|canoes?`, null, String.raw`paddles?(?! ?boards?)|pumps?|leash(?:es)?|fins?|dry ?bags?|bags?|seats?|racks?|trolleys?|covers?|repair|straps?|holders?|cushions?|deck ?bags?|anchors?|life ?jackets?|buoyancy`],
  // Sized wetsuits, swimwear and surf tops. Wetsuit gloves, socks, hangers and shampoo pass.
  [String.raw`wetsuits?|rash (?:vests?|guards?)|swim(?:ming)? (?:t-?shirts?|costumes?|shorts|suits?|trunks)|swimsuits?|swimming costumes?|bikinis?|uv suits?|surf (?:t-?shirts?|tops?|suits?)`,
    null, String.raw`gloves?|socks?|hangers?|shampoo|cleaners?|wash|repair|glue|bags?|changing|robes?|mats?|dolls?|toy`],
  // Sized footwear: surf, wetsuit, sailing and walking boots, shoes and trainers. Horse boots pass.
  [String.raw`(?:wetsuit|surf|neoprene|sailing|walking|hiking|football|rugby|running|golf|cycling|climbing|aqua|water|beach|sports?|power|all purpose|aero|\d ?mm) (?:boots?|shoes?)|(?:adult|kids'?|mens|men'?s|womens|women'?s|ladies'?|junior) (?:hybrid )?(?:shoes?|trainers|boots?)|\b(?:shoes?|trainers|boots?) (?:size|uk ?\d)`,
    null, `${HORSE}|${FOOT_KIT}`],
  // Riding tights and leggings, sized.
  [String.raw`(?:riding|equestrian|horse riding|full seat|knee grip|training|competition) (?:tights|leggings|breeches|jodhpurs)|\b(?:breeches|jodhpurs)\b`, null, String.raw`dolls?|toy|hangers?`],
  // Waders, sized by foot.
  [String.raw`waders?`, null, String.raw`repair|bags?|hangers?|dryers?|belts?|patches?`],
  // Fishing (decided 4 October): tackle is hers, but what can't go by parcel is not. Rods, poles, whips and
  // rod-and-reel combos pack to 1.8m or more; holdalls and rod sleeves are as long. Telescopic and travel rods pack
  // short and pass, and so do rod rests, pods, clips, tip protectors and pole elastics, rollers and pots.
  [String.raw`rods?|fishing poles?|(?:match|carp|margin|commercial|power|coarse|competition) poles?|whips?|combos?|rod (?:holdalls?|sleeves?|quivers?)|holdalls?|quivers?`,
    FISH,
    String.raw`telescopic|tele|travel|rests?|pods?|holders?|clips?|bands?|tip protectors?|protectors?|straps?|stands?|racks?|rollers?|winders?|pots?|cups?|elastics?|bungs?|socks?|(?<!ultra[- ]?)lights?(?! game| lure| spin| rod)|isotopes?|alarms?|buzz ?bars?|banksticks?|repair|rings?|guides?|tips?|rigs?|floats?|lines?|hooks?|kits?|toys?|archery|arrows?|bows?|riding|horse|equestrian|pony|lunge|crop`],
  // Bivvies, brollies, shelters, bedchairs, fishing chairs, seat boxes and barrows: bulky, courier only. Their covers,
  // pegs, groundsheets, lights, side trays and bags pass.
  [String.raw`bivv(?:y|ies)|brollies|brolly|(?:fishing|day|umbrella|pop[- ]up ice fishing) shelters?|bed ?chairs?|sleep systems?|level ?chairs?|(?:fishing|carp|match) chairs?|seat ?box(?:es)?|(?:fishing|tackle|carp) barrows?`,
    null,
    String.raw`covers?|wraps?|skirts?|overwraps?|pegs?|ground ?sheets?|lights?|lamps?|tables?|bags?|accessor(?:y|ies)|arms?|mud ?feet|feet|straps?|clips?|pillows?|repair|tyres?|wheels?|organi[sz]ers?|drop[- ]?ins?|side ?trays?|trays?|cushions?|hooks?|poles? only|storm poles?|mozzi|insect|nets? only|caps?|footplates?|keys?|loos?|toilets?|sinks?|taps?|spares?|kettles?|stoves?`],
  // Frozen and live bait: needs a cold chain or arrives dead. Shelf-life boilies, pellets and liquids pass.
  // Freezer and frozen bait stop even when the title says boilies or pop-ups. Only kit for it passes.
  [String.raw`freezer (?:boilies|baits?|pop[- ]?ups?|packs?)|frozen (?:boilies|baits?|sardines?|mackerel|squid|lugworms?|ragworms?|prawns?|smelt|lamprey|deadbaits?|blueys?)`,
    null,
    String.raw`cool ?bags?|bait ?bags?|freezers? (?:bags?|boxes?)|thermal|insulated|imitation|fake|artificial|plastic|rubber`],
  [String.raw`deadbaits?|live (?:baits?|maggots?|worms?)|maggots?|casters|lugworms?|ragworms?|dendrobaena|redworms?|bloodworms?|jokers`,
    null,
    String.raw`shelf[- ]life|boilies|pellets|groundbait|tubs?|box(?:es)?|riddles?|catapults?|droppers?|feeders?|clips?|imitation|fake|artificial|plastic|rubber|floating|pop[- ]?ups?|tins?|flavou?red|scented|dips?|liquids?|glugs?|cool ?bags?|slings?|trays?|spoons?|pots?|bait ?bags?|aerators?`],
  // Skates, sized by foot. Adjustable and learner skates span sizes and pass, and so do wheels, ramps and pads.
  [String.raw`skates?`, null, String.raw`adjustable|learner|adjusters?|${FOOT_KIT}|skate ?boards?|skateboards?|skate parks?|key|tool`],
];

// Fixed-blade, hunting, survival and tactical knives (decided 3 October): out of her range. Pocket knives,
// multi-tools and camping axes pass with the age-check postage note.
export const RESTRICTED = {
  knives_fixed: String.raw`\b(fixed[- ]?blade|hunting knife|(?<!folding )hunters? knife(?: set)?|bushcraft knife|survival knife|tactical knife|combat knife|bowie|kukri|throwing (?:knives|knife|axes?)|axe throwing)\b|\b(?:kombat|kombat uk)\b[^|]*\bknife\b|\bmora(?:kniv)? (?:companion|basic|garberg|kansbol|eldris)\b|\bfixed knife\b`,
};

// A maker's product named in the title passes own label when Google's Brand column names a shop: Gym Sets weights
// sold through B&Q's marketplace, licensed scooters filed under Argos.
export const BRANDED = String.raw`\b(gym sets|bowflex|jordan fitness|mirafit|bodymax|reebok|adidas|nike|puma|under armour|rdx|evo|globber|nkd|madd gear|slamm|blunt|osprey|coleman|vango|outwell|berghaus|regatta|forza|mitre|spalding|wilson|babolat|yonex|dunlop|titleist|callaway|taylormade|footjoy|shimano|maxxis|schwalbe|continental|muc-?off|park tool|garmin|wahoo|korda|nash|drennan|preston innovations|shires|lemieux|weatherbeeta|harry hall|ariat|winmau|harrows|red dragon|head (?:tennis|padel|squash|rackets?)|ping (?:golf|putters?|drivers?)|micro scooters?)\b|\b(?:target|unicorn)\b(?=[^|]*\b(?:darts?|tungsten|\d+g)\b)`;
