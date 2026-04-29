---
status: pending Rewards tab redesign
last_updated: 2026-04-23
---

# Badge Rewards — Tier → Voucher Mapping

> Source: Kasey Fong, WhatsApp 2026-04-23.
> Pair with [`credits-overview.md`](credits-overview.md) (where badge tiers are defined).

---

## Tier → reward

| Tier | Tasks required (cumulative R/C/B) | Reward |
|---|---|---|
| Bronze | default (0–4 tasks) | Airbnb voucher |
| Silver | 5 tasks | 3-star hotel voucher |
| Gold | 15 tasks | 4-star hotel voucher |
| Platinum | 35+ tasks | Specialty hotel / 5-star / resort voucher |

> Quoting Kasey directly:
> - "Bronze reward airbnb"
> - "Silver rewards 3 start hotel"
> - "Gold reward 4 star"
> - "Platinum reward specialty hotel or 5 or resort"

---

## How rewards are earned vs redeemed

- **Earning:** every completed task (10 credits in any R/C/B cycle) mints **1 voucher** of the user's current badge tier. Completing another task while at the same tier mints another voucher of that same tier.
- **Tier level-up:** reaching the next badge tier does not retroactively upgrade previously-earned vouchers. Future task-completion vouchers are minted at the new tier.
- **Redemption:** handled in the Tasks tab → Rewards subtab. Redemption UX is not yet designed; this doc is purely the tier→reward mapping.

---

## Open questions

- **Voucher inventory / sourcing** — are these vouchers purchased from real partners (Airbnb, hotel chains) or is Wegood4u-side mechanics TBD? Confirm with Kasey.
- **Expiry** — no expiry specified. Default to none until product says otherwise.
- **Regional availability** — vouchers only valid in certain regions? Out of scope until redemption is built.
- **Stacking** — can users combine multiple Airbnb vouchers into one booking? Out of scope.
- **Hotel category reward** — Kasey said Hotel submissions go on a "bigger claims" track but didn't specify what that rewards. Tracked in [`credits-overview.md`](credits-overview.md) "Still open".

> Resolved 2026-04-23: Sub-level rewards (L1/L2/L3) are **tier-based only** — Silver L1 and Silver L3 mint identical 3-star hotel vouchers. Level differentiates badge UI bragging rights, not the redemption value.

---

## Implementation placeholder

When Rewards is built, a `vouchers` table is the minimum shape:

```
vouchers(
  id,
  user_id,
  tier,                  -- 'bronze' | 'silver' | 'gold' | 'platinum'
  reward_kind,           -- 'airbnb' | '3_star_hotel' | '4_star_hotel' | 'specialty'
  earned_from_cycle_id,  -- FK to the completed cycle in credits_ledger
  redeemed_at,           -- nullable
  created_at
)
```

Tier snapshot on mint: a voucher's tier is frozen at creation time (using the user's current badge tier), not re-evaluated at redemption. This avoids awkward behaviour where a user's tier drops (never happens today, but the model is defensive).
