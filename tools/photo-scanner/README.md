# Photo Scanner Tools

## Video Store — Friday shoot planner

Generates a ranked HTML plan of which active CompanyCam projects are likely
to have the right work + visible conditions next Monday for filming the shots
in your video script document.

```bash
# From tools/photo-scanner/
python -m photo_scanner.video_store path/to/scripts.md

# Plan for a specific Monday (default = next Monday)
python -m photo_scanner.video_store path/to/scripts.md --week-of 2026-05-11

# Bigger radius
python -m photo_scanner.video_store path/to/scripts.md --max-distance 30

# Force re-extraction of the shot list (e.g., after editing the script)
python -m photo_scanner.video_store path/to/scripts.md --refresh-shots

# Force re-triage (default: cached per Monday)
python -m photo_scanner.video_store path/to/scripts.md --refresh-triage

# Force re-score location quality (default: cached for 14 days)
python -m photo_scanner.video_store path/to/scripts.md --refresh-quality
```

Output: `video_shoot_plan_<YYYY-MM-DD>.html` opens in your browser.
Caches: shot lists at `.video_store_cache/<sha>.json`; triage and location
quality on the `projects` table in `catalog.db`.

Spec: `docs/superpowers/specs/2026-05-07-video-store-design.md`
