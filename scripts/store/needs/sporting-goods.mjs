// Need words for Sporting Goods. Most of the category is browsed (balls, rackets, tents, scooters). The needs are
// the parts and consumables people reorder for kit they own, safety kit, recovery and support, and bite and midge
// protection outdoors.
export const RULES = [
  ['pest', /\b(midges?|mosquito(?:es)?|insect repellent|bug repellent|smidge|deet|tick (?:removers?|twisters?|cards?)|fly (?:repellent|spray|fringe|masks?)|horse fly)\b/i],
  ['safety', /\b(helmets?|life ?jackets?|buoyancy (?:aids?|vests?)|float(?:ation)? vests?|swim vests?|armbands?|hi[- ]?vis|reflective|bike lights?|(?:front|rear) lights?|bike locks?|d-?locks?|cable locks?|whistles?|first aid|mouth ?guards?|gum ?shields?|shin ?pads?|body protectors?|back protectors?)\b/i],
  ['care', /\b(knee (?:supports?|braces?|sleeves?)|ankle (?:supports?|braces?)|wrist (?:supports?|braces?|wraps?)|back supports?|elbow (?:supports?|braces?)|compression sleeves?|massage (?:guns?|balls?|rollers?)|foam rollers?|ice packs?|cold packs?|heat packs?|kinesiology tape|physio|resistance bands?|hand (?:grips?|exercisers?|strengtheners?)|pedal exercisers?|grip strengtheners?)\b/i],
  ['part', /\b(inner tubes?|tubes? \d|tyres?|tires?|puncture|repair kits?|patch(?:es)? kits?|tubeless|sealant|brake pads?|chains?|cassettes?|cables?|bar tape|handlebar grips|(?:bike|bmx|mtb|lock[- ]on|golf|tennis|racket) grips|replacement (?:parts?|strings?|grips?|nets?|poles?|pegs?|wheels?|bearings?|blades?|batter(?:y|ies)|chargers?|heads?|filters?|valves?|mantles?)|spare (?:parts?|poles?|pegs?|wheels?)|strings?|restring|overgrips?|wheels? (?:for|set)|bearings?|tent pegs?|guy ropes?|pole (?:kits?|sections?)|mantles?|gas (?:adaptors?|adapters?)|batter(?:y|ies)|chargers?|valves?|(?<!built[- ]in )(?:bike|ball|track|floor|shock|mini|hand|foot|air ?bed|sup|paddle ?board|electric) pumps?|cleats?|chalk|lube|chain oil)\b/i],
];
export const NOT_NEED = /\b(toys?|kids'? (?:bikes?|scooters?)|gift sets?|advent|novelty|costumes?)\b/i;
