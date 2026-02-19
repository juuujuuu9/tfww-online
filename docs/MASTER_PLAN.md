# Master Plan: Thoughtform Worldwide Enhancement

**Created:** 2025-02-17  
**Scope:** Consolidates findings from code audits, Bloat & Best Practices audit, and independent verification.

---

## Executive Summary

The project builds successfully and has solid architectural foundations (site config, clean separation, fallback patterns), but requires **type safety fixes**, **memory management hardening**, and **accessibility/SEO improvements** before scaling. The 3D dithering shader is technically impressive and should be documented.

---

## Cross-Audit Verification

| Audit Finding | Verification | Status |
|---------------|--------------|--------|
| `material.mapIntensity` doesn't exist | **Confirmed** — MeshStandardMaterial has no such property; Three.js uses `aoMapIntensity`, `emissiveIntensity`, etc. | Fix required |
| `Pane.refresh()` doesn't exist | **Mitigated** — Code uses `typeof paneRef.current.refresh === 'function'` guard; call is dead code, never throws | Cleanup recommended |
| Missing `@types/node` | **Partial** — Build passes; Playwright uses `process.env.CI`; Astro may provide ambient types | Add for strict CI |
| Unused deps: leva, react-player, wavesurfer | **Confirmed** — `leva` not in package.json (may have been removed); `react-player`, `wavesurfer.js`, `@tweakpane/plugin-essentials` present and unused | Remove |
| SlidersPanel dead code | **Confirmed** — Not imported anywhere; HandModel uses Tweakpane directly | Delete or archive |
| 818KB HandModel chunk | **Confirmed** — Build output: `HandModel.Dd7kk5HX.js 818.38 kB` | Code-split |
| Site config centralization | **Done** — `src/config/site.ts` exists with contactEmail, instagramUrl | No action |
| Meta description / OG tags | **Confirmed** — index.astro has none | Add |

---

## Phase 1: Critical (Before Next Deploy)

### 1.1 Type Safety and Runtime Fixes

| Task | Location | Action |
|------|----------|--------|
| Remove `material.mapIntensity` | `HandModel.tsx:42` | Delete line; property doesn't exist, silently fails. Use `material.map` only (texture multiply is built-in) or document intent. |
| Remove dead `pane.refresh()` call | `HandModel.tsx:439-442` | Remove the conditional block; Tweakpane Pane has no `refresh()` method. |
| Add `@types/node` | package.json | `npm i -D @types/node` — required for Playwright `process.env` in strict mode. |
| Fix `DitheringEffect` resolution uniform | `DitheringEffect.ts:124, 179` | Use `Vector2` instead of `[w, h]` array for proper GL uniform and GC hygiene. |

### 1.2 Three.js Memory Management

| Task | Location | Action |
|------|----------|--------|
| Dispose loaded textures | `HandModel.tsx` | Store Texture refs from `textureLoader.load()` callbacks; in cleanup: `textures.forEach(t => t.dispose())`. |
| Dispose postprocessing passes | `HandModel.tsx` | After `composer.dispose()`, call `renderPass.dispose()`, `effectPass.dispose()` if API supports it (verify postprocessing API). |
| Dispose ground geometry/material | `HandModel.tsx` | `ground.geometry.dispose(); ground.material.dispose()` in cleanup. |
| Dispose dithering effect | `HandModel.tsx` | If `DitheringEffect` extends Effect, ensure its internal resources are disposed; check postprocessing docs. |

### 1.3 SEO Baseline

| Task | Location | Action |
|------|----------|--------|
| Add meta description | `index.astro` head | `<meta name="description" content="Thoughtform Worldwide — boutique development studio for creators and brands building what's next." />` |
| Add OpenGraph tags | `index.astro` head | `og:title`, `og:description`, `og:type`, `og:url` (use `Astro.url`). |
| Add canonical URL | `index.astro` head | `<link rel="canonical" href={new URL(Astro.url.pathname, Astro.url.origin).href} />` |

---

## Phase 2: Short-Term (Next Sprint)

### 2.1 Dependency and Dead Code Cleanup

| Task | Action |
|------|--------|
| Remove unused packages | `npm uninstall react-player wavesurfer.js @tweakpane/plugin-essentials` |
| Delete or gitignore `SCENE_SNIPPET_FOR_AGENT.tsx` | Delete if scratchpad; or add to `.gitignore` if needed for local use. |
| Remove `SlidersPanel.tsx` | Delete file; not referenced. Tweakpane controls in HandModel supersede it. |

### 2.2 Magic Numbers → Named Constants

Apply constants from [BLOAT_AND_BEST_PRACTICES_AUDIT.md](./BLOAT_AND_BEST_PRACTICES_AUDIT.md):

| Constant | Value | Location |
|----------|-------|----------|
| `PANEL_COLLAPSE_DELAY_MS` | 220 | HandModel |
| `SHADOW_MAP_SIZE` | 1024 | HandModel |
| `BREAKPOINT_MOBILE_PX` | 640 | HandModel |
| `BREAKPOINT_SMALL_DESKTOP_PX` | 1280 | HandModel |
| `CAMERA_FOV`, `CAMERA_NEAR`, `CAMERA_FAR` | 28, 0.1, 100 | HandModel |
| `ALPHA_THRESHOLD` | 0.2 | DitheringEffect.ts |

### 2.3 Performance

| Task | Action |
|------|--------|
| Code-split HandModel | In `index.astro`: `client:load` with dynamic import. Astro supports `client:visible` or lazy for heavy components; use `import()` + `Suspense` or Astro's `client:load` with Vite code-split. Configure `manualChunks` in `astro.config` to separate HandModel. |
| Visibility-based pause | In HandModel: `document.addEventListener('visibilitychange', ...)` — pause `requestAnimationFrame` when `document.hidden`. |
| Debounce resize | Single resize handler with debounce (e.g. 100ms) to avoid layout thrashing. |

### 2.4 Accessibility (WCAG)

| Task | Action |
|------|--------|
| Canvas role and keyboard | Replace `aria-hidden="true"` on interactive canvas with `role="img"`, `aria-label="Interactive 3D hand model"`. Add basic keyboard controls (e.g. arrow keys to nudge rotation) or provide a "Skip to content" pattern. |
| `prefers-reduced-motion` | When `matchMedia('(prefers-reduced-motion: reduce)').matches`, disable floating animation and reduce/cancel shake. |
| Color contrast | Audit `text-blue-800/90`; ensure 4.5:1 for body text (WCAG AA). |

### 2.5 WebGL Robustness

| Task | Action |
|------|--------|
| Context loss handling | `renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); cancelAnimationFrame(frameId); })` — prevents crash on GPU pressure. |

---

## Phase 3: Long-Term

### 3.1 Testing

| Task | Action |
|------|--------|
| E2E coverage | Expand Playwright tests: model load, controls expand/collapse, dithering toggles (already present per project). |
| Sad-path: GLB failure | Test fallback geometry when GLB fails; assert placeholder renders. |
| Unit: DitheringEffect | Optional: headless render or pure logic tests for shader params. |

### 3.2 Documentation

| Task | Action |
|------|--------|
| Shader README | Document DitheringEffect: Bayer matrix, uniforms, color options. Add to `docs/` or component JSDoc. |
| Architecture overview | Brief doc on HandModel lifecycle (mount → texture load → animate → cleanup). |

### 3.3 Optional Enhancements

| Task | Consideration |
|------|---------------|
| Structured data (JSON-LD) | `Organization` schema for rich results. |
| Service worker | Asset caching for 3D models/textures on repeat visits. |
| Instancing | Only if multiple hand models needed; premature otherwise. |

---

## Priority Checklist

### Immediate (before next deploy)

- [ ] Remove `material.mapIntensity` (HandModel.tsx:42)
- [ ] Remove dead `pane.refresh()` block (HandModel.tsx:439-442)
- [ ] Add `@types/node` for Playwright
- [ ] Implement Three.js disposal (textures, ground, composer passes)
- [ ] Add `<meta name="description">` and OpenGraph tags to index.astro
- [ ] Fix DitheringEffect resolution to use `Vector2`

### Short-term (next sprint)

- [ ] Remove unused deps: react-player, wavesurfer.js, @tweakpane/plugin-essentials
- [ ] Delete SlidersPanel.tsx and SCENE_SNIPPET_FOR_AGENT.tsx (or gitignore)
- [ ] Extract magic numbers to named constants
- [ ] Code-split HandModel (reduce 818KB chunk)
- [ ] Add visibility-based animation pause
- [ ] Add `prefers-reduced-motion` support
- [ ] Fix canvas accessibility (role, aria-label, keyboard)
- [ ] Add WebGL context loss handler

### Long-term

- [ ] Document DitheringEffect shader
- [ ] Add unit/integration tests for fallback geometry
- [ ] Consider JSON-LD and service worker

---

## File Change Summary

| File | Changes |
|------|---------|
| `src/components/HandModel.tsx` | Remove mapIntensity, pane.refresh; add disposal; visibility pause; context loss; constants |
| `src/components/DitheringEffect.ts` | Vector2 for resolution; ALPHA_THRESHOLD constant |
| `src/pages/index.astro` | Meta description, OG tags, canonical; optional lazy HandModel |
| `playwright.config.ts` | No code change if @types/node added |
| `package.json` | Add @types/node; remove react-player, wavesurfer.js, @tweakpane/plugin-essentials |
| Delete | `SlidersPanel.tsx`, `SCENE_SNIPPET_FOR_AGENT.tsx` (or gitignore) |

---

## Positive Findings (Preserve)

- **Security:** No exposed secrets; email in config
- **Dependencies:** 0 npm audit vulnerabilities
- **Testing:** Playwright E2E in place
- **Performance:** Tone mapping, pixel ratio cap, mobile-first
- **Config:** Site URLs/contact centralized in `src/config/site.ts`
- **Architecture:** Clean fallback for GLB; Tweakpane well-abstracted

---

*This plan reconciles the user's audit, BLOAT_AND_BEST_PRACTICES_AUDIT.md, and codebase verification. Execute Phase 1 before deploy; Phase 2 in next sprint; Phase 3 as capacity allows.*
