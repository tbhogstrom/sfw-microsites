# Service Page Redirects

Migration map from legacy service page URLs to new cluster page URLs.
All redirects are 301 permanent (Astro static output default).

**Source of truth:** `tools/migration/redirect-map.json`
**Applied to:** each app's `astro.config.mjs` via `tools/migration/apply-redirects.js`
**Validated by:** `node tools/migration/validate-redirects.js`

Legacy service page files remain in `src/data/generated_content/` as content reference until cluster stubs are populated with generated content.

---

## deck-repair

| Old URL | New URL |
|---------|---------|
| /services/portland/deck-board-replacement | /services/portland/deck-board-repair-replacement |
| /services/seattle/deck-board-replacement  | /services/seattle/deck-board-repair-replacement  |
| /services/portland/deck-surface-refinishing | /services/portland/deck-board-repair-replacement |
| /services/seattle/deck-surface-refinishing  | /services/seattle/deck-board-repair-replacement  |
| /services/portland/deck-staining-and-sealing | /services/portland/deck-board-repair-replacement |
| /services/seattle/deck-staining-and-sealing  | /services/seattle/deck-board-repair-replacement  |
| /services/portland/epoxy-wood-repair | /services/portland/deck-board-repair-replacement |
| /services/seattle/epoxy-wood-repair  | /services/seattle/deck-board-repair-replacement  |
| /services/portland/rotten-trim-repair | /services/portland/deck-board-repair-replacement |
| /services/seattle/rotten-trim-repair  | /services/seattle/deck-board-repair-replacement  |
| /services/portland/deck-repair-services | /services/portland/deck-board-repair-replacement |
| /services/seattle/deck-repair-services  | /services/seattle/deck-board-repair-replacement  |
| /services/portland/deck-joist-repair-and-replacement | /services/portland/deck-structural-framing-repair |
| /services/seattle/deck-joist-repair-and-replacement  | /services/seattle/deck-structural-framing-repair  |
| /services/portland/pressure-treated-wood-installation | /services/portland/deck-structural-framing-repair |
| /services/seattle/pressure-treated-wood-installation  | /services/seattle/deck-structural-framing-repair  |
| /services/portland/deck-drainage-solutions | /services/portland/deck-ledger-flashing-water-protection |
| /services/seattle/deck-drainage-solutions  | /services/seattle/deck-ledger-flashing-water-protection  |
| /services/portland/post-replacement-and-repair | /services/portland/deck-posts-footings-foundation |
| /services/seattle/post-replacement-and-repair  | /services/seattle/deck-posts-footings-foundation  |
| /services/portland/deck-lighting-installation | /services/portland/deck-skirting-lattice-accessories |
| /services/seattle/deck-lighting-installation  | /services/seattle/deck-skirting-lattice-accessories  |

## chimney-repair

| Old URL | New URL |
|---------|---------|
| /services/portland/chimney-chase-cover-installation-and-replacement | /services/portland/chimney-chase-waterproofing-sealing |
| /services/seattle/chimney-chase-cover-installation-and-replacement  | /services/seattle/chimney-chase-waterproofing-sealing  |
| /services/portland/chimney-chase-crown-repair | /services/portland/chimney-chase-structural-repair-rebuilding |
| /services/seattle/chimney-chase-crown-repair  | /services/seattle/chimney-chase-structural-repair-rebuilding  |
| /services/portland/chimney-chase-repair-and-rebuilding | /services/portland/chimney-chase-structural-repair-rebuilding |
| /services/seattle/chimney-chase-repair-and-rebuilding  | /services/seattle/chimney-chase-structural-repair-rebuilding  |
| /services/portland/chimney-chase-water-damage-restoration | /services/portland/chimney-chase-water-damage-rot-repair |
| /services/seattle/chimney-chase-water-damage-restoration  | /services/seattle/chimney-chase-water-damage-rot-repair  |
| /services/portland/chimney-flashing-repair-and-waterproofing | /services/portland/chimney-chase-flashing-leak-repair |
| /services/seattle/chimney-flashing-repair-and-waterproofing  | /services/seattle/chimney-chase-flashing-leak-repair  |
| /services/portland/chimney-penetration-leak-repair | /services/portland/chimney-chase-flashing-leak-repair |
| /services/seattle/chimney-penetration-leak-repair  | /services/seattle/chimney-chase-flashing-leak-repair  |
| /services/portland/roof-cricket-installation-for-chimneys | /services/portland/chimney-chase-flashing-leak-repair |
| /services/seattle/roof-cricket-installation-for-chimneys  | /services/seattle/chimney-chase-flashing-leak-repair  |
| /services/portland/wood-chimney-chase-framing-repair | /services/portland/chimney-chase-structural-repair-rebuilding |
| /services/seattle/wood-chimney-chase-framing-repair  | /services/seattle/chimney-chase-structural-repair-rebuilding  |
| /services/portland/wood-chimney-chase-siding-repair | /services/portland/chimney-chase-siding-exterior-repair |
| /services/seattle/wood-chimney-chase-siding-repair  | /services/seattle/chimney-chase-siding-exterior-repair  |
| /services/portland/wood-chimney-exterior-finishing-and-painting | /services/portland/chimney-chase-siding-exterior-repair |
| /services/seattle/wood-chimney-exterior-finishing-and-painting  | /services/seattle/chimney-chase-siding-exterior-repair  |

## crawlspace-rot

| Old URL | New URL |
|---------|---------|
| /services/portland/crawlspace-access-door-installation | /services/portland/crawlspace-access-entry |
| /services/seattle/crawlspace-access-door-installation  | /services/seattle/crawlspace-access-entry  |
| /services/portland/crawlspace-drainage-solutions | /services/portland/crawlspace-moisture-vapor-waterproofing |
| /services/seattle/crawlspace-drainage-solutions  | /services/seattle/crawlspace-moisture-vapor-waterproofing  |
| /services/portland/crawlspace-energy-audit | /services/portland/crawlspace-moisture-vapor-waterproofing |
| /services/seattle/crawlspace-energy-audit  | /services/seattle/crawlspace-moisture-vapor-waterproofing  |
| /services/portland/crawlspace-insulation-installation | /services/portland/crawlspace-moisture-vapor-waterproofing |
| /services/seattle/crawlspace-insulation-installation  | /services/seattle/crawlspace-moisture-vapor-waterproofing  |
| /services/portland/crawlspace-moisture-barrier-installation | /services/portland/crawlspace-moisture-vapor-waterproofing |
| /services/seattle/crawlspace-moisture-barrier-installation  | /services/seattle/crawlspace-moisture-vapor-waterproofing  |
| /services/portland/crawlspace-mold-remediation | /services/portland/crawlspace-moisture-vapor-waterproofing |
| /services/seattle/crawlspace-mold-remediation  | /services/seattle/crawlspace-moisture-vapor-waterproofing  |
| /services/portland/crawlspace-pest-control-services | /services/portland/crawlspace-moisture-vapor-waterproofing |
| /services/seattle/crawlspace-pest-control-services  | /services/seattle/crawlspace-moisture-vapor-waterproofing  |
| /services/portland/crawlspace-repair-and-maintenance | /services/portland/crawlspace-structural-rot-dry-rot-repair |
| /services/seattle/crawlspace-repair-and-maintenance  | /services/seattle/crawlspace-structural-rot-dry-rot-repair  |
| /services/portland/crawlspace-structural-support-installation | /services/portland/crawlspace-floor-system-framing-repair |
| /services/seattle/crawlspace-structural-support-installation  | /services/seattle/crawlspace-floor-system-framing-repair  |
| /services/portland/crawlspace-ventilation-improvement | /services/portland/crawlspace-moisture-vapor-waterproofing |
| /services/seattle/crawlspace-ventilation-improvement  | /services/seattle/crawlspace-moisture-vapor-waterproofing  |
| /services/portland/crawl-space-access-door-installation | /services/portland/crawlspace-access-entry |
| /services/seattle/crawl-space-access-door-installation  | /services/seattle/crawlspace-access-entry  |
| /services/portland/crawl-space-air-quality-improvement | /services/portland/crawlspace-moisture-vapor-waterproofing |
| /services/seattle/crawl-space-air-quality-improvement  | /services/seattle/crawlspace-moisture-vapor-waterproofing  |
| /services/portland/crawl-space-cleanup-and-maintenance | /services/portland/crawlspace-moisture-vapor-waterproofing |
| /services/seattle/crawl-space-cleanup-and-maintenance  | /services/seattle/crawlspace-moisture-vapor-waterproofing  |
| /services/portland/crawl-space-insulation-replacement | /services/portland/crawlspace-moisture-vapor-waterproofing |
| /services/seattle/crawl-space-insulation-replacement  | /services/seattle/crawlspace-moisture-vapor-waterproofing  |
| /services/portland/crawl-space-moisture-barrier-installation | /services/portland/crawlspace-moisture-vapor-waterproofing |
| /services/seattle/crawl-space-moisture-barrier-installation  | /services/seattle/crawlspace-moisture-vapor-waterproofing  |
| /services/portland/crawl-space-mold-remediation | /services/portland/crawlspace-moisture-vapor-waterproofing |
| /services/seattle/crawl-space-mold-remediation  | /services/seattle/crawlspace-moisture-vapor-waterproofing  |
| /services/portland/crawl-space-rodent-and-pest-control | /services/portland/crawlspace-moisture-vapor-waterproofing |
| /services/seattle/crawl-space-rodent-and-pest-control  | /services/seattle/crawlspace-moisture-vapor-waterproofing  |
| /services/portland/crawl-space-structural-repairs | /services/portland/crawlspace-structural-rot-dry-rot-repair |
| /services/seattle/crawl-space-structural-repairs  | /services/seattle/crawlspace-structural-rot-dry-rot-repair  |
| /services/portland/crawl-space-ventilation-solutions | /services/portland/crawlspace-moisture-vapor-waterproofing |
| /services/seattle/crawl-space-ventilation-solutions  | /services/seattle/crawlspace-moisture-vapor-waterproofing  |
| /services/portland/crawl-space-water-drainage-solutions | /services/portland/crawlspace-moisture-vapor-waterproofing |
| /services/seattle/crawl-space-water-drainage-solutions  | /services/seattle/crawlspace-moisture-vapor-waterproofing  |

## dry-rot

| Old URL | New URL |
|---------|---------|
| /services/portland/comprehensive-dry-rot-assessments | /services/portland/comprehensive-dry-rot-emergency-services |
| /services/seattle/comprehensive-dry-rot-assessments  | /services/seattle/comprehensive-dry-rot-emergency-services  |
| /services/portland/comprehensive-dry-rot-solutions | /services/portland/comprehensive-dry-rot-emergency-services |
| /services/seattle/comprehensive-dry-rot-solutions  | /services/seattle/comprehensive-dry-rot-emergency-services  |
| /services/portland/crown-molding-and-trim-restoration | /services/portland/exterior-siding-wall-rot-repair |
| /services/seattle/crown-molding-and-trim-restoration  | /services/seattle/exterior-siding-wall-rot-repair  |
| /services/portland/custom-wood-replacement | /services/portland/comprehensive-dry-rot-emergency-services |
| /services/seattle/custom-wood-replacement  | /services/seattle/comprehensive-dry-rot-emergency-services  |
| /services/portland/deck-joist-dry-rot-inspection-and-repair | /services/portland/deck-porch-balcony-rot-repair |
| /services/seattle/deck-joist-dry-rot-inspection-and-repair  | /services/seattle/deck-porch-balcony-rot-repair  |
| /services/portland/dry-rot-trim-replacement | /services/portland/exterior-siding-wall-rot-repair |
| /services/seattle/dry-rot-trim-replacement  | /services/seattle/exterior-siding-wall-rot-repair  |
| /services/portland/emergency-dry-rot-repair | /services/portland/comprehensive-dry-rot-emergency-services |
| /services/seattle/emergency-dry-rot-repair  | /services/seattle/comprehensive-dry-rot-emergency-services  |
| /services/portland/epoxy-reinforcement-for-rotted-wood | /services/portland/comprehensive-dry-rot-emergency-services |
| /services/seattle/epoxy-reinforcement-for-rotted-wood  | /services/seattle/comprehensive-dry-rot-emergency-services  |
| /services/portland/epoxy-reinforcement-for-wood | /services/portland/comprehensive-dry-rot-emergency-services |
| /services/seattle/epoxy-reinforcement-for-wood  | /services/seattle/comprehensive-dry-rot-emergency-services  |
| /services/portland/exterior-siding-repair-services | /services/portland/exterior-siding-wall-rot-repair |
| /services/seattle/exterior-siding-repair-services  | /services/seattle/exterior-siding-wall-rot-repair  |
| /services/portland/exterior-trim-dry-rot-repair | /services/portland/exterior-siding-wall-rot-repair |
| /services/seattle/exterior-trim-dry-rot-repair  | /services/seattle/exterior-siding-wall-rot-repair  |
| /services/portland/fascia-board-dry-rot-restoration | /services/portland/roofline-overhang-rot-repair |
| /services/seattle/fascia-board-dry-rot-restoration  | /services/seattle/roofline-overhang-rot-repair  |
| /services/portland/foundation-and-framing-inspection | /services/portland/structural-framing-rot-repair |
| /services/seattle/foundation-and-framing-inspection  | /services/seattle/structural-framing-rot-repair  |
| /services/portland/historic-home-dry-rot-repair | /services/portland/comprehensive-dry-rot-emergency-services |
| /services/seattle/historic-home-dry-rot-repair  | /services/seattle/comprehensive-dry-rot-emergency-services  |
| /services/portland/porch-column-dry-rot-repair | /services/portland/deck-porch-balcony-rot-repair |
| /services/seattle/porch-column-dry-rot-repair  | /services/seattle/deck-porch-balcony-rot-repair  |
| /services/portland/roof-eave-dry-rot-repair | /services/portland/roofline-overhang-rot-repair |
| /services/seattle/roof-eave-dry-rot-repair  | /services/seattle/roofline-overhang-rot-repair  |
| /services/portland/rotten-trim-scarf-joint-repair | /services/portland/exterior-siding-wall-rot-repair |
| /services/seattle/rotten-trim-scarf-joint-repair  | /services/seattle/exterior-siding-wall-rot-repair  |
| /services/portland/rotten-window-sill-repair | /services/portland/window-door-rot-repair |
| /services/seattle/rotten-window-sill-repair  | /services/seattle/window-door-rot-repair  |
| /services/portland/seasonal-dry-rot-assessment | /services/portland/comprehensive-dry-rot-emergency-services |
| /services/seattle/seasonal-dry-rot-assessment  | /services/seattle/comprehensive-dry-rot-emergency-services  |
| /services/portland/window-sill-dry-rot-replacement | /services/portland/window-door-rot-repair |
| /services/seattle/window-sill-dry-rot-replacement  | /services/seattle/window-door-rot-repair  |

## flashing-repair

| Old URL | New URL |
|---------|---------|
| /services/portland/chimney-flashing-repair | /services/portland/chimney-flashing-repair |
| /services/seattle/chimney-flashing-repair  | /services/seattle/chimney-flashing-repair  |
| /services/portland/counterflashing-installation | /services/portland/chimney-flashing-repair |
| /services/seattle/counterflashing-installation  | /services/seattle/chimney-flashing-repair  |
| /services/portland/counterflashing-repair-services | /services/portland/chimney-flashing-repair |
| /services/seattle/counterflashing-repair-services  | /services/seattle/chimney-flashing-repair  |
| /services/portland/custom-metal-flashing-fabrication | /services/portland/roof-to-wall-penetration-flashing |
| /services/seattle/custom-metal-flashing-fabrication  | /services/seattle/roof-to-wall-penetration-flashing  |
| /services/portland/custom-metal-flashing-solutions | /services/portland/roof-to-wall-penetration-flashing |
| /services/seattle/custom-metal-flashing-solutions  | /services/seattle/roof-to-wall-penetration-flashing  |
| /services/portland/drip-edge-flashing-installation | /services/portland/roof-to-wall-penetration-flashing |
| /services/seattle/drip-edge-flashing-installation  | /services/seattle/roof-to-wall-penetration-flashing  |
| /services/portland/flashing-inspection-services | /services/portland/building-envelope-waterproofing |
| /services/seattle/flashing-inspection-services  | /services/seattle/building-envelope-waterproofing  |
| /services/portland/flashing-maintenance-and-inspection-services | /services/portland/building-envelope-waterproofing |
| /services/seattle/flashing-maintenance-and-inspection-services  | /services/seattle/building-envelope-waterproofing  |
| /services/portland/masonry-flashing-repair | /services/portland/chimney-flashing-repair |
| /services/seattle/masonry-flashing-repair  | /services/seattle/chimney-flashing-repair  |
| /services/portland/siding-and-flashing-repair | /services/portland/building-envelope-waterproofing |
| /services/seattle/siding-and-flashing-repair  | /services/seattle/building-envelope-waterproofing  |
| /services/portland/skylight-flashing-installation | /services/portland/roof-to-wall-penetration-flashing |
| /services/seattle/skylight-flashing-installation  | /services/seattle/roof-to-wall-penetration-flashing  |
| /services/portland/skylight-flashing-replacement | /services/portland/roof-to-wall-penetration-flashing |
| /services/seattle/skylight-flashing-replacement  | /services/seattle/roof-to-wall-penetration-flashing  |
| /services/portland/step-flashing-installation-and-repair | /services/portland/chimney-flashing-repair |
| /services/seattle/step-flashing-installation-and-repair  | /services/seattle/chimney-flashing-repair  |
| /services/portland/step-flashing-repair | /services/portland/chimney-flashing-repair |
| /services/seattle/step-flashing-repair  | /services/seattle/chimney-flashing-repair  |
| /services/portland/vent-pipe-flashing-repair | /services/portland/roof-to-wall-penetration-flashing |
| /services/seattle/vent-pipe-flashing-repair  | /services/seattle/roof-to-wall-penetration-flashing  |
| /services/portland/wall-and-roof-junction-flashing-services | /services/portland/roof-to-wall-penetration-flashing |
| /services/seattle/wall-and-roof-junction-flashing-services  | /services/seattle/roof-to-wall-penetration-flashing  |
| /services/portland/wall-flashing-repair | /services/portland/roof-to-wall-penetration-flashing |
| /services/seattle/wall-flashing-repair  | /services/seattle/roof-to-wall-penetration-flashing  |

## lead-paint

| Old URL | New URL |
|---------|---------|
| /services/portland/chemical-lead-paint-removal | /services/portland/lead-paint-removal-surface-preparation |
| /services/seattle/chemical-lead-paint-removal  | /services/seattle/lead-paint-removal-surface-preparation  |
| /services/portland/chemical-lead-paint-stripping | /services/portland/lead-paint-removal-surface-preparation |
| /services/seattle/chemical-lead-paint-stripping  | /services/seattle/lead-paint-removal-surface-preparation  |
| /services/portland/heat-gun-lead-paint-removal | /services/portland/lead-paint-removal-surface-preparation |
| /services/seattle/heat-gun-lead-paint-removal  | /services/seattle/lead-paint-removal-surface-preparation  |
| /services/portland/lead-dust-cleanup-services | /services/portland/lead-paint-containment-cleanup |
| /services/seattle/lead-dust-cleanup-services  | /services/seattle/lead-paint-containment-cleanup  |
| /services/portland/lead-hazard-control-consultation | /services/portland/lead-paint-testing-inspection |
| /services/seattle/lead-hazard-control-consultation  | /services/seattle/lead-paint-testing-inspection  |
| /services/portland/lead-paint-abatement-services | /services/portland/lead-paint-removal-surface-preparation |
| /services/seattle/lead-paint-abatement-services  | /services/seattle/lead-paint-removal-surface-preparation  |
| /services/portland/lead-paint-compliance-inspections | /services/portland/lead-paint-testing-inspection |
| /services/seattle/lead-paint-compliance-inspections  | /services/seattle/lead-paint-testing-inspection  |
| /services/portland/lead-paint-encapsulation | /services/portland/lead-paint-stabilization-encapsulation |
| /services/seattle/lead-paint-encapsulation  | /services/seattle/lead-paint-stabilization-encapsulation  |
| /services/portland/lead-paint-encapsulation-services | /services/portland/lead-paint-stabilization-encapsulation |
| /services/seattle/lead-paint-encapsulation-services  | /services/seattle/lead-paint-stabilization-encapsulation  |
| /services/portland/lead-paint-inspection-services | /services/portland/lead-paint-testing-inspection |
| /services/seattle/lead-paint-inspection-services  | /services/seattle/lead-paint-testing-inspection  |
| /services/portland/lead-paint-removal-for-historic-homes | /services/portland/lead-paint-removal-surface-preparation |
| /services/seattle/lead-paint-removal-for-historic-homes  | /services/seattle/lead-paint-removal-surface-preparation  |
| /services/portland/lead-paint-safety-training-for-homeowners | /services/portland/lead-paint-testing-inspection |
| /services/seattle/lead-paint-safety-training-for-homeowners  | /services/seattle/lead-paint-testing-inspection  |
| /services/portland/lead-paint-testing-in-portland | /services/portland/lead-paint-testing-inspection |
| /services/seattle/lead-paint-testing-in-portland  | /services/seattle/lead-paint-testing-inspection  |
| /services/portland/lead-safety-training-for-homeowners | /services/portland/lead-paint-testing-inspection |
| /services/seattle/lead-safety-training-for-homeowners  | /services/seattle/lead-paint-testing-inspection  |
| /services/portland/leadbased-paint-disposal-services | /services/portland/lead-paint-containment-cleanup |
| /services/seattle/leadbased-paint-disposal-services  | /services/seattle/lead-paint-containment-cleanup  |
| /services/portland/leadbased-paint-testing-kits | /services/portland/lead-paint-testing-inspection |
| /services/seattle/leadbased-paint-testing-kits  | /services/seattle/lead-paint-testing-inspection  |
| /services/portland/leadsafe-remodeling-consultations | /services/portland/lead-safe-exterior-renovation |
| /services/seattle/leadsafe-remodeling-consultations  | /services/seattle/lead-safe-exterior-renovation  |
| /services/portland/leadsafe-remodeling-services | /services/portland/lead-safe-exterior-renovation |
| /services/seattle/leadsafe-remodeling-services  | /services/seattle/lead-safe-exterior-renovation  |

## leak-repair

| Old URL | New URL |
|---------|---------|
| /services/portland/bay-window-leak-repair | /services/portland/bay-window-specialty-window-repairs |
| /services/seattle/bay-window-leak-repair  | /services/seattle/bay-window-specialty-window-repairs  |
| /services/portland/door-threshold-leak-repair | /services/portland/door-frame-leak-rot-repair |
| /services/seattle/door-threshold-leak-repair  | /services/seattle/door-frame-leak-rot-repair  |
| /services/portland/leaking-door-frame-repair | /services/portland/door-frame-leak-rot-repair |
| /services/seattle/leaking-door-frame-repair  | /services/seattle/door-frame-leak-rot-repair  |
| /services/portland/leaking-window-repair-and-waterproofing | /services/portland/window-leak-repair-waterproofing |
| /services/seattle/leaking-window-repair-and-waterproofing  | /services/seattle/window-leak-repair-waterproofing  |
| /services/portland/siding-and-window-integration-repair | /services/portland/siding-building-envelope-integration |
| /services/seattle/siding-and-window-integration-repair  | /services/seattle/siding-building-envelope-integration  |
| /services/portland/sliding-glass-door-leak-repair | /services/portland/sliding-glass-door-leak-repair |
| /services/seattle/sliding-glass-door-leak-repair  | /services/seattle/sliding-glass-door-leak-repair  |
| /services/portland/window-flashing-repair-and-installation | /services/portland/window-flashing-repair |
| /services/seattle/window-flashing-repair-and-installation  | /services/seattle/window-flashing-repair  |
| /services/portland/window-frame-rot-repair-and-replacement | /services/portland/window-door-frame-rot-repair |
| /services/seattle/window-frame-rot-repair-and-replacement  | /services/seattle/window-door-frame-rot-repair  |
| /services/portland/window-seal-replacement-and-reglazing | /services/portland/window-leak-repair-waterproofing |
| /services/seattle/window-seal-replacement-and-reglazing  | /services/seattle/window-leak-repair-waterproofing  |
| /services/portland/window-sill-leak-repair | /services/portland/window-leak-repair-waterproofing |
| /services/seattle/window-sill-leak-repair  | /services/seattle/window-leak-repair-waterproofing  |

## siding-repair

| Old URL | New URL |
|---------|---------|
| /services/portland/aluminum-siding-repair | /services/portland/lap-cedar-wood-specialty-siding-repair |
| /services/seattle/aluminum-siding-repair  | /services/seattle/lap-cedar-wood-specialty-siding-repair  |
| /services/portland/custom-siding-solutions | /services/portland/siding-integration-repairs |
| /services/seattle/custom-siding-solutions  | /services/seattle/siding-integration-repairs  |
| /services/portland/emergency-siding-repairs | /services/portland/siding-rot-repair-replacement |
| /services/seattle/emergency-siding-repairs  | /services/seattle/siding-rot-repair-replacement  |
| /services/portland/fibercement-siding-installation | /services/portland/hardie-fiber-cement-siding-repair |
| /services/seattle/fibercement-siding-installation  | /services/seattle/hardie-fiber-cement-siding-repair  |
| /services/portland/siding-installation-for-new-construction | /services/portland/siding-rot-repair-replacement |
| /services/seattle/siding-installation-for-new-construction  | /services/seattle/siding-rot-repair-replacement  |
| /services/portland/siding-maintenance-and-inspection | /services/portland/siding-rot-repair-replacement |
| /services/seattle/siding-maintenance-and-inspection  | /services/seattle/siding-rot-repair-replacement  |
| /services/portland/siding-painting-and-finishing | /services/portland/siding-trim-corner-board-repair |
| /services/seattle/siding-painting-and-finishing  | /services/seattle/siding-trim-corner-board-repair  |
| /services/portland/siding-repair-for-storm-damage | /services/portland/siding-rot-repair-replacement |
| /services/seattle/siding-repair-for-storm-damage  | /services/seattle/siding-rot-repair-replacement  |
| /services/portland/vinyl-siding-replacement | /services/portland/lap-cedar-wood-specialty-siding-repair |
| /services/seattle/vinyl-siding-replacement  | /services/seattle/lap-cedar-wood-specialty-siding-repair  |
| /services/portland/wood-siding-repair | /services/portland/lap-cedar-wood-specialty-siding-repair |
| /services/seattle/wood-siding-repair  | /services/seattle/lap-cedar-wood-specialty-siding-repair  |

## trim-repair

| Old URL | New URL |
|---------|---------|
| /services/portland/corbel-reproduction-services | /services/portland/corner-boards-decorative-trim |
| /services/seattle/corbel-reproduction-services  | /services/seattle/corner-boards-decorative-trim  |
| /services/portland/custom-sitemade-moldings | /services/portland/corner-boards-decorative-trim |
| /services/seattle/custom-sitemade-moldings  | /services/seattle/corner-boards-decorative-trim  |
| /services/portland/custom-trim-molding-installation | /services/portland/corner-boards-decorative-trim |
| /services/seattle/custom-trim-molding-installation  | /services/seattle/corner-boards-decorative-trim  |
| /services/portland/elliptical-trim-cutting | /services/portland/corner-boards-decorative-trim |
| /services/seattle/elliptical-trim-cutting  | /services/seattle/corner-boards-decorative-trim  |
| /services/portland/emergency-trim-repair-services | /services/portland/exterior-trim-rot-repair-replacement |
| /services/seattle/emergency-trim-repair-services  | /services/seattle/exterior-trim-rot-repair-replacement  |
| /services/portland/expert-trim-repair-services-in-portland-oregon | /services/portland/exterior-trim-rot-repair-replacement |
| /services/seattle/expert-trim-repair-services-in-portland-oregon  | /services/seattle/exterior-trim-rot-repair-replacement  |
| /services/portland/exterior-trim-replacement | /services/portland/exterior-trim-rot-repair-replacement |
| /services/seattle/exterior-trim-replacement  | /services/seattle/exterior-trim-rot-repair-replacement  |
| /services/portland/fascia-board-replacement | /services/portland/fascia-soffit-roofline-trim |
| /services/seattle/fascia-board-replacement  | /services/seattle/fascia-soffit-roofline-trim  |
| /services/portland/pvc-trim-installation | /services/portland/trim-by-material-cedar-pvc-fiber-cement |
| /services/seattle/pvc-trim-installation  | /services/seattle/trim-by-material-cedar-pvc-fiber-cement  |
| /services/portland/rotten-trim-repair | /services/portland/exterior-trim-rot-repair-replacement |
| /services/seattle/rotten-trim-repair  | /services/seattle/exterior-trim-rot-repair-replacement  |
| /services/portland/scarf-joint-restoration | /services/portland/exterior-trim-rot-repair-replacement |
| /services/seattle/scarf-joint-restoration  | /services/seattle/exterior-trim-rot-repair-replacement  |
| /services/portland/trim-caulking-and-sealing | /services/portland/siding-flashing-integration-repairs |
| /services/seattle/trim-caulking-and-sealing  | /services/seattle/siding-flashing-integration-repairs  |
| /services/portland/trim-design-consultation | /services/portland/corner-boards-decorative-trim |
| /services/seattle/trim-design-consultation  | /services/seattle/corner-boards-decorative-trim  |
| /services/portland/trim-painting-and-finishing | /services/portland/trim-by-material-cedar-pvc-fiber-cement |
| /services/seattle/trim-painting-and-finishing  | /services/seattle/trim-by-material-cedar-pvc-fiber-cement  |
| /services/portland/trim-removal-and-replacement | /services/portland/exterior-trim-rot-repair-replacement |
| /services/seattle/trim-removal-and-replacement  | /services/seattle/exterior-trim-rot-repair-replacement  |
| /services/portland/trim-restoration-and-refinishing | /services/portland/exterior-trim-rot-repair-replacement |
| /services/seattle/trim-restoration-and-refinishing  | /services/seattle/exterior-trim-rot-repair-replacement  |
| /services/portland/weatherproofing-for-trim | /services/portland/siding-flashing-integration-repairs |
| /services/seattle/weatherproofing-for-trim  | /services/seattle/siding-flashing-integration-repairs  |
| /services/portland/window-and-door-trim-repair | /services/portland/window-door-trim-repair |
| /services/seattle/window-and-door-trim-repair  | /services/seattle/window-door-trim-repair  |

## beam-repair

| Old URL | New URL |
|---------|---------|
| /services/portland/beam-code-compliance-consultation | /services/portland/beam-post-connection-repairs |
| /services/seattle/beam-code-compliance-consultation  | /services/seattle/beam-post-connection-repairs  |
| /services/portland/beam-design-consulting | /services/portland/structural-beam-repair-replacement |
| /services/seattle/beam-design-consulting  | /services/seattle/structural-beam-repair-replacement  |
| /services/portland/beam-inspection-and-assessment | /services/portland/structural-beam-repair-replacement |
| /services/seattle/beam-inspection-and-assessment  | /services/seattle/structural-beam-repair-replacement  |
| /services/portland/beam-replacement-services | /services/portland/structural-beam-repair-replacement |
| /services/seattle/beam-replacement-services  | /services/seattle/structural-beam-repair-replacement  |
| /services/portland/beam-replacement-solutions | /services/portland/structural-beam-repair-replacement |
| /services/seattle/beam-replacement-solutions  | /services/seattle/structural-beam-repair-replacement  |
| /services/portland/beam-shoring-solutions | /services/portland/floor-interior-structural-support-repair |
| /services/seattle/beam-shoring-solutions  | /services/seattle/floor-interior-structural-support-repair  |
| /services/portland/beam-weatherproofing-services | /services/portland/deck-porch-exterior-beam-repair |
| /services/seattle/beam-weatherproofing-services  | /services/seattle/deck-porch-exterior-beam-repair  |
| /services/portland/custom-beam-design-and-fabrication | /services/portland/structural-beam-repair-replacement |
| /services/seattle/custom-beam-design-and-fabrication  | /services/seattle/structural-beam-repair-replacement  |
| /services/portland/custom-beam-fabrication | /services/portland/structural-beam-repair-replacement |
| /services/seattle/custom-beam-fabrication  | /services/seattle/structural-beam-repair-replacement  |
| /services/portland/emergency-beam-repair-services | /services/portland/structural-beam-repair-replacement |
| /services/seattle/emergency-beam-repair-services  | /services/seattle/structural-beam-repair-replacement  |
| /services/portland/foundation-beam-assessment | /services/portland/footing-foundation-support |
| /services/seattle/foundation-beam-assessment  | /services/seattle/footing-foundation-support  |
| /services/portland/ibeam-installation-and-repair-services-in-portland-or | /services/portland/structural-beam-repair-replacement |
| /services/seattle/ibeam-installation-and-repair-services-in-portland-or  | /services/seattle/structural-beam-repair-replacement  |
| /services/portland/ibeam-installation-services | /services/portland/structural-beam-repair-replacement |
| /services/seattle/ibeam-installation-services  | /services/seattle/structural-beam-repair-replacement  |
| /services/portland/loadbearing-beam-reinforcement | /services/portland/structural-beam-repair-replacement |
| /services/seattle/loadbearing-beam-reinforcement  | /services/seattle/structural-beam-repair-replacement  |
| /services/portland/loadbearing-wall-beam-reinforcement | /services/portland/structural-beam-repair-replacement |
| /services/seattle/loadbearing-wall-beam-reinforcement  | /services/seattle/structural-beam-repair-replacement  |
| /services/portland/plywood-gusset-installation | /services/portland/beam-post-connection-repairs |
| /services/seattle/plywood-gusset-installation  | /services/seattle/beam-post-connection-repairs  |
| /services/portland/post-and-beam-structural-support | /services/portland/post-column-repair |
| /services/seattle/post-and-beam-structural-support  | /services/seattle/post-column-repair  |
| /services/portland/restoration-of-exposed-beams | /services/portland/deck-porch-exterior-beam-repair |
| /services/seattle/restoration-of-exposed-beams  | /services/seattle/deck-porch-exterior-beam-repair  |
| /services/portland/shoring-and-support-services | /services/portland/floor-interior-structural-support-repair |
| /services/seattle/shoring-and-support-services  | /services/seattle/floor-interior-structural-support-repair  |
