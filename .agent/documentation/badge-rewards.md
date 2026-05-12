---
status: shipped (v1)
last_updated: 2026-05-10
---

# Badge Rewards — Visit Badge → Voucher Mapping

> Source: Kasey Fong, WhatsApp 2026-04-23 (initial mapping), 2026-05-03 (manual claim flow), 2026-05-04 (voucher kind upgrade), 2026-05-06 (terminology aligned to "Badge"), 2026-05-10 (mint trigger moved from cycle close to Visit Badge level-up).
> Pair with [`credits-overview.md`](credits-overview.md) (Visit 10 cycle that drives Visit Badge) and [`badges.md`](badges.md) (full badge table + tier/level math).

---

## What gates the voucher

Vouchers are minted on **Visit Badge level-up** — i.e. the moment a `user_badges` row is inserted with `badge_kind='visit'`. The voucher's tier matches the level the user just achieved (Bronze L1 → Bronze voucher, Silver L2 → Silver voucher, etc.). Per-category badges (Cafe / Bar / Restaurant / Hotel / Experience) are tracked separately and do **not** mint vouchers in v1.

There are 12 Visit Badge levels (4 tiers × 3 levels), so a user who reaches Platinum L3 has earned **12 lifetime vouchers**: 3 Bronze + 3 Silver + 3 Gold + 3 Platinum.

> *"this rank is for 10 visit rank"* — Kasey, 2026-05-04
> *"vouchers redeem amount will only increase based ONLY visit badges rank and level"* — wegood4u, 2026-05-10

---

## Tier → reward (revised 2026-05-04)

| Visit Badge tier | Cycles required (cumulative R/C/B) | Reward |
|---|---|---|
| Bronze | default (1–4 cycles) | **3-star or equivalent Airbnb voucher** |
| Silver | 5 cycles | **3–4 star hotel or equivalent Airbnb voucher** |
| Gold | 15 cycles | **4–5 star hotel or equivalent Airbnb voucher** |
| Platinum | 35+ cycles | **Specialty / 5-star / Resort and Airbnb equivalent voucher** |

> Quoting Kasey directly (revised 2026-05-04):
> - "Bronze — 3 star or equivalent Airbnb voucher"
> - "Silver — 3 - 4 - star hotel or equivalent Airbnb voucher"
> - "Gold — 4- 5 star or equivalent Airbnb hotel voucher"
> - "Platinum — Specialty / 5-star / Resort and Airbnb equivalent voucher"

Every tier offers a hotel-or-Airbnb option — Bronze got an upgrade from the earlier "Airbnb only" mapping.

---

## How rewards are earned vs redeemed

### Auto-mint on Visit Badge level-up

A voucher row is inserted into `vouchers` automatically by a database trigger whenever the user crosses a Visit Badge level threshold. The trigger reads the badge's `tier` + `level` and writes a corresponding voucher row in one shot — no user interaction needed.

The 12 lifetime mint moments (cumulative cycles required, on the left) and the resulting voucher tier (on the right):

| Visit Badge level | Cycles | Voucher tier minted |
|---|---|---|
| Bronze L1 | 1 | Bronze |
| Bronze L2 | 2 | Bronze |
| Bronze L3 | 3 | Bronze |
| Silver L1 | 5 | Silver |
| Silver L2 | 7 | Silver |
| Silver L3 | 10 | Silver |
| Gold L1 | 15 | Gold |
| Gold L2 | 20 | Gold |
| Gold L3 | 27 | Gold |
| Platinum L1 | 35 | Platinum |
| Platinum L2 | 40 | Platinum |
| Platinum L3 | 45 | Platinum |

Cycles between levels (4, 6, 8, 9, 11–14, 16–19, 21–26, 28–34, 36–39, 41–44) close normally but **do not** mint a voucher.

### "Complete Tasks" still drives the cycle

Tapping **"Complete Tasks & Claim"** on the Visit 10 card still closes the active cycle and resets to 0/10. It also re-evaluates the user's Visit Badge tier against the new cumulative count — and *if* that re-evaluation inserts a `user_badges` row, the level-up trigger mints a voucher. So from the user's perspective, vouchers still appear when they complete enough cycles; the difference is they only get one *per level* now, not one per cycle.

### Tier snapshot on mint

A voucher's tier is **frozen at creation time** — the level being entered, not the user's overall current tier. A user who has already reached Gold but is going through old Bronze cycles for some reason wouldn't earn a Bronze voucher because they crossed those Bronze thresholds long ago.

### No claw-back

Once a voucher is minted, it stays. Approvals are final ([`credits-overview.md`](credits-overview.md) §"Approvals are final").

### Redemption (admin-fulfilled in v1)

> *"As of now, we will issue voucher on our own. When press redeem voucher, we will rewards manually 1st. If future will be Auto."* — Kasey, 2026-05-07

Handled in the **Tasks tab → Rewards subtab**. The UI shows **all 4 tier voucher cards as a fixed catalog** (Bronze / Silver / Gold / Platinum), with the bundled art from `assets/images/voucher/`. Each card displays the user's available redemption count for that tier.

The Redeem button states:
- **Disabled (grey)** when the user has 0 unredeemed vouchers of that tier
- **Enabled (green)**, labeled **"Redeem ×N"**, when N ≥ 1

Tapping Redeem consumes **the oldest unredeemed voucher of that tier** (FIFO).

Redemption flow:

1. User taps **Redeem** on an enabled card.
2. Confirmation modal: *"Request your {tier} voucher? Our team will reach out via WhatsApp to issue it."*
3. User confirms → `vouchers.redeemed_at` is set on the chosen row → `voucher_redemption_requested` notification fires to admins.
4. Admin sees the pending redemption in the **Tasks → Redeem Req tab** (sibling to Submission). Each row shows user, tier, reward kind, requested time, with a "Mark fulfilled" action that flips `vouchers.fulfilled_at`.
5. Admin contacts user via WhatsApp / email out-of-band to deliver the reward, then taps Mark fulfilled to clear the queue.

Notes:
- Vouchers can be held indefinitely. Users can stack — e.g. earn 3 Bronze vouchers, redeem the first, hold the other 2, the card still shows "Redeem ×2".
- **Fulfillment SLA: ~24 hours** after the user taps Redeem (Kasey 2026-05-10). Admin reaches out via email or WhatsApp to confirm hotel / Airbnb selection.
- No hotel-selection step in v1 — admin handles hotel matching out-of-band based on the voucher tier. v2 adds an in-app hotel picker once partnerships are signed.
- No "Coming soon" wording in the UI per Kasey 2026-05-07.

---

## Beyond Platinum L3 — minting continues (future, not yet wired)

> *"after platinum, they still can mint it. just maintain at platinum level."* — Kasey, 2026-05-10

Once a user reaches Visit Platinum L3 (45 cycles), the current trigger stops minting because `user_badges` has UNIQUE `(user_id, badge_id)` — the same Platinum L3 row can't insert twice. Kasey wants minting to continue past L3, awarding **another Platinum voucher every cycle close** (or every Nth cycle — TBD).

**Status: deferred.** Not in current v1 code. To enable:
- Add a separate trigger / RPC branch that mints a Platinum voucher when the user is already at Platinum L3 and closes another cycle. Likely simplest: extend `complete_visit_task` to check "user has Platinum L3 and no level was crossed by this close" → still mint a Platinum voucher row (with `earned_from_badge_id` pointing at Platinum L3, no `user_badges` insert needed since it already exists).

Decision needed: cycle cadence after L3 — every cycle (1:1) or every N cycles (e.g. every 5 cycles = 1 voucher) to avoid runaway minting? Re-confirm with Kasey before implementing.

---

## Category Badge rewards (future, not in v1) — concrete plan

Cafe / Bar / Restaurant / Hotel each have their own Category Badge with Bronze / Silver / Gold / Platinum progressions ([`badges.md`](badges.md)). In v1, Category Badge tiles show progression only — no reward callout, no "Coming soon" wording.

> *"this will be rewards later, once i got sponsorship from vendors"* — Kasey, 2026-05-04
> *"We no need put future or coming soon ya."* — Kasey, 2026-05-07
> *"we will give voucher books every X months by tier"* — Kasey, 2026-05-10 (paraphrase)

**Reward plan (locked 2026-05-10, pending ≥100 active vendors):**

| Category Badge tier | Voucher book cadence | Voucher type |
|---|---|---|
| Bronze | every 6 months | partner-store voucher (free meal, drink upgrade, group discount, etc.) |
| Silver | every 4 months | partner-store voucher |
| Gold | every 3 months | partner-store voucher |
| Platinum | every 2 months | partner-store voucher |

Voucher kind is matched to the user's most-visited category (e.g. heaviest Cafe visitor → Cafe vouchers). Books are sent **manually** by the admin team via email — no in-app delivery in this phase.

Kasey explicitly said: *"don't overbuild for initial stages. we need to keep the apps really functioning."* — so until 100+ vendor partnerships are signed (estimated 1–2 months out at minimum), **the Category Badge tiles in v1 stay progression-only with zero in-app reward visibility.**

When vendor sponsorships are signed, rewards plug in via the same `vouchers` table — new `reward_kind` values per partner, new `badge_kind` rows mapped to category, new mint trigger filtered to category badges. The schema already supports it.

---

## Future feature — badge level decay (deferred)

> *"in the future, we might implement drop of badges. example, 2 months not active in visiting, it will drop 1 level"* — Kasey, 2026-05-10

If a user goes 2 months with no approved submissions in a category, that category's badge drops one level. Same idea may extend to Visit Badge if cycles stall. **Not implemented in v1.** Schema change not needed (just a scheduled job or a check on submission insert), but UX implications (notification before drop? grace period?) need spec.

---

## Implementation sketch

```
vouchers(
  id,
  user_id,
  badge_kind,                 -- 'visit' (v1) | future per-category values
  tier,                       -- 'bronze' | 'silver' | 'gold' | 'platinum'
  level,                      -- 1 | 2 | 3 (snapshot at mint, for display)
  reward_kind,                -- 'airbnb_3star' | 'hotel_3_4star' | 'hotel_4_5star' | 'specialty_5star_resort'
  earned_from_cycle_id,       -- nullable; cycle that triggered the level-up (or NULL for legacy rows)
  earned_from_badge_id,       -- FK to badges.id — the level the user crossed
  redeemed_at,                -- nullable; set when user taps Redeem
  fulfilled_at,               -- nullable; set when admin taps Mark fulfilled in Redeem Req queue
  created_at
)
```

Sub-level rewards (L1 / L2 / L3) are **tier-based only** — Silver L1 and Silver L3 mint identical vouchers. Level differentiates badge UI bragging rights, not redemption value.

Mint trigger: `mint_voucher_on_visit_levelup` on `user_badges` AFTER INSERT. Filters on `badge_kind='visit'` and joins to `badges` to read tier + level + reward_kind.

---

## Open questions

- **Expiry** — no expiry specified. Default to none until product says otherwise.
- **Regional availability** — vouchers only valid in certain regions? Out of scope until partnerships signed.
- **Stacking** — can users combine multiple Airbnb vouchers into one booking? Out of scope.
- **Category Badge rewards** — TBD per Kasey, vendor sponsorship pending. UI ships in v1 with progression only (no reward callout).
- **Hotel "bigger claims" reward path** — Hotel earns share-stars and has a Category Badge, but a dedicated Hotel-specific reward track was referenced by Kasey earlier and never specified. v1 Hotel partner stores are deferred until partnership signed.
- **Failed claims** — admin manually fulfills in v1, so failure handling is a manual conversation. v2 with auto-fulfillment will need a queued / retry mechanism.
