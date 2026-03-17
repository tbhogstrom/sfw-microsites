# V1 Content & V1 Photos Tickets — Design Spec

**Date:** 2026-03-16
**Status:** Design Approved

## Overview

Two parent tickets with sub-issues for each of the 11 microsites, tracking completion of cluster service pages through content validation and photo selection.

## Scope

### Microsites Included
- beam-repair (12 clusters)
- chimney-repair (10 clusters)
- crawlspace-rot (12 clusters)
- deck-repair (14 clusters)
- dry-rot (14 clusters)
- flashing-repair (12 clusters)
- lead-paint (12 clusters)
- leak-repair (14 clusters)
- mold-testing (0 clusters — **needs cluster pages created first**, LOW PRIORITY)
- restoration (0 clusters — **needs cluster pages created first**, LOW PRIORITY)
- siding-repair (14 clusters)
- trim-repair (12 clusters)

## Ticket 1: V1 Content

### Parent Ticket
**Title:** V1 Content - Validate & finalize cluster service page copy
**Description:** Comprehensive content validation and completion for all cluster service pages across expert sites using QED client.

**Acceptance Criteria:**
- All cluster pages have validated copy (SEO, brand voice, completeness)
- QED client validation passes all checks
- No placeholder text remains
- All required sections present and complete

### Sub-Issues (11 total)
Each sub-issue follows this pattern:

**Title:** V1 Content - [Microsite Name]

**Description:**
```
Validate and finalize cluster service page content for [Microsite Name].

## Current State
- [N] cluster pages created and implemented
- Status: Content needs QED validation

## Required Actions
1. Run QED client against all cluster pages in apps/[microsite-name]/
2. Address any SEO issues (keyword optimization, meta descriptions)
3. Validate brand voice and tone consistency
4. Ensure all content sections are complete (no placeholders)
5. Fix any identified issues
6. Re-validate with QED client

## Clusters to Validate
[Auto-populated list of cluster names from generated_content/]

## Tools
- QED Client: tools/content-review/
- Microsite: apps/[microsite-name]/

## Acceptance Criteria
- ✅ QED validation passes
- ✅ All clusters show green in validation report
- ✅ No warnings or errors from QED client
- ✅ Ready for launch
```

**Special Cases:**
- mold-testing: Add note "Cluster pages do not yet exist. This requires cluster page creation first."
- restoration: Add note "Cluster pages do not yet exist. This requires cluster page creation first."

**Priority:**
- All except mold-testing & restoration: **Normal**
- mold-testing & restoration: **Low** (blocked until cluster pages exist)

## Ticket 2: V1 Photos

### Parent Ticket
**Title:** V1 Photos - Select & upload images for all expert sites
**Description:** Select and upload hero images, backgrounds, and content images for all cluster service pages using photo-picker tool.

**Acceptance Criteria:**
- Hero image selected and assigned to home page
- Service pages background image selected and assigned
- At least one image selected for every sub-topic on service clusters
- All images uploaded through photo-picker
- Photo assignments verified on live pages

### Sub-Issues (11 total)
Each sub-issue follows this pattern:

**Title:** V1 Photos - [Microsite Name]

**Description:**
```
Select and upload images for [Microsite Name].

## Images Needed
- 1x Hero image (home page)
- 1x Service pages background
- [N]+ images for cluster sub-topics (at least 1 per sub-topic)
- **Estimated total: [estimate] images to review and select**

## Current State
- Cluster pages created and implemented
- Photo library available in photo-picker tool
- Status: Images need to be selected and assigned

## Required Actions
1. Open photo-picker tool (tools/photo-picker/)
2. Browse available images
3. Select hero image → assign to home page
4. Select background image → assign to service pages template
5. For each cluster page:
   - Identify sub-topics/sections
   - Select at least 1 image per sub-topic
   - Upload through photo-picker
6. Verify all images appear correctly on live pages

## Tools
- Photo Picker: tools/photo-picker/
- Microsite: apps/[microsite-name]/

## Acceptance Criteria
- ✅ Hero image selected and live
- ✅ Service background image selected and live
- ✅ All cluster sub-topics have image(s)
- ✅ Images load and display correctly
- ✅ Images are optimized for web
```

**Special Cases:**
- mold-testing: Add note "Cluster pages do not yet exist. Photo assignment will be done after cluster page creation."
- restoration: Add note "Cluster pages do not yet exist. Photo assignment will be done after cluster page creation."

**Priority:**
- All except mold-testing & restoration: **Normal**
- mold-testing & restoration: **Low** (blocked until cluster pages exist)

## Image Count Estimates

Based on cluster structure (each cluster typically has 3-5 sub-topics):

| Microsite | Clusters | Estimated Images | Priority |
|-----------|----------|------------------|----------|
| beam-repair | 12 | ~40-60 | Normal |
| chimney-repair | 10 | ~35-50 | Normal |
| crawlspace-rot | 12 | ~40-60 | Normal |
| deck-repair | 14 | ~45-70 | Normal |
| dry-rot | 14 | ~45-70 | Normal |
| flashing-repair | 12 | ~40-60 | Normal |
| lead-paint | 12 | ~40-60 | Normal |
| leak-repair | 14 | ~45-70 | Normal |
| mold-testing | 0 | 0 (pending) | **Low** |
| restoration | 0 | 0 (pending) | **Low** |
| siding-repair | 14 | ~45-70 | Normal |
| trim-repair | 12 | ~40-60 | Normal |

## Implementation Notes

1. **Sub-issue creation:** Exact cluster names and image counts should be populated from actual microsite data when creating issues
2. **QED Client:** Location and usage documented in tools/content-review/
3. **Photo Picker:** Location and usage documented in tools/photo-picker/
4. **Blocked dependencies:** mold-testing and restoration are blocked by cluster page creation—can add those as blockedBy relationships
5. **Validation gate:** Consider adding a milestone or label to group these tickets as "Pre-Launch V1"

## Success Definition

**V1 Content Complete:** All cluster pages pass QED validation with zero errors/warnings
**V1 Photos Complete:** All cluster pages have hero, background, and content images assigned and live
**Overall Launch Ready:** Both tickets complete, all 9 "normal priority" microsites ready to launch
