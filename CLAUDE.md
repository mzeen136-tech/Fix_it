# SnapFix - CLAUDE.md

## Project Overview
WhatsApp Home Services Dispatch System built with Next.js, Supabase, and Meta WhatsApp Cloud API.

## Quick Commands
```bash
npm run dev          # Start development server
npm run build        # Build for production
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain <domain>
```

## UI/UX Design Intelligence

This project uses **UI-UX Pro Max** skill for design decisions. Activate for any UI work.

### Design System Command
```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "home services dispatch" --design-system -p "SnapFix"
```

### Core Design Principles (Priority Order)

1. **Accessibility (CRITICAL)**
   - Color contrast ≥ 4.5:1 for all text
   - Touch targets ≥ 44×44px (WhatsApp-style buttons)
   - Visible focus states on interactive elements
   - ARIA labels for icon-only buttons

2. **Touch & Interaction (CRITICAL)**
   - Minimum 8px spacing between touch targets
   - Loading states on buttons during async operations
   - Clear pressed/active state feedback
   - No hover-only interactions (mobile-first)

3. **Layout & Responsive (HIGH)**
   - Mobile-first breakpoints (320px → 768px → 1024px → 1280px)
   - 4pt/8dp spacing system (8, 16, 24, 32, 48)
   - No horizontal scroll on any viewport
   - Safe area padding for notches/gesture bars

4. **Typography & Color (MEDIUM)**
   - Base font size: 16px body, 14px small
   - Line height: 1.5 for body, 1.2 for headings
   - Semantic color tokens (not raw hex values)
   - Dark mode: desaturated variants, maintain contrast

5. **Animation (MEDIUM)**
   - Duration: 150-300ms for micro-interactions
   - Use transform/opacity only (performance)
   - Respect `prefers-reduced-motion`
   - Motion conveys cause-effect

### SnapFix Brand Guidelines

**Colors:**
- Primary: WhatsApp Green (#25D366) for success/accept actions
- Secondary: Facebook Blue (#1877F2) for primary CTAs
- Danger: Red (#DC3545) for reject/delete actions
- Background: Light (#F0F2F5) / Dark (#1A1A1A)

**Typography:**
- Font: System fonts (Inter, -apple-system, Segoe UI)
- Headings: 600 weight
- Body: 400 weight

**Icon Style:**
- Lucide React or Heroicons (outline style)
- Consistent 1.5px stroke width
- No emojis as structural icons

### Pre-Delivery Checklist

**Visual Quality:**
- [ ] No emojis as icons (use SVG)
- [ ] Consistent icon family throughout
- [ ] Pressed states don't shift layout

**Interaction:**
- [ ] All buttons provide pressed feedback
- [ ] Touch targets ≥ 44×44px
- [ ] Loading states for async actions

**Light/Dark Mode:**
- [ ] Text contrast ≥ 4.5:1 in both modes
- [ ] Borders visible in both themes
- [ ] Modal scrim 40-60% black

**Layout:**
- [ ] Safe areas respected (header, bottom nav)
- [ ] Scroll content not hidden behind fixed bars
- [ ] 8dp spacing rhythm maintained

**Accessibility:**
- [ ] Labels on all form fields
- [ ] Focus states visible
- [ ] Color not only indicator

## Tech Stack
- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **Database:** Supabase (PostgreSQL)
- **Styling:** Tailwind CSS
- **Messaging:** Meta WhatsApp Cloud API
- **AI:** Google Gemini

## Environment Variables
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_JOB_ALERT_TEMPLATE=job_alert
TELEGRAM_BOT_TOKEN=
GEMINI_API_KEY=
ADMIN_PHONE=923157276899
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Git Workflow
- Never push directly to `main`
- Create feature branch → commit → PR → merge
