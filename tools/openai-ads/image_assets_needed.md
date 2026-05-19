# Ad creative asset needed before upload

Every ad in `SFW_chatgpt_ads_campaigns.xlsx` references **one shared SFW Construction brand image**:

```
https://sfwconstruction.com/sfw-chatgpt-ad-1200.png
```

**This URL currently 404s** — it's a placeholder. ChatGPT Ads will reject the bulk upload if the image URL is unreachable or not an image.

## Image requirements (OpenAI)

- **Format:** PNG or JPG
- **Shape:** square
- **Size:** at least 640×640, at most **1200×1200**
- **Hosting:** publicly accessible, opens directly to the image in a browser
- **Accepted hosts:** SFW's own domains/CDN, Google Drive public links, AWS S3/CloudFront

## What to put in the image

The single shared image will run on **53 ads across 10 service categories**, so design for breadth, not specificity. Recommended treatments:

- **SFW Construction logo, centered, on a clean background** — works as a brand impression across every service.
- A clean photo of a Portland-area home exterior with the SFW logo overlaid in a corner.
- Avoid text-heavy treatments — title/copy and advertiser name are already shown next to the image.

## Two paths to ship the image

**Option A — single shared brand image (current build):**
1. Produce one 1200×1200 PNG (SFW logo, brand colors, neutral background)
2. Drop it at the WordPress root (`/sfw-chatgpt-ad-1200.png`)
3. Verify `https://sfwconstruction.com/sfw-chatgpt-ad-1200.png` returns `200` and `image/png`
4. No code changes needed — the workbook already points here

**Option B — distinct image per service or per ad** (better A/B testing, more effort):
1. Produce a 1200×1200 image per service (10 images) or per ad (53 images)
2. Add an `image` field to the `Ad` or `Campaign` dataclass in `build_workbook.py`
3. Update `image_url()` to return the per-ad/per-campaign URL
4. Regenerate: `python build_workbook.py`

OpenAI's "Create Ads for ChatGPT" guide notes images should be simple, relevant, and match the ad message — Option B gives a measurable lift, Option A clears the gate.

## Quick verification before upload

```powershell
$url = 'https://sfwconstruction.com/sfw-chatgpt-ad-1200.png'
$r = Invoke-WebRequest -Uri $url -Method Head -MaximumRedirection 5
"{0}  {1}  {2}" -f $r.StatusCode, $r.Headers.'Content-Type', $r.Headers.'Content-Length'
```

Expect `200`, `image/png` (or `image/jpeg`), and a content-length under a few hundred KB.

## Favicon (separate from this ad image)

The favicon shown next to every ad in ChatGPT is uploaded once in Ads Manager Beta → Settings → Account Information. Use the SFW Construction logo (same one used on `sfwconstruction.com`). This is separate from the per-ad image above.
