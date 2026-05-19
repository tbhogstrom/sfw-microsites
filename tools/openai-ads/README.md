# OpenAI ChatGPT Ads — SFW Construction campaigns

Plan, build, and upload SFW's ChatGPT Ads campaigns in OpenAI Ads Manager Beta.

## What's in this directory

| File | Purpose |
|---|---|
| `strategy.md` | The campaign strategy: objectives, tiers, targeting approach, KPIs, launch sequence. **Read first.** |
| `build_workbook.py` | Source of truth for every campaign / ad group / ad. Edit here, regenerate. |
| `SFW_chatgpt_ads_campaigns.xlsx` | Generated workbook ready for OpenAI's bulk upload. Don't hand-edit — regenerate. |
| `campaigns.csv` / `adgroups.csv` / `ads.csv` | Human-readable mirrors of each xlsx sheet. Good for review and diffing. |
| `image_assets_needed.md` | Per-campaign image checklist — must be resolved before upload. |
| `articles/` | Saved copies of the 14 OpenAI Ads help articles this strategy is based on. |
| `articles_extracted.txt` | Plain-text extract of all 14 articles for quick reference. |

## At a glance

- **Single advertiser: SFW Construction** — every ad lands on `sfwconstruction.com` (DBA microsites are not used for paid landing)
- **10 campaigns** (one per service line; mold-testing and restoration excluded per project memory)
- **24 ad groups** across distinct intent themes
- **53 ads**, all under OpenAI's 24-char title / 48-char copy template limits
- **All US delivery** (only country option), **Clicks objective** (CPC, $3–$5 max bids)
- **Lifetime budget total:** $6,800 across 6 weeks (2026-06-01 → 2026-07-15)
- **Tracking:** UTMs on every link (`utm_source=chatgpt`, `utm_medium=ads`, `utm_campaign=<service>`, `utm_content=<adgroup>__<variant>`)

## Workflow

```bash
# 1. Edit campaigns / ad groups / ads
$EDITOR build_workbook.py

# 2. Regenerate workbook + CSVs (validates title/copy length and ad-group uniqueness)
python build_workbook.py

# 3. Review CSVs (easier diffs than xlsx)
git diff campaigns.csv adgroups.csv ads.csv

# 4. Upload SFW_chatgpt_ads_campaigns.xlsx via Ads Manager Beta -> Create -> Upload bulk
```

The script will fail loudly if any ad title > 24 chars, any copy > 48 chars, any ad group has > 25 negative keywords, or any name collides — these all cause OpenAI's bulk upload to reject the file.

## Before you upload — checklist

Map this to OpenAI's [Bulk Upload Campaign Schema Checklist](articles/20001218-bulk-upload-campaign-schema-checklist.html).

- [ ] Ads Manager Beta account created at ads.openai.com (account owner = tfalcon@sfwconstruction.com or designated owner)
- [ ] Account verified (email confirmation received from OpenAI)
- [ ] SFW favicon (brand logo) uploaded under Settings → Account Information
- [ ] Billing profile created (business name, address, invoice email)
- [ ] Payment method added (note: OpenAI may place a $100 authorization hold for up to 7 days)
- [ ] Conversion measurement wired up on at least the deck-repair campaign (see Measure Results article)
- [ ] All ad images exist at the URLs in `ads.csv` (see `image_assets_needed.md`)
- [ ] Final budgets and dates in `build_workbook.py` reviewed and approved
- [ ] `python build_workbook.py` re-run after any edits

## After upload — first 48 hours

Per the Launch Campaigns article:

- Delivery typically begins within 24 hours of upload
- Reporting has up to a 7-hour delay between delivery and dashboard
- Any ad rejected for policy reasons can be edited and resubmitted in-place

## Editing in production

Two paths per the Edit Campaigns article:

- **In-line edits** — adjust budgets, pause campaigns, swap copy quickly via the Ads Manager Beta UI. Best for one-off changes.
- **Bulk edits** — for structural changes, click `Export for edit` in Ads Manager Beta, modify, and re-upload. The `build_workbook.py` script in this directory is the source of truth — if you bulk-edit in production, port the changes back into the script so the file and reality stay in sync.

## Support

- OpenAI Ads support: `ads-support@openai.com`
- Troubleshooting guide: `articles/20001217-troubleshooting-common-issues.html`
- Full help collection: <https://help.openai.com/en/collections/20001223-chatgpt-ads>
