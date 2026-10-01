// Toys & Games only.
// Google's Brand column sometimes names the shop, not the maker: "Pokemon Mega Evolution Elite Booster" filed under
// Wilko, a genuine Pokemon product Wilko sells. A title that names a maker from this list is that maker's product,
// so the shop's name in the Brand column does not make it own label. Argos' Waffle soft toy and George's dolls
// house name no maker, so they still stop.
// A shop's own range named in the title while the Brand column names its maker: Chad Valley (Argos) under
// Ambassador or Playgo, Happyland (Early Learning Centre).
export const OWN_TITLE = String.raw`\b(chad valley|early learning centre|happyland)\b`;
export const BRANDED = String.raw`\b(lego|duplo|pok[eé]mon|barbie|hot wheels|matchbox|fisher[- ]price|mattel|hasbro|nerf|play-?doh|monopoly|jellycat|squishmallows?|bluey|peppa pig|paw patrol|sylvanian|playmobil|vtech|leapfrog|melissa (?:&|and) doug|hape|orchard toys|ravensburger|crayola|marvel|disney|star wars|harry potter|minecraft|sonic|super mario|nintendo|pop mart|labubu|funko|lol surprise|our generation|baby born|cocomelon|gabby'?s dollhouse|hatchimals|magna-?tiles|connetix|tonies|yoto|schleich|brio|little tikes|v-?tech|transformers|my little pony|uno|jenga|twister|kinder)\b`;

// Google files many toys under the maker (Epoch, Jazwares) while shops name the range (Sylvanian Families,
// Squishmallows), so the maker's best sellers never met a shop's product. A range named here and in the Google
// title is searched as well as the maker. Names in lower case, as squash() leaves them.
export const LINES = {
  epoch: ['sylvanian families', 'aquabeads', 'super mario'],
  jazwares: ['squishmallows', 'squishmallow', 'roblox', 'fortnite', 'pokemon', 'adopt me'],
  'takara tomy': ['tomy', 'beyblade', 'tomica', 'plarail', 'licca'],
  tomy: ['beyblade', 'toomies', 'pop up pirate'],
  'wizards of the coast': ['magic the gathering', 'mtg', 'dungeons dragons', 'dungeons and dragons'],
  'jakks pacific': ['disney princess', 'disney frozen', 'sonic', 'super mario', 'nintendo'],
  goliath: ['pass the pigs', 'doggie doo', 'gooey louie', 'crocodile dentist', 'pop the pig', 'rummikub'],
  'golden bear': ['in the night garden', 'hey duggee', 'peppa pig', 'cocomelon', 'bing'],
  'learning resources': ['hand2mind', 'educational insights', 'numberblocks', 'coding critters'],
  'jaques of london': ['jaques'],
  'sonny angel': ['sonny angel'],
  'spin master': ['paw patrol', 'hatchimals', 'gabby s dollhouse', 'bakugan', 'kinetic sand', 'rubiks', 'rubik s'],
  hasbro: ['nerf', 'play doh', 'monopoly', 'transformers', 'my little pony', 'peppa pig', 'connect 4', 'guess who'],
  mattel: ['barbie', 'hot wheels', 'fisher price', 'uno', 'matchbox', 'polly pocket', 'monster high'],
  'mga entertainment': ['lol surprise', 'bratz', 'little tikes', 'rainbow high', 'miniverse'],
  'character options': ['peppa pig', 'bluey', 'cocomelon', 'twirlywoos', 'stitch'],
  moose: ['bluey', 'magic mixies', 'cookeez'],
  'moose toys': ['bluey', 'magic mixies', 'cookeez'],
  flair: ['crayola', 'bluey', 'barbie', 'lol surprise'],
  zuru: ['bunch o balloons', 'x shot', 'smashers', 'mini brands', 'rainbocorns'],
  'bandai namco': ['tamagotchi', 'dragon ball', 'gundam', 'naruto', 'one piece'],
  bandai: ['tamagotchi', 'dragon ball', 'gundam', 'naruto', 'one piece'],
  'zapf creation': ['baby born', 'baby annabell', 'chou chou'],
  zapf: ['baby born', 'baby annabell', 'chou chou'],
  'just play': ['ms rachel', 'disney junior', 'mickey mouse', 'minnie mouse', 'bluey', 'cocomelon', 'blippi'],
  'games workshop': ['warhammer', 'warhammer 40000', 'warhammer 40k', 'age of sigmar', 'kill team', 'citadel'],
  battat: ['our generation', 'b toys'],
};
