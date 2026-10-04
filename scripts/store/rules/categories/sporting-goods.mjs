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
];

// The same ranges named in the title while the Brand column names something else ("Decathlon 3 Man Tent" under
// Quechua is caught by the brand; "Btwin Kids Balance Bike" under B'TWIN is caught here).
export const OWN_TITLE = String.raw`\b(mountain warehouse|advanta|decathlon|quechua|forclaz|kalenji|kiprun|nabaiji|kuikma|canaveral|rockrider|triban|van rysel|artengo|inesis|tribord|olaian|caperlan|solognac|wedze|oxelo|btwin|b'twin|domyos|kipsta|hy-?pro|pro fitness)\b|\bzinc\b(?=[^|]*\b(?:scooters?|skates?|helmets?|bikes?|trampolines?)\b)`;

// Kit worn to size (decided 3 October): wetsuits, rash vests, swimwear, riding tights, waders, skates and sports
// footwear come in many sizes and drive returns. Gloves, socks, caps, helmets, life jackets, swim and float vests
// and horse boots are one-size or S/M/L and pass, and so do adjustable skates.
const HORSE = String.raw`equilibrium|tri-zone|brushing|hoof|mud fever|over ?reach|tendon|fetlock|turnout|travel|stable|ice boots?|wrap boots?|snug boots?|schooling|cavallo|horses?|equine|ponies|pony`;
const FOOT_KIT = String.raw`bags?|dryers?|cleaners?|cleaning|care|spray|laces?|insoles?|studs?|spikes? (?:replacement|keys?|spanner)|stretchers?|horns?|trees?|covers?|grips?|socks?|rack|tool|deodori[sz]ers?|guards?|toe stops?|wheels?|bearings?|ramps?|pads?|protect\w*|sharpeners?|blade covers?|shin pads?|shinpads?|key`;

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
export const BRANDED = String.raw`\b(gym sets|bowflex|jordan fitness|mirafit|bodymax|reebok|adidas|nike|puma|under armour|everlast|rdx|evo|globber|nkd|madd gear|slamm|blunt|osprey|eurohike|coleman|vango|outwell|berghaus|regatta|forza|mitre|spalding|wilson|babolat|yonex|slazenger|dunlop|titleist|callaway|taylormade|footjoy|shimano|maxxis|schwalbe|continental|muc-?off|park tool|garmin|wahoo|korda|nash|drennan|preston innovations|shires|lemieux|weatherbeeta|harry hall|ariat|winmau|harrows|red dragon|head (?:tennis|padel|squash|rackets?)|ping (?:golf|putters?|drivers?)|micro scooters?)\b|\b(?:target|unicorn)\b(?=[^|]*\b(?:darts?|tungsten|\d+g)\b)`;
