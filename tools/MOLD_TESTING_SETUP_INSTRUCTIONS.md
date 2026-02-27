# Mold Testing Content Generation - Resume Instructions

## What We've Completed ✅

1. **Added mold-testing to services configuration**
   - File: `tools/content-generator/config/services.json`
   - Added mold-testing service with keywords: mold testing, mold inspection, mold detection, mold assessment

2. **Added blog topics for mold-testing**
   - File: `tools/content-generator/config/topics.json`
   - Added 7 blog post topics for mold-testing

3. **Generated 5 blog posts**
   - Total blog posts for mold-testing: 7 (2 existing + 5 new)
   - File updated: `apps/mold-testing/src/data/blog-posts.ts`
   - New blog posts:
     1. When to Get Professional Mold Testing for Your Home (1084 words)
     2. Understanding Different Types of Mold Testing Methods (1055 words)
     3. Mold Inspection vs Mold Testing: What's the Difference? (1068 words)
     4. How Portland's Climate Affects Mold Growth in Homes (1054 words)
     5. Black Mold: Identification, Testing, and Health Risks (875 words)

## What Still Needs to Be Done 📋

### Step 1: Generate Service Page Ideas
```bash
cd tools/content-generator
PYTHONIOENCODING=utf-8 python generate_content.py service-ideas --service mold-testing --count 10
```

This will create: `tools/content-generator/output/mold-testing_service_ideas.json`

### Step 2: Generate Service Pages for Portland
```bash
PYTHONIOENCODING=utf-8 python generate_content.py service-pages --service mold-testing --count 10 --locations portland
```

This will generate 10 service pages in:
`apps/mold-testing/src/data/generated_content/service_page_*_portland.md`

### Step 3: (Optional) Generate Service Pages for Seattle
```bash
PYTHONIOENCODING=utf-8 python generate_content.py service-pages --service mold-testing --count 10 --locations seattle
```

Or generate for both locations at once:
```bash
PYTHONIOENCODING=utf-8 python generate_content.py service-pages --service mold-testing --count 10 --locations both
```

### Step 4: Review and Commit Changes
```bash
# From the root of the repository
cd C:\Users\tfalcon\sfw-microsites

# Check what was generated
git status

# Add the generated content
git add apps/mold-testing/src/data/blog-posts.ts
git add apps/mold-testing/src/data/generated_content/
git add tools/content-generator/config/services.json
git add tools/content-generator/config/topics.json

# Commit
git commit -m "Add blog posts and service pages for mold-testing microsite"
```

## Important Notes 📝

- **UTF-8 Encoding**: Always use `PYTHONIOENCODING=utf-8` prefix on Windows to avoid Unicode errors
- **Current Location**: Working directory should be `tools/content-generator`
- **Cost Estimate**:
  - Service ideas: ~$0.02
  - 10 service pages (Portland): ~$0.40-0.60
  - 10 service pages (both locations): ~$0.80-1.20
- **Time Estimate**:
  - Service ideas: ~30 seconds
  - 10 service pages: ~5-7 minutes
  - 20 service pages (both locations): ~10-14 minutes

## Configuration Files Modified

1. `tools/content-generator/config/services.json` - Added mold-testing service
2. `tools/content-generator/config/topics.json` - Added 7 blog topics for mold-testing

## Verification Commands

Check blog post count:
```bash
cd tools/content-generator
python generate_content.py list
```

View generated service ideas (after Step 1):
```bash
cat output/mold-testing_service_ideas.json
```

Count generated service pages (after Step 2/3):
```bash
ls -la ../../apps/mold-testing/src/data/generated_content/
```

## Quick Resume Command

To continue exactly where we left off:
```bash
cd C:\Users\tfalcon\sfw-microsites\tools\content-generator
PYTHONIOENCODING=utf-8 python generate_content.py service-ideas --service mold-testing --count 10
```

Then proceed with the service page generation commands above.
