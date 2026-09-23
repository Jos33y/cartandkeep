"""
Screens applied before anything is measured.

Screens are word lists and they are wrong in both directions, so nothing a
screen removes is dropped silently. What it took out is printed with its
reason, and the caller decides.

**The electrical screen was one word list doing two jobs and it has been
split.** The reason recorded in `category-research.md` for excluding powered
goods is that electrical compliance sits with the importer. That reason
contains its own release condition: it binds whoever imports, not whoever
sells. Bought from a UK trade supplier who has already imported it, she is a
distributor, and a distributor checks the marking is present, keeps the
paperwork and cooperates with market surveillance. Shipped direct from a
Chinese seller to a UK customer she is the importer and the UK responsible
person, holding a declaration of conformity and a technical file for ten years
on a product she has never handled.

So powered is not a reason to reject a product. It is a constraint on where the
product can be bought, and the supply route is decided per product long after
this script has run. Powered goods are carried through with a flag.

Medical devices are different and stay out. They sit under the UK Medical
Devices Regulations rather than the electrical regime, they carry their own
labelling and responsible person obligations, and several are restricted
categories on eBay besides. Reopening that is a category call and hers.
"""

import re

# Powered goods. Not an exclusion any more, a supply route constraint.
# A caregiver pager cleared the old list on the elderly sweep, because the list
# was pet vocabulary and knew nothing about alert devices, which are most of
# what is powered in a mobility category.
POWERED = re.compile(
    r"\b(electric|electrical|rechargeable|cordless|batter(?:y|ies)|"
    r"\bled\b|lamp|bulb|charger|usb|plug|mains|powered|heated|heater|"
    r"fountain|water pump|timer|automatic (?:feeder|dispenser|cat feeder|"
    r"pet feeder)|auto feeder|programmable|"
    r"pager|alarm|alert|intercom|doorbell|call button|monitor|sensor|"
    r"amplifier|massage gun|percussion|"
    # `vibration` is the second highest gate clearing word in the massage
    # scrape at 662 units and POWERED did not know it, so a mains driven
    # vibration massager was reading as an unpowered product with no import
    # obligation attached. Same gap as the caregiver pager, one category later.
    r"vibrat\w+|kneading|shiatsu|percussive|motoris\w+|motoriz\w+|"
    r"speed\s+settings?|heating)\b", re.I)

# Medical devices, which are a different regime from electrical compliance and
# remain excluded. Checked before POWERED so a blood pressure monitor is
# recorded as medical rather than as a powered product needing a UK route.
#
# The massage sweep found the hole. `blood pressure` was here and `blood
# circulation` was not, so a foot circulation booster passed every screen and
# came back as the single best looking cluster in the file: four phrases, one
# product, nine listings, GBP 16.23, nothing removed. A device sold to improve
# circulation is making a therapeutic claim, and so is a muscle stimulator.
# Both sit under the UK MDR rather than the electrical regime.
#
# EMS is written with its context rather than alone, because three letters in
# a title are also a courier.
MEDICAL = re.compile(
    r"\b(oximeters?|nebulis\w+|nebuliz\w+|sphygmomanometers?|stethoscopes?|"
    r"blood\s+pressure|glucose\s+(?:meter|monitor)s?|glucometers?|"
    r"hearing\s+aids?|hearing\s+amplifiers?|thermometers?|defibrillators?|"
    r"tens\s+(?:machine|unit)s?|medical\s+devices?|"
    # Narrower first, and it left `Leg Massager for Circulation Pain Relief`
    # listable at GBP 51.89 while `Circulation Foot Massager and EMS TENS` was
    # screened at GBP 51.90. Two of the same product, a penny apart, opposite
    # verdicts, because one of them happened to put blood in front of the word.
    #
    # So the word alone. In this category it only ever appears as a claim, and
    # a screened row is printed for review rather than binned, which is the
    # right way round for a compliance question.
    r"circulat\w+|"
    r"(?:muscle|nerve|electro)\s?stimulat\w+|"
    r"electrical\s+muscle\s+stimulat\w+|"
    r"ems\s+(?:muscle|abs|body|foot|leg|pad|massager|machine|trainer|"
    r"stimulator|toner|unit)s?|"
    r"(?:muscle|abs|body|foot|leg)\s+ems\b)\b", re.I)

EXCLUSIONS = {
    # Condition, not category. `DR-HO\'S MotionCiser - Returned - Refurb`
    # came back listable at GBP 76 of headroom on a scrape filtered to New,
    # so either the seller mislabelled it or the row export does not carry the
    # filter. Refurbished stock is a one off unit, never a dropship product,
    # whichever it was.
    "condition": re.compile(
        r"\b(refurb\w+|reconditioned|open\s?box|ex[\s-]?display|"
        r"grade\s+[abc]\b|for\s+parts|spares\s+or\s+repair)\b", re.I),

    # Applied to the product, not to a colour. "Cream stripe polycotton" is a
    # bed, so the words must sit next to something that makes them a cosmetic.
    #
    # The first version of this list was written against pet titles and held
    # lipstick and mascara and nothing else from the make-up counter. Run
    # against a beauty sweep it passed foundation, eye shadow, concealer and
    # setting powder straight through, which is Responsible Person liability
    # under the UK Cosmetics Regulation on every one of them. The vocabulary
    # below comes from eBay's own leaf names under Health & Beauty.
    "cosmetic": re.compile(
        r"\b(serum|shampoo|conditioner|lipstick|lip\s?(?:gloss|balm|liner|tint|stain)|"
        r"mascara|nail\s+(?:polish|varnish|lacquer)|perfume|fragrance|"
        r"aftershave|cologne|eau\s+de\s+(?:parfum|toilette)|"
        r"foundation|concealer|primer|blusher|blush\s+(?:stick|palette)|"
        r"bronzer|highlighter\s+(?:palette|stick)|contour\s+(?:kit|palette|stick)|"
        r"eye\s?shadow|eye\s+shadow|eyeliner|eye\s+liner|brow\s+(?:pencil|gel|pomade)|"
        r"setting\s+(?:spray|powder)|loose\s+powder|pressed\s+powder|"
        r"bb\s+cream|cc\s+cream|tinted\s+moisturis\w+|"
        r"moisturis\w+|cleanser|toner|exfoliat\w+|face\s+mask|sheet\s+mask|"
        r"retinol|hyaluronic|niacinamide|salicylic|glycolic|"
        r"sunscreen|spf\s?\d+|self\s+tan|fake\s+tan|"
        r"shower\s+gel|body\s+wash|bubble\s+bath|bath\s+bomb|body\s+butter|"
        r"deodorant|antiperspirant|deep\s+conditioner|hair\s+(?:mask|oil|dye|colour)|"
        r"rinse[\s-]?free|no[\s-]?rinse|"
        r"(?:face|skin|body|hand|foot)\s+(?:cream|lotion|oil|scrub|balm)|"
        # `body oil` was here and `massage oil` was not, so a 500ml bottle of
        # it passed the whole screen on the massage sweep. Responsible Person
        # liability does not care which word is in front of oil.
        r"(?:massage|aromatherapy|essential|carrier)\s+oils?)\b",
        re.I),

    # "Chew resistant" and "tough chew" describe a bed's durability, and
    # "winter warm" is not a food, so chew and feed only count as ingestible
    # when nothing next to them says otherwise.
    "ingestible": re.compile(
        r"\b(supplements?|vitamins?|tablets?|capsules?|kibble|pellets?|"
        r"dental\s+(?:stick|chew)s?|(?<!chew )treats?\b|dog rocks?|water rocks?|"
        r"(?:chew|feed)(?:s|ing)?\s+(?:stick|bone|bar|treat|snack|roll)|"
        r"(?:rawhide|pizzle|tripe|jerky|biscuits?))\b", re.I),

    # Fit risk on WORN goods only. A bed sold in various sizes is not a fit
    # gamble, and the earlier pattern was screening out the best products in
    # the best category because "various sizes" contains the word size.
    "sized": re.compile(
        r"\b(harness|collar|coat|jumper|jacket|hoodie|boots?|shoes?|"
        r"socks?(?!\s+(?:aid|helper|puller|slider|glide))|"
        r"vest|bandana|muzzle|life\s?jacket|raincoat)\b", re.I),

    # Adult goods listed as massagers. `magic wand` came back at GBP 17.82 on
    # six listings with every screen clear, and it is two problems at once:
    # Magic Wand is a registered mark, and the phrase is the standard way an
    # adult product is listed inside a massage category. eBay restricts these
    # to their own category, so it is not a margin question.
    #
    # `wand` alone stays out. It is a TOOL_NOUN and it releases the cosmetic
    # screen on make-up wands.
    # `magic wand` caught 113 units and `Le Wand Wednesday Powerful Ladies
    # Wand` sat in the listable list at GBP 52 of headroom, which is the wrong
    # direction to miss in. A wand qualified by a person rather than by a body
    # part is the same product under a different phrase.
    "adult": re.compile(
        r"\b(magic\s?wands?|vibrators?|dildos?|anal|prostate|"
        r"masturbat\w+|adult\s+toys?|g[\s-]?spot|clitor\w+|"
        r"(?:ladies|womens?|women\'s|personal|intimate)\s+wands?|"
        r"wand\s+(?:vibe|massager\s+for\s+(?:her|women)))\b", re.I),

    "medical": MEDICAL,
}

# "Branded" covers four different situations and only two are disqualifying.
# Lumping them threw away the own-label candidates, which are the whole reason
# the custom store exists.

# Licensed character IP. Never, at any margin. This is what ends accounts.
# Character and entertainment IP. Never, at any margin. This is what ends
# accounts, and the fourteen names here were written for pet products. Run
# against bedding, which is one of the largest licensed categories on eBay UK,
# the old list missed Roblox, Billie Eilish and a football star duvet in the
# top twenty five rows of one window.
#
# Trailing suffixes are allowed because sellers misspell deliberately:
# `Robloxs` was a real title in the July scrape.
LICENSED = re.compile(
    r"\b(disney|marvel|pixar|nintendo|pokemon|pok\u00e9mon|barbie|peppa|bluey|"
    r"paw\s?patrol|harry\s?potter|star\s?wars|hello\s?kitty|minecraft|"
    r"roblox\w*|fortnite|sonic\s+the|super\s?mario|spider[\s-]?man|batman|"
    r"superman|\bdc\s+comics|avengers|hulk\b|thor\b|transformers|"
    r"ninja\s?turtles|tmnt|power\s?rangers|my\s+little\s+pony|"
    r"lol\s+surprise|squishmallow\w*|among\s+us|five\s+nights|fnaf|"
    r"frozen\s+(?:elsa|anna|disney)|elsa\b|moana|encanto|toy\s?story|"
    r"winnie\s+the\s+pooh|thomas\s+the\s+tank|hey\s?duggee|cocomelon|"
    r"in\s+the\s+night\s+garden|trolls\b|shrek|minions|despicable\s+me|"
    r"stranger\s+things|squid\s+game|"
    r"billie\s+eilish|taylor\s+swift|\bbts\b|blackpink|harry\s+styles|"
    r"premier\s?league|manchester\s+united|man\s+utd|liverpool\s+fc|"
    r"arsenal\s+fc|chelsea\s+fc|celtic\s+fc|rangers\s+fc)\b", re.I)

# Third-party brands with no authorised supply route. VeRO exposure.
#
# This list was pet vocabulary only and the sweep it now runs on is mobility
# and daily living. The brands below the blank line were named in our own
# batch: they are UK manufacturers selling through trade accounts, which is
# exactly the shape that issues takedowns.
THIRD_PARTY = {
    "kong", "petsafe", "ancol", "rosewood", "trixie", "catit", "pawise",
    "bunty", "hownd", "sureflap", "mason cash", "zeus", "dekton", "goodyear",
    "bauer", "me & my", "dogit", "skylos", "maximum pet", "road refresher",
    "super design", "cat mate",

    "aidapt", "croydex", "drive devilbiss", "devilbiss", "homecraft",
    "helping hand", "medokare", "nrs healthcare", "patterson medical",
    "performance health", "days healthcare", "senator", "viscount",
    "tenura", "putnams", "etac", "sunrise medical", "invacare",
    "homcom", "aosom", "vitility", "russka", "ability superstore",

    "catherine lansfield", "silentnight", "slumberdown", "dorma",
    "sanderson", "laura ashley", "cath kidston", "kelly hoppen",
    "dreamscene", "brentfords", "gaveno cavailia", "sleepdown",
    "rapport home", "pieridae", "de lavish",

    # Massage. The first run of this category put Theragun at GBP 293 of
    # headroom at the top of the listable list, five times over, alongside
    # Therabody, Bob and Brad, Naipo and Dr Ho. Every row in the file above
    # GBP 30 of headroom was a brand name. The list has learned pet, then
    # mobility, then bedding, and it learns the category it is pointed at,
    # which is the recurring shape of this fault rather than a new one.
    "theragun", "therabody", "hypervolt", "hyperice", "bob and brad",
    "naipo", "renpho", "homedics", "beurer", "breo", "medcursor",
    "dr-ho", "dr ho", "sarah chapman", "le wand", "lelo",
    "emsense", "callixe", "welliawell", "yawn air", "medi-boost",
    "medisana", "sportneer", "opove", "addsfit", "mebak",
    # Second pass, all four sat in the listable list on the run that removed
    # the first twenty six. Crivit is Lidl's own label, which is a brand with
    # a retailer behind it rather than a generic.
    "crivit", "centra", "dr graeme", "nordicsculpt", "nordic sculpt",
}

# The list was matched with `brand in title.lower()`, a bare substring test, so
# `etac` fired on deTAChable and `dorma` fires on dormant the same way. A brand
# list that matches inside words is a screen nobody can predict, which is worse
# than one that misses.
#
# Longest first so `drive devilbiss` is reported rather than `devilbiss`.
THIRD_PARTY_RE = re.compile(
    r"\b(" + "|".join(re.escape(b) for b in
                      sorted(THIRD_PARTY, key=len, reverse=True)) + r")\b",
    re.I)

# Made to order per customer. Not a dropship product whatever the margin.
BESPOKE = re.compile(r"\b(personalised|personalized|custom name|bespoke|engraved)\b", re.I)

TRADEMARK = re.compile(r"[\u00ae\u2122\u00a9]")

# Royal Mail bands assume a small parcel. These words say the item is not one,
# so the headroom figure is optimistic and the real band must be checked before
# any margin claim. Bulk is the single biggest unmodelled cost in this data.
BULKY = re.compile(
    r"\b(\d+\s?kg|roll|jumbo|xxl|extra large|x-large|xl\b|bulk|"
    r"sofa|orthopaedic|orthopedic|crate|kennel|cage|mattress|large\s+bed|"
    r"frame|stool|chair|step|table|walker|rollator|commode|trolley|bench|"
    # `wheelchair user` names the buyer, not the product, and was costing a
    # pack of sponges as a medium parcel.
    r"platform|wheelchair(?!\s+users?)|bed rail|over bed|"
    # A foot spa is a moulded tub sold to be filled with water. It came back
    # as a small parcel on the massage corpus, which understates postage and
    # so overstates margin, which is the wrong direction to be wrong in.
    r"foot\s?spa|spa\s+bath|foot\s?bath|pedicure\s+(?:spa|bath))\b", re.I)

# Bulk and shape are different properties and the difference decides whether a
# Chinese supply route works at all. BULKY asks how big it is. This asks
# whether it compresses. A raised toilet seat is neither large nor heavy and
# took GBP 28.50 of freight from AliExpress, while a cushion from another
# seller took 80p, because rigid moulded goods travel as a parcel and soft
# goods travel as a packet on subsidised postal rates.
RIGID = re.compile(
    r"\b((?:toilet|shower|bath|commode|perching)\s+seat|"
    r"stool|frame|rail|pole|step|stand|tray|basin|gun\b|"
    r"chair|recliner|armchair|hoist|patient\s+lift|riser|"
    r"clippers?|tweezers?|scissors|rollers?|gua\s?sha|curlers?|"
    r"board|stick|cane\b|pan\b|"
    r"commode|bedpan|bed pan|urinal|bucket|caddy|crate|box\b|"
    r"foot\s?spa|spa\s+bath|foot\s?bath|"
    r"walker|rollator|wheelchair|trolley|zimmer|crutch|"
    r"plastic|moulded|molded|aluminium|aluminum|steel|metal)\b", re.I)

# Two kinds of soft word and the difference decides which way an ambiguous
# title reads. A swivel cushion for a chair is a cushion. A fabric covered
# recliner is a chair. So a soft PRODUCT noun beats a rigid word, and a soft
# MATERIAL word does not.
SOFT_PRODUCT = re.compile(
    r"\b(cushions?|pads?|mats?|matting|covers?|sheets?|bedsheets?|sleeves?|"
    r"straps?|belts?|socks?(?!\s+(?:aid|helper|puller|slider|glide))|"
    r"gloves?|wipes?|cloths?|towels?|bibs?|aprons?|"
    r"insoles?|bandages?|slings?|sponges?|puffs?|"
    r"duvets?|quilts?|bedding|pillow\s?cases?|linen|throws?|blankets?)\b", re.I)

SOFT_MATERIAL = re.compile(
    r"\b(fabric|cotton|foam|silicone|polyester|fleece|microfibre|microfiber)\b",
    re.I)


# "Things, not chemistry" is a boundary between products, not between words.
# A make-up sponge applies foundation and a blending brush applies eye shadow,
# so both titles carry a cosmetic word while being tools she can list. The
# cosmetic screen is dropped when a tool noun is present and no formulation
# word is, which is the same shape as the harness exemption below.
TOOL_NOUN = re.compile(
    r"\b(brush(?:es)?|sponges?|blender|applicators?|puffs?|curlers?|"
    r"tweezers?|mirrors?|bags?|cases?|holders?|organis\w+|cleaners?|"
    r"rollers?|gua\s?sha|clippers?|files?|buffers?|scissors|"
    r"stand|rack|pouch|wand|comb)\b", re.I)

# The product carries its own cleanser, so the sponge or wipe is packaging
# rather than a tool. A dry make-up sponge is a tool she can list. A sponge
# soaked in body wash is a cosmetic in a different shape, and the Responsible
# Person obligation does not care what the cleanser is wrapped around.
#
# Found by the corpus: `Rinse Free Bath Wipes| No Water Body Wash Sponge` was
# screening as cosmetic and then being let through by the tool exemption,
# while sitting in a live batch.
IMPREGNATED = re.compile(
    r"\b(rinse[\s-]?free|no[\s-]?rinse|no[\s-]?water|water[\s-]?less|"
    r"pre[\s-]?moisten\w+|soapless|self[\s-]?lathering)\b", re.I)

# An oil is a formulation whatever it is packaged in, so a roller bottle of
# massage oil is not released by the tool exemption the way a dry blending
# brush is.
FORMULATION = re.compile(
    r"\b(liquid|cream|palette|lotion|serum|balm|varnish|polish|oils?|"
    r"\d+\s?ml|refill|tube|bottle|sachet)\b", re.I)


# A transfer harness is a buckled strap that fits everyone across a range. A
# dog harness is fitted to a body. The word is the same and the fit risk is
# not, so `sized` ignores harness when the title puts it in a transfer context.
# Verified against the four harness rows in the elderly batch: it clears the
# wheelchair belt, the scooter belt and the gait belt, and still screens the
# dog harness.
TRANSFER_CONTEXT = re.compile(
    r"\b(gait|transfer|wheelchair|patient|lifting|hoist|"
    r"stand\s+assist|seat.?belt)\b", re.I)


def screen(title):
    """Reasons this product cannot be listed at all. Powered is not one."""
    hits = []
    for name, pattern in EXCLUSIONS.items():
        matches = [m.group(0).lower() for m in pattern.finditer(title)]
        if not matches:
            continue
        if (name == "cosmetic" and TOOL_NOUN.search(title)
                and not FORMULATION.search(title)
                and not IMPREGNATED.search(title)):
            continue
        if name == "sized" and TRANSFER_CONTEXT.search(title):
            matches = [m for m in matches if not m.startswith("harness")]
            if not matches:
                continue
        hits.append(name)
    if LICENSED.search(title):
        hits.append("licensed")
    match = THIRD_PARTY_RE.search(title)
    if match:
        hits.append("brand:" + match.group(1).lower())
    elif TRADEMARK.search(title):
        hits.append("trademark")
    if BESPOKE.search(title):
        hits.append("bespoke")
    return hits


def is_powered(title):
    """
    True when the product needs a supply route that carries the import
    obligation. Medical devices are excluded by `screen` before this is
    consulted, so this never fires on one.
    """
    if MEDICAL.search(title):
        return False
    return bool(POWERED.search(title))


# Royal Mail Tracked 48 bands, chosen from the title rather than assumed.
#
# Small parcel is 45 x 35 x 16cm and 2kg. A three piece double duvet cover set
# compresses inside that. A king or super king set does not, and neither does a
# filled duvet, a pillow or a mattress topper. Where a listing names king at
# all the seller has to be able to post the king version, so the band has to
# cover it.
#
# This only ever moves a row UP a band. Nothing is guessed downward, because
# understating margin costs a candidate and overstating it costs a decision.
MEDIUM_BAND = re.compile(
    r"\b(super\s?king|superking|king\s?size|\bking\b|"
    r"tog\b|filled|duvets?\s+(?:\d+|tog)|"
    r"pillows?\b(?!\s?cases?)|mattress\s+(?:topper|protector)|"
    r"hoist|patient\s+lift|stand\s+aid|transfer\s+board|"
    r"throw|blanket|towel\s+bale|curtains?)\b", re.I)


# Words that decide a band and mean two different things depending on what
# they are attached to. A bed pillow does not compress into a small parcel. A
# massage pillow is a moulded device wearing the same word, and it was costing
# GBP 1.90 more than it should on two rows in the massage batch.
#
# The answer is not an exemption. `postage_band` only ever moves a row up, on
# purpose, because understating margin costs a candidate and overstating it
# costs a decision, and writing an exemption means guessing a carton size from
# memory. So the band stays conservative and the word that set it is recorded
# instead. A row costed on an ambiguous word is a row somebody has to measure,
# which is a queue rather than a rotting note.
# The first version of this list was mobility vocabulary and it fired on 67 of
# 196 elderly rows. A toilet frame, a half step and a shower chair are not
# ambiguous, they are furniture, and a measuring queue that contains a third of
# the batch is not a queue.
#
# Ambiguity is contextual, not lexical. The word has to be attached to
# something that says this is a small device rather than the thing it is named
# after, which is the same shape as the transfer harness exemption.
AMBIGUOUS_BAND = re.compile(
    r"\b(pillows?|chairs?|stools?|throws?|blankets?|boards?)\b", re.I)

# What turns one of those into a device. A massage cushion sits on a chair, a
# shiatsu pillow is not slept on, a car seat cover is not a car seat.
SMALL_DEVICE_CONTEXT = re.compile(
    r"\b(massage|massager|shiatsu|kneading|percussion|vibrat\w+|"
    r"cushions?|pads?|covers?|wraps?|sleeves?|"
    r"cervical|lumbar|neck|shoulder|car\b|seat\s+cover)\b", re.I)


def postage_band(title):
    """
    The band this product actually posts at. Never large letter: that requires
    dimensions and sellers in these categories do not publish them.
    """
    if MEDIUM_BAND.search(title) or BULKY.search(title):
        return "medium_parcel"
    return "small_parcel"


def band_word(title):
    """
    The word or words that pushed this row up a band, in the order they appear
    in the title. Empty when nothing fired and the row is a small parcel by
    default.

    This exists so a band can be argued with. `Neck & Shoulder Massager Heated
    Back Body Massager Deep Tissue Electric Pillow` reads medium and the reason
    is one word, and until that is on the row nobody can tell a confident band
    from a guess.
    """
    hits = [m.group(0).lower() for m in MEDIUM_BAND.finditer(title)]
    hits += [m.group(0).lower() for m in BULKY.finditer(title)]
    return "|".join(dict.fromkeys(hits))


def band_needs_measuring(title):
    """
    True when the band was decided by a word that does two jobs, so the figure
    is a defensible default rather than a fact. These are the rows to check a
    real pack size on before anything is sourced from them.
    """
    if postage_band(title) != "medium_parcel":
        return False
    # Nothing in the title says this is a device, so the word means what it
    # usually means and the band is not in doubt.
    if not SMALL_DEVICE_CONTEXT.search(title):
        return False
    deciding = [w for w in band_word(title).split("|") if w]
    # All of them, not any. One unambiguous word settles the band on its own:
    # a super king filled duvet is not a small parcel whatever else is in the
    # title, and putting it in a measuring queue is noise.
    return bool(deciding) and all(AMBIGUOUS_BAND.fullmatch(w) for w in deciding)


def is_bulky(title):
    return bool(BULKY.search(title))


def shape(title):
    """
    Whether a Chinese route is plausible on freight alone. Three values and the
    middle one is honest: most titles do not say.

        rigid    moulded or framed, travels as a parcel
        soft     compresses, travels as a packet
        ""       the title does not say, so do not pretend it does

    Order matters. A soft product noun wins, because a swivel cushion for a
    chair is still a cushion and we have costed one at 80p of freight. A rigid
    word beats a soft material word, because a fabric covered riser recliner
    is a chair. Both misreadings happened on real runs.
    """
    if SOFT_PRODUCT.search(title):
        return "soft"
    if RIGID.search(title):
        return "rigid"
    if SOFT_MATERIAL.search(title):
        return "soft"
    return ""
