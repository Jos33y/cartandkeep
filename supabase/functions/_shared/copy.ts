// A last guard on buyer copy, as Keepr's shop drafts have: a sentence or a line about the photographs, the source or
// what is not confirmed never reaches a listing.
const BACKSTAGE = /\b(photographs?|photos?|images?|pictures?|the listing|sources?|suppliers?|not (been )?confirmed|cannot be confirmed|unconfirmed|please check|check the|not stated|not specified)\b/i;
export function backstageOut(text: string) {
  if (/^CONFLICT:/i.test(text.trim())) return text;
  return text.split('\n').map((line) => {
    if (/^\s*[-*]\s/.test(line)) return BACKSTAGE.test(line) ? null : line;
    const sentences = line.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [line];
    return sentences.filter((x) => !BACKSTAGE.test(x)).join('').trimEnd();
  }).filter((l) => l !== null).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
