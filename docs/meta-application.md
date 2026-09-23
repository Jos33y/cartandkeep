# The Meta application

Cart & Keep, 23 August 2026

---

## What this is about

Two different things get called "Meta approval" and only one of them is a
blocker. Separating them is the whole point of this document.

```
wa.me link              works today, no application, no account, nothing to
                        approve. Opens the customer's own WhatsApp into a chat
                        with her number.

WhatsApp Business       an API. Needs a Meta Business Portfolio, Business
Platform                Verification, an approved display name, approved
                        message templates and a webhook. Weeks.
```

The messaging plan already chose the first for stage one, and the reason is in
it: two honest channels beats one half built one. Nothing in the shop as it
stands waits on Meta.

**So the shop can go live without any Meta approval.** If something said
otherwise in the meeting, that is a decision that changed rather than a
constraint that exists, and it is worth being clear which.

---

## What the API actually gets us that a link does not

Worth stating, because the application is real work and it should buy
something.

```
outbound after 24 hours   a link only works when the customer starts. The API
                          can send a template message later: your order has
                          shipped, the thing you asked about is in stock
threads in the portal     her replies come back into the shop rather than
                          living in her phone
multiple people           one queue, more than one person answering
the blue tick             a separate paid subscription, not this application
```

The first two are the ones that matter for this shop. The third is a problem
she does not have and the fourth is a different purchase.

---

## What Meta requires, as of August 2026

Checked rather than remembered, since this changes.

### 1. A Meta Business Portfolio

<cite index="30-1">Formerly Business Manager, and the central hub where the business manages its assets. Without a properly configured Business Portfolio the WhatsApp Business API onboarding cannot be completed.</cite>

Registered in **her** business name, not the studio's, for the same reason the
Stripe account is.

### 2. Business Verification

This is the long pole and the one that gets rejected.

<cite index="32-1">Meta asks for two distinct proofs: a legal entity proof and an address or phone proof, and verification is strictly for a legal entity registered with local authorities. The way it passes is making the reviewer see the same legal business everywhere: the Meta business info, the registration document, the website, the address proof and the authorised admin all matching.</cite>

Three specific failure modes, all avoidable:

<cite index="32-1">Use the exact legal entity name rather than a casual trade name. Put the legal name and exact address on the website's footer and contact pages. Do not loosely translate a non-English document; submit a certified translation instead.</cite>

**This is where our own outstanding work bites.** Her trading name and address
are still not filled in on the shop, and the placeholder currently on it is an
address in Ontario. A reviewer comparing the registration document against the
website would fail that immediately. So the trading details are not just a
legal requirement for trading, they are a precondition for this application.

<cite index="30-1">Typical documents are business registration, company information, a business website, a business email address, and supporting documents. Requirements vary by country and business type, and any inconsistency between the submitted information and the official documents delays verification.</cite>

### 3. A dedicated phone number

<cite index="29-1">A dedicated phone number, an approved display name, Meta-approved message templates, and explicit customer opt-in.</cite>

The number cannot be one already registered on the ordinary WhatsApp Business
app. If she uses her current business number for WhatsApp today, moving it to
the API means losing the app on that number, and that is a real decision rather
than a technicality.

### 4. A webhook

<cite index="27-1">A secure HTTPS webhook URL to receive incoming messages and delivery events, unless a Business Solution Provider supplies one.</cite>

Ours would be a Supabase edge function, the same shape as `stripe-webhook`.
This part is a day, and it is the only part that is engineering.

### 5. Approved message templates

Anything sent outside a 24 hour window since the customer's last message has to
be a template Meta approved in advance. Order shipped, back in stock, and the
reply to a question left overnight are all templates.

---

## Direct or through a provider

```
direct Cloud API   free API access, we build everything, we own the webhook
                   and the template submissions
a BSP              Wati, Twilio, 360dialog and so on. They supply the webhook,
                   an inbox, and often walk the verification through. Monthly
                   fee plus per conversation.
```

**I would go direct.** The portal already has an inbox pattern, an email
sender, and a webhook that works. Paying a monthly fee for an inbox she would
have to check separately from the portal is buying a second place for a
customer message to sit unanswered, which is the exact failure the messaging
plan is built to prevent.

The argument for a BSP is that they carry the verification, and verification is
the part most likely to go wrong. That is worth money if the paperwork is
messy. It is not worth it here, because her paperwork is a UK registered
company with a real address, which is the easy case.

---

## What blocks what

```
the shop going live        nothing here. wa.me works today.
messaging stage one        nothing here. Email plus a WhatsApp link.
messaging stage two        Business Verification, which is weeks
Business Verification      her trading name and address, on the shop,
                           matching her registration exactly
```

That last line is the one to act on. It is already on her list as a legal
requirement for trading, and it turns out to be a precondition for this too.

---

## The order to do it in

```
1  She fills in the trading name and address on the shop.
   Ours to chase, hers to supply. Already outstanding.

2  Create the Meta Business Portfolio in her legal business name.
   Fifteen minutes. Do it the same day as step one, so the website and the
   portfolio are consistent from the start.

3  Submit Business Verification with the registration document and an
   address proof.
   Meta reviews. Days to weeks, and a rejection costs a wait rather than the
   application.

4  Decide the number.
   The only decision with a cost attached, because it may mean giving up the
   WhatsApp Business app on her current number.

5  Build the webhook and submit templates.
   Ours. A day, and it cannot start before step 3 clears.
```

Steps one and two can happen this week and cost nothing. Everything after them
is waiting, which is exactly why they should not wait on us finishing the code.

---

## What I would tell her

Not "we need Meta approval before the shop can open", because that is not true
and it hands her a reason for the date to slip that is nobody's fault.

What is true: the shop opens without it, WhatsApp works from day one as a link,
and the fuller integration is a separate thing with a separate timeline that
starts the moment her trading details are in.
