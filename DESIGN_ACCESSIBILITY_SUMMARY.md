# THE WAY — עיצוב ונגישות | סיכום

## 🎨 **עיצוב — מצב נוכחי**

### Phase 1 ✅ (COMPLETE)
- ✅ Design tokens system (`src/lib/design-system.ts`)
- ✅ Hebrew fonts (Rubik, RTL ready)
- ✅ Framer Motion animations installed
- ✅ Gradient cards (indigo primary, cyan accent, emerald success)
- ✅ Premium shadows & spacing
- ✅ ProgressRing animated components
- ✅ Client home page with animated header & hero

### Phase 2 📋 (TODO — Priority Order)
1. [ ] Food tab: photo upload UI, meal cards styling
2. [ ] Weight tab: journey visualization, animations
3. [ ] Steps tab: leaderboard styling
4. [ ] Coach dashboard: equivalent visual elevation
5. [ ] Accessibility audit (WCAG AAA)

---

## ♿ **נגישות — דרישות**

### RTL (Right-to-Left) Hebrew
- ✅ All components use `dir="rtl"` 
- ✅ Tailwind configured for RTL
- ✅ Text alignment auto-reversed
- ✅ Icons can be mirrored where needed

### WCAG AAA Targets
- [ ] Color contrast: 7:1 ratio (AAA)
- [ ] Focus states: visible & keyboard navigable
- [ ] Semantic HTML: proper heading hierarchy
- [ ] ARIA labels: for icons & complex components
- [ ] Screen reader testing: needed

### Mobile-First Approach
- ✅ Responsive: max-w-lg containers
- ✅ Touch-friendly: buttons 44×44px minimum
- ✅ iOS: Gallery via `<label>` with opacity:0 (not display:none)
- ✅ Web Share Target API in manifest

---

## 🛠️ **כלים & Stack**

```
Tailwind 4.1 (with CSS variables)
Framer Motion (animations)
TypeScript (strict mode)
Next.js 15 (App Router)
Rubik Font (Hebrew)
```

---

## 📐 **Design Tokens**

```typescript
// src/lib/design-system.ts
Colors:
  - primary: indigo (actions, focus)
  - accent: cyan (highlights)
  - success: emerald (goals met)
  - warning: amber (caution)
  - error: red (critical)

Spacing: 4px base (tailwind 1 = 4px)
Shadows: premium elevation levels
Animations: 300ms default duration, cubic-bezier(0.23, 1, 0.320, 1)
Border radius: 12px (cards), 8px (buttons)
```

---

## 📝 **הערות חשובות**

- **תמונות:** base64 לClaude API (iOS HEIC → JPEG compression)
- **Build:** `ignoreBuildErrors: true` (TS warnings בקבצים שלא משתנים)
- **Gallery:** No `accept` attribute on input — צריך לעדכן
- **Commit style:** Conventional (feat:, fix:, design:, refactor:)

---

## 🎯 **משימה הקרובה**

**Food Tab Phase 2:**
- Photo upload UI עם preview
- Meal cards עם animations
- Nutrition summary card
- Delete/edit actions

---

**עדכון אחרון:** 2026-06-19 | Vercel: the-way-app-two.vercel.app
