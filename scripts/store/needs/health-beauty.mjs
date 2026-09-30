// Need words for Health & Beauty: care and daily living aids, supports, monitors, pain relief, first aid and the
// parts people reorder (brush heads, shaver foils, blades). Beauty, fragrance and hair care are browsed, not needed.
export const RULES = [
  ['care', /\b(walking (?:aids?|sticks?|frames?|canes?)|rollators?|wheelchairs?|commodes?|raised toilet|toilet (?:seat )?raisers?|toilet frames?|grab (?:rails?|bars?)|bath (?:seats?|boards?|steps?|lifts?)|shower (?:seats?|stools?|chairs?)|perching stools?|bed (?:rails?|levers?|wedges?)|dressing aids?|sock aids?|long handled (?:sponge|comb|brush|shoe horn)|shoe horns?|reachers?|grabbers?|pick ?up tools?|jar openers?|kettle tippers?|pill (?:organisers?|organizers?|box(?:es)?|dispensers?|crushers?|cutters?)|incontinence|continence|bed pads?|chair pads?|magnif\w*|big button|amplified|hearing amplifiers?|personal alarms?|pendant alarms?|dementia|easy grip|adapted cutlery|plate guards?|scoop plates?|two handled|day clocks?|talking (?:clocks?|watch(?:es)?))\b/i],
  ['support', /\b((?:knee|back|wrist|ankle|elbow|lumbar|neck|thumb) (?:supports?|braces?)|compression (?:socks|stockings|sleeves?)|posture correctors?|hernia (?:belts?|supports?)|arm slings?|tubigrip)\b/i],
  ['monitor', /\b(blood pressure monitors?|thermometers?|pulse oximeters?|oximeters?|blood glucose|glucose (?:meters?|monitors?)|test strips|lancets|bathroom scales?|body (?:weight )?scales?)\b/i],
  ['pain', /\b(heat (?:pads?|wraps?|packs?)|tens (?:machines?|units?)|hot water bottles?|wheat (?:bags?|warmers?)|cold packs?|ice packs?|gel packs?)\b/i],
  ['first-aid', /\b(first aid(?! beauty)|plasters?|bandages?|wound dressings?|burn gel|eye wash|splinter)\b/i],
  ['pest', /\b(head lice|nit combs?|lice)\b/i],
  ['part', /\b(brush heads?|replacement heads?|toothbrush heads?|shaver (?:heads?|foils?|cutters?)|foil and cutter|razor (?:blades?|cartridges?)|refill (?:pads|blades|cartridges)|hearing aid batter(?:y|ies)|flosser tips|replacement tips|nebuli[sz]er (?:masks?|parts?)|cpap (?:masks?|filters?|tubing)|charging (?:stands?|bases?|cables?))\b/i],
];
export const NOT_NEED = /\b(meal replacements?|foundation|perfume|parfum|eau de|fragrance|cologne|molecule|lipstick|mascara|serum|shampoo|conditioner|hair dye|nail polish|gift set)\b/i;
