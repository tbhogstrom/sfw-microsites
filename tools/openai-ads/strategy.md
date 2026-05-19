# SFW Construction — ChatGPT Ads Campaign Strategy

**Account:** SFW Construction LLC — single advertiser account, all campaigns brand as SFW Construction
**Landing pages:** all traffic goes to `sfwconstruction.com` (DBA microsites are not used for paid landing)
**Date:** 2026-05-18
**Platform:** OpenAI Ads Manager Beta (ChatGPT Ads)
**Window:** Beta — early scaling phase, US-only delivery to Free/Go users 18+

---

## 1. Platform reality check (what we're working with)

| Constraint | Implication for SFW |
|---|---|
| **US-only country targeting** (no state/city geo) | Portland-area intent must be **encoded in ad copy and context hints** — there is no geographic filter. Spend on out-of-region clicks is the largest risk. |
| **Free/Go ChatGPT users in US** are the audience (no Plus/Pro/Business) | Skews toward consumers, light/casual users — fits residential homeowner persona. |
| **Ad format:** title (≤24 chars per template), copy (≤48 chars per template), favicon, image (1200×1200 square max), landing page | Forces extremely tight messaging — every word fights for placement. SFW favicon goes on every ad. |
| **Auction:** relevance-weighted second-price | Specific, intent-rich copy and landing pages beat broad/generic. |
| **Context hints ≠ keywords** | Hints are *thematic intent signals* — write them as the **questions/situations a homeowner would bring to ChatGPT**, not Google keywords. |
| **Bidding:** CPM (Views) or CPC (Clicks), $3–5 recommended starting CPC max | We default to **Clicks** — SFW needs leads, not impressions. |
| **Limits:** 5,000 campaigns / ad groups / ads per account | Not a constraint for us. |
| **Reporting:** Impressions, Clicks, Spend, CTR, Avg CPC, Avg CPM, Conversions (if measurement is wired in) | We will wire UTMs into every URL and ideally set up conversion measurement before launch. |

## 2. Objective and KPIs

**Primary objective:** generate qualified contact-form and phone leads from Portland-metro homeowners researching exterior/structural repair services.

**Primary KPIs (per campaign, weekly):**

- CTR ≥ 0.6% (no public benchmark exists yet — this is a working floor)
- Avg CPC ≤ the max_bid set per ad group
- Cost per HubSpot form submission ≤ 1.5× SFW's blended paid-search CPL for that service
- Phone call volume (CallRail attribution where script is installed)

**Secondary signals:**

- Impressions delivered (proxy for context-hint quality)
- Landing page engagement (GA4 — bounce, scroll depth, time-on-page)
- Geo split of clicks via GA4 — if >50% of clicks are out-of-region, kill or reword

## 3. Account structure

```
SFW Construction (one advertiser account, one favicon = SFW logo)
└── 10 Campaigns (one per service line, all landing on sfwconstruction.com)
    └── 2–3 Ad Groups per campaign (intent themes)
        └── 2–3 Ads per ad group (creative variants)
```

**Services in scope (10):** deck-repair, chimney-repair, siding-repair, crawlspace-rot, leak-repair, lead-paint, flashing-repair, dry-rot, trim-repair, beam-repair.

**Excluded:** mold-testing (not released for V1), restoration (no service pages in V1) — per project memory.

### Why one advertiser brand (SFW) and one campaign per service

- **Brand surface:** ChatGPT renders the advertiser name and favicon on every ad. Running 10 DBAs as 10 advertisers would mean 10 separate ad accounts, 10 verifications, 10 billing profiles. Consolidating under "SFW Construction" keeps account ops simple and presents one trustworthy brand to ChatGPT users.
- **Landing pages on sfwconstruction.com:** every ad lands on a real service page on the main SFW site — better conversion infrastructure (HubSpot form, financing offer, testimonials, photos), better tracking, and the main domain has higher trust signals for OpenAI's relevance system.
- **Per-service campaigns** keep budget control, reporting, and bidding clean — each service has a wildly different CPC environment ($2.37 for lead paint vs $14.62 for leak repair).

### Landing-page map (every ad lands on a real SFW page)

| Service | Landing page |
|---|---|
| deck-repair | `sfwconstruction.com/repair-services/portland-deck-repair/` |
| chimney-repair | `sfwconstruction.com/chimney-chase-repair/` |
| siding-repair | `sfwconstruction.com/siding-repair-portland/` |
| crawlspace-rot | `sfwconstruction.com/repair-services/crawl-space-repair-portland/` |
| leak-repair | `sfwconstruction.com/locations/portland/portland-window-leak-repair/` |
| lead-paint | `sfwconstruction.com/locations/portland/house-painting-portland/lead-based-paint-removal/` |
| flashing-repair | `sfwconstruction.com/repair-services/roof-repair-flat-roof-repair/` (closest match — no dedicated flashing page) |
| dry-rot | `sfwconstruction.com/repair-services/dry-rot-repair/` |
| trim-repair | `sfwconstruction.com/repair-services/dry-rot-repair/` (no dedicated trim page; rot is the dominant intent) |
| beam-repair | `sfwconstruction.com/repair-services/construction-defect-repair-portland/` |

If marketing wants to ship dedicated flashing-repair or trim-repair pages on sfwconstruction.com, update `landing_path` in `build_workbook.py` and regenerate — this is a one-line change per service.

## 4. Tiered budget and bid allocation

Tiers reflect search volume × CPC × business profitability. **Lifetime budgets sized for a ~6-week initial test window (2026-06-01 → 2026-07-15) producing meaningful signal.** Adjust before launch.

| Tier | Services | Lifetime budget | CPC max_bid | Why |
|---|---|---|---|---|
| **1 — High value, competitive** | deck-repair, siding-repair, crawlspace-rot, chimney-repair | $1,000 each ($4,000 total) | $4–$5 | Largest search volume, highest revenue per job, competitive CPC environments. |
| **2 — Emergency / urgent intent** | leak-repair, flashing-repair | $600 each ($1,200) | $4–$5 | Smaller volume but bottom-of-funnel intent. |
| **3 — Specialty / lower volume** | lead-paint, dry-rot, trim-repair, beam-repair | $400 each ($1,600) | $3–$4 | Niche services, lower CPC environments, lower volume. |
| | **Total** | **$6,800** | | |

If $6,800 is too aggressive for a beta test, halve it across the board — the structure still works.

## 5. Targeting strategy: encoding Portland into intent

We cannot geo-target. We compensate three ways:

1. **Title or copy of every ad contains "Portland," "PDX," "Portland, OR," or "Pacific NW"** wherever character budget allows.
2. **Context hints describe homeowner situations with Portland/Oregon geography baked in** — e.g., *"homeowner in Portland Oregon asking about replacing rotted deck boards"*, not *"deck rot repair"*.
3. **Landing pages are already Portland-coded** (rotrepairportland.com, etc.) — relevance algorithm uses the landing page as a strong signal.

Negative keywords are kept short and focused on clear off-intent (DIY, big-box retail, far-away cities). Per-ad-group cap is 25.

## 6. Creative principles for ChatGPT Ads (vs Google Search)

Per OpenAI's "Create Ads for ChatGPT" guide:

- **Build for coverage** — multiple distinct ads per ad group, each angled differently.
- **Each ad introduces a different angle** — *don't* run three "free estimate" ads. Run "free estimate" + "stop the rot" + "licensed since 2000".
- **Specific > catchy** — "Wood Chimney Rot Repair" beats "Chimney Pros."
- **Title and copy must complement, not echo** each other.
- **Land deep, not on homepage** — link to the service page or location hub, not the root domain.

### Angle library used in this build

| Angle | Use when |
|---|---|
| **Problem-statement** ("Rotted Deck?") | High-emotion / urgent services (rot, leaks, structural) |
| **Solution-statement** ("Hardie Board Experts") | Specialty material or technique |
| **Trust/credentials** ("Licensed Portland crew", "EPA-certified") | Regulated services (lead paint), high-stakes (structural) |
| **Free inspection / estimate** | Universal — supports lower funnel |
| **Local proof** ("Portland licensed contractor", "Pacific NW moisture experts") | Counteracts US-wide ad placement |

## 7. Tracking and measurement

### UTMs (on every landing page link)

```
utm_source=chatgpt
utm_medium=ads
utm_campaign=<service-slug>           # e.g. deck-repair
utm_content=<adgroup-slug>__<ad-variant>  # e.g. deck-rot__problem-v1
```

These persist through ad clicks per OpenAI's docs and feed GA4 + HubSpot.

### Conversion measurement

Wire up OpenAI's conversion measurement (per Measure Results guide) **before launch** for at least one campaign — recommend deck-repair as it has the highest volume. Conversion events:

- HubSpot form submit (primary)
- CallRail completed call ≥ 30s (where script is installed: deck-repair, siding-repair, crawlspace-rot)
- High-intent page scroll (secondary)

### CallRail compatibility

deck-repair, siding-repair, crawlspace-rot have CallRail dynamic number-swapping scripts in `service-configs.ts`. UTMs from ChatGPT Ads should trigger appropriate number swapping. **Verify after launch by clicking a live ad and checking the displayed number.**

## 8. Launch sequence

1. **Pre-launch (now → 2026-05-25)**
   - Create OpenAI Ads Manager Beta account (account owner: tfalcon@sfwconstruction.com)
   - Upload SFW favicon (the same logo used across microsites in `public/shared/`)
   - Set up billing profile and payment method
   - Wire conversion measurement on deck-repair
2. **Workbook upload (2026-05-26 → 2026-05-30)**
   - Upload `SFW_chatgpt_ads_campaigns.xlsx`
   - Resolve any validation errors (per Troubleshooting Common Issues guide)
   - Confirm all 10 campaigns marked Active
3. **Launch (2026-06-01)** — campaigns go live
4. **First 24–48h:** monitor delivery status, expect 7h reporting delay
5. **Week 1 review (2026-06-08):** kill or rewrite any ad group with CTR < 0.3% or out-of-region click % > 50%
6. **Week 3 review (2026-06-22):** rebalance budgets toward best-performing campaigns
7. **End of test (2026-07-15):** decide which campaigns continue and at what budget

## 9. Open decisions before upload (review these)

- [ ] **Image assets** — every ad needs a 1200×1200 square PNG/JPG, publicly hosted. The workbook currently uses placeholder URLs at each DBA's `/og-image.png`. Replace with real ad creative before upload. (See `image_assets_needed.md`.)
- [ ] **Final budgets** — defaults total $6,800. Confirm or scale.
- [ ] **Final landing page URLs** — defaults link to each DBA homepage. Consider linking to deeper service or location pages for higher relevance.
- [ ] **Conversion measurement pixels** — need to be implemented per OpenAI's measurement docs before launch.
- [ ] **Favicon** — confirm SFW logo file is uploaded to the account.

## 10. What's in the deliverable

- `strategy.md` — this file
- `SFW_chatgpt_ads_campaigns.xlsx` — populated workbook, ready for bulk upload
- `campaigns.csv` / `adgroups.csv` / `ads.csv` — human-readable mirrors of each sheet
- `image_assets_needed.md` — checklist of creative work needed before upload
- `build_workbook.py` — the script that generated the workbook (regenerate after edits)
- `articles/` — saved copies of the 14 OpenAI Ads help articles this strategy is based on
