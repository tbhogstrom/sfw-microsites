# @sfw/ui

Shared UI Component Library for SFW Microsites

## Overview

A comprehensive collection of 27 reusable Astro components designed for the SFW microsites monorepo. All components are built with TypeScript, Tailwind CSS, and follow accessibility best practices.

## Installation

This package is part of the SFW monorepo and is automatically available to all apps via npm workspaces.

```bash
# Install dependencies (from monorepo root)
npm install
```

## Usage

### Import Components

```astro
---
// Import layout
import BaseLayout from '@sfw/ui';

// Import specific components
import { Button, HeroSection, ContactForm } from '@sfw/ui';

// Import from specific category
import { ServiceCard, TestimonialCard } from '@sfw/ui/components/content';
import { FormInput, FormButton } from '@sfw/ui/components/forms';

// Import types
import type { ButtonProps, SiteConfig } from '@sfw/ui';
---
```

### Basic Example

```astro
---
import BaseLayout from '@sfw/ui';
import { HeroSection, Button, ContactForm } from '@sfw/ui';
import { serviceConfigs } from '@sfw/content';

const config = serviceConfigs['deck-repair'];
---

<BaseLayout
  title="Deck Repair Services"
  description="Professional deck repair in Seattle"
  config={config}
>
  <HeroSection
    headline="Expert Deck Repair"
    subheadline="Restoring beauty and safety to your outdoor space"
    backgroundImage="/images/hero.jpg"
    primaryCTA={{ text: 'Get Quote', href: '#contact' }}
  />

  <ContactForm config={config} />
</BaseLayout>
```

## Components

### UI Components (6)
- **Button** - Multi-variant button (primary, secondary, outline, ghost)
- **Icon** - SVG icon system (10 icons)
- **Image** - Optimized image wrapper
- **SEO** - Meta tags + structured data
- **Breadcrumbs** - Navigation breadcrumbs
- **LinkCard** - Generic clickable card

### Layout Components (3)
- **Header** - Site header with navigation
- **Footer** - Footer with company info
- **MobileNav** - Mobile hamburger menu

### Form Components (4)
- **FormInput** - Text/email/tel input fields
- **FormTextarea** - Multi-line text input
- **FormButton** - Form submit button
- **ContactForm** - HubSpot form integration

### Hero Components (2)
- **HeroSection** - Hero with background image
- **HeroWithForm** - Hero with embedded form

### Content Components (8)
- **ServiceCard** - Service card with image overlay
- **TestimonialCard** - Customer testimonial display
- **StatsBar** - Statistics display bar
- **CTASection** - Call-to-action section
- **ProcessSteps** - Numbered step display
- **FAQAccordion** - Expandable FAQ
- **ServiceAreas** - Grid of service areas
- **TestimonialSlider** - Swiper.js carousel

### Blog Components (3)
- **BlogCard** - Blog post preview card
- **BlogGrid** - Responsive blog grid
- **BlogPost** - Full blog post layout

### Layouts (1)
- **BaseLayout** - Main page wrapper with SEO, header, footer

## Component Props

### Button

```typescript
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  href?: string;
  icon?: 'phone' | 'email' | 'arrow-right';
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  disabled?: boolean;
}
```

### HeroSection

```typescript
interface HeroSectionProps {
  headline: string;
  subheadline?: string;
  backgroundImage?: string;
  primaryCTA?: { text: string; href: string };
  secondaryCTA?: { text: string; href: string };
  overlay?: boolean;
  height?: 'sm' | 'md' | 'lg' | 'full';
  textAlign?: 'left' | 'center' | 'right';
}
```

### ContactForm

```typescript
interface ContactFormProps {
  config: SiteConfig;
  title?: string;
  description?: string;
  hubspotPortalId?: string;
  hubspotFormId?: string;
  submitText?: string;
}
```

## Design Tokens

Components use design tokens from `@sfw/config`:

- **Primary Color:** `#a1b770` (bg-primary, text-primary)
- **Secondary Color:** `#900` (bg-secondary)
- **Dark:** bg-dark, text-dark
- **Fonts:** Helvetica Neue (heading), Poppins (body)
- **Base Size:** 18px

## Accessibility

All components follow WCAG 2.1 AA standards:

- ✅ Semantic HTML
- ✅ ARIA labels where needed
- ✅ Keyboard navigation
- ✅ Focus indicators
- ✅ Color contrast compliance
- ✅ Screen reader support

## Responsive Design

All components are mobile-first and fully responsive:

- **Mobile:** 375px - 639px
- **Tablet:** 640px - 1023px
- **Desktop:** 1024px+

## TypeScript Support

Full TypeScript support with exported prop types:

```typescript
import type {
  ButtonProps,
  HeroSectionProps,
  ContactFormProps,
  SiteConfig,
  NavigationItem,
  Testimonial,
  FAQ,
} from '@sfw/ui';
```

## Integration

### HubSpot Forms

```astro
<ContactForm
  config={siteConfig}
  hubspotPortalId="your-portal-id"
  hubspotFormId="your-form-id"
/>
```

### Swiper.js Carousel

```astro
<TestimonialSlider
  testimonials={testimonials}
  autoplay={true}
  autoplayDelay={5000}
/>
```

## Testing

View all components in action:

```bash
# Start dev server
npm run dev

# Navigate to test page
# http://localhost:4321/test-components
```

## Dependencies

- `astro` ^5.1.3
- `swiper` ^11.0.0
- `typescript` ^5.7.2
- `@sfw/config` *
- `@sfw/content` *

## License

Proprietary - SFW Microsites Project
