# Portal auth

Six digit code, not a magic link. She works from her phone, and links opened
from a mail app land in an in-app browser where the session is easily lost.
A code is typed into the tab already open.

## Dashboard setup, once

**Authentication > Providers > Email**
- Enable email provider
- Turn OFF "Confirm email" is not required; leave defaults
- Turn OFF public signups: Authentication > Sign In / Up > "Allow new users to
  sign up". The app also passes `shouldCreateUser: false`, but the server side
  is what actually holds.

**Authentication > Emails > Magic Link template**

The default template only renders the link. Add the token, or the code flow has
nothing to send:

```
<p>Your Cart &amp; Keep sign in code:</p>
<p style="font-size:28px;letter-spacing:6px"><strong>{{ .Token }}</strong></p>
<p>The code expires in one hour.</p>
```

**Authentication > Rate limits**

The built-in email sender is capped at a few messages per hour and often lands
in spam. Fine for testing. Before she uses this, set custom SMTP under
Project Settings > Authentication > SMTP so mail comes from cartandkeep.com and
arrives reliably.

## Adding a user

1. Authentication > Users > Invite user, enter the address
2. Run `queries/2026-07-25_grant-portal-access.sql` with the address filled in
3. They sign in at the portal and request a code

Without step 2 they reach the portal but see "No access", because a session is
not the same thing as a membership row and RLS returns nothing without one.
