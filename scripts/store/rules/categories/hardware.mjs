// Hardware only.
// Building materials are not shelf products for her: sold by length, area or tonne, too long or heavy for a
// Royal Mail parcel, and bought from a builders' merchant. Their fixings, tools and repair products pass.
const FIX = String.raw`screws?|nails?|fixings?|brackets?|clips?|hinges?|handles?|knobs?|locks?|latch(?:es)?|stops?|closers?|seals?|draught|trims?|spacers?|cutters?|saws?|adhesive|glue|sealant|filler|grout|primer|paint|stain|treatment|protector|preserver|repair|kit|tools?|levell?ing|cleaner|stickers?|decals?|tape|plugs?|anchors?|caps?|covers?|feet|pads?|connectors?|joiners?|labels?|numbers?|knockers?|letter ?(?:box|plate)|viewers?|chains?|bells?|wedges?|guards?|hooks?|wrench(?:es)?|spanners?|grids?|ties|jointers?|bolsters?|trowels?|spikes?|supports?|patch(?:es)?|scrapers?|mechanisms?|samples?`;
export const NOT_SHELF = [
  // Timber and sheet materials
  [String.raw`timber|plywood|osb|chipboard|hardboard|plasterboard|mdf (?:board|sheet|panel)|sheet material|cls|sawn|planed|tongue (?:and|&) groove|t&g|skirting|architrave|coving|cladding|sleepers?`, null, FIX],
  // Fencing, decking and landscaping
  [String.raw`fence (?:panels?|posts?|boards?|rails?)|feather ?edge|gravel boards?|trellis panels?|deck(?:ing)? boards?|composite decking|decking (?:boards?|planks?|kit|tiles?)|paving|slabs?|flagstones?|setts|kerbs?|edging stones?`, null, FIX],
  // Bagged and loose aggregates, cement, bricks and blocks
  [String.raw`cement|concrete (?:mix|bags?)|postcrete|post ?fix|ballast|aggregate|building sand|sharp sand|plastering sand|gravel|pebbles|chippings|bricks?|breeze blocks?|concrete blocks?|bulk bags?|jumbo bags?|top ?soil|lime mortar|mortar mix`, null, String.raw`${FIX}|mixer|trowel|bucket|bag holder`],
  // Floor and wall coverings sold by the square metre
  [String.raw`flooring|laminate|lvt|carpet|underlay|(?:floor|wall|porcelain|ceramic|mosaic|metro|marble|stone|slate|outdoor|bathroom|kitchen) tiles?|wall panels?|wall panelling|shower (?:wall )?panels?|acoustic (?:slat(?:ted)? )?panels?|slat(?:ted)? (?:wall )?panels?`, null, String.raw`${FIX}|cleaner|shampoo|stain remover|protector|gripper|spray|mop|steam`],
  // Doors, windows and roofing
  [String.raw`(?:internal|external|front|back|fire|french|bi-?fold|patio|garage|cottage|oak|pine|glazed|panel|ledged|stable|composite|upvc|shed) doors?|doors? (?:set|pair)|(?:upvc|casement|double glazed|sash|velux|roof|tilt (?:and|&) turn|bay|timber|aluminium) windows?|roof(?:ing)? sheets?|corrugated|polycarbonate sheets?|bitumen sheets?|roof (?:tiles?|felt)|onduline|guttering \d|downpipe \d`, null, String.raw`${FIX}|film|frost|blinds?|curtains?|alarm|sensors?|magnetic|vac|squeegee|wipes?|insulation kit|cleaning`],
  // Bathroom and kitchen fittings that need fitting and a courier
  [String.raw`bath(?:tub)?s?|shower (?:enclosures?|trays?|screens?|doors?|cubicles?)|vanity units?|basins?|close coupled|toilet suites?|back to wall|wall hung|kitchen (?:units?|sinks?|worktops?)|worktops?|sink units?`, String.raw`suite|enclosure|tray|screen|cubicle|vanity|basin|close coupled|back to wall|wall hung|units?|worktops?|freestanding|straight|p[- ]shaped|l[- ]shaped|shower bath|\d{3,4} ?(?:x|mm)`, String.raw`${FIX}|taps?(?! holes?)|wastes?|plugs?|mats?|sheets?|bombs?|towels?|robes?|toys?|thermometers?|pillows?|caddy|caddies|racks?|rails?|seats?|cisterns? (?:parts?|valves?|levers?)|flush|fill valves?|siphons?`],
  // Consumer units and the protective devices inside them: fitted by an electrician (Part P), not her ground.
  // Plug-in RCD adaptors and RCD extension leads are consumer safety products and pass.
  [String.raw`consumer units?|rcbos?|mcbs?|rccbs?|rcds?|afdds?|spds?|surge protection devices?|main switch|fused switch|isolators?|distribution boards?|garage units?`, null, String.raw`plug[- ]in|adaptors?|adapters?|extension|leads?|reels?|portable|sockets? (?:outlet|adaptor)|testers?`],
  // Over Royal Mail's 20kg, or sold in lengths too long for a parcel (3m and up)
  [String.raw`(?:2[1-9]|[3-9]\d|\d{3})(?:\.\d+)? ?kg`, null, String.raw`capacity|load|max(?:imum)?|rated|holds?|supports?|weight limit|up to`],
  [String.raw`(?:[3-9]|\d\d)(?:\.\d+)? ?m(?:etres?)? (?:lengths?|long|coil|roll|drum)|\d+(?:\.\d+)? ?m lengths?`, null, String.raw`tape|tapes?|measures?|cables? (?:ties|clips)|extension (?:leads?|reels?)|hose|lights?|led|string|rope|cord|wire|line|chain`],
  // Overlap and closeboard fence panels, plantation shutters, bagged concrete
  [String.raw`overlap(?: dip treated)?|closeboard|shutters?|multi[- ]purpose concrete|post mix`, null, FIX],
  // Lintels, manhole covers and gully grates: heavy cast or concrete building items
  [String.raw`lintels?|manhole covers?|manhole (?:cover|frame)|gully grates?|inspection chamber`, null, String.raw`keys?|lifting keys?|lifters?|seals?|grease|paint`],
  // Boiler internals: fitted inside a gas appliance by a Gas Safe engineer (Gas Safety Regulations). Thermostats,
  // valves on the pipework, inhibitors and filters pass.
  [String.raw`gas sections?|gas valves?|ignitors?|ignition electrodes?|electrodes?|thermocouples?|diverter valves?|3 way valves?|three way valves?|heat exchangers?|burners?|fan assembl(?:y|ies)|flue sensors?|water pressure sensors?|expansion vessels?|pcbs?|printed circuit boards?`, String.raw`vaillant|ideal|baxi|worcester|glow[- ]?worm|potterton|viessmann|vokera|main|alpha|ferroli|biasi|intergas|ariston|halstead|keston|navien|grant`, String.raw`thermostats?|filters?|inhibitors?|cleaners?|magnetic|service valve`],
  // Polystyrene and foam boards
  [String.raw`jablite|polystyrene insulation|eps (?:insulation|boards?)|xps (?:insulation|boards?)`, null, FIX],
  // Insulation by the slab or roll; insulation tape and pipe lagging pass
  [String.raw`insulation (?:slabs?|rolls?|boards?|batts?)|loft (?:roll|insulation)|rockwool|celotex|kingspan|earthwool|knauf (?:insulation|loft)`, null, String.raw`tape|lagging|pipe|jackets?|lids?|hatch`],
];
