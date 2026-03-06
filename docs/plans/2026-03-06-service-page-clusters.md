# Service Page Clusters Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate 10 microsites from granular per-service pages to SEO cluster pages, with stub markdown files, working routes, redirects from all old URLs, and a validation script.

**Architecture:** New `service_page_cluster_*` markdown stubs live alongside existing files. A new `cluster-services.ts` loader (per app) serves cluster pages through the existing `[location]/[service].astro` route. Redirects are defined in each app's `astro.config.mjs`, driven by `tools/migration/redirect-map.json`. A validation script confirms no old slug is missing a redirect.

**Tech Stack:** Node.js scripts (no deps beyond built-ins), Astro static redirects, TypeScript data loaders, pnpm monorepo.

---

## Task 1: Create `tools/content-generator/config/clusters.json`

**Files:**
- Create: `tools/content-generator/config/clusters.json`

This is the authoritative source for all cluster definitions. All subsequent tasks read from it.

**Step 1: Create the file**

```json
{
  "deck-repair": [
    {
      "id": 1,
      "name": "Deck Board Repair & Replacement",
      "slug": "deck-board-repair-replacement",
      "subtopics": [
        "Deck Board Removal & Refastening",
        "Rotten Deck Board Replacement",
        "Deck Surface Repair & Refinishing",
        "Touch-Up Sanding & Staining",
        "Deck Fascia Board Repair",
        "Deck Rim Joist Repair"
      ]
    },
    {
      "id": 2,
      "name": "Deck Structural Framing Repair",
      "slug": "deck-structural-framing-repair",
      "subtopics": [
        "Deck Joist Repair & Replacement",
        "Deck Beam Replacement",
        "Post & Beam Repairs",
        "Deck Bracing & Structural Framing",
        "Deck Blocking Installation",
        "Deck Framing Repair & Reinforcement"
      ]
    },
    {
      "id": 3,
      "name": "Deck Ledger, Flashing & Water Protection",
      "slug": "deck-ledger-flashing-water-protection",
      "subtopics": [
        "Deck Ledger Board Replacement",
        "Deck Ledger Repairs & Flashing",
        "Deck Flashing Installation or Repair",
        "Deck Waterproofing Repairs",
        "Deck Drainage Corrections"
      ]
    },
    {
      "id": 4,
      "name": "Deck Posts, Footings & Foundation",
      "slug": "deck-posts-footings-foundation",
      "subtopics": [
        "Deck Post Replacement",
        "Footing Repairs & Replacement",
        "Deck Concrete Pier Repair",
        "Deck Shoring & Safety",
        "Deck Leveling & Stabilization",
        "Deck Support Post Repair"
      ]
    },
    {
      "id": 5,
      "name": "Deck Stairs & Railings",
      "slug": "deck-stairs-railings",
      "subtopics": [
        "Deck Stair Stringer Repair",
        "Deck Stair Tread Replacement",
        "Staircase Repairs",
        "Deck Railing Repair or Replacement",
        "Handrail Repair",
        "Deck Guardrail Repair",
        "Deck Baluster Replacement"
      ]
    },
    {
      "id": 6,
      "name": "Deck Safety, Code & Hardware Upgrades",
      "slug": "deck-safety-code-hardware-upgrades",
      "subtopics": [
        "Deck Safety Upgrades to Current Code",
        "Deck Hardware Replacement",
        "Deck Connector Upgrades (Simpson Hardware)",
        "Joist Hanger Repairs or Upgrades",
        "Deck Structural Reinforcement"
      ]
    },
    {
      "id": 7,
      "name": "Deck Skirting, Lattice & Accessories",
      "slug": "deck-skirting-lattice-accessories",
      "subtopics": [
        "Deck Skirting or Lattice Repair",
        "Deck Ledger Repairs & Flashing"
      ]
    }
  ],
  "dry-rot": [
    {
      "id": 1,
      "name": "Exterior Siding & Wall Rot Repair",
      "slug": "exterior-siding-wall-rot-repair",
      "subtopics": [
        "Rotten Siding Repair Service",
        "Exterior Siding Rot Repair",
        "Dry Rot Siding Replacement",
        "Lap Siding Rot Repair",
        "Cedar Shake Rot Replacement",
        "Exterior Wall Sheathing Rot Repair",
        "Corner Board Rot Repair"
      ]
    },
    {
      "id": 2,
      "name": "Window & Door Rot Repair",
      "slug": "window-door-rot-repair",
      "subtopics": [
        "Rotted Window Sill Replacement",
        "Window Frame Rot Repair",
        "Window Sill Rot Repair",
        "Bay Window Rot Repair",
        "Sliding Door Frame Rot Repair",
        "French Door Rot Repair",
        "Garage Door Frame Rot Repair",
        "Rotted Window Trim & Sashes",
        "Rotted Door or Window Jambs"
      ]
    },
    {
      "id": 3,
      "name": "Deck, Porch & Balcony Rot Repair",
      "slug": "deck-porch-balcony-rot-repair",
      "subtopics": [
        "Deck & Porch Rot Repair",
        "Deck Joist Rot Repair",
        "Deck Beam Rot Repair",
        "Deck Ledger Board Rot Repair",
        "Deck Stair Stringer Rot Repair",
        "Porch Floor Rot Repair",
        "Porch Beam & Post Rot Repair",
        "Balcony Rot Repair"
      ]
    },
    {
      "id": 4,
      "name": "Structural & Framing Rot Repair",
      "slug": "structural-framing-rot-repair",
      "subtopics": [
        "Structural Rot Repair",
        "Rotted Framing Repair Services",
        "Rim Joist Rot Repair",
        "Header Rot Repair",
        "Load-Bearing Beam Rot Repair",
        "Floor Joist Rot Repair",
        "Support Column Rot Repair",
        "Structural Beam Replacement",
        "Foundation Framing Rot Repair"
      ]
    },
    {
      "id": 5,
      "name": "Roofline & Overhang Rot Repair",
      "slug": "roofline-overhang-rot-repair",
      "subtopics": [
        "Roofline Rot Repairs",
        "Eave Rot Repair",
        "Roof Overhang Rot Repair",
        "Gable End Rot Repair",
        "Barge Board Rot Repair",
        "Fascia Board Replacement",
        "Rotted Rafter Tails & Overhangs",
        "Chimney Chase Rot Repair",
        "Soffit & Fascia Rot"
      ]
    },
    {
      "id": 6,
      "name": "Crawlspace & Foundation Rot Repair",
      "slug": "crawlspace-foundation-rot-repair",
      "subtopics": [
        "Crawlspace Beam Rot Repair",
        "Crawlspace Joist Rot Repair",
        "Mud Sill Rot Repair",
        "Foundation Plate Rot Repair",
        "Moisture-Damaged Framing Repair",
        "Subfloor Rot Removal",
        "Rotted Sill Plate Removal"
      ]
    },
    {
      "id": 7,
      "name": "Comprehensive Dry Rot & Emergency Services",
      "slug": "comprehensive-dry-rot-emergency-services",
      "subtopics": [
        "Comprehensive Dry Rot Solutions",
        "Emergency Dry Rot Repair",
        "Rotten Window Sill Repair",
        "Seasonal Dry Rot Assessment",
        "Wood Rot Damage Repair",
        "Water Damage Wood Repair",
        "Exterior Wood Restoration"
      ]
    }
  ],
  "chimney-repair": [
    {
      "id": 1,
      "name": "Chimney Chase Structural Repair & Rebuilding",
      "slug": "chimney-chase-structural-repair-rebuilding",
      "subtopics": [
        "Chimney Chase Repair and Rebuilding",
        "Chimney Chase Structural Framing Repair",
        "Chimney Chase Reframing & Reinforcement",
        "Wooden Chimney Chase Framing Repair",
        "Chimney Chase Top Rebuild",
        "Chimney Chase Framing Replacement"
      ]
    },
    {
      "id": 2,
      "name": "Chimney Chase Water Damage & Rot Repair",
      "slug": "chimney-chase-water-damage-rot-repair",
      "subtopics": [
        "Chimney Chase Water Damage Restoration",
        "Chimney Chase Dry Rot Repair",
        "Chimney Chase Wood Rot Replacement",
        "Chimney Chase Moisture Damage Repair",
        "Chimney Chase Structural Rot Repair",
        "Chimney Chase Dry Rot Replacement"
      ]
    },
    {
      "id": 3,
      "name": "Chimney Chase Flashing & Leak Repair",
      "slug": "chimney-chase-flashing-leak-repair",
      "subtopics": [
        "Chimney Chase Flashing Repair & Waterproofing",
        "Chimney Chase Leak Diagnosis & Repair",
        "Chimney Chase Penetration Leak Repair",
        "Roof Cricket Installation for Chimney Chase",
        "Chimney Chase Roof Flashing Replacement",
        "Chimney Chase Step Flashing Repair",
        "Chimney Chase Counter Flashing Repair",
        "Chimney Chase Roof Tie-In Repair"
      ]
    },
    {
      "id": 4,
      "name": "Chimney Chase Siding & Exterior Repair",
      "slug": "chimney-chase-siding-exterior-repair",
      "subtopics": [
        "Wooden Chimney Chase Siding Repair",
        "Chimney Chase Siding Replacement",
        "Chimney Chase Trim Repair",
        "Chimney Chase Fascia Repair",
        "Chimney Chase Corner Board Repair",
        "Chimney Chase Roofline Repair"
      ]
    },
    {
      "id": 5,
      "name": "Chimney Chase Waterproofing & Sealing",
      "slug": "chimney-chase-waterproofing-sealing",
      "subtopics": [
        "Chimney Chase Waterproofing & Sealing",
        "Chimney Chase Vent Penetration Sealing",
        "Chimney Chase Cap Replacement",
        "Chimney Chase Rot Repair"
      ]
    }
  ],
  "crawlspace-rot": [
    {
      "id": 1,
      "name": "Crawlspace Structural Rot & Dry Rot Repair",
      "slug": "crawlspace-structural-rot-dry-rot-repair",
      "subtopics": [
        "Crawlspace Dry Rot Repair",
        "Crawlspace Structural Rot Repair",
        "Crawlspace Dry Rot Removal",
        "Crawlspace Beam Replacement",
        "Crawlspace Support Post Replacement",
        "Crawlspace Post & Beam Repair"
      ]
    },
    {
      "id": 2,
      "name": "Crawlspace Floor System & Framing Repair",
      "slug": "crawlspace-floor-system-framing-repair",
      "subtopics": [
        "Crawlspace Floor Joist Repair",
        "Crawlspace Rim Joist Repair",
        "Crawlspace Sill Plate Repair",
        "Crawlspace Foundation Framing Repair",
        "Crawlspace Structural Reinforcement",
        "Crawlspace Joist Sistering",
        "Crawlspace Beam Reinforcement",
        "Crawlspace Structural Framing"
      ]
    },
    {
      "id": 3,
      "name": "Subfloor & Sagging Floor Repair",
      "slug": "subfloor-sagging-floor-repair",
      "subtopics": [
        "Subfloor Repair",
        "Subfloor Replacement",
        "Subfloor Water Damage Repair",
        "Sagging Floor System Repair",
        "Floor Joist Replacement",
        "Floor Joist Reinforcement",
        "Floor System Framing",
        "Crawlspace Sagging Floor Repair"
      ]
    },
    {
      "id": 4,
      "name": "Foundation Transition & Ground-Level Repairs",
      "slug": "foundation-transition-ground-level-repairs",
      "subtopics": [
        "Rim Joist Rot Repair",
        "Mud Sill Replacement",
        "Sill Plate Replacement",
        "Foundation Framing Repair"
      ]
    },
    {
      "id": 5,
      "name": "Crawlspace Moisture, Vapor & Waterproofing",
      "slug": "crawlspace-moisture-vapor-waterproofing",
      "subtopics": [
        "Crawlspace Moisture Damage Repair",
        "Crawlspace Water Damage Restoration",
        "Crawlspace Drainage Corrections",
        "Crawlspace Vapor Barrier Installation",
        "Crawlspace Moisture Barrier Replacement",
        "Crawlspace Ventilation Improvements",
        "Crawlspace Waterproofing",
        "Crawlspace Mold Remediation",
        "Crawlspace Mold Testing & Encapsulation"
      ]
    },
    {
      "id": 6,
      "name": "Crawlspace Access & Entry",
      "slug": "crawlspace-access-entry",
      "subtopics": [
        "Crawlspace Access Door Installation"
      ]
    }
  ],
  "leak-repair": [
    {
      "id": 1,
      "name": "Window Leak Repair & Waterproofing",
      "slug": "window-leak-repair-waterproofing",
      "subtopics": [
        "Leaking Window Repair & Waterproofing",
        "Window Sill Leak Repair",
        "Window Head Flashing Repair",
        "Window Pan Flashing Installation",
        "Window Waterproofing & Sealing",
        "Window Leak Detection & Diagnosis",
        "Exterior Window Seal Failure Repair",
        "Window Frame Water Damage Repair"
      ]
    },
    {
      "id": 2,
      "name": "Window Flashing Repair",
      "slug": "window-flashing-repair",
      "subtopics": [
        "Window Flashing Repair",
        "Window Flashing Repair & Replacement",
        "Siding to Window Flashing Repair",
        "Window Weatherproofing System Repair",
        "Window Trim Leak Repair"
      ]
    },
    {
      "id": 3,
      "name": "Bay Window & Specialty Window Repairs",
      "slug": "bay-window-specialty-window-repairs",
      "subtopics": [
        "Bay Window Leak Repair",
        "Window & Siding Leak Repair",
        "Window & Trim Integration Repair",
        "Window & Weather Barrier Repair"
      ]
    },
    {
      "id": 4,
      "name": "Sliding Glass Door & Door Leak Repair",
      "slug": "sliding-glass-door-leak-repair",
      "subtopics": [
        "Sliding Glass Door Leak Repair",
        "Sliding Door Frame Rot Repair",
        "Sliding Door Flashing Repair",
        "Sliding Door Waterproofing",
        "Door Threshold Leak Repair",
        "Leaking Door Frame Repair"
      ]
    },
    {
      "id": 5,
      "name": "Door Frame Leak & Rot Repair",
      "slug": "door-frame-leak-rot-repair",
      "subtopics": [
        "Door Frame Water Damage Repair",
        "Front Door Leak Repair",
        "French Door Leak Repair",
        "Entry Door Flashing Repair",
        "Door Frame Rot Repair",
        "Door Weatherproofing Repair"
      ]
    },
    {
      "id": 6,
      "name": "Window & Door Frame Rot Repair",
      "slug": "window-door-frame-rot-repair",
      "subtopics": [
        "Window Frame Rot Repair",
        "Rotted Window Sill Replacement",
        "Rotted Window Trim Repair",
        "Rotted Window Frame Replacement",
        "Rotted Door Frame Replacement",
        "Water Damaged Window Framing Repair"
      ]
    },
    {
      "id": 7,
      "name": "Siding & Building Envelope Integration",
      "slug": "siding-building-envelope-integration",
      "subtopics": [
        "Siding & Window Integration Repair",
        "Siding & Window Leak Repair",
        "Siding to Window Flashing Repair",
        "Exterior Wall Leak Repair"
      ]
    }
  ],
  "siding-repair": [
    {
      "id": 1,
      "name": "Siding Rot Repair & Replacement",
      "slug": "siding-rot-repair-replacement",
      "subtopics": [
        "Siding Rot Repair",
        "Dry Rot Siding Replacement",
        "Water Damaged Siding Repair",
        "Siding Board Replacement",
        "Siding Panel Replacement",
        "Rotted Siding Framing Repair",
        "Wall Framing Rot Repair Behind Siding"
      ]
    },
    {
      "id": 2,
      "name": "Lap, Cedar, Wood & Specialty Siding Repair",
      "slug": "lap-cedar-wood-specialty-siding-repair",
      "subtopics": [
        "Lap Siding Repair",
        "Cedar Siding Repair",
        "Wood Siding Repair",
        "Siding Seam Repair"
      ]
    },
    {
      "id": 3,
      "name": "Hardie & Fiber Cement Siding Repair",
      "slug": "hardie-fiber-cement-siding-repair",
      "subtopics": [
        "Hardie Siding Repair"
      ]
    },
    {
      "id": 4,
      "name": "Exterior Wall Sheathing & Weather Barrier Repair",
      "slug": "exterior-wall-sheathing-weather-barrier-repair",
      "subtopics": [
        "Exterior Wall Sheathing Repair",
        "Weather Barrier Repair Behind Siding",
        "House Wrap Replacement During Siding Repair",
        "Wall Sheathing Rot Replacement",
        "Structural Framing Repair Behind Siding"
      ]
    },
    {
      "id": 5,
      "name": "Siding Flashing & Water Intrusion Repair",
      "slug": "siding-flashing-water-intrusion-repair",
      "subtopics": [
        "Siding Flashing Repair",
        "Siding Leak Repair",
        "Siding Water Intrusion Repair",
        "Siding & Roofline Repair"
      ]
    },
    {
      "id": 6,
      "name": "Siding Trim & Corner Board Repair",
      "slug": "siding-trim-corner-board-repair",
      "subtopics": [
        "Siding Trim Repair",
        "Corner Board Repair"
      ]
    },
    {
      "id": 7,
      "name": "Siding Integration Repairs",
      "slug": "siding-integration-repairs",
      "subtopics": [
        "Siding Integration Repair with Windows",
        "Siding Integration Repair with Doors",
        "Siding & Deck Ledger Integration Repair"
      ]
    }
  ],
  "lead-paint": [
    {
      "id": 1,
      "name": "Lead Paint Testing & Inspection",
      "slug": "lead-paint-testing-inspection",
      "subtopics": [
        "Lead Paint Testing & Inspection",
        "Lead Paint Risk Assessment",
        "EPA RRP Certified Renovation Services",
        "Lead Paint Renovation Compliance"
      ]
    },
    {
      "id": 2,
      "name": "Lead Paint Removal & Surface Preparation",
      "slug": "lead-paint-removal-surface-preparation",
      "subtopics": [
        "Lead Paint Removal & Surface Preparation",
        "Lead Paint Safe Scraping & Sanding",
        "Lead Paint Peeling & Failure Repair",
        "Lead Paint Surface Stabilization",
        "Lead Paint Surface Repair & Repainting",
        "Lead Paint Weathered Surface Restoration"
      ]
    },
    {
      "id": 3,
      "name": "Lead Paint Stabilization & Encapsulation",
      "slug": "lead-paint-stabilization-encapsulation",
      "subtopics": [
        "Lead Paint Stabilization & Repainting",
        "Lead Paint Encapsulation Coating"
      ]
    },
    {
      "id": 4,
      "name": "Lead Paint Containment & Cleanup",
      "slug": "lead-paint-containment-cleanup",
      "subtopics": [
        "Lead Paint Containment Setup",
        "Lead Paint Dust Control Systems",
        "Lead Paint Debris Removal & Disposal",
        "Lead Paint Work Area Protection",
        "Lead Paint Cleanup & Final Inspection"
      ]
    },
    {
      "id": 5,
      "name": "Lead-Safe Painting & Exterior Services",
      "slug": "lead-safe-painting-exterior-services",
      "subtopics": [
        "Lead-Safe Painting Services",
        "EPA RRP Lead-Safe Painting",
        "Lead Paint Safe Exterior Repainting",
        "Lead Paint Safe Fascia & Soffit Painting",
        "Lead Paint Safe Deck Painting & Staining",
        "Lead Paint Safe Exterior Wood Restoration"
      ]
    },
    {
      "id": 6,
      "name": "Lead-Safe Exterior Renovation",
      "slug": "lead-safe-exterior-renovation",
      "subtopics": [
        "Lead Paint Safe Siding Repair & Painting",
        "Lead Paint Safe Trim Repair & Painting",
        "Lead Paint Safe Window Trim Painting",
        "Lead Paint Safe Door Painting"
      ]
    }
  ],
  "flashing-repair": [
    {
      "id": 1,
      "name": "Window & Door Flashing Repair",
      "slug": "window-door-flashing-repair",
      "subtopics": [
        "Window Flashing Repair",
        "Door Flashing Repair",
        "Head Flashing Installation",
        "Pan Flashing Installation",
        "Window & Siding Flashing Repair",
        "Door & Siding Flashing Repair"
      ]
    },
    {
      "id": 2,
      "name": "Chimney Flashing Repair",
      "slug": "chimney-flashing-repair",
      "subtopics": [
        "Chimney Flashing Repair",
        "Chimney Chase Flashing Repair",
        "Step Flashing Repair",
        "Counter Flashing Repair"
      ]
    },
    {
      "id": 3,
      "name": "Deck Ledger Flashing & Waterproofing",
      "slug": "deck-ledger-flashing-waterproofing",
      "subtopics": [
        "Deck Ledger Flashing Repair",
        "Deck Ledger Waterproofing & Flashing",
        "Deck Ledger Rot Repair"
      ]
    },
    {
      "id": 4,
      "name": "Roof-to-Wall & Penetration Flashing",
      "slug": "roof-to-wall-penetration-flashing",
      "subtopics": [
        "Roof-to-Wall Flashing Repair",
        "Kickout Flashing Installation & Repair",
        "Roof Penetration Flashing Repair",
        "Dormer Flashing Repair",
        "Roof Valley Flashing Repair",
        "Siding to Roof Flashing Repair"
      ]
    },
    {
      "id": 5,
      "name": "Structural Damage from Flashing Failure",
      "slug": "structural-damage-flashing-failure",
      "subtopics": [
        "Wall Sheathing Rot Repair from Flashing Failure",
        "Window Frame Rot Repair from Water Intrusion",
        "Door Frame Rot Repair from Flashing Failure",
        "Roofline Rot Repair",
        "Exterior Framing Rot Repair from Leaks"
      ]
    },
    {
      "id": 6,
      "name": "Building Envelope & Waterproofing",
      "slug": "building-envelope-waterproofing",
      "subtopics": [
        "Building Envelope Leak Diagnosis",
        "Exterior Waterproofing Repairs",
        "Siding & Flashing Integration Repair",
        "Weather Barrier Repair Behind Siding",
        "Water Intrusion Repair Around Windows",
        "Exterior Wall Leak Repair"
      ]
    }
  ],
  "trim-repair": [
    {
      "id": 1,
      "name": "Exterior Trim Rot Repair & Replacement",
      "slug": "exterior-trim-rot-repair-replacement",
      "subtopics": [
        "Exterior Trim Rot Repair",
        "Exterior Trim Replacement",
        "Rotted Wood Trim Replacement",
        "Exterior Wood Rot Removal",
        "Exterior Wood Trim Rebuilding",
        "Exterior Wood Trim Stabilization",
        "Exterior Wood Restoration"
      ]
    },
    {
      "id": 2,
      "name": "Window & Door Trim Repair",
      "slug": "window-door-trim-repair",
      "subtopics": [
        "Window Trim Repair",
        "Window Trim Rot Repair",
        "Window Trim Replacement",
        "Window Sill Trim Repair",
        "Exterior Window Casing Repair",
        "Door Trim Repair",
        "Door Trim Rot Repair",
        "Door Casing Repair",
        "Entry Door Trim Replacement",
        "Sliding Door Trim Repair"
      ]
    },
    {
      "id": 3,
      "name": "Fascia, Soffit & Roofline Trim",
      "slug": "fascia-soffit-roofline-trim",
      "subtopics": [
        "Fascia Board Repair",
        "Soffit Trim Repair",
        "Rotted Fascia Board Replacement",
        "Rafter Tail Trim Repair",
        "Roofline Trim Repair",
        "Eave Trim Repair",
        "Gable Trim Repair",
        "Barge Board Repair",
        "Frieze Board Repair"
      ]
    },
    {
      "id": 4,
      "name": "Corner Boards & Decorative Trim",
      "slug": "corner-boards-decorative-trim",
      "subtopics": [
        "Corner Board Repair",
        "Decorative Trim Repair"
      ]
    },
    {
      "id": 5,
      "name": "Siding, Flashing & Integration Repairs",
      "slug": "siding-flashing-integration-repairs",
      "subtopics": [
        "Siding & Trim Integration Repair",
        "Trim & Flashing Integration Repair",
        "Trim Water Intrusion Repair",
        "Trim & Window Waterproofing Repair",
        "Trim & Siding Leak Repair",
        "Exterior Trim Waterproofing"
      ]
    },
    {
      "id": 6,
      "name": "Trim by Material: Cedar, PVC & Fiber Cement",
      "slug": "trim-by-material-cedar-pvc-fiber-cement",
      "subtopics": [
        "Cedar Trim Repair",
        "Cedar Trim Rot Repair",
        "Cedar Trim Replacement",
        "PVC Trim Repair",
        "PVC Trim Replacement",
        "Fiber Cement Trim Repair",
        "Fiber Cement Trim Replacement",
        "Hardie Trim Repair",
        "Composite Trim Repair",
        "Composite Trim Replacement",
        "Engineered Wood Trim Repair"
      ]
    }
  ],
  "beam-repair": [
    {
      "id": 1,
      "name": "Structural Beam Repair & Replacement",
      "slug": "structural-beam-repair-replacement",
      "subtopics": [
        "Structural Beam Repair",
        "Structural Beam Replacement",
        "Load-Bearing Beam Repair",
        "Load-Bearing Beam Reinforcement",
        "Rotted Beam Replacement",
        "Sagging Beam Repair",
        "Water Damaged Beam Repair",
        "Beam Sistering & Reinforcement",
        "Engineered Beam Installation",
        "Structural Beam Stabilization"
      ]
    },
    {
      "id": 2,
      "name": "Floor & Interior Structural Support Repair",
      "slug": "floor-interior-structural-support-repair",
      "subtopics": [
        "Sagging Floor Structural Repair",
        "Floor Beam Reinforcement",
        "Floor Beam Replacement",
        "Floor Framing Structural Repair",
        "Subfloor Support Beam Repair",
        "Crawlspace Beam Replacement"
      ]
    },
    {
      "id": 3,
      "name": "Post & Column Repair",
      "slug": "post-column-repair",
      "subtopics": [
        "Post & Column Repair",
        "Support Post Repair",
        "Support Post Replacement",
        "Structural Post Replacement",
        "Load-Bearing Post Repair",
        "Wood Post Rot Repair",
        "Steel Support Post Installation",
        "Adjustable Post Installation"
      ]
    },
    {
      "id": 4,
      "name": "Deck, Porch & Exterior Beam Repair",
      "slug": "deck-porch-exterior-beam-repair",
      "subtopics": [
        "Deck Beam Repair",
        "Porch Beam Repair",
        "Roof Support Beam Repair",
        "Balcony Support Beam Repair",
        "Deck Support Post Repair",
        "Porch Post Repair",
        "Exterior Structural Beam Reinforcement"
      ]
    },
    {
      "id": 5,
      "name": "Footing & Foundation Support",
      "slug": "footing-foundation-support",
      "subtopics": [
        "Footing Repair",
        "Footing Replacement",
        "Concrete Pier Repair",
        "Concrete Pier Replacement",
        "Post Footing Repair",
        "Structural Footing Reinforcement",
        "Settled Footing Repair",
        "Foundation Support Footing Repair"
      ]
    },
    {
      "id": 6,
      "name": "Beam & Post Connection Repairs",
      "slug": "beam-post-connection-repairs",
      "subtopics": [
        "Post-to-Beam Connection Repair",
        "Beam-to-Column Reinforcement",
        "Structural Bearing Point Repair",
        "Beam Pocket Repair",
        "Structural Framing Connections Repair",
        "Structural Hardware Replacement",
        "Simpson Connector Installation"
      ]
    }
  ]
}
```

**Step 2: Verify count**

```bash
node -e "
const c = require('./tools/content-generator/config/clusters.json');
let total = 0;
for (const [site, clusters] of Object.entries(c)) {
  console.log(site + ': ' + clusters.length + ' clusters');
  total += clusters.length;
}
console.log('Total:', total, 'clusters,', total * 2, 'stub files');
"
```

Expected output:
```
deck-repair: 7 clusters
dry-rot: 7 clusters
chimney-repair: 5 clusters
crawlspace-rot: 6 clusters
leak-repair: 7 clusters
siding-repair: 7 clusters
lead-paint: 6 clusters
flashing-repair: 6 clusters
trim-repair: 6 clusters
beam-repair: 6 clusters
Total: 63 clusters, 126 stub files
```

**Step 3: Commit**

```bash
git add tools/content-generator/config/clusters.json
git commit -m "add service page clusters config (63 clusters across 10 sites)"
```

---

## Task 2: Create `tools/content-generator/generate-stubs.js`

**Files:**
- Create: `tools/content-generator/generate-stubs.js`

**Step 1: Create the script**

```js
#!/usr/bin/env node
/**
 * Generates stub markdown files for each cluster × location.
 * Usage: node tools/content-generator/generate-stubs.js [--force]
 *
 * Creates: apps/<site>/src/data/generated_content/service_page_cluster_<slug>_<location>.md
 * Skips existing files unless --force is passed.
 */

const fs = require('fs');
const path = require('path');

const FORCE = process.argv.includes('--force');
const LOCATIONS = ['portland', 'seattle'];
const LOCATION_FULL = { portland: 'Portland, Oregon', seattle: 'Seattle, Washington' };
const ROOT = path.resolve(__dirname, '../..');
const clusters = require('./config/clusters.json');

let created = 0;
let skipped = 0;

for (const [site, siteClust] of Object.entries(clusters)) {
  const contentDir = path.join(ROOT, 'apps', site, 'src', 'data', 'generated_content');

  if (!fs.existsSync(contentDir)) {
    console.warn(`WARN: content dir missing for ${site}, skipping`);
    continue;
  }

  for (const cluster of siteClust) {
    for (const location of LOCATIONS) {
      const fileName = `service_page_cluster_${cluster.slug}_${location}.md`;
      const filePath = path.join(contentDir, fileName);

      if (fs.existsSync(filePath) && !FORCE) {
        skipped++;
        continue;
      }

      const content = generateStub(cluster, location, site);
      fs.writeFileSync(filePath, content, 'utf-8');
      created++;
      console.log(`  created: apps/${site}/src/data/generated_content/${fileName}`);
    }
  }
}

console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);

function generateStub(cluster, location, site) {
  const locationFull = LOCATION_FULL[location];
  const subtopicSections = cluster.subtopics
    .map(t => `## ${t}\n*Content to be generated.*\n`)
    .join('\n');

  return `# ${cluster.name} - ${locationFull}

<!-- CLUSTER_META
service: ${site}
cluster_id: ${cluster.id}
cluster_slug: ${cluster.slug}
location: ${location}
status: stub
subtopics:
${cluster.subtopics.map(t => `  - ${t}`).join('\n')}
-->

## Hero Section

### [STUB] ${cluster.name} in ${locationFull}
*Content to be generated.*

${subtopicSections}
## FAQ Section
*Content to be generated.*

## Page Metadata

**Service:** ${cluster.name}
**Location:** ${locationFull}
**Status:** STUB
**Cluster ID:** ${cluster.id}
**Target Keywords:** [to be filled]
`;
}
```

**Step 2: Run it**

```bash
node tools/content-generator/generate-stubs.js
```

Expected: 126 files created across 10 app directories.

**Step 3: Spot-check one file**

```bash
cat "apps/deck-repair/src/data/generated_content/service_page_cluster_deck-board-repair-replacement_portland.md"
```

Verify: file has `CLUSTER_META` block, correct `cluster_slug`, subtopics as H2 sections.

**Step 4: Verify counts per site**

```bash
for site in beam-repair chimney-repair crawlspace-rot deck-repair dry-rot flashing-repair lead-paint leak-repair siding-repair trim-repair; do
  count=$(ls apps/$site/src/data/generated_content/service_page_cluster_*.md 2>/dev/null | wc -l)
  echo "$site: $count stub files"
done
```

**Step 5: Commit**

```bash
git add apps/*/src/data/generated_content/service_page_cluster_*.md tools/content-generator/generate-stubs.js
git commit -m "add 126 cluster stub markdown files across 10 apps"
```

---

## Task 3: Create `tools/migration/redirect-map.json`

**Files:**
- Create: `tools/migration/redirect-map.json`

This maps every old service slug to its new cluster slug. Keys are old slugs (URL-safe, as derived by `services.ts`). Values are new cluster slugs.

**Step 1: Create the directory and file**

```bash
mkdir -p tools/migration
```

```json
{
  "deck-repair": {
    "deck-board-replacement": "deck-board-repair-replacement",
    "deck-surface-refinishing": "deck-board-repair-replacement",
    "deck-staining-and-sealing": "deck-board-repair-replacement",
    "epoxy-wood-repair": "deck-board-repair-replacement",
    "rotten-trim-repair": "deck-board-repair-replacement",
    "deck-repair-services": "deck-board-repair-replacement",
    "deck-joist-repair-and-replacement": "deck-structural-framing-repair",
    "pressure-treated-wood-installation": "deck-structural-framing-repair",
    "deck-drainage-solutions": "deck-ledger-flashing-water-protection",
    "post-replacement-and-repair": "deck-posts-footings-foundation",
    "deck-lighting-installation": "deck-skirting-lattice-accessories"
  },
  "chimney-repair": {
    "chimney-chase-cover-installation-and-replacement": "chimney-chase-waterproofing-sealing",
    "chimney-chase-crown-repair": "chimney-chase-structural-repair-rebuilding",
    "chimney-chase-repair-and-rebuilding": "chimney-chase-structural-repair-rebuilding",
    "chimney-chase-water-damage-restoration": "chimney-chase-water-damage-rot-repair",
    "chimney-flashing-repair-and-waterproofing": "chimney-chase-flashing-leak-repair",
    "chimney-penetration-leak-repair": "chimney-chase-flashing-leak-repair",
    "roof-cricket-installation-for-chimneys": "chimney-chase-flashing-leak-repair",
    "wood-chimney-chase-framing-repair": "chimney-chase-structural-repair-rebuilding",
    "wood-chimney-chase-siding-repair": "chimney-chase-siding-exterior-repair",
    "wood-chimney-exterior-finishing-and-painting": "chimney-chase-siding-exterior-repair"
  },
  "crawlspace-rot": {
    "crawlspace-access-door-installation": "crawlspace-access-entry",
    "crawlspace-drainage-solutions": "crawlspace-moisture-vapor-waterproofing",
    "crawlspace-energy-audit": "crawlspace-moisture-vapor-waterproofing",
    "crawlspace-insulation-installation": "crawlspace-moisture-vapor-waterproofing",
    "crawlspace-moisture-barrier-installation": "crawlspace-moisture-vapor-waterproofing",
    "crawlspace-mold-remediation": "crawlspace-moisture-vapor-waterproofing",
    "crawlspace-pest-control-services": "crawlspace-moisture-vapor-waterproofing",
    "crawlspace-repair-and-maintenance": "crawlspace-structural-rot-dry-rot-repair",
    "crawlspace-structural-support-installation": "crawlspace-floor-system-framing-repair",
    "crawlspace-ventilation-improvement": "crawlspace-moisture-vapor-waterproofing",
    "crawl-space-access-door-installation": "crawlspace-access-entry",
    "crawl-space-air-quality-improvement": "crawlspace-moisture-vapor-waterproofing",
    "crawl-space-cleanup-and-maintenance": "crawlspace-moisture-vapor-waterproofing",
    "crawl-space-insulation-replacement": "crawlspace-moisture-vapor-waterproofing",
    "crawl-space-moisture-barrier-installation": "crawlspace-moisture-vapor-waterproofing",
    "crawl-space-mold-remediation": "crawlspace-moisture-vapor-waterproofing",
    "crawl-space-rodent-and-pest-control": "crawlspace-moisture-vapor-waterproofing",
    "crawl-space-structural-repairs": "crawlspace-structural-rot-dry-rot-repair",
    "crawl-space-ventilation-solutions": "crawlspace-moisture-vapor-waterproofing",
    "crawl-space-water-drainage-solutions": "crawlspace-moisture-vapor-waterproofing"
  },
  "dry-rot": {
    "comprehensive-dry-rot-assessments": "comprehensive-dry-rot-emergency-services",
    "comprehensive-dry-rot-solutions": "comprehensive-dry-rot-emergency-services",
    "crown-molding-and-trim-restoration": "exterior-siding-wall-rot-repair",
    "custom-wood-replacement": "comprehensive-dry-rot-emergency-services",
    "deck-joist-dry-rot-inspection-and-repair": "deck-porch-balcony-rot-repair",
    "dry-rot-trim-replacement": "exterior-siding-wall-rot-repair",
    "emergency-dry-rot-repair": "comprehensive-dry-rot-emergency-services",
    "epoxy-reinforcement-for-rotted-wood": "comprehensive-dry-rot-emergency-services",
    "epoxy-reinforcement-for-wood": "comprehensive-dry-rot-emergency-services",
    "exterior-siding-repair-services": "exterior-siding-wall-rot-repair",
    "exterior-trim-dry-rot-repair": "exterior-siding-wall-rot-repair",
    "fascia-board-dry-rot-restoration": "roofline-overhang-rot-repair",
    "foundation-and-framing-inspection": "structural-framing-rot-repair",
    "historic-home-dry-rot-repair": "comprehensive-dry-rot-emergency-services",
    "porch-column-dry-rot-repair": "deck-porch-balcony-rot-repair",
    "roof-eave-dry-rot-repair": "roofline-overhang-rot-repair",
    "rotten-trim-scarf-joint-repair": "exterior-siding-wall-rot-repair",
    "rotten-window-sill-repair": "window-door-rot-repair",
    "seasonal-dry-rot-assessment": "comprehensive-dry-rot-emergency-services",
    "window-sill-dry-rot-replacement": "window-door-rot-repair"
  },
  "flashing-repair": {
    "chimney-flashing-repair": "chimney-flashing-repair",
    "counterflashing-installation": "chimney-flashing-repair",
    "counterflashing-repair-services": "chimney-flashing-repair",
    "custom-metal-flashing-fabrication": "roof-to-wall-penetration-flashing",
    "custom-metal-flashing-solutions": "roof-to-wall-penetration-flashing",
    "drip-edge-flashing-installation": "roof-to-wall-penetration-flashing",
    "flashing-inspection-services": "building-envelope-waterproofing",
    "flashing-maintenance-and-inspection-services": "building-envelope-waterproofing",
    "masonry-flashing-repair": "chimney-flashing-repair",
    "siding-and-flashing-repair": "building-envelope-waterproofing",
    "skylight-flashing-installation": "roof-to-wall-penetration-flashing",
    "skylight-flashing-replacement": "roof-to-wall-penetration-flashing",
    "step-flashing-installation-and-repair": "chimney-flashing-repair",
    "step-flashing-repair": "chimney-flashing-repair",
    "vent-pipe-flashing-repair": "roof-to-wall-penetration-flashing",
    "wall-and-roof-junction-flashing-services": "roof-to-wall-penetration-flashing",
    "wall-flashing-repair": "roof-to-wall-penetration-flashing"
  },
  "lead-paint": {
    "chemical-lead-paint-removal": "lead-paint-removal-surface-preparation",
    "chemical-lead-paint-stripping": "lead-paint-removal-surface-preparation",
    "heat-gun-lead-paint-removal": "lead-paint-removal-surface-preparation",
    "lead-dust-cleanup-services": "lead-paint-containment-cleanup",
    "lead-hazard-control-consultation": "lead-paint-testing-inspection",
    "lead-paint-abatement-services": "lead-paint-removal-surface-preparation",
    "lead-paint-compliance-inspections": "lead-paint-testing-inspection",
    "lead-paint-encapsulation": "lead-paint-stabilization-encapsulation",
    "lead-paint-encapsulation-services": "lead-paint-stabilization-encapsulation",
    "lead-paint-inspection-services": "lead-paint-testing-inspection",
    "lead-paint-removal-for-historic-homes": "lead-paint-removal-surface-preparation",
    "lead-paint-safety-training-for-homeowners": "lead-paint-testing-inspection",
    "lead-paint-testing-in-portland": "lead-paint-testing-inspection",
    "lead-safety-training-for-homeowners": "lead-paint-testing-inspection",
    "leadbased-paint-disposal-services": "lead-paint-containment-cleanup",
    "leadbased-paint-testing-kits": "lead-paint-testing-inspection",
    "leadsafe-remodeling-consultations": "lead-safe-exterior-renovation",
    "leadsafe-remodeling-services": "lead-safe-exterior-renovation"
  },
  "leak-repair": {
    "bay-window-leak-repair": "bay-window-specialty-window-repairs",
    "door-threshold-leak-repair": "door-frame-leak-rot-repair",
    "leaking-door-frame-repair": "door-frame-leak-rot-repair",
    "leaking-window-repair-and-waterproofing": "window-leak-repair-waterproofing",
    "siding-and-window-integration-repair": "siding-building-envelope-integration",
    "sliding-glass-door-leak-repair": "sliding-glass-door-leak-repair",
    "window-flashing-repair-and-installation": "window-flashing-repair",
    "window-frame-rot-repair-and-replacement": "window-door-frame-rot-repair",
    "window-seal-replacement-and-reglazing": "window-leak-repair-waterproofing",
    "window-sill-leak-repair": "window-leak-repair-waterproofing"
  },
  "siding-repair": {
    "aluminum-siding-repair": "lap-cedar-wood-specialty-siding-repair",
    "custom-siding-solutions": "siding-integration-repairs",
    "emergency-siding-repairs": "siding-rot-repair-replacement",
    "fibercement-siding-installation": "hardie-fiber-cement-siding-repair",
    "siding-installation-for-new-construction": "siding-rot-repair-replacement",
    "siding-maintenance-and-inspection": "siding-rot-repair-replacement",
    "siding-painting-and-finishing": "siding-trim-corner-board-repair",
    "siding-repair-for-storm-damage": "siding-rot-repair-replacement",
    "vinyl-siding-replacement": "lap-cedar-wood-specialty-siding-repair",
    "wood-siding-repair": "lap-cedar-wood-specialty-siding-repair"
  },
  "trim-repair": {
    "corbel-reproduction-services": "corner-boards-decorative-trim",
    "custom-sitemade-moldings": "corner-boards-decorative-trim",
    "custom-trim-molding-installation": "corner-boards-decorative-trim",
    "elliptical-trim-cutting": "corner-boards-decorative-trim",
    "emergency-trim-repair-services": "exterior-trim-rot-repair-replacement",
    "expert-trim-repair-services-in-portland-oregon": "exterior-trim-rot-repair-replacement",
    "exterior-trim-replacement": "exterior-trim-rot-repair-replacement",
    "fascia-board-replacement": "fascia-soffit-roofline-trim",
    "pvc-trim-installation": "trim-by-material-cedar-pvc-fiber-cement",
    "rotten-trim-repair": "exterior-trim-rot-repair-replacement",
    "scarf-joint-restoration": "exterior-trim-rot-repair-replacement",
    "trim-caulking-and-sealing": "siding-flashing-integration-repairs",
    "trim-design-consultation": "corner-boards-decorative-trim",
    "trim-painting-and-finishing": "trim-by-material-cedar-pvc-fiber-cement",
    "trim-removal-and-replacement": "exterior-trim-rot-repair-replacement",
    "trim-restoration-and-refinishing": "exterior-trim-rot-repair-replacement",
    "weatherproofing-for-trim": "siding-flashing-integration-repairs",
    "window-and-door-trim-repair": "window-door-trim-repair"
  },
  "beam-repair": {
    "beam-code-compliance-consultation": "beam-post-connection-repairs",
    "beam-design-consulting": "structural-beam-repair-replacement",
    "beam-inspection-and-assessment": "structural-beam-repair-replacement",
    "beam-replacement-services": "structural-beam-repair-replacement",
    "beam-replacement-solutions": "structural-beam-repair-replacement",
    "beam-shoring-solutions": "floor-interior-structural-support-repair",
    "beam-weatherproofing-services": "deck-porch-exterior-beam-repair",
    "custom-beam-design-and-fabrication": "structural-beam-repair-replacement",
    "custom-beam-fabrication": "structural-beam-repair-replacement",
    "emergency-beam-repair-services": "structural-beam-repair-replacement",
    "foundation-beam-assessment": "footing-foundation-support",
    "ibeam-installation-and-repair-services-in-portland-or": "structural-beam-repair-replacement",
    "ibeam-installation-services": "structural-beam-repair-replacement",
    "loadbearing-beam-reinforcement": "structural-beam-repair-replacement",
    "loadbearing-wall-beam-reinforcement": "structural-beam-repair-replacement",
    "plywood-gusset-installation": "beam-post-connection-repairs",
    "post-and-beam-structural-support": "post-column-repair",
    "restoration-of-exposed-beams": "deck-porch-exterior-beam-repair",
    "shoring-and-support-services": "floor-interior-structural-support-repair"
  }
}
```

**Step 2: Commit**

```bash
git add tools/migration/redirect-map.json
git commit -m "add redirect map: all old service slugs mapped to new cluster slugs"
```

---

## Task 4: Create `apps/siding-repair/src/pages/services/` routes

**Context:** `siding-repair` is the only app in the Excel that is missing a `services/` directory entirely. It needs the route before cluster pages can be served.

**Files:**
- Create: `apps/siding-repair/src/pages/services/index.astro`
- Create: `apps/siding-repair/src/pages/services/[location]/[service].astro`

**Step 1: Check what the index looks like in another app**

Read `apps/deck-repair/src/pages/services/index.astro` for reference.

**Step 2: Create services index**

Copy structure from deck-repair but change config key to `siding-repair`:

```astro
---
import BaseLayout from '@sfw/ui';
import { serviceConfigs } from '@sfw/content';

const config = serviceConfigs['siding-repair'];
---
<BaseLayout title="Siding Repair Services" description="Professional siding repair services in Portland and Seattle." config={config}>
  <section class="py-16">
    <div class="container mx-auto px-4 text-center">
      <h1 class="text-4xl font-heading font-bold mb-4">Siding Repair Services</h1>
      <p class="text-xl text-gray-600">Expert siding repair for Portland and Seattle homeowners.</p>
    </div>
  </section>
</BaseLayout>
```

**Step 3: Create the dynamic service route**

Copy `apps/deck-repair/src/pages/services/[location]/[service].astro` and change:
- Line 24: `serviceConfigs['deck-repair']` → `serviceConfigs['siding-repair']`
- Line 94: `"your deck needs"` → `"your siding needs"`

**Step 4: Verify directory structure**

```bash
ls apps/siding-repair/src/pages/services/
# Expected: index.astro  [location]/
ls apps/siding-repair/src/pages/services/[location]/
# Expected: [service].astro
```

**Step 5: Commit**

```bash
git add apps/siding-repair/src/pages/services/
git commit -m "add missing services route to siding-repair app"
```

---

## Task 5: Create `cluster-services.ts` in each app

Each app needs a data loader that reads `service_page_cluster_*` files and returns `ServicePageData`-compatible objects so the existing `[location]/[service].astro` route can serve stub pages.

**Files:**
- Create: `apps/<site>/src/data/cluster-services.ts` (in all 10 apps)

**Step 1: Write the shared template**

The logic is the same in every app. The only difference is the service config key (e.g., `'deck-repair'`).

Create `apps/deck-repair/src/data/cluster-services.ts` first:

```typescript
/**
 * Cluster service page loader.
 * Reads service_page_cluster_* markdown files and returns stub ServicePageData objects.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type { ServicePageData } from './services';

const SITE_KEY = 'deck-repair'; // Change per app

function parseClusterMeta(content: string): Record<string, string> | null {
  const match = content.match(/<!--\s*CLUSTER_META\s*([\s\S]*?)-->/);
  if (!match) return null;
  const meta: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const [key, ...rest] = line.split(':');
    if (key && rest.length) meta[key.trim()] = rest.join(':').trim();
  }
  return meta;
}

function parseSubtopics(content: string): string[] {
  const match = content.match(/<!--\s*CLUSTER_META[\s\S]*?subtopics:\s*([\s\S]*?)-->/);
  if (!match) return [];
  return match[1]
    .split('\n')
    .filter(l => l.trim().startsWith('- '))
    .map(l => l.replace(/^\s*-\s*/, '').trim());
}

function loadClusterPages(): ServicePageData[] {
  const contentDir = join(process.cwd(), 'src', 'data', 'generated_content');
  const files = readdirSync(contentDir).filter(
    f => f.startsWith('service_page_cluster_') && f.endsWith('.md')
  );

  const pages: ServicePageData[] = [];

  for (const file of files) {
    const content = readFileSync(join(contentDir, file), 'utf-8');
    const meta = parseClusterMeta(content);
    if (!meta) continue;

    const location = meta['location'] as 'portland' | 'seattle';
    const locationFull = location === 'portland' ? 'Portland, Oregon' : 'Seattle, Washington';
    const slug = meta['cluster_slug'];
    const subtopics = parseSubtopics(content);

    // Extract name from first H1
    const nameMatch = content.match(/^#\s+(.+?)\s+-\s+/m);
    const name = nameMatch ? nameMatch[1].trim() : slug;

    pages.push({
      name,
      slug,
      location,
      locationFull,
      heroHeadline: `[STUB] ${name} in ${locationFull}`,
      heroSubheadline: `Professional ${name.toLowerCase()} services in ${locationFull}. Content coming soon.`,
      keyBenefits: subtopics.slice(0, 4),
      sections: {},
      faqs: [],
      metaTitle: `${name} in ${locationFull} | SFW Construction`,
      metaDescription: `Professional ${name.toLowerCase()} services in ${locationFull}. Expert craftsmanship and quality materials.`,
      keywords: [slug, location, SITE_KEY],
      rawMarkdown: content,
      htmlContent: `<h1>${name}</h1><p>Content coming soon.</p>`,
    });
  }

  return pages;
}

export const allClusterServices = loadClusterPages();

export function getClusterService(location: string, slug: string): ServicePageData | undefined {
  return allClusterServices.find(s => s.location === location && s.slug === slug);
}

export function getClusterPaths() {
  return allClusterServices.map(s => ({
    params: { location: s.location, service: s.slug },
  }));
}
```

**Step 2: Copy to remaining 9 apps, changing only SITE_KEY**

| App | SITE_KEY |
|-----|----------|
| chimney-repair | `'chimney-repair'` |
| crawlspace-rot | `'crawlspace-rot'` |
| dry-rot | `'dry-rot'` |
| flashing-repair | `'flashing-repair'` |
| lead-paint | `'lead-paint'` |
| leak-repair | `'leak-repair'` |
| siding-repair | `'siding-repair'` |
| trim-repair | `'trim-repair'` |
| beam-repair | `'beam-repair'` |

Create each file by copying deck-repair's version and changing line 9 (`const SITE_KEY = ...`).

**Step 3: Verify files exist**

```bash
for site in beam-repair chimney-repair crawlspace-rot deck-repair dry-rot flashing-repair lead-paint leak-repair siding-repair trim-repair; do
  [ -f "apps/$site/src/data/cluster-services.ts" ] && echo "$site: OK" || echo "$site: MISSING"
done
```

**Step 4: Commit**

```bash
git add apps/*/src/data/cluster-services.ts
git commit -m "add cluster-services.ts loader to all 10 apps"
```

---

## Task 6: Update `services.ts` and `[location]/[service].astro` in each app

Two changes per app:
1. `services.ts`: skip `service_page_cluster_*` files (they have their own loader)
2. `[location]/[service].astro`: merge cluster paths into `getStaticPaths`, fall back to cluster loader

**Files:**
- Modify: `apps/<site>/src/data/services.ts` in all 10 apps (1 line change each)
- Modify: `apps/<site>/src/pages/services/[location]/[service].astro` in all 10 apps

**Step 1: Update `services.ts` in each app**

In `loadServicePages()`, the existing filter is:
```typescript
if (!file.startsWith('service_page_') || !file.endsWith('.md') || file.includes('.ipynb_checkpoints')) {
```

Change to also skip cluster files:
```typescript
if (!file.startsWith('service_page_') || file.startsWith('service_page_cluster_') || !file.endsWith('.md') || file.includes('.ipynb_checkpoints')) {
```

Apply this change to `services.ts` in all 10 apps.

**Step 2: Update `[location]/[service].astro` in each app**

The frontmatter needs two changes. Current top of frontmatter:
```astro
import { getServicePaths, getService } from '../../../data/services';
...
export async function getStaticPaths() {
  return getServicePaths();
}
const { location, service } = Astro.params;
const serviceData = getService(location as string, service as string);
```

New version (add cluster imports and merge paths):
```astro
import { getServicePaths, getService } from '../../../data/services';
import { getClusterPaths, getClusterService } from '../../../data/cluster-services';
...
export async function getStaticPaths() {
  return [...getServicePaths(), ...getClusterPaths()];
}
const { location, service } = Astro.params;
const serviceData = getService(location as string, service as string)
  ?? getClusterService(location as string, service as string);
```

Apply these changes to all 10 apps. Note: `siding-repair` was just created in Task 4, so it already needs this version from the start.

**Step 3: Build one app to verify**

```bash
cd apps/deck-repair && pnpm build 2>&1 | tail -20
```

Expected: build succeeds, no TypeScript errors. The output should show routes including cluster slugs.

**Step 4: Check a cluster route exists in the build output**

```bash
ls apps/deck-repair/dist/services/portland/ | grep cluster
# or
ls apps/deck-repair/dist/services/portland/ | grep deck-board-repair-replacement
```

**Step 5: Commit**

```bash
git add apps/*/src/data/services.ts apps/*/src/pages/services/
git commit -m "wire cluster loader into all 10 service routes"
```

---

## Task 7: Create and run `tools/migration/apply-redirects.js`

Reads `redirect-map.json` and writes the `redirects` block into each app's `astro.config.mjs`.

**Files:**
- Create: `tools/migration/apply-redirects.js`

**Step 1: Create the script**

```js
#!/usr/bin/env node
/**
 * Reads tools/migration/redirect-map.json and updates each app's astro.config.mjs
 * with a redirects block covering both portland and seattle for each old slug.
 *
 * Safe to re-run — replaces the redirects block each time.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const redirectMap = require('./redirect-map.json');

for (const [site, slugMap] of Object.entries(redirectMap)) {
  const configPath = path.join(ROOT, 'apps', site, 'astro.config.mjs');

  if (!fs.existsSync(configPath)) {
    console.warn(`WARN: ${configPath} not found, skipping`);
    continue;
  }

  const redirectEntries = [];
  for (const [oldSlug, newSlug] of Object.entries(slugMap)) {
    redirectEntries.push(
      `    '/services/portland/${oldSlug}': '/services/portland/${newSlug}',`,
      `    '/services/seattle/${oldSlug}':  '/services/seattle/${newSlug}',`
    );
  }

  const redirectsBlock = `  redirects: {\n${redirectEntries.join('\n')}\n  },`;

  let config = fs.readFileSync(configPath, 'utf-8');

  // Remove existing redirects block if present
  config = config.replace(/\s*redirects:\s*\{[\s\S]*?\},\n?/m, '\n');

  // Insert before closing brace of defineConfig
  config = config.replace(/(\s*output:\s*['"]static['"]\s*\n)(}\))/,
    `$1  ${redirectsBlock.trim()}\n$2`);

  // Fallback: insert before the last });
  if (!config.includes('redirects:')) {
    config = config.replace(/\n\}\);$/, `\n  ${redirectsBlock.trim()}\n});`);
  }

  fs.writeFileSync(configPath, config, 'utf-8');
  console.log(`Updated ${site}/astro.config.mjs (${Object.keys(slugMap).length * 2} redirect entries)`);
}

console.log('\nDone. Run validate-redirects.js to verify coverage.');
```

**Step 2: Run the script**

```bash
node tools/migration/apply-redirects.js
```

Expected output (one line per app):
```
Updated deck-repair/astro.config.mjs (22 redirect entries)
Updated chimney-repair/astro.config.mjs (20 redirect entries)
...
```

**Step 3: Spot-check one config**

```bash
cat apps/deck-repair/astro.config.mjs
```

Verify: `redirects` block with entries like `'/services/portland/deck-board-replacement': '/services/portland/deck-board-repair-replacement'`.

**Step 4: Commit**

```bash
git add apps/*/astro.config.mjs tools/migration/apply-redirects.js
git commit -m "add service page redirects to all 10 astro configs"
```

---

## Task 8: Create and run `tools/migration/validate-redirects.js`

Verifies that every non-cluster `service_page_*.md` file has a corresponding redirect in its app's `astro.config.mjs`.

**Files:**
- Create: `tools/migration/validate-redirects.js`

**Step 1: Create the script**

The same slug derivation logic used in `services.ts` must be replicated here.

```js
#!/usr/bin/env node
/**
 * Validates that every legacy service page slug has a redirect in astro.config.mjs.
 *
 * Slug derivation matches services.ts logic:
 *   filename → remove prefix/suffix → replace _ with space →
 *   replace " and " with " & " → lowercase → spaces to hyphens →
 *   & to "and" → remove non-alphanumeric except hyphen
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const APPS = [
  'beam-repair', 'chimney-repair', 'crawlspace-rot', 'deck-repair',
  'dry-rot', 'flashing-repair', 'lead-paint', 'leak-repair',
  'siding-repair', 'trim-repair'
];
const LOCATIONS = ['portland', 'seattle'];

function deriveSlug(fileName) {
  let name = fileName
    .replace('service_page_', '')
    .replace(/_(portland|seattle)\.md$/, '')
    .replace(/_/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/ and /g, ' & ');

  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9-]/g, '');
}

function extractRedirects(configContent) {
  const match = configContent.match(/redirects:\s*\{([\s\S]*?)\}/);
  if (!match) return new Set();
  const redirects = new Set();
  const lines = match[1].split('\n');
  for (const line of lines) {
    const keyMatch = line.match(/'([^']+)':/);
    if (keyMatch) redirects.add(keyMatch[1]);
  }
  return redirects;
}

let totalErrors = 0;

for (const app of APPS) {
  const contentDir = path.join(ROOT, 'apps', app, 'src', 'data', 'generated_content');
  const configPath = path.join(ROOT, 'apps', app, 'astro.config.mjs');

  if (!fs.existsSync(contentDir)) {
    console.warn(`WARN: no content dir for ${app}`);
    continue;
  }

  const configContent = fs.existsSync(configPath)
    ? fs.readFileSync(configPath, 'utf-8') : '';
  const definedRedirects = extractRedirects(configContent);

  const files = fs.readdirSync(contentDir).filter(
    f => f.startsWith('service_page_') &&
         !f.startsWith('service_page_cluster_') &&
         f.endsWith('.md') &&
         !f.includes('.ipynb_checkpoints')
  );

  const errors = [];

  for (const file of files) {
    const locationMatch = file.match(/_(portland|seattle)\.md$/);
    if (!locationMatch) continue;
    const location = locationMatch[1];
    const slug = deriveSlug(file);
    const oldUrl = `/services/${location}/${slug}`;

    if (!definedRedirects.has(oldUrl)) {
      errors.push(`  MISSING: ${oldUrl}`);
    }
  }

  if (errors.length === 0) {
    console.log(`PASS ${app} (${files.length} legacy pages covered)`);
  } else {
    console.log(`FAIL ${app} — ${errors.length} missing redirects:`);
    errors.forEach(e => console.log(e));
    totalErrors += errors.length;
  }
}

console.log(`\n${totalErrors === 0 ? 'ALL PASS' : `TOTAL ERRORS: ${totalErrors}`}`);
process.exit(totalErrors > 0 ? 1 : 0);
```

**Step 2: Run the validator**

```bash
node tools/migration/validate-redirects.js
```

Expected output:
```
PASS beam-repair (21 legacy pages covered)
PASS chimney-repair (20 legacy pages covered)
PASS crawlspace-rot (20 legacy pages covered)
PASS deck-repair (22 legacy pages covered)
PASS dry-rot (20 legacy pages covered)
PASS flashing-repair (20 legacy pages covered)
PASS lead-paint (20 legacy pages covered)
PASS leak-repair (20 legacy pages covered)
PASS siding-repair (20 legacy pages covered)
PASS trim-repair (21 legacy pages covered)

ALL PASS
```

**Step 3: Fix any failures**

If `FAIL` appears, add the missing slug to `tools/migration/redirect-map.json`, re-run `apply-redirects.js`, then re-run `validate-redirects.js` until all pass.

**Step 4: Commit**

```bash
git add tools/migration/validate-redirects.js
git commit -m "add redirect validation script"
```

---

## Task 9: Create `docs/migration/service-page-redirects.md`

Human-readable redirect reference document.

**Files:**
- Create: `docs/migration/service-page-redirects.md`

**Step 1: Create the directory**

```bash
mkdir -p docs/migration
```

**Step 2: Create the document**

The format is one table per app. Use this template (fill in all 10 apps from `redirect-map.json`):

```markdown
# Service Page Redirects

Migration map from legacy service page URLs to new cluster page URLs.
All redirects are 301 permanent (Astro static output default).

**Source of truth:** `tools/migration/redirect-map.json`
**Applied to:** each app's `astro.config.mjs`
**Validated by:** `node tools/migration/validate-redirects.js`

Old service page files remain in `src/data/generated_content/` as content reference
until cluster stubs are populated with generated content.

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

[Repeat table for each of the remaining 9 apps using redirect-map.json as reference]
```

**Step 3: Commit**

```bash
git add docs/migration/
git commit -m "add service page redirect migration documentation"
```

---

## Task 10: Final verification build

**Step 1: Build all affected apps**

```bash
pnpm build 2>&1 | grep -E "(error|warning|built in)" | head -40
```

If individual app builds are needed:
```bash
for site in beam-repair chimney-repair crawlspace-rot deck-repair dry-rot flashing-repair lead-paint leak-repair siding-repair trim-repair; do
  echo "=== $site ==="
  cd apps/$site && pnpm build 2>&1 | tail -5
  cd ../..
done
```

**Step 2: Run the redirect validator one final time**

```bash
node tools/migration/validate-redirects.js
```

Expected: `ALL PASS`

**Step 3: Verify cluster route count in one build**

```bash
find apps/deck-repair/dist/services -name "index.html" | wc -l
```

Expected: at least 7 (cluster pages per location) + existing legacy pages.

**Step 4: Push**

```bash
./pushall.ps1
```

---

## Summary

| Deliverable | Location |
|-------------|----------|
| Cluster definitions | `tools/content-generator/config/clusters.json` |
| Stub generator script | `tools/content-generator/generate-stubs.js` |
| 126 stub markdown files | `apps/*/src/data/generated_content/service_page_cluster_*.md` |
| Redirect assignments | `tools/migration/redirect-map.json` |
| Redirect applier script | `tools/migration/apply-redirects.js` |
| Redirect validator script | `tools/migration/validate-redirects.js` |
| Cluster data loaders | `apps/*/src/data/cluster-services.ts` |
| Astro redirects | `apps/*/astro.config.mjs` (redirects block) |
| Human-readable redirect doc | `docs/migration/service-page-redirects.md` |
| siding-repair services route | `apps/siding-repair/src/pages/services/` |
