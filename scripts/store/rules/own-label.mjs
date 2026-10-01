/*
 * Brands only their own shop sells: she cannot buy them for less than the owner sells them.
 * Matched against Google's Brand column, whole name, any case. Add a name here when a review rejects a card as
 * a shop's own brand (T-Mech was MonsterShop's, 3 Peaks is Pets at Home's).
 */
export const OWN_LABEL = [
  // Home, kitchen and garden shops
  'dusk', 'procook', 'b&q', 'm&s', 'wilko', 'dunelm', 'john lewis', 'habitat', 'the white company', 'the range',
  'lakeland', 'wickes', 'halfords', 'ikea', 'next', 'george', 'argos', 'jysk', 'la redoute', 'oliver bonas',
  'living and home', 'livingandhome', 'cookology', 'asda', "sainsbury's", 'homebase', 'robert dyas', 'menkind',
  'laura ashley', 'lights4fun', 'monstershop', 't-mech', 'home discount', 'simmer eats',
  // B&Q and Screwfix (Kingfisher) own brands, and the tile shops' own ranges
  'goodhome', 'diall', 'mac allister', 'erbauer', 'titan', 'lap', 'no nonsense', 'porcelain superstore',
  'tile mountain', 'topps tiles',
  // Fashion and general
  'h&m', 'shein', 'primark', 'very', 'debenhams', 'cotton traders', 'papier',
  // Print on demand
  'photobox', 'printerpix', 'optimalprint', 'soufeel', 'zazzle', 'displate',
  // Pets
  '3 peaks', 'pets at home',
  // Health and beauty
  'holland & barrett', 'holland and barrett', 'boots', 'no7', 'no 7', 'superdrug', 'myprotein', 'weightworld',
  'the body shop', 'lush', 'kiko milano', 'noted. aromas', 'noted aromas',
];
