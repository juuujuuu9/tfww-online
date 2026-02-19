# Bloat & Code Best Practices Audit

**Date:** 2025-02-18 (updated)  
**Scope:** Full codebase (src/, public/, config, e2e/)

---

## 1. Hardcoded Values (URLs, IDs, Secrets)

| Finding | Location | Status |
|---------|----------|--------|
| **Site URLs / contact** | `src/config/site.ts` | ✅ Centralized. `contactEmail`, `instagramUrl`, `title`, `description` used from `index.astro`. |
| **Asset paths** | `HandModel.tsx`: `GLB_PATH`, `TEXTURE_BASE_PATH`, `TOWEL_TEXTURES` | OK for static assets; consider `ASSET_BASE` or config if paths ever vary by env. |
| **Google Fonts URL** | `global.css`: `https://fonts.googleapis.com/...` | Acceptable; optional: self-host Lexend Mega to avoid external request. |
| **Secrets / .env** | Repo | No secrets found. If adding analytics/API keys, use `.env` + `import.meta.env` and add `.env` to `.gitignore`. |

**Verdict:** Site URLs and contact are centralized. Asset paths are fine for static site. No urgent need for .env.

---

## 2. Magic Numbers

| Location | Status |
|----------|--------|
| **HandModel.tsx** | ✅ Named constants: `BREAKPOINT_MOBILE_PX`, `BREAKPOINT_SMALL_DESKTOP_PX`, `CAMERA_FOV`, `CAMERA_NEAR`, `CAMERA_FAR`, `SHADOW_MAP_SIZE`, `PANEL_COLLAPSE_DELAY_MS`, `PANEL_DEFAULT_X_PX`, `PANEL_MIN_TOP_PX`, `PANEL_VERTICAL_FROM_BOTTOM_PX`, `SHAKE_DECAY`, `SHAKE_MIN_INTENSITY`, `SHAKE_FREQUENCY`, `FRAME_TIME_MS`, `TAP_MOVE_THRESHOLD_SQ`, `TAP_MAX_DURATION_MS`, `MODEL_MIN_HEIGHT_PX`. |
| **DitheringEffect.ts** | ✅ `ALPHA_THRESHOLD = 0.2` as named constant and shader uniform. |
| **global.css** | Optional: `0.5s`, `-2px`/`2px` in shake keyframes could use CSS vars. Low priority. |

**Verdict:** Magic numbers extracted to named constants. No remaining high-priority raw values.

---

## 3. Prop Drilling

| Finding | Detail |
|--------|--------|
| **Component tree** | `index.astro` → `HandModel` only. No intermediate components. |
| **Data flow** | All 3D/controls state lives inside `HandModel` (refs + useState). No data passed down through multiple layers. |

**Verdict:** No prop drilling. Single page, single main component. Context or store not needed.

---

## 4. Large Bundle Size / Tree-Shaking

| Item | Status |
|------|--------|
| **three** | `import * as THREE from 'three'` — Standard for Three.js; acceptable. |
| **postprocessing**, **tweakpane**, **DitheringEffect** | Named imports; tree-shakeable. |
| **Unused dependencies** | ✅ Previously removed: `leva`, `react-player`, `wavesurfer.js`, `@tweakpane/plugin-essentials`. |
| **Current deps** | Verify any new additions (e.g. `@neondatabase/serverless`, `resend`, `stripe`) are actually used. |

**Verdict:** Imports are tree-shake friendly. Unused deps removed. Audit new deps as added.

---

## 5. Testing Coverage

| Area | Status |
|------|--------|
| **E2E (Playwright)** | ✅ `e2e/happy-path.spec.ts`: (1) home page loads with Thoughtform content and canvas, (2) controls panel expand/collapse. |
| **Sad path** | ✅ `e2e/glb-fallback.spec.ts`: when GLB request fails (route abort), page still renders with model container and controls (fallback geometry). |
| **Run tests** | `npm test` — builds, starts preview on port 8765, runs Playwright. First-time: run `npx playwright install chromium` if needed. |

**Verdict:** Minimal E2E coverage in place: one happy path and one sad path (model load failure → fallback).

---

## Summary Table (KPIs)

| KPI | Status |
|-----|--------|
| **Hardcoded values** | ✅ Site URLs/contact centralized in `src/config/site.ts`. |
| **Magic numbers** | ✅ Extracted in `HandModel.tsx` and `DitheringEffect.ts`. |
| **Prop drilling** | OK — none; no change needed. |
| **Bundle / tree-shaking** | ✅ Unused deps removed; imports are lean. |
| **Testing** | ✅ E2E happy path + GLB fallback sad path. |

---

## Completed Actions

1. ✅ **Remove unused dependencies** — `leva`, `react-player`, `wavesurfer.js`, `@tweakpane/plugin-essentials` removed.
2. ✅ **Extract magic numbers** — Named constants in `HandModel.tsx` and `DitheringEffect.ts`.
3. ✅ **Centralize site config** — `src/config/site.ts` with `contactEmail`, `instagramUrl`, `title`, `description`.
4. ✅ **Add minimal tests** — Happy-path E2E (page load, canvas, controls) and sad-path (GLB failure → fallback).

---

## Optional Future Improvements

- Self-host Lexend Mega font to avoid Google Fonts request.
- CSS vars for shake keyframe timing/offset in `global.css`.
- Unit tests for extracted helpers if any are added.
- Audit new dependencies before adding (ensure they are used).
