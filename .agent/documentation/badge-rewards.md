---
status: pending Rewards tab redesign
last_updated: 2026-05-04
---

# Badge Rewards — Visit Rank → Voucher Mapping

> Source: Kasey Fong, WhatsApp 2026-04-23 (initial mapping), 2026-05-03 (manual claim flow), 2026-05-04 (voucher kind upgrade + Visit Rank rename).
> Pair with [`credits-overview.md`](credits-overview.md) (Visit 10 cycle that drives Visit Rank) and [`badges.md`](badges.md) (full rank table + level math).

---

## What gates the voucher

Vouchers are minted on **Visit 10 cycle close**. The voucher kind is determined by the user's **Visit Rank tier** at the moment they tap "Complete Tasks". Per-category ranks (Cafe / Bar / Restaurant / Hotel / Experience) are tracked separately and do **not** affect voucher kind.

> *"this rank is for 10 visit rank"* — Kasey, 2026-05-04

---

## Tier → reward (revised 2026-05-04)

| Visit Rank tier | Cycles required (cumulative R/C/B) | Reward |
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

### Manual claim at cycle close

When a user's Visit 10 cycle reaches 10/10 (any combination of ≥6 real visits + ≤4 star-traded extras), the UI surfaces a **"Complete Tasks & Claim"** button on the Visit 10 card. Tapping it:

1. Closes the active cycle in `visit_progress`.
2. Mints **1 voucher** at the user's **current Visit Rank tier** into the `vouchers` table.
3. Resets the cycle counter to 0/10 (star wallet keeps any leftover stars).
4. Re-evaluates Visit Rank against the new cumulative cycle count — may award a Silver / Gold / Platinum badge if a threshold was just crossed.

> *"once they complete the task, they press complete task, then they will get voucher in rewards tab"* — Kasey, 2026-05-03

Vouchers do **not** auto-mint at 10/10 — the user must explicitly claim. This avoids surprise voucher minting and lets the user see the milestone before consuming it.

### Tier snapshot on mint

A voucher's tier is **frozen at creation time** (using the user's Visit Rank tier when they claim). Future tier-ups don't retroactively upgrade earlier vouchers — they only affect future cycle-claim mints.

### No claw-back

Once a voucher is minted, it stays. Approvals are final ([`credits-overview.md`](credits-overview.md) §"Approvals are final"), so there's no path to revoke a cycle that has already closed.

### Redemption

Handled in the **Tasks tab → Rewards subtab**. Redemption UX shows claimable vouchers (with a Redeem CTA) + past redemptions (greyed, with "Used" tag). Redemption flow itself (booking platform integration / honor codes / partner API) is TBD pending vendor sourcing.

---

## Per-category rank rewards — coming soon

Cafe / Bar / Restaurant / Hotel / Experience ranks each have Bronze / Silver / Gold / Platinum progressions ([`badges.md`](badges.md)) but **no rewards wired up in v1**.

> *"this will be rewards later, once i got sponsorship from vendors"* — Kasey, 2026-05-04

UI shows the rank progression with a "Coming soon" hint. When vendor sponsorships are signed, rewards plug in via the same `vouchers` table — likely with new `reward_kind` values per partner.

---

## Implementation sketch

```
vouchers(
  id,
  user_id,
  rank_kind,                  -- 'visit' (v1) | future per-category values
  tier,                       -- 'bronze' | 'silver' | 'gold' | 'platinum'
  level,                      -- 1 | 2 | 3 (snapshot at mint, for display)
  reward_kind,                -- 'airbnb_3star' | 'hotel_3_4star' | 'hotel_4_5star' | 'specialty_5star_resort'
  earned_from_cycle_id,       -- FK to closed cycle in visit_progress (for Visit Rank vouchers)
  earned_from_rank_threshold, -- nullable: which rank threshold awarded this (for future per-category rewards)
  redeemed_at,                -- nullable
  created_at
)
```

Sub-level rewards (L1 / L2 / L3) are **tier-based only** — Silver L1 and Silver L3 mint identical vouchers. Level differentiates badge UI bragging rights, not redemption value.

---

## Open questions

- **Voucher inventory / sourcing** — partner integration (Airbnb API, hotel chain APIs) vs honor-system codes? Currently honor-system is the v1 default.
- **Expiry** — no expiry specified. Default to none until product says otherwise.
- **Regional availability** — vouchers only valid in certain regions? Out of scope until redemption is built.
- **Stacking** — can users combine multiple Airbnb vouchers into one booking? Out of scope.
- **Per-category rank rewards** — TBD per Kasey, vendor sponsorship pending. UI ships in v1 with "Coming soon" hint.
- **Hotel "bigger claims" reward path** — Hotel earns share-stars and has a per-category rank, but a dedicated Hotel-specific reward track was referenced by Kasey earlier and never specified.
- **Failed claims** — what if voucher mint fails (e.g. partner inventory exhausted)? Should the cycle stay open or close with a queued voucher? Pending.
