# Extra Tasks — Stars, Streaks, and Social Media Share

> Source of truth for the three engagement loops that earn **stars**: Social Media Share, Daily Log-In Streak, and Referral.
> Locks: 2026-05-03 (initial), 2026-05-04 (daily streak revised to 50 stars / 14 days, manual trade flow, day-1 access for verified members).
> Pair with [`credits-overview.md`](credits-overview.md) (Visit 10 cycle + stars-to-progress trade), [`referral-system.md`](referral-system.md) (referral tree + qualification gate), and [`badges.md`](badges.md) (badge progression).

---

## What "extra tasks" are

Three engagement loops that run alongside the core Visit 10 Task. Each one earns **stars** — the unit users manually trade for bonus progress on the Visit 10 cycle.

| Extra task | Source | Surface |
|---|---|---|
| Social media share | Sharing an approved submission to Facebook / Instagram / TikTok | Submit Proof tab (proof-required) |
| Daily log-in streak | Logging into the app daily | Rewards tab (no proof) |
| Referral | Inviting friends who verify and submit | Rewards tab (no proof) |

**Stars are not auto-converted.** They sit in the user's wallet until the user manually taps **"Use 100 ★ for +1 Progress"** on the Visit 10 card. Each tap deducts 100 stars and adds +1 progress to the active cycle, capped at +4 trades per cycle. Full mechanics in [`credits-overview.md`](credits-overview.md).

---

## 1. Social Media Share

### Eligibility

- A share must reference an **approved** submission.
- All four categories are eligible: Restaurant, Cafe, Bar, **and Hotel** (Kasey 2026-05-03: *"Share social media can be used on hotel approved submission"*).
- One approved submission can be shared on multiple platforms; each platform earns separately.
- Hotel submissions don't earn Visit 10 progress on their own, but a Hotel-submission share **does** earn stars (which can then be traded on the user's R/C/B Visit 10 cycle).

### Star rates

| Action | Stars |
|---|---|
| Share approved submission to Facebook | +15 |
| Share approved submission to Instagram | +15 |
| Share approved submission to TikTok | +15 |
| Bonus: all 3 platforms shared for the same approved submission | +5 |
| **Maximum per approved submission** | **50** |

### Submission flow

1. After a user's submission is approved, a **"Share & earn"** card surfaces on the submission detail screen and on the Submit Proof tab while any approved submission has unfilled platforms.
2. User publishes content on the chosen platform with the required hashtags + mention.
3. User pastes the post URL **or** uploads a screenshot (private accounts).
4. AI review verifies hashtag presence, mention/tag presence, and that the proof has not been re-used.
5. Verified → stars credited to wallet; History row written; user notified.

### Required hashtags + mention

Final list pending — Kasey: *"I send you the hashtag later"*. Provisional from the [`wegood4u-share-earn.html`](wegood4u-share-earn.html) prototype:

- `#Wegood4u`
- `#TravelMalaysia`
- `#GoodForYou`
- `@wegood4u.official` (mention)

All four required for verification.

### Anti-fraud

- DB unique key on `(submission_id, platform)` — one share per pair.
- Image hash dedup on uploaded screenshots: same image used twice = rejected.
- URL dedup: same post URL submitted by two different users = rejected for the second.
- AI review (same model that handles submission receipt review) processes share posts. Cost ≈ same as submission review.

Note: approvals are final ([`credits-overview.md`](credits-overview.md) §"Approvals are final"), so a share verified against a now-disputed submission cannot be reverted. The submission is locked once approved.

### UI references

- Phase 1 reference layout: [`wegood4u-share-earn.html`](wegood4u-share-earn.html).
  - Hero **"100 points"** wording → rebrand to **stars**.
  - **"RM 5 travel credit"** line is dropped — not in spec.
  - Color palette stays on Wegood4u green/white primary (Kasey: *"color need to change ya"*).
- Updated design: [`../plans/designs/03-share-earn-v2.html`](../plans/designs/03-share-earn-v2.html).

---

## 2. Daily Log-In Streak

### Goal

Reward continuous daily app opens with stars that can be traded into the Visit 10 cycle.

### Locked rules (revised 2026-05-04)

- **14 consecutive days** logged in = **50 stars** awarded as a single payout at the milestone.
- The streak is **recurring** — hitting day 14 awards 50 stars and the counter rolls into the next 14-day window.
- Day boundary: **Asia/Kuala_Lumpur** local time (00:00–23:59 KL = MY time).
- **Eligibility: any verified member.** No approved-submission pre-requirement; users can start streaks from day 1 of being verified.
- Math impact: 100 stars = 1 trade. So 14 days alone = 0.5 trade. User needs **2 × 14-day streaks (~28 days)** for one full +1 Progress trade. Streak is intentionally a slow source.

> *"14 days = 50 star"* — Kasey, 2026-05-04 (revised down from earlier 100; reasoning: low-effort activity warrants smaller reward)
> *"all verified members can immediately began their daily checkin tasks"* — Kasey, 2026-05-04
> *"Asia MY time"* — Kasey, 2026-05-04 (timezone confirm)

### Activity gate

**v1 (current):** Just login + tap **"Check in today"** button. Simple.

**v2 (deferred — pairs with blog section build):** Require either session ≥ 1 minute foreground time OR opened a blog/video during the session for the streak day to count. Tracked via React Native `AppState` events. The blog section doesn't exist yet, so this is a future phase.

> *"i wish they can contribute some view or like on our post or video"* — Kasey, 2026-05-03 (preferred direction, deferred until blog section ships)
> *"can we deploy what we have now ?"* — Kasey, 2026-05-04 (signoff to ship v1 with simple check-in)

### Streak break / reset

- Last check-in date < (today - 1 day in KL TZ) → streak resets to 0 on next check-in (which then becomes day 1).
- No grace period in v1. (Reconsider for v2 if user feedback warrants.)

### Storage model

- `profiles.current_streak` (int, default 0)
- `profiles.last_checkin_at` (timestamptz, nullable)
- `daily_checkins(user_id, checkin_date, created_at)` — audit table; one row per (user, KL-day). Unique on `(user_id, checkin_date)`.

### UI

- "Daily Log-In" tile on the Rewards tab.
- Tapping the tile reveals: current streak count, "Check in today" CTA (only enabled if today's check-in not yet recorded), 14-day grid showing past streak progress, next-milestone reward card (`+50 ★ at day 14`).
- Reference: [`../plans/designs/02-daily-streak.html`](../plans/designs/02-daily-streak.html).

---

## 3. Referral (cross-reference)

Full mechanic in [`referral-system.md`](referral-system.md). Star economy summary:

| Event | Stars to top-level affiliate |
|---|---|
| L1 invitee qualifies (verified + first approved submission) | +100 |
| L2 invitee qualifies | +50 |

Two L2 qualifications accumulate to 100 stars = 1 trade, same as one L1 qualification.

Per-invitee **one-shot** — a second approved submission from the same invitee does not award again.

---

## How stars feed Visit 10 progress

```
  Approved submission share        ┐
  Daily log-in 14-day milestone    ├──►  Star wallet (per user)
  L1 referral qualifies            │
  L2 referral qualifies            ┘

  User taps "Use 100 ★ for +1 Progress"
                                     │
                          100 stars deducted
                                     │
                                     ▼
                    +1 Visit 10 progress (max 4 trades / cycle)
```

The trade is **manual** — users tap the button on the Visit 10 card. There's no auto-conversion. Stars sit in the wallet until the user decides to spend them. This gives the user agency and makes the trade feel like an action.

UI on the Visit 10 Task card:
- `6 (+2) / 10` notation when trades have been applied.
- Trade button: enabled when `wallet ≥ 100 AND active cycle has < 4 extras`. Disabled otherwise (with a hint about wallet status or cap).
- Per-extras-row breakdown in History: shows where each extra came from (referral / share / streak).

---

## Where each extra lives in the app

| Surface | Contents |
|---|---|
| **Tasks tab → My Task subtab** | Visit 10 progress card with `(+N)` extras annotation + trade button. Lists the four task types so users see what's available. |
| **Tasks tab → Submit Proof subtab** | Visit submission form **and** Social Media Share card (both require proof upload). |
| **Tasks tab → Rewards subtab** | Star wallet hero. Voucher inventory. Daily Log-In streak tile + Referral tile (no proof needed). Trade button mirrored here for convenience. |
| **Profile tab** | No star display (Kasey: stars/credits do not surface in profile). |

---

## Star icon

- Format: **SVG** (vector, single file across all densities, runtime tintable).
- **v1 fallback: Lucide `Star`** for inline counters and chips while the custom asset is in production.
- Custom asset: pending design from Kasey's team — see materials list in [`../plans/stars-and-extra-progress.plan.md`](../plans/stars-and-extra-progress.plan.md).

---

## Still open

- Final hashtag list — Kasey: *"I send you the hashtag later"*.
- Daily streak v2: foreground time tracking + blog/video gate (deferred until blog section ships).
- AI verification: false-positive / appeal flow for share verification.
- Hotel "bigger claims" reward track — separate from Visit 10, mechanism still TBD (tracked in [`credits-overview.md`](credits-overview.md) "Still open").
