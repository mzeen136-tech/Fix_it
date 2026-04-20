# UI/UX Pro Max - Design Intelligence

Comprehensive design guide for web and mobile applications. Contains 50+ styles, 161 color palettes, 57 font pairings, 161 product types with reasoning rules, 99 UX guidelines, and 25 chart types across 10 technology stacks. Searchable database with priority-based recommendations.

## When to Apply

This Skill should be used when the task involves **UI structure, visual design decisions, interaction patterns, or user experience quality control**.

### Must Use

- Designing new pages (Landing Page, Dashboard, Admin, SaaS, Mobile App)
- Creating or refactoring UI components (buttons, modals, forms, tables, charts, etc.)
- Choosing color schemes, typography systems, spacing standards, or layout systems
- Reviewing UI code for user experience, accessibility, or visual consistency
- Implementing navigation structures, animations, or responsive behavior
- Making product-level design decisions (style, information hierarchy, brand expression)
- Improving perceived quality, clarity, or usability of interfaces

### Recommended

- UI looks "not professional enough" but the reason is unclear
- Receiving feedback on usability or experience
- Pre-launch UI quality optimization
- Aligning cross-platform design (Web / iOS / Android)
- Building design systems or reusable component libraries

### Skip

- Pure backend logic development
- Only involving API or database design
- Performance optimization unrelated to the interface
- Infrastructure or DevOps work
- Non-visual scripts or automation tasks

**Decision criteria**: If the task will change how a feature **looks, feels, moves, or is interacted with**, this Skill should be used.

## Rule Categories by Priority

| Priority | Category | Impact | Domain | Key Checks | Anti-Patterns |
|----------|----------|--------|--------|------------|---------------|
| 1 | Accessibility | CRITICAL | `ux` | Contrast 4.5:1, Alt text, Keyboard nav, Aria-labels | Removing focus rings, Icon-only buttons without labels |
| 2 | Touch & Interaction | CRITICAL | `ux` | Min size 44×44px, 8px+ spacing, Loading feedback | Reliance on hover only, Instant state changes (0ms) |
| 3 | Performance | HIGH | `ux` | WebP/AVIF, Lazy loading, Reserve space (CLS < 0.1) | Layout thrashing, Cumulative Layout Shift |
| 4 | Style Selection | HIGH | `style`, `product` | Match product type, Consistency, SVG icons | Mixing flat & skeuomorphic randomly, Emoji as icons |
| 5 | Layout & Responsive | HIGH | `ux` | Mobile-first breakpoints, Viewport meta, No horizontal scroll | Horizontal scroll, Fixed px container widths, Disable zoom |
| 6 | Typography & Color | MEDIUM | `typography`, `color` | Base 16px, Line-height 1.5, Semantic color tokens | Text < 12px body, Gray-on-gray, Raw hex in components |
| 7 | Animation | MEDIUM | `ux` | Duration 150–300ms, Motion conveys meaning, Spatial continuity | Decorative-only animation, Animating width/height |
| 8 | Forms & Feedback | MEDIUM | `ux` | Visible labels, Error near field, Helper text, Progressive disclosure | Placeholder-only label, Errors only at top |
| 9 | Navigation Patterns | HIGH | `ux` | Predictable back, Bottom nav ≤5, Deep linking | Overloaded nav, Broken back behavior, No deep links |
| 10 | Charts & Data | LOW | `chart` | Legends, Tooltips, Accessible colors | Relying on color alone to convey meaning |

## Quick Reference

### 1. Accessibility (CRITICAL)

- `color-contrast` - Minimum 4.5:1 ratio for normal text (large text 3:1)
- `focus-states` - Visible focus rings on interactive elements (2–4px)
- `alt-text` - Descriptive alt text for meaningful images
- `aria-labels` - aria-label for icon-only buttons
- `keyboard-nav` - Tab order matches visual order; full keyboard support
- `form-labels` - Use label with for attribute
- `skip-links` - Skip to main content for keyboard users
- `heading-hierarchy` - Sequential h1→h6, no level skip
- `color-not-only` - Don't convey info by color alone (add icon/text)
- `dynamic-type` - Support system text scaling
- `reduced-motion` - Respect prefers-reduced-motion
- `voiceover-sr` - Meaningful accessibilityLabel/accessibilityHint
- `escape-routes` - Provide cancel/back in modals and multi-step flows
- `keyboard-shortcuts` - Preserve system and a11y shortcuts

### 2. Touch & Interaction (CRITICAL)

- `touch-target-size` - Min 44×44pt (Apple) / 48×48dp (Material)
- `touch-spacing` - Minimum 8px/8dp gap between touch targets
- `hover-vs-tap` - Use click/tap for primary interactions; don't rely on hover alone
- `loading-buttons` - Disable button during async operations; show spinner
- `error-feedback` - Clear error messages near problem
- `cursor-pointer` - Add cursor-pointer to clickable elements (Web)
- `gesture-conflicts` - Avoid horizontal swipe on main content
- `tap-delay` - Use touch-action: manipulation to reduce 300ms delay
- `standard-gestures` - Use platform standard gestures consistently
- `system-gestures` - Don't block system gestures
- `press-feedback` - Visual feedback on press (ripple/highlight)
- `haptic-feedback` - Use haptic for confirmations; avoid overuse
- `gesture-alternative` - Provide visible controls for critical actions
- `safe-area-awareness` - Keep touch targets away from notch, gesture bar
- `no-precision-required` - Avoid requiring pixel-perfect taps
- `swipe-clarity` - Swipe actions must show clear affordance
- `drag-threshold` - Use movement threshold before starting drag

### 3. Performance (HIGH)

- `image-optimization` - Use WebP/AVIF, responsive images, lazy load
- `image-dimension` - Declare width/height to prevent layout shift
- `font-loading` - Use font-display: swap/optional
- `font-preload` - Preload only critical fonts
- `critical-css` - Prioritize above-the-fold CSS
- `lazy-loading` - Lazy load non-hero components
- `bundle-splitting` - Split code by route/feature
- `third-party-scripts` - Load async/defer; audit unnecessary ones
- `reduce-reflows` - Avoid frequent layout reads/writes
- `content-jumping` - Reserve space for async content
- `lazy-load-below-fold` - Use loading="lazy" for below-fold images
- `virtualize-lists` - Virtualize lists with 50+ items
- `main-thread-budget` - Keep per-frame work under ~16ms for 60fps
- `progressive-loading` - Use skeleton screens for >1s operations
- `input-latency` - Keep input latency under ~100ms
- `tap-feedback-speed` - Provide visual feedback within 100ms
- `debounce-throttle` - Use for high-frequency events
- `offline-support` - Provide offline state messaging
- `network-fallback` - Offer degraded modes for slow networks

### 4. Style Selection (HIGH)

- `style-match` - Match style to product type
- `consistency` - Use same style across all pages
- `no-emoji-icons` - Use SVG icons, not emojis
- `color-palette-from-product` - Choose palette from product/industry
- `effects-match-style` - Shadows, blur, radius aligned with style
- `platform-adaptive` - Respect platform idioms (iOS HIG vs Material)
- `state-clarity` - Make hover/pressed/disabled states visually distinct
- `elevation-consistent` - Use consistent elevation/shadow scale
- `dark-mode-pairing` - Design light/dark variants together
- `icon-style-consistent` - Use one icon set/visual language
- `system-controls` - Prefer native/system controls
- `blur-purpose` - Use blur to indicate background dismissal
- `primary-action` - One primary CTA per screen

### 5. Layout & Responsive (HIGH)

- `viewport-meta` - width=device-width initial-scale=1
- `mobile-first` - Design mobile-first, then scale up
- `breakpoint-consistency` - Use systematic breakpoints
- `readable-font-size` - Minimum 16px body text on mobile
- `line-length-control` - Mobile 35–60 chars; desktop 60–75 chars
- `horizontal-scroll` - No horizontal scroll on mobile
- `spacing-scale` - Use 4pt/8dp incremental spacing system
- `touch-density` - Keep component spacing comfortable for touch
- `container-width` - Consistent max-width on desktop
- `z-index-management` - Define layered z-index scale
- `fixed-element-offset` - Reserve safe padding for fixed elements
- `scroll-behavior` - Avoid nested scroll regions
- `viewport-units` - Prefer min-h-dvh over 100vh on mobile
- `orientation-support` - Keep layout readable in landscape
- `content-priority` - Show core content first on mobile
- `visual-hierarchy` - Establish hierarchy via size, spacing, contrast

### 6. Typography & Color (MEDIUM)

- `line-height` - Use 1.5-1.75 for body text
- `line-length` - Limit to 65-75 characters per line
- `font-pairing` - Match heading/body font personalities
- `font-scale` - Consistent type scale (e.g. 12 14 16 18 24 32)
- `contrast-readability` - Darker text on light backgrounds
- `text-styles-system` - Use platform type system
- `weight-hierarchy` - Bold headings (600–700), Regular body (400)
- `color-semantic` - Define semantic color tokens, not raw hex
- `color-dark-mode` - Dark mode uses desaturated variants
- `color-accessible-pairs` - Foreground/background 4.5:1 (AA) or 7:1 (AAA)
- `color-not-decorative-only` - Functional color must include icon/text
- `truncation-strategy` - Prefer wrapping over truncation
- `letter-spacing` - Respect default letter-spacing per platform
- `number-tabular` - Use tabular figures for data columns
- `whitespace-balance` - Use whitespace intentionally

### 7. Animation (MEDIUM)

- `duration-timing` - 150–300ms for micro-interactions; ≤400ms complex
- `transform-performance` - Use transform/opacity only
- `loading-states` - Show skeleton when loading exceeds 300ms
- `excessive-motion` - Animate 1-2 key elements per view max
- `easing` - Use ease-out for entering, ease-in for exiting
- `motion-meaning` - Every animation must express cause-effect
- `state-transition` - State changes should animate smoothly
- `continuity` - Maintain spatial continuity between screens
- `parallax-subtle` - Use parallax sparingly
- `spring-physics` - Prefer spring-based curves
- `exit-faster-than-enter` - Exit animations ~60–70% of enter duration
- `stagger-sequence` - Stagger list items by 30–50ms
- `shared-element-transition` - Use shared element transitions
- `interruptible` - Animations must be interruptible
- `no-blocking-animation` - Never block user input during animation
- `fade-crossfade` - Use crossfade for content replacement
- `scale-feedback` - Subtle scale (0.95–1.05) on press
- `gesture-feedback` - Drag/swipe must provide real-time response
- `hierarchy-motion` - Use direction to express hierarchy
- `motion-consistency` - Unify duration/easing tokens globally
- `opacity-threshold` - Don't linger below opacity 0.2
- `modal-motion` - Modals animate from trigger source
- `navigation-direction` - Forward: left/up; Backward: right/down
- `layout-shift-avoid` - Use transform for position changes

### 8. Forms & Feedback (MEDIUM)

- `input-labels` - Visible label per input (not placeholder-only)
- `error-placement` - Show error below the related field
- `submit-feedback` - Loading then success/error state on submit
- `required-indicators` - Mark required fields
- `empty-states` - Helpful message and action when no content
- `toast-dismiss` - Auto-dismiss toasts in 3-5s
- `confirmation-dialogs` - Confirm before destructive actions
- `input-helper-text` - Provide persistent helper text
- `disabled-states` - Reduced opacity + cursor change + semantic attribute
- `progressive-disclosure` - Reveal complex options progressively
- `inline-validation` - Validate on blur, not keystroke
- `input-type-keyboard` - Use semantic input types for mobile keyboard
- `password-toggle` - Provide show/hide toggle
- `autofill-support` - Use autocomplete attributes
- `undo-support` - Allow undo for destructive actions
- `success-feedback` - Confirm completed actions
- `error-recovery` - Error messages must include recovery path
- `multi-step-progress` - Show step indicator for multi-step flows
- `form-autosave` - Long forms should auto-save drafts
- `sheet-dismiss-confirm` - Confirm before dismissing with unsaved changes
- `error-clarity` - State cause + how to fix
- `field-grouping` - Group related fields logically
- `read-only-distinction` - Read-only different from disabled
- `focus-management` - Auto-focus first invalid field after error
- `error-summary` - Show summary at top with anchor links
- `touch-friendly-input` - Mobile input height ≥44px
- `destructive-emphasis` - Destructive actions use danger color
- `toast-accessibility` - Toasts must not steal focus
- `aria-live-errors` - Form errors use aria-live region
- `contrast-feedback` - Error/success colors meet 4.5:1 contrast
- `timeout-feedback` - Request timeout shows feedback with retry

### 9. Navigation Patterns (HIGH)

- `bottom-nav-limit` - Bottom navigation max 5 items with labels
- `drawer-usage` - Use drawer for secondary navigation
- `back-behavior` - Back navigation must be predictable
- `deep-linking` - All key screens reachable via deep link
- `tab-bar-ios` - iOS: use bottom Tab Bar for top-level navigation
- `top-app-bar-android` - Android: Top App Bar for primary structure
- `nav-label-icon` - Navigation items must have icon and text
- `nav-state-active` - Current location visually highlighted
- `nav-hierarchy` - Primary vs secondary nav clearly separated
- `modal-escape` - Modals must offer clear close affordance
- `search-accessible` - Search easily reachable
- `breadcrumb-web` - Use breadcrumbs for 3+ level hierarchies
- `state-preservation` - Navigating back restores scroll/state
- `gesture-nav-support` - Support system gesture navigation
- `tab-badge` - Use badges sparingly for unread/pending
- `overflow-menu` - Use overflow menu when actions exceed space
- `bottom-nav-top-level` - Bottom nav for top-level screens only
- `adaptive-navigation` - Large screens: sidebar; Small: bottom/top nav
- `back-stack-integrity` - Never silently reset navigation stack
- `navigation-consistency` - Navigation placement stays same across pages
- `avoid-mixed-patterns` - Don't mix Tab + Sidebar + Bottom Nav
- `modal-vs-navigation` - Modals not for primary navigation flows
- `focus-on-route-change` - Move focus to main content after transition
- `persistent-nav` - Core navigation reachable from deep pages
- `destructive-nav-separation` - Dangerous actions separated from nav
- `empty-nav-state` - Explain why nav destination unavailable

### 10. Charts & Data (LOW)

- `chart-type` - Match chart type to data type
- `color-guidance` - Use accessible palettes; avoid red/green only
- `data-table` - Provide table alternative for accessibility
- `pattern-texture` - Supplement color with patterns/shapes
- `legend-visible` - Always show legend near chart
- `tooltip-on-interact` - Provide tooltips on hover/tap
- `axis-labels` - Label axes with units and readable scale
- `responsive-chart` - Charts reflow on small screens
- `empty-data-state` - Show meaningful empty state
- `loading-chart` - Use skeleton while data loads
- `animation-optional` - Respect prefers-reduced-motion
- `large-dataset` - Aggregate or sample 1000+ data points
- `number-formatting` - Use locale-aware formatting
- `touch-target-chart` - Interactive elements ≥44pt tap area
- `no-pie-overuse` - Avoid pie for >5 categories
- `contrast-data` - Data vs background ≥3:1; labels ≥4.5:1
- `legend-interactive` - Legends clickable to toggle series
- `direct-labeling` - Label values directly for small datasets
- `tooltip-keyboard` - Tooltip content keyboard-reachable
- `sortable-table` - Tables support sorting with aria-sort
- `axis-readability` - Axis ticks maintain readable spacing
- `data-density` - Limit information density per chart
- `trend-emphasis` - Emphasize data over decoration
- `gridline-subtle` - Grid lines low-contrast
- `focusable-elements` - Interactive elements keyboard-navigable
- `screen-reader-summary` - Provide text summary for screen readers
- `error-state-chart` - Data failure shows error with retry
- `export-option` - Offer CSV/image export
- `drill-down-consistency` - Maintain clear back-path
- `time-scale-clarity` - Clearly label time granularity

## How to Use

### Prerequisites

Check if Python is installed:
```bash
python3 --version || python --version
```

If not installed:
- **macOS:** `brew install python3`
- **Ubuntu/Debian:** `sudo apt update && sudo apt install python3`
- **Windows:** `winget install Python.Python.3.12`

### Workflow

**Step 1: Analyze User Requirements**
- Product type, Target audience, Style keywords, Stack

**Step 2: Generate Design System (REQUIRED)**
```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<product_type> <industry> <keywords>" --design-system [-p "Project Name"]
```

**Step 2b: Persist Design System**
```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system --persist -p "Project Name"
```
Creates `design-system/MASTER.md` and optional `design-system/pages/<page>.md`

**Step 3: Supplement with Detailed Searches**
```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<keyword>" --domain <domain> [-n <max_results>]
```

**Step 4: Stack Guidelines**
```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<keyword>" --stack react-native
```

### Available Domains

| Domain | Use For |
|--------|---------|
| `product` | Product type recommendations |
| `style` | UI styles, colors, effects |
| `typography` | Font pairings, Google Fonts |
| `color` | Color palettes by product type |
| `landing` | Page structure, CTA strategies |
| `chart` | Chart types, library recommendations |
| `ux` | Best practices, anti-patterns |
| `google-fonts` | Individual Google Fonts lookup |
| `react` | React/Next.js performance |
| `web` | App interface guidelines |
| `prompt` | AI prompts, CSS keywords |

### Available Stacks

| Stack | Focus |
|-------|-------|
| `react-native` | Components, Navigation, Lists |

### Output Formats

```bash
# ASCII box (default)
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "fintech crypto" --design-system

# Markdown
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "fintech crypto" --design-system -f markdown
```

## Common Rules for Professional UI

### Icons & Visual Elements

| Rule | Standard | Avoid |
|------|----------|-------|
| No Emoji as Structural Icons | Use vector-based icons | Using emojis for navigation/settings |
| Vector-Only Assets | Use SVG or platform vector icons | Raster PNG icons |
| Stable Interaction States | Color/opacity/elevation transitions | Layout-shifting transforms |
| Correct Brand Logos | Official brand assets | Guessing logo paths |
| Consistent Icon Sizing | Design tokens (icon-sm, icon-md, icon-lg) | Arbitrary values |
| Stroke Consistency | Consistent stroke width per layer | Mixing thick/thin arbitrarily |
| Filled vs Outline Discipline | One style per hierarchy level | Mixing filled and outline |
| Touch Target Minimum | 44×44pt (use hitSlop if smaller) | Small icons without expanded tap area |
| Icon Alignment | Align to text baseline | Misaligned icons |
| Icon Contrast | WCAG: 4.5:1 small, 3:1 large | Low-contrast icons |

### Interaction (App)

| Rule | Do | Don't |
|------|----|-----|
| Tap feedback | Clear pressed feedback within 80-150ms | No visual response |
| Animation timing | 150-300ms with native easing | Instant or >500ms |
| Accessibility focus | Focus order matches visual order | Unlabeled controls |
| Disabled state clarity | Semantic disabled props, reduced emphasis | Look tappable but do nothing |
| Touch target minimum | ≥44x44pt iOS, ≥48x48dp Android | Tiny tap targets |
| Gesture conflict prevention | One primary gesture per region | Overlapping gestures |
| Semantic native controls | Native primitives with proper roles | Generic containers as controls |

### Light/Dark Mode Contrast

| Rule | Do | Don't |
|------|----|-----|
| Surface readability (light) | Clear separation with opacity/elevation | Overly transparent surfaces |
| Text contrast (light) | Body text ≥4.5:1 | Low-contrast gray |
| Text contrast (dark) | Primary ≥4.5:1, secondary ≥3:1 | Text blending into background |
| Border visibility | Visible in both themes | Theme-specific disappearing borders |
| State contrast parity | Equally distinguishable in both themes | One theme only |
| Token-driven theming | Semantic color tokens | Hardcoded hex values |
| Scrim legibility | 40-60% black for modals | Weak scrim |

### Layout & Spacing

| Rule | Do | Don't |
|------|----|-----|
| Safe-area compliance | Respect top/bottom safe areas | Content under notch/gesture area |
| System bar clearance | Spacing for status/navigation bars | Content colliding with OS chrome |
| Consistent content width | Predictable width per device class | Arbitrary widths |
| 8dp spacing rhythm | Consistent 4/8dp system | Random increments |
| Readable text measure | Avoid edge-to-edge on tablets | Full-width long text |
| Section spacing hierarchy | Clear vertical rhythm tiers | Inconsistent spacing |
| Adaptive gutters | Increase insets on larger widths | Same gutter everywhere |
| Scroll/fixed coexistence | Bottom/top content insets | Content hidden behind bars |

## Pre-Delivery Checklist

### Visual Quality
- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon family/style
- [ ] Official brand assets with correct proportions
- [ ] Pressed-state visuals don't shift layout
- [ ] Semantic-theme tokens used consistently

### Interaction
- [ ] All tappable elements provide pressed feedback
- [ ] Touch targets meet minimum size
- [ ] Micro-interactions 150-300ms with native easing
- [ ] Disabled states visually clear and non-interactive
- [ ] Screen reader focus order matches visual order
- [ ] Gesture regions avoid nested/conflicting interactions

### Light/Dark Mode
- [ ] Primary text contrast ≥4.5:1 in both modes
- [ ] Secondary text contrast ≥3:1 in both modes
- [ ] Dividers/borders distinguishable in both modes
- [ ] Modal/drawer scrim 40-60% black
- [ ] Both themes tested before delivery

### Layout
- [ ] Safe areas respected for headers, tab bars, CTA bars
- [ ] Scroll content not hidden behind fixed/sticky bars
- [ ] Verified on small phone, large phone, tablet (portrait + landscape)
- [ ] Horizontal insets adapt by device size/orientation
- [ ] 4/8dp spacing rhythm maintained
- [ ] Long-form text readable on larger devices

### Accessibility
- [ ] All meaningful images/icons have accessibility labels
- [ ] Form fields have labels, hints, clear error messages
- [ ] Color not the only indicator
- [ ] Reduced motion and dynamic text size supported
- [ ] Accessibility traits/roles/states announced correctly
