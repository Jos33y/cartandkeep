// Toys & Games only.
// Google's Brand column sometimes names the shop, not the maker: "Pokemon Mega Evolution Elite Booster" filed under
// Wilko, a genuine Pokemon product Wilko sells. A title that names a maker from this list is that maker's product,
// so the shop's name in the Brand column does not make it own label. Argos' Waffle soft toy and George's dolls
// house name no maker, so they still stop.
// A shop's own range named in the title while the Brand column names its maker: Chad Valley (Argos) under
// Ambassador or Playgo, Happyland (Early Learning Centre).
export const OWN_TITLE = String.raw`\b(chad valley|early learning centre|happyland)\b`;
export const BRANDED = String.raw`\b(lego|duplo|pok[eé]mon|barbie|hot wheels|matchbox|fisher[- ]price|mattel|hasbro|nerf|play-?doh|monopoly|jellycat|squishmallows?|bluey|peppa pig|paw patrol|sylvanian|playmobil|vtech|leapfrog|melissa (?:&|and) doug|hape|orchard toys|ravensburger|crayola|marvel|disney|star wars|harry potter|minecraft|sonic|super mario|nintendo|pop mart|labubu|funko|lol surprise|our generation|baby born|cocomelon|gabby'?s dollhouse|hatchimals|magna-?tiles|connetix|tonies|yoto|schleich|brio|little tikes|v-?tech|transformers|my little pony|uno|jenga|twister|kinder)\b`;
