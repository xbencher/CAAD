# Business Rules

These rules are the source of truth for product behavior. Code that
enforces a rule must cite its ID in a comment. Each rule enforced in a
checkpoint has at least one test whose name contains the ID (e.g.
`test_br08_fourth_free_request_is_rejected`).

Do not edit these rules while implementing a checkpoint. If a requirement
conflicts with a rule below, stop and ask instead of guessing.

- **BR-01 Age**: users must be 18+ based on date of birth, computed in IST.
  Under-18 → signup refused, the account record is deleted, and a hash of
  the phone number is blocked from registering for 365 days. DOB cannot be
  changed once set.
- **BR-02 Discovery privacy**: other users' distance, coordinates, check-in
  time and arrival order are never returned by any API.
- **BR-03 Check-in**: requires (a) a valid signed venue QR payload and (b) a
  device location within the venue radius (default 150 m) with accuracy
  <= 100 m. One active check-in per user. A check-in expires 3 hours after
  creation.
- **BR-04 Presence**: the app sends a heartbeat every 60 s while in the
  foreground. Presence TTL is 5 minutes. A heartbeat outside radius + 300 m
  checks the user out.
- **BR-05 Invisible mode**: an invisible user does not appear in discovery.
  Sending a request reveals the sender to that recipient only.
- **BR-06 Request format**: a connection request carries exactly one intro
  message, 1–200 characters, plain text. Links, email addresses and phone
  numbers are rejected. No further messages can be exchanged until the
  request is accepted.
- **BR-07 Uniqueness**: at most one pending request between any two users,
  in either direction. If B already has a pending request to A, A is told
  to respond to it instead.
- **BR-08 Daily quota**: FREE_DAILY_REQUESTS (default 3) for every free
  user regardless of gender. Members get MEMBER_DAILY_REQUESTS (default
  50, fair use). Quota resets at 00:00 IST.
- **BR-09 Quota consumption**: every request created counts toward the
  quota, whatever its outcome (accepted, declined, expired, cancelled).
  Super Requests do not count (BR-18).
- **BR-10 Silent decline**: the sender is never told about a decline. A
  declined request is shown to the sender as pending until its expiry
  time, then as expired. No event or push is sent to the sender on
  decline.
- **BR-11 Cooldown**: after a request ends without acceptance (declined or
  expired), the sender cannot request the same recipient for 7 days. The
  API response is identical for both causes.
- **BR-12 Photos**: before acceptance, others see only the blurred primary
  photo, first name, age, bio, interests and verified badge. Unblurred
  photos are visible only to accepted connections.
- **BR-13 Chat**: only between users with an active connection and no
  block. Text only in v1, 1–2000 characters, max 20 messages per 10
  seconds per user. When either side unmatches, messages are hidden for
  both and hard-deleted after 30 days unless under a report hold.
- **BR-14 Block**: bidirectional invisibility everywhere (discovery,
  requests, chat, cards). Blocking ends the connection and cancels pending
  requests both ways. The blocked user is never notified.
- **BR-15 Reports**: 3 reports from unique reporters within 7 days → the
  reported user is shadow-hidden pending review. A report in the
  "underage" category shadow-hides immediately. Reporting also blocks the
  reported user for the reporter.
- **BR-16 Verified-only**: a user can choose to receive requests only from
  verified users.
- **BR-17 Plans**: DAILY ₹29 (24 h), WEEKLY ₹79 (7 days), MONTHLY ₹299 (30
  days). Prices live in the database in paise, never trusted from the
  client. Buying while active extends the end time: `new_end = max(now,
  current_end) + duration`.
- **BR-18 Add-ons**: SUPER_REQUEST ₹19 per credit (pinned at top of the
  recipient's inbox, does not consume daily quota). VENUE_BOOST ₹49 (user
  appears first in discovery at the current venue for 60 minutes).
- **BR-19 Entitlement grant**: only after server-side verification —
  either a verified checkout signature plus a server-side payment status
  check (captured, amount matches), or a signature-verified
  `payment.captured` webhook. Granting is idempotent per order.
- **BR-20 Account deletion**: immediate deactivation (checkout, hidden,
  tokens revoked), hard delete within 30 days, except data under report
  hold and minimal payment records required by law. Users can request a
  JSON export of their data.
- **BR-21 Location data**: raw user coordinates are never persisted or
  logged; they are used only transiently for geofence checks. Uploaded
  photos have all EXIF metadata stripped.
- **BR-22 BLE**: optional and opt-in. Ephemeral IDs rotate every 15
  minutes. The "Same room" badge requires both users checked in at the
  same venue AND a sighting within the last 10 minutes above the RSSI
  threshold. BLE is never used on its own for discovery. Sightings are
  never written to the database.
- **BR-23 Rate limits**: OTP request max 3 per phone per 10 minutes and 10
  per IP per hour. OTP verify max 5 attempts per issued code.
- **BR-24 Gender and preferences**: gender (woman, man, non_binary, other)
  and "show me" preferences are used only for mutual discovery filtering,
  never for pricing or quotas.
- **BR-25 Push privacy**: push notifications never contain message text.
  Declines never trigger a push.
- **BR-26 Partner analytics**: venue partners see only aggregates; any
  bucket with fewer than 5 users is suppressed.
