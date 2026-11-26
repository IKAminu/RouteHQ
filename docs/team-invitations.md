# RouteHQ team invitations

The invitation lifecycle is implemented with Supabase database functions and the `agency-invitations` Edge Function.

## Required email configuration

The Edge Function uses Resend for transactional email. Before enabling invitations in production:

1. Verify a sending domain in Resend and configure the DNS records Resend provides.
2. Create a Resend API key with permission to send email.
3. In Supabase Dashboard → Project → Edge Functions → Secrets, add:
   - `RESEND_API_KEY`: the Resend API key.
   - `ROUTEHQ_FROM_EMAIL`: a verified sender, for example `RouteHQ <notifications@your-verified-domain>`.
   - `ROUTEHQ_APP_URL`: `https://app.routehq.cc.cd`.
   - `ROUTEHQ_APP_ORIGIN`: `https://app.routehq.cc.cd`.
4. Do not put these values in Vite environment variables, GitHub, or frontend code. Never commit the Resend key.

The function is deployed as `agency-invitations` with JWT verification enabled. It also checks the signed-in user and AAL2 before invite, resend, or cancel actions.

## Lifecycle

- Agency invitation creation is authorized against `team.invite` in Postgres.
- Only non-owner system roles or agency roles belonging to the current agency can be assigned.
- Active memberships and unexpired invitations count toward the plan's additional-seat limit.
- Invitation tokens contain 256 bits of random entropy. Only their SHA-256 hashes are stored.
- Invitations expire after seven days. Resending rotates the token and expiry.
- Public preview reveals only the agency name, invited email, role, and expiry.
- Acceptance requires a confirmed email matching the invited address and a verified AAL2 session.
- Membership creation and invitation consumption happen in one database transaction.
- A token is single-use. Cancelled, expired, and accepted invitations cannot be accepted again.

## Production test checklist

Use a dedicated test agency and two test inboxes. Do not test by inviting a real employee until email delivery is configured.

- Send an invitation and confirm delivery, sender identity, and link destination.
- Confirm the invited user can sign up, confirm email, set up TOTP, and join the correct agency.
- Confirm an existing user can sign in and accept.
- Confirm a different signed-in email cannot accept the invitation.
- Confirm expired, revoked, and already-used links are rejected.
- Confirm resend invalidates the previous link.
- Confirm duplicate pending invitations are blocked.
- Confirm Basic cannot invite additional seats and Growth/Pro enforce their configured limits.
- Confirm users without `team.invite` cannot create, resend, or revoke invitations.
