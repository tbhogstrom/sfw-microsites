# Interlinking Strategy for SFW Microsites

## Overview
This document outlines the internal linking strategy between microsites and to SFW Construction main site.

**Goal:** 1-2 contextual links per blog post and service page
- Links to SFW Construction main site
- Links to related microsite DBAs

## 🛠️ Interlinking Tool

An automated tool is available in `tools/interlinking/` to analyze content and suggest contextual links.

See [tools/interlinking/README.md](tools/interlinking/README.md) for usage instructions.

## SFW Construction Links

All SFW Construction links and anchor text options are defined in:
`packages/content/src/sfw-links.ts`

### Usage Examples

**Natural placement in blog posts:**
- "If you're experiencing moisture issues, you may need to [fix moisture issues in your crawl space](https://sfwconstruction.com/repair-services/crawl-space-repair-portland/)."
- "For comprehensive solutions, [our exterior renovation services](https://sfwconstruction.com/) cover everything from siding to structural repairs."
- "Before starting, [estimate your siding project cost](https://sfwconstruction.com/siding-calculator/) to plan your budget."

## Microsite Cross-Linking Strategy

### Related Service Clusters

#### Cluster 1: Structural & Rot Damage
- **Deck Repair** → Dry Rot, Crawlspace Rot, Beam Repair
- **Dry Rot** → Crawlspace Rot, Siding Repair, Deck Repair
- **Crawlspace Rot** → Beam Repair, Dry Rot, Siding Repair
- **Beam Repair** → Crawlspace Rot, Dry Rot, Deck Repair

**Example links:**
- "Dry rot often affects [crawlspace structural components](https://crawlspacerot.com)"
- "When [deck framing fails](https://deckrepairexpert.com), it's usually due to moisture damage"

#### Cluster 2: Exterior Envelope
- **Siding Repair** → Flashing Repair, Trim Repair, Window Leaks
- **Flashing Repair** → Chimney Repair, Siding Repair, Leak Repair
- **Trim Repair** → Siding Repair, Leak Repair
- **Window Leak** → Flashing Repair, Siding Repair, Trim Repair

**Example links:**
- "Proper [flashing installation](https://flashingrepairs.com) prevents water from reaching your siding"
- "Damaged [exterior trim](https://exteriortrimrepairs.com) can compromise your home's weather protection"

#### Cluster 3: Specialized Services
- **Chimney Repair** → Flashing Repair, Siding Repair
- **Lead Paint** → Historic Restoration, Siding Repair, Trim Repair
- **Historic Restoration** → Lead Paint, Trim Repair, Siding Repair

**Example links:**
- "Historic homes often require [certified lead paint removal](https://leadpaintprofessionals.com)"
- "When restoring [historic exteriors](https://historicrenovationsnw.com), proper techniques are essential"

## Implementation Guidelines

### 1. Link Placement in Blog Posts

**Good placement locations:**
- Within problem/solution discussions
- In "related services" or "next steps" sections
- In prevention or maintenance tips
- When discussing comprehensive repairs

**Example:**
```markdown
## Preventing Future Damage

Regular inspections can catch problems early. If you notice moisture in your
crawlspace, [professional crawl space repairs](https://sfwconstruction.com/repair-services/crawl-space-repair-portland/)
can prevent structural damage before it spreads.
```

### 2. Link Placement in Service Pages

**Strategic locations:**
- Related services section
- FAQ answers
- Process descriptions (when mentioning adjacent work)
- Location-specific content

**Example:**
```markdown
### Our Service Areas

We provide chimney repair throughout the Portland metro area, including comprehensive
[exterior services in Portland](https://sfwconstruction.com/locations/portland/)
for all your home repair needs.
```

### 3. Anchor Text Best Practices

**✅ Good:**
- Natural, contextual phrases
- Varied anchor text (don't repeat exact phrases)
- Mix of branded and descriptive anchors
- Action-oriented language

**❌ Avoid:**
- "Click here" or "read more"
- Over-optimized exact match repeatedly
- Forced or unnatural placement
- Too many links in one paragraph

### 4. Link Distribution

**Per Blog Post:**
- 1 SFW Construction link (from sfw-links.ts)
- 1 related microsite link (if contextually relevant)

**Per Service Page:**
- 1-2 SFW Construction links
- 1-2 related microsite links in "Related Services" section

## Topic-to-Link Mapping

### Deck Repair Microsite
**Should link to:**
- SFW: portland-deck-repair, dry-rot-repair, exterior-home-repair
- Microsites: dry-rot, crawlspace-rot, beam-repair

### Chimney Repair Microsite
**Should link to:**
- SFW: chimney-chase-repair, roof-repair, flashing-repair (if relevant)
- Microsites: flashing-repair, siding-repair

### Siding Repair Microsite
**Should link to:**
- SFW: siding-repair, siding-calculator, exterior-home-repair
- Microsites: trim-repair, flashing-repair, leak-repair

### Crawlspace Rot Microsite
**Should link to:**
- SFW: crawl-space-repair-portland, dry-rot-repair, mold-removal
- Microsites: dry-rot, beam-repair, siding-repair

### Window Leak Microsite
**Should link to:**
- SFW: window-installation-portland, leaking-window-cost, exterior-home-repair
- Microsites: flashing-repair, siding-repair, trim-repair

### Lead Paint Microsite
**Should link to:**
- SFW: lead-based-paint-removal, exterior-home-repair
- Microsites: historic-restoration, siding-repair, trim-repair

### Flashing Repair Microsite
**Should link to:**
- SFW: roof-repair, chimney-chase-repair, exterior-home-repair
- Microsites: chimney-repair, siding-repair, leak-repair

### Trim Repair Microsite
**Should link to:**
- SFW: exterior-home-repair, siding-repair
- Microsites: siding-repair, leak-repair

### Beam Repair Microsite
**Should link to:**
- SFW: exterior-home-repair, crawl-space-repair-portland
- Microsites: crawlspace-rot, dry-rot, deck-repair

### Dry Rot Microsite
**Should link to:**
- SFW: dry-rot-repair, crawl-space-repair-portland, exterior-home-repair
- Microsites: crawlspace-rot, deck-repair, siding-repair

### Historic Restoration Microsite
**Should link to:**
- SFW: exterior-home-repair, lead-based-paint-removal
- Microsites: lead-paint, trim-repair, siding-repair

## Monthly Review

Review interlinking performance monthly:
1. Check that links are working
2. Monitor which pages receive the most internal traffic
3. Adjust strategy based on conversion data
4. Add new SFW Construction pages to sfw-links.ts as they're created

## Tools

- **Link data:** `packages/content/src/sfw-links.ts`
- **Helper functions:** `getRelevantSFWLinks()`, `getRandomAnchor()`
- **DBA registry:** `packages/content/src/dbas.ts`
