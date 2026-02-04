# BooGMe Website Polish Checklist

**Purpose**: Comprehensive checklist of remaining items to make the website production-ready  
**Date**: February 2026  
**Status**: Post-messaging cleanup, pre-launch polish

---

## ✅ Completed Items

- [x] Remove specific percentage claims (80-85%, 15-20%)
- [x] Replace with vague "keep more of your earnings" messaging
- [x] Enhance logo visibility (h-8 → h-10, add drop shadow)
- [x] Implement 20-question AI-powered coach matching assessment
- [x] Remove puzzle demo from homepage
- [x] Create dedicated /coaches landing page with earnings calculator
- [x] Remove Chess.com fee comparison claims
- [x] Implement Palantir-inspired minimalist design
- [x] Add waitlist functionality with email capture
- [x] Create payment protection section with escrow explanation

---

## 🎨 Visual & Design Polish

### Typography & Readability
- [ ] **Audit font weights across all pages** - Ensure consistent use of font-thin (100), font-light (300), font-normal (400)
- [ ] **Check line height consistency** - All body text should use `leading-relaxed` (1.625)
- [ ] **Verify heading hierarchy** - h1 (5xl-7xl), h2 (5xl-6xl), h3 (xl-2xl) consistent across pages
- [ ] **Mobile typography scaling** - Test all text sizes on mobile (320px-768px widths)

### Spacing & Layout
- [ ] **Audit section padding** - Ensure consistent use of `section` and `section-sm` classes
- [ ] **Check container max-widths** - Verify `max-w-4xl` for content, `max-w-2xl` for forms
- [ ] **Mobile spacing** - Test all sections on mobile for proper gap-4/gap-6/gap-8 usage
- [ ] **Button spacing** - Ensure consistent padding (size="lg" for primary CTAs)

### Color & Contrast
- [ ] **Verify WCAG AA compliance** - All text must meet 4.5:1 contrast ratio
- [ ] **Check muted-foreground readability** - Ensure secondary text is readable on dark backgrounds
- [ ] **Test accent color usage** - Primary color (#8B4513 terracotta) used sparingly for emphasis
- [ ] **Border opacity consistency** - All borders should use `border-border` or `border-border/50`

### Animations & Interactions
- [ ] **Test all hover states** - Buttons, links, cards should have smooth transitions
- [ ] **Verify motion.div animations** - fadeIn, staggerContainer work on all viewports
- [ ] **Mobile touch targets** - All clickable elements minimum 44x44px
- [ ] **Loading states** - Ensure all mutations show loading spinners (Loader2 component)

---

## 📝 Content & Copywriting

### Messaging Consistency
- [x] Remove all specific percentage claims
- [ ] **Audit "minimal platform fees" usage** - Ensure consistent across all pages
- [ ] **Check coach value proposition** - "Keep more of your earnings" vs "Keep more of what you earn"
- [ ] **Verify payment protection messaging** - Consistent escrow explanation across pages
- [ ] **Student vs coach messaging** - Ensure clear separation of value props

### Call-to-Action (CTA) Optimization
- [ ] **Primary CTA consistency** - "Find Your Coach" (students) vs "Apply as Coach" (coaches)
- [ ] **CTA button text** - Ensure action-oriented ("Find Your Coach" not "Learn More")
- [ ] **Urgency messaging** - "Limited spots for founding members" placement and consistency
- [ ] **Waitlist CTA** - Clear value prop before email capture form

### Microcopy & Error States
- [ ] **Form validation messages** - Friendly, helpful error messages for email input
- [ ] **Toast notifications** - Success/error messages for waitlist join, assessment submission
- [ ] **Empty states** - Placeholder text for forms, loading states
- [ ] **404 page** - Ensure NotFound page has clear navigation back to home

---

## 🔧 Functionality & UX

### Navigation & Routing
- [ ] **Test all internal links** - Home, /coaches, #features, #waitlist anchors
- [ ] **Mobile menu** - Verify hamburger menu opens/closes smoothly
- [ ] **Smooth scrolling** - All anchor links use smooth scroll behavior
- [ ] **Logo click** - Ensure logo links back to homepage from all pages

### Forms & Inputs
- [ ] **Email validation** - Test with invalid emails (missing @, .com, etc.)
- [ ] **Form submission states** - Loading, success, error states for waitlist
- [ ] **Assessment form** - Test all 20 questions, progress tracking, AI analysis animation
- [ ] **Earnings calculator** - Test with various inputs (students, rate, hours)

### Modals & Overlays
- [ ] **Assessment modal** - Test open/close, escape key, click outside to close
- [ ] **Mobile menu overlay** - Ensure proper z-index, no scroll when open
- [ ] **Modal accessibility** - Focus trap, keyboard navigation (Tab, Escape)

### Performance
- [ ] **Image optimization** - Compress logo.png, hero images (use WebP if possible)
- [ ] **Font loading** - Ensure fonts load without FOUT (Flash of Unstyled Text)
- [ ] **Animation performance** - Test on low-end devices, reduce motion if needed
- [ ] **Bundle size** - Check if any unused dependencies can be removed

---

## 📱 Responsive Design

### Mobile (320px - 768px)
- [ ] **Navigation** - Hamburger menu works, all links accessible
- [ ] **Hero section** - Text readable, CTA buttons stack vertically
- [ ] **Features grid** - 3-column grid collapses to 1 column
- [ ] **Forms** - Email input + button stack on small screens
- [ ] **Assessment modal** - Full-screen on mobile, scrollable content
- [ ] **Earnings calculator** - Sliders work on touch devices

### Tablet (768px - 1024px)
- [ ] **Navigation** - Desktop nav shows at md: breakpoint
- [ ] **Features grid** - 3-column grid maintained
- [ ] **Two-column layouts** - Benefits, protection features display correctly
- [ ] **Spacing** - Adequate padding/margins between sections

### Desktop (1024px+)
- [ ] **Max-width containers** - Content doesn't stretch too wide (max-w-7xl)
- [ ] **Hover states** - All interactive elements have hover effects
- [ ] **Large screen optimization** - Text doesn't become too large on 4K displays

---

## ♿ Accessibility

### Keyboard Navigation
- [ ] **Tab order** - Logical tab order through all interactive elements
- [ ] **Focus indicators** - Visible focus rings on all focusable elements
- [ ] **Skip to content** - Add skip link for keyboard users
- [ ] **Modal focus trap** - Focus stays within modal when open

### Screen Readers
- [ ] **Alt text** - All images have descriptive alt attributes
- [ ] **ARIA labels** - Buttons with icons have aria-label attributes
- [ ] **Semantic HTML** - Proper use of nav, section, article, aside tags
- [ ] **Form labels** - All inputs have associated labels (even if visually hidden)

### Color & Contrast
- [ ] **WCAG AA compliance** - 4.5:1 contrast for normal text, 3:1 for large text
- [ ] **Color-blind friendly** - Don't rely solely on color to convey information
- [ ] **Focus indicators** - High contrast focus rings (not just outline: none)

---

## 🔒 Security & Privacy

### Forms & Data
- [ ] **Email validation** - Server-side validation in addition to client-side
- [ ] **CSRF protection** - Ensure tRPC mutations are protected
- [ ] **Rate limiting** - Prevent spam submissions to waitlist form
- [ ] **Data sanitization** - User inputs sanitized before database storage

### Third-Party Services
- [ ] **Stripe integration** - Test Stripe Connect onboarding flow (sandbox mode)
- [ ] **Analytics** - Verify analytics tracking works (if implemented)
- [ ] **External links** - All external links use rel="noopener noreferrer"

---

## 📄 Legal & Compliance

### Required Pages
- [ ] **Privacy Policy** - Create /privacy page with data collection disclosure
- [ ] **Terms of Service** - Create /terms page with platform rules
- [ ] **Refund Policy** - Document 48-hour refund window, escrow process
- [ ] **Cookie Policy** - If using cookies, add cookie banner and policy

### Footer Links
- [ ] **Add footer component** - Include Privacy, Terms, Contact links
- [ ] **Copyright notice** - © 2026 BooGMe. All rights reserved.
- [ ] **Social media links** - Placeholder for future social accounts

---

## 🚀 Pre-Launch Technical

### SEO & Meta Tags
- [ ] **Title tags** - Unique, descriptive titles for each page (< 60 chars)
- [ ] **Meta descriptions** - Compelling descriptions for each page (< 160 chars)
- [ ] **Open Graph tags** - og:title, og:description, og:image for social sharing
- [ ] **Twitter Card tags** - twitter:card, twitter:title, twitter:description
- [ ] **Canonical URLs** - Add canonical tags to prevent duplicate content

### Favicon & Icons
- [x] **Favicon.ico** - 16x16, 32x32, 48x48 sizes
- [ ] **Apple touch icon** - 180x180 for iOS home screen
- [ ] **Android icons** - 192x192, 512x512 for PWA manifest
- [ ] **Manifest.json** - PWA manifest for installable web app

### Analytics & Tracking
- [ ] **Google Analytics** - Set up GA4 tracking (if desired)
- [ ] **Event tracking** - Track waitlist signups, assessment completions, CTA clicks
- [ ] **Conversion tracking** - Track coach applications, student signups
- [ ] **Error tracking** - Set up Sentry or similar for error monitoring

### Performance Optimization
- [ ] **Lighthouse audit** - Run Lighthouse, aim for 90+ scores
- [ ] **Core Web Vitals** - LCP < 2.5s, FID < 100ms, CLS < 0.1
- [ ] **Image lazy loading** - Add loading="lazy" to below-fold images
- [ ] **Code splitting** - Ensure React.lazy() used for large components

---

## 🧪 Testing

### Cross-Browser Testing
- [ ] **Chrome/Edge** - Test on latest Chrome and Edge
- [ ] **Firefox** - Test on latest Firefox
- [ ] **Safari** - Test on Safari (macOS and iOS)
- [ ] **Mobile browsers** - Test on Chrome Mobile, Safari iOS

### Device Testing
- [ ] **iPhone** - Test on iPhone SE, iPhone 14 Pro
- [ ] **Android** - Test on Pixel, Samsung Galaxy
- [ ] **Tablet** - Test on iPad, Android tablet
- [ ] **Desktop** - Test on 1920x1080, 2560x1440, 4K displays

### Functionality Testing
- [ ] **Waitlist flow** - Submit email, verify toast notification, check database
- [ ] **Assessment flow** - Complete all 20 questions, verify AI analysis, check results
- [ ] **Navigation** - Test all links, anchors, mobile menu
- [ ] **Forms** - Test validation, error states, success states
- [ ] **Earnings calculator** - Test with various inputs, verify calculations

---

## 📊 Content Additions (Nice-to-Have)

### Social Proof
- [ ] **Testimonials section** - Add 2-3 beta coach/student testimonials (when available)
- [ ] **Coach profiles** - Showcase 3-5 founding coaches with photos, bios, credentials
- [ ] **Trust badges** - Payment security, Stripe partnership, data encryption icons

### Educational Content
- [ ] **FAQ section** - Add comprehensive FAQ for students and coaches
- [ ] **How It Works** - Step-by-step visual guide for booking lessons
- [ ] **Blog/Resources** - Consider adding blog for SEO and thought leadership

### Engagement Features
- [ ] **Live chat widget** - Add Intercom/Crisp for immediate support
- [ ] **Referral program** - "Refer a friend" CTA with incentive
- [ ] **Email capture incentive** - Offer free chess resources for waitlist signup

---

## 🎯 Priority Recommendations

### High Priority (Must-Have Before Launch)
1. **WCAG AA compliance** - Ensure accessibility for all users
2. **Privacy Policy & Terms** - Legal requirement for data collection
3. **Mobile responsiveness** - 60%+ of traffic will be mobile
4. **Form validation** - Prevent spam and bad data
5. **Cross-browser testing** - Ensure works on all major browsers

### Medium Priority (Should-Have for Soft Launch)
1. **SEO meta tags** - Improve discoverability
2. **Analytics tracking** - Understand user behavior
3. **Footer with legal links** - Professional appearance
4. **FAQ section** - Reduce support burden
5. **Performance optimization** - Improve user experience

### Low Priority (Nice-to-Have for Full Launch)
1. **Testimonials** - Add as you get beta users
2. **Blog/Resources** - Long-term SEO strategy
3. **Live chat** - Add when you have support capacity
4. **PWA features** - Installable web app
5. **Advanced analytics** - Heatmaps, session recordings

---

## Next Steps

1. **Complete High Priority items** (estimated 2-3 days)
2. **Run comprehensive testing** (estimated 1 day)
3. **Fix critical bugs** (estimated 1-2 days)
4. **Complete Medium Priority items** (estimated 2-3 days)
5. **Final QA pass** (estimated 1 day)
6. **Soft launch to C-Squared audience** (target: 5-10 beta coaches)
7. **Iterate based on feedback** (ongoing)
8. **Full public launch** (after 30-60 days of beta)

**Estimated time to production-ready**: 7-12 days of focused work
