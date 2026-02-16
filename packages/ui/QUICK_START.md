# Quick Start Guide - @sfw/ui

## 1. Basic Page Setup

```astro
---
import BaseLayout from '@sfw/ui';
import { serviceConfigs } from '@sfw/content';

const config = serviceConfigs['your-app-name'];
const navigation = [
  { label: 'Home', url: '/' },
  { label: 'Services', url: '/services' },
  { label: 'About', url: '/about' },
  { label: 'Contact', url: '/contact' },
];
---

<BaseLayout
  title="Page Title"
  description="Page description for SEO"
  config={config}
  navigation={navigation}
>
  <!-- Your content here -->
</BaseLayout>
```

## 2. Common Components

### Hero Section
```astro
import { HeroSection } from '@sfw/ui';

<HeroSection
  headline="Your Main Headline"
  subheadline="Supporting text goes here"
  backgroundImage="/images/hero.jpg"
  primaryCTA={{ text: 'Get Started', href: '/contact' }}
  secondaryCTA={{ text: 'Learn More', href: '/about' }}
/>
```

### Buttons
```astro
import { Button } from '@sfw/ui';

<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="primary" icon="phone">Call Now</Button>
<Button href="/contact" variant="primary">Link Button</Button>
```

### Contact Form
```astro
import { ContactForm } from '@sfw/ui';

<ContactForm
  config={config}
  title="Get Your Free Quote"
  hubspotPortalId="12345"
  hubspotFormId="form-id"
/>
```

### Service Cards
```astro
import { ServiceCard } from '@sfw/ui';

<div class="grid md:grid-cols-3 gap-6">
  <ServiceCard
    title="Service Name"
    description="Brief description"
    image="/images/service.jpg"
    href="/services/service-name"
  />
</div>
```

### Testimonials
```astro
import { TestimonialCard } from '@sfw/ui';

const testimonial = {
  name: 'John Smith',
  location: 'Seattle, WA',
  text: 'Great service!',
  rating: 5
};

<TestimonialCard testimonial={testimonial} />
```

### FAQ Section
```astro
import { FAQAccordion } from '@sfw/ui';

const faqs = [
  {
    question: 'How long does it take?',
    answer: 'Usually 1-2 weeks.'
  }
];

<FAQAccordion title="Frequently Asked Questions" faqs={faqs} />
```

### Stats Bar
```astro
import { StatsBar } from '@sfw/ui';

const stats = [
  { value: '25', suffix: '+', label: 'Years Experience' },
  { value: '500', suffix: '+', label: 'Projects Completed' }
];

<StatsBar stats={stats} variant="primary" />
```

### Call-to-Action
```astro
import { CTASection } from '@sfw/ui';

<CTASection
  headline="Ready to Get Started?"
  description="Contact us today for a free consultation"
  primaryCTA={{ text: 'Get Quote', href: '/contact' }}
  variant="dark"
/>
```

## 3. Import Patterns

```astro
---
// Single default import (BaseLayout)
import BaseLayout from '@sfw/ui';

// Named imports
import { Button, Icon, Image } from '@sfw/ui';

// Multiple components
import {
  HeroSection,
  ContactForm,
  ServiceCard,
  TestimonialCard,
  FAQAccordion,
  CTASection
} from '@sfw/ui';

// Category-specific imports
import { FormInput, FormButton } from '@sfw/ui/components/forms';
import { BlogCard, BlogGrid } from '@sfw/ui/components/blog';

// Import types
import type { SiteConfig, Testimonial, FAQ } from '@sfw/ui';
---
```

## 4. Common Layouts

### Homepage
```astro
<BaseLayout title="Home" description="..." config={config}>
  <HeroSection {...heroProps} />
  <StatsBar stats={stats} />
  <ServiceCards /> <!-- Your grid of ServiceCard -->
  <TestimonialSlider testimonials={testimonials} />
  <FAQAccordion faqs={faqs} />
  <CTASection {...ctaProps} />
</BaseLayout>
```

### Service Page
```astro
<BaseLayout title="Service Name" description="..." config={config}>
  <Breadcrumbs items={[...]} />
  <HeroSection {...heroProps} />
  <ProcessSteps steps={steps} title="Our Process" />
  <ServiceAreas serviceAreas={config.serviceAreas} />
  <ContactForm config={config} />
</BaseLayout>
```

### Blog Index
```astro
<BaseLayout title="Blog" description="..." config={config}>
  <div class="container mx-auto px-4 py-12">
    <h1>Latest Articles</h1>
  </div>
  <BlogGrid posts={posts} columns={3} />
</BaseLayout>
```

### Blog Post
```astro
<BaseLayout title={post.title} description={post.excerpt} config={config}>
  <BlogPost post={post} />
</BaseLayout>
```

## 5. Design Utilities

### Container
```astro
<div class="container mx-auto px-4">
  <!-- Content -->
</div>
```

### Section Spacing
```astro
<section class="py-12 md:py-16">
  <!-- Content -->
</section>
```

### Grid Layouts
```astro
<!-- 2 columns on tablet+ -->
<div class="grid md:grid-cols-2 gap-6">

<!-- 3 columns on desktop -->
<div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">

<!-- 4 columns -->
<div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
```

### Typography
```astro
<h1 class="text-4xl md:text-5xl font-heading font-bold">
<h2 class="text-3xl md:text-4xl font-heading font-bold">
<h3 class="text-2xl font-heading font-bold">
<p class="text-base text-gray-600">
```

### Colors
```astro
bg-primary      <!-- #a1b770 -->
bg-secondary    <!-- #900 -->
bg-dark         <!-- Dark background -->
bg-light        <!-- Light background -->
bg-gray-light   <!-- #f3f1ee -->
text-primary    <!-- Primary color text -->
text-dark       <!-- Dark text -->
```

## 6. Tips

- Always import `config` from `@sfw/content` for site-specific data
- Use `BaseLayout` on every page for consistent SEO and structure
- Test on mobile (375px), tablet (768px), and desktop (1440px)
- Run accessibility checks with Lighthouse (target >90 score)
- Use semantic HTML elements (article, section, nav, etc.)
- Add proper alt text to all images
- Include ARIA labels on icon-only buttons

## 7. Need Help?

- View all components: `/test-components` in any app
- Check component props: `packages/ui/README.md`
- See implementation: `packages/ui/IMPLEMENTATION_SUMMARY.md`
