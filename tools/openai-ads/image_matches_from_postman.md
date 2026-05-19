# Per-ad image picks from The Postman (recent GMB posts)

Source: `the_postman.db.posted_log` (82 posts, all `pending-live` as of 2026-05-07).
Photos live in the public `buildertrend-rip` GCS bucket — URLs below open directly to the image.

## ⚠️ Before using these URLs in the ad workbook

OpenAI ad images must be **square, 640–1200px, PNG/JPG**. The builder-rip photos are
full-resolution landscape JPGs (often 4000×3000). Two options:

1. **Resize/crop pipeline** — download each pick, center-crop to square, resize to 1200×1200, re-upload to
   `sfwconstruction.com/ad-images/<slug>.jpg`. ChatGPT Ads will then pull from sfwconstruction.com.
2. **Stay with the single brand-logo image** (`Option A` in `image_assets_needed.md`) and use
   these picks only for organic GMB posts.

Recommend (1) for measurable A/B lift; the GCS URLs below tell you *which photos* to process.

---

## Per-category picks

Format: `[posted_log #id]` → ad-group(s) this image fits → GCS URL.

### SFW_DeckRepair (RotDamage, Structural, Inspection) — 8 ads
**Primary pick — covers all three sub-groups:**
- `#62` **Deck Railing Rebuild & Rot Repair in Portland**
  https://storage.googleapis.com/buildertrend-rip/14036191-Amy_McFeeters-Krone/photos/Job_Photos/509762196-IMG_8181.JPG

**Alternates:**
- `#7` Deck & Rim Joist Repair in Bend — https://storage.googleapis.com/buildertrend-rip/11125936-Gene_Rosecrans/photos/Job_Photos/368403905-20210927_130441.jpg
- `#21` Custom Porch Railing Replacement, SE Portland — https://storage.googleapis.com/buildertrend-rip/33272396-Ada_Beale_02-09-2024/photos/Job_Photos/782562654-PXL_20240613_210543640.jpg
- `#25` Cedar Deck Build, Salem — https://storage.googleapis.com/buildertrend-rip/12666297-Adrienne_Maynard/photos/Job_Photos/496845931-IMG_1852.JPG

### SFW_Chimney (WoodRot, Leaking, Inspection) — 7 ads
**Only one match — use for all three sub-groups:**
- `#29` **Chimney Chase Siding Replacement in Bellevue**
  https://storage.googleapis.com/buildertrend-rip/33273585-Adam_Paetznick_02-08-2024/photos/Job_Photos/733622966-IMG_1162.jpg

> **Gap:** no chimney-leak / chimney-inspection photos in posted log. Either shoot one on the next chimney job or fall back to the brand image for the leak/inspection variants.

### SFW_Siding (HardieBoard, RotRepair, Replacement) — 7 ads
**HardieBoard:**
- `#6` **James Hardie Lap Siding Installation in Bend**
  https://storage.googleapis.com/buildertrend-rip/41857282-Brian_Fitzpatrick_09-17-2025/photos/Job_Photos/1039530952-PXL_20250923_004243722.jpg
- alt: `#1` Hardie-shake crew, Bellevue — https://storage.googleapis.com/buildertrend-rip/42340877-Andrew_Brummett_10-24-2025/photos/Job_Photos/1070622418-IMG_6686.jpg

**RotRepair:**
- `#24` **Siding Replacement in Salem — Rotten Lap Siding Removal**
  https://storage.googleapis.com/buildertrend-rip/12666297-Adrienne_Maynard/photos/Job_Photos/495728415-IMG_1801.JPG

**Replacement:**
- `#16` **Siding Replacement & Repair in Renton — Lap + Cedar Shake**
  https://storage.googleapis.com/buildertrend-rip/10158116-Clarence_Williams/photos/Job_Photos/330957302-PXL_20210604_192939386.jpg
- alt: `#81` Tyvek DrainWrap install, Eugene — https://storage.googleapis.com/buildertrend-rip/35862702-Peter_Gallagher_08-12-2024/photos/Job_Photos/812545318-1723582402997.jpg

### SFW_Crawlspace (RotRepair, Subfloor, Moisture) — 7 ads
> **Gap:** no crawlspace-specific photos in posted log. Closest analogues are structural rim-joist / sill work:
- `#69` Structural Rot Repair — Rim Joist & Sill Rebuild, Sherwood
  https://storage.googleapis.com/buildertrend-rip/38470052-Amber_Grasmick_02-04-2025/photos/Job_Photos/918374393-20250311_144451.jpg

Use brand image for these 7 ads, or shoot crawlspace-specific photos on the next moisture/vapor-barrier job.

### SFW_Leak (WindowLeak, WaterIntrusion) — 4 ads
**WindowLeak — perfect match:**
- `#11` **Cedar Shingle Siding Repair & Window Leak in Gearhart**
  https://storage.googleapis.com/buildertrend-rip/10146919-Terry_Mckeighan/photos/Job_Photos/325099932-20210521_115753.jpg
- `#12` Cedar Shake Siding & Window Leak Repair, Gearhart — https://storage.googleapis.com/buildertrend-rip/10146919-Terry_Mckeighan/photos/Job_Photos/348273295-20210729_094131.jpg

**WaterIntrusion:**
- `#67` Roof Framing & Dry Rot Repair, Sherwood (water intrusion at roof-to-wall) — https://storage.googleapis.com/buildertrend-rip/38470052-Amber_Grasmick_02-04-2025/photos/Job_Photos/922368358-20250318_114421.jpg
- alt: `#85` Window Sealing — Exterior Caulking Prep, Eugene — https://storage.googleapis.com/buildertrend-rip/39950463-Brian_Coble_05-05-2025/photos/Job_Photos/954408870-PXL_20250507_234423801.jpg

### SFW_Flashing (RoofWall, WindowKickout) — 4 ads
**Primary — covers both sub-groups:**
- `#4` **Custom Bent Flashing over Tyvek DrainWrap in Bellevue**
  https://storage.googleapis.com/buildertrend-rip/42340877-Andrew_Brummett_10-24-2025/photos/Job_Photos/1067070769-IMG_6577.jpg

**WindowKickout-leaning alt:**
- `#86` Window Installation, Eugene (flashing & rough-in) — https://storage.googleapis.com/buildertrend-rip/39950463-Brian_Coble_05-05-2025/photos/Job_Photos/953225577-PXL_20250506_172943044.jpg

### SFW_LeadPaint (Removal, Testing) — 4 ads
**Only one real match — use for all 4 ads:**
- `#18` **Lead Paint Removal & Siding Prep in Portland, OR**
  https://storage.googleapis.com/buildertrend-rip/10965107-Aaron_Burkhardt/photos/Job_Photos/377872714-IMG_0302.JPG

### SFW_DryRot (Repair, Prevention) — 4 ads
**Repair:**
- `#63` **Dry Rot & Framing Repair in Sherwood**
  https://storage.googleapis.com/buildertrend-rip/38470052-Amber_Grasmick_02-04-2025/photos/Job_Photos/917631036-20250310_112625.jpg
- alt: `#67` Roof Framing & Dry Rot Repair, Sherwood — https://storage.googleapis.com/buildertrend-rip/38470052-Amber_Grasmick_02-04-2025/photos/Job_Photos/922368358-20250318_114421.jpg
- alt: `#64` Door Sill Rot Repair, Sherwood — https://storage.googleapis.com/buildertrend-rip/11854005-Allison___Mike_Bassich/photos/Job_Photos/408039569-1642530824668.jpg

**Prevention** (no direct match — use a Tyvek/WRB shot to imply prevention):
- `#15` (or related Tyvek install) — pair with `#63` for the prevention variant

### SFW_Trim (FasciaSoffit, Exterior) — 4 ads
**FasciaSoffit — strong direct match:**
- `#10` **Exterior Trim & Column Work in Gearhart, OR**
  https://storage.googleapis.com/buildertrend-rip/36504994-Greg_Jones_09-24-2024/photos/Job_Photos/835213092-PXL_20240926_211850068.jpg

**Exterior trim:**
- `#5` Window Trim & Cedar Bevel Siding, Bellevue — https://storage.googleapis.com/buildertrend-rip/42340877-Andrew_Brummett_10-24-2025/photos/Job_Photos/1061573684-IMG_6431.jpg

### SFW_Beam (Structural, Sistering) — 4 ads
**Structural:**
- `#69` **Structural Rot Repair — Rim Joist & Sill Rebuild, Sherwood**
  https://storage.googleapis.com/buildertrend-rip/38470052-Amber_Grasmick_02-04-2025/photos/Job_Photos/918374393-20250311_144451.jpg
- alt: `#66` Ionic Column Rot Repair (load-bearing), Portland — https://storage.googleapis.com/buildertrend-rip/14036191-Amy_McFeeters-Krone/photos/Job_Photos/518087553-1666128764518.jpg

**Sistering** (no exact match — repurpose #68 which is a header/framing rebuild):
- `#68` Dry Rot Repair — Window Framing Rebuild, Sherwood — https://storage.googleapis.com/buildertrend-rip/38470052-Amber_Grasmick_02-04-2025/photos/Job_Photos/900753867-20250206_144539.jpg

---

## Coverage summary

| Category    | Direct photos | Quality of match            |
|-------------|---------------|------------------------------|
| DeckRepair  | 4 strong      | ✓ ready                      |
| Chimney     | 1             | ⚠ thin — 1 photo for 3 sub-groups |
| Siding      | 8+ strong     | ✓ ready, per-sub-group picks |
| Crawlspace  | 0 direct      | ✗ shoot crawlspace photos    |
| Leak        | 4 strong      | ✓ ready                      |
| Flashing    | 4 strong      | ✓ ready                      |
| LeadPaint   | 1             | ⚠ only 1 photo for both ads  |
| DryRot      | 6+ strong     | ✓ ready                      |
| Trim        | 5+ strong     | ✓ ready                      |
| Beam        | 2 weak        | ⚠ rim-joist repurposed       |

**Action items:**
1. Shoot or import **crawlspace photos** (vapor barrier, sister joists, encapsulation) — biggest gap.
2. Capture more **chimney** work — currently one photo will run on 7 ads.
3. Capture more **lead-paint / containment** photos — currently one photo for 4 ads.
4. Add an **image_url field** to the `Ad` dataclass in `build_workbook.py` and regenerate the workbook with per-ad-group URLs.
5. Build a thumbnail/resize step that center-crops these landscape photos to 1200×1200 and hosts them under `sfwconstruction.com/ad-images/`.
