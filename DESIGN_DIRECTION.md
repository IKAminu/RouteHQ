# RouteHQ visual direction and audit

## Design direction

- **Product:** RouteHQ is the operating workspace for travel agencies, connecting enquiries, customers, packages, bookings, travellers, payments and agency administration.
- **Character:** calm, exact, operational.
- **World:** a travel operations desk: route boards, booking records, departure lists and clear hand-offs.
- **Moment:** real agency records and the relationship between an enquiry, a booking and the travellers on that journey.
- **Signature:** RouteHQ orange used as a route marker for the active action or selected state, not as decoration across every surface.

**Concept:** RouteHQ should read like a well-run travel operations desk: the records carry the visual weight; the interface chrome stays quiet.

## Audit findings

The existing interface already had a defined RouteHQ orange palette, working module navigation, reusable UI controls, a responsive sidebar, and a useful dark theme. It did not need a new brand identity.

The most noticeable opportunities were:
- A local in-memory search and a separate command menu split one global-navigation job across two interfaces.
- Dark mode used repeated radial and linear gradients, translucent highlights and shadows across surfaces that did not need depth.
- Navigation and table labels used tracked uppercase styling more broadly than their information value justified.
- Authentication was a single centred card and did not use the application's travel-operations visual language.
- TOTP verification accepted 6–8 characters and required a manual submit even after all six digits had been entered.

## Changes applied

- Replaced the duplicated local search/command-menu experience with one top-centred global search island.
- Search reads the current RouteHQ tables and relies on each table's existing RLS policy. It searches only ordinary identifying/display fields, never encrypted passport data or other secrets.
- Search results route into existing modules with their current filter pre-populated. Notes use the existing Notes page search.
- Added loading, empty, error/retry, keyboard navigation, Escape, focus restoration, debounce and stale-response protection.
- Installed Dynaura 0.2.2 for its documented React toaster and promise notifications. The app uses its no-font stylesheet so it does not pull in a second display font.
- Reworked authentication into one consistent form-plus-operations-visual layout, reused for login, signup, password recovery, TOTP setup and session errors.
- TOTP entry is six digits, numeric, paste/autofill friendly, auto-submits once complete and blocks duplicate submissions. Error state clears the invalid code and allows a fresh attempt.
- The live verification factor is Supabase TOTP, not SMS. WebOTP and SMS resend are intentionally not added to an authenticator-app challenge.
- Reduced decorative dark-mode gradients and shadows in the application chrome while retaining the graphite surfaces and orange accent.
- Kept the existing module layout, business features, route structure, theme provider and Supabase authentication logic.

## Verification boundaries

This implementation is checked by the repository's CI workflow. The GitHub Pages deployment is a demo build and does not prove live Supabase workspace access. Live global search requires a user with an active agency workspace and the corresponding table permissions.

No Supabase schema changes or migrations were required. Search uses the existing tenant-scoped RLS policies.

## Skill attribution

The design audit follows the Charles Unslop skill installed under `.agents/skills/charles-unslop`. It is adapted from Unslop by Damir Sokolovsky, CC BY 4.0, with changes by Charles Liu. The skill source and its references are retained in the repository. See the source project: https://github.com/LemonFace0309/charles-skills/tree/main/skills/design/charles-unslop
