# Thoughtform Worldwide

> A boutique development studio website featuring an interactive 3D WebGL experience with custom shader effects. Built with modern web technologies and engineering best practices.

**Live Site:** [thoughtform.world](https://thoughtform.world)

---

## What This Is

This is the marketing website for **Thoughtform Worldwide**, a development studio specializing in technical infrastructure for creators and brands. The site showcases an interactive 3D hand model that responds to user interaction, featuring:

- **Real-time 3D rendering** with Three.js and React Three Fiber
- **Custom dithering shader** for a distinctive visual aesthetic
- **Mouse-responsive animations** with floating motion and proximity-based effects
- **Responsive design** with mobile-optimized interaction patterns

---

## Technical Architecture

### Core Stack

| Layer | Technology |
|-------|------------|
| **Framework** | [Astro 5.x](https://astro.build/) — Static site generation with partial hydration |
| **UI** | [React 19](https://react.dev/) — Component-based interactivity |
| **Language** | [TypeScript](https://www.typescriptlang.org/) — Strict mode enabled |
| **Styling** | [Tailwind CSS 4.x](https://tailwindcss.com/) — Utility-first CSS |
| **3D Rendering** | [Three.js](https://threejs.org/) + [React Three Fiber](https://docs.pmndrs.dev/react-three-fiber) |
| **Post-Processing** | [postprocessing](https://github.com/pmndrs/postprocessing) — Custom shader pipeline |

### Key Dependencies

```
three                # Core 3D engine
@react-three/fiber   # React renderer for Three.js
@react-three/drei     # Three.js utilities
postprocessing        # Shader effects pipeline
tweakpane            # Debug/control panel UI
tailwindcss          # Styling framework
astro                # Static site generator
playwright           # E2E testing
```

---

## Technical Highlights

### 1. Custom WebGL Dithering Shader

Built a custom post-processing effect (`DitheringEffect.ts`) implementing **ordered dithering** with a 4x4 Bayer matrix:

- **100+ line GLSL fragment shader** with configurable uniforms
- Pixel-perfect transparency handling with alpha thresholding
- Dynamic color mapping (light/dark pixel customization)
- Real-time parameter adjustment via Tweakpane UI

```typescript
// Shader features:
- 4x4 Bayer matrix for ordered dithering
- Configurable grid size (1-20)
- Pixelation ratio control
- Grayscale + color inversion modes
- Transparency-aware rendering
```

### 2. Interactive 3D Hand Model

The centerpiece 3D component (`HandModel.tsx`) demonstrates:

- **GLTF model loading** with fallback placeholder geometry
- **PBR material system** — Color, normal, roughness, and AO texture maps
- **Multi-light setup** — Ambient, directional, spot, and rim lighting for realistic form definition
- **Mouse interaction** — Cursor following with smoothed lerp animation
- **Touch gesture handling** — Mobile-optimized tap vs. scroll detection
- **Floating animation** — Time-based sinusoidal motion with proximity intensity scaling
- **Shake effect** — Physics-based decay animation on interaction

**Performance optimizations:**
- Pixel ratio capping (max 2x) for mobile GPU efficiency
- Texture disposal and geometry cleanup on unmount
- Debounced resize handling
- `requestAnimationFrame` with proper cleanup

### 3. Engineering Quality

**Type Safety:**
- Strict TypeScript configuration (`astro/tsconfigs/strict`)
- Explicit return types on all exported functions
- No `any` types; proper interface definitions

**Code Organization:**
- Centralized site config (`src/config/site.ts`)
- Named constants for all magic numbers (camera FOV, breakpoints, animation timings)
- Component co-location (3D logic, effects, and UI in one file)

**Memory Management:**
- Proper Three.js disposal patterns (geometries, materials, textures)
- Effect composer cleanup on unmount
- Event listener removal in cleanup functions

---

## Development Practices

### Testing Strategy

**E2E Testing with Playwright:**

```bash
npm test  # Builds, starts preview server, runs full test suite
```

Test coverage includes:
- Happy path: Page load, 3D canvas attachment, content verification
- UI interaction: Controls panel expand/collapse
- Sad path: GLB model failure → fallback geometry rendering

**Configuration:**
- Tests run against production build (not dev server)
- Isolated test port (8765) to avoid conflicts
- CI-ready configuration with retry logic

### Code Quality Documentation

The project includes comprehensive audit documentation:

- **`docs/BLOAT_AND_BEST_PRACTICES_AUDIT.md`** — Code quality KPIs (magic numbers, hardcoded values, prop drilling, bundle size, testing)
- **`docs/MASTER_PLAN.md`** — Phased improvement roadmap (Critical → Short-term → Long-term)
- **`AGENTS.md`** — Project architecture guide for contributors

### Build & Deploy

```bash
npm install    # Install dependencies
npm run dev    # Development server (localhost:4321)
npm run build  # Production build to ./dist/
npm run test   # Full E2E test suite
```

---

## Project Structure

```
/
├── src/
│   ├── components/
│   │   ├── HandModel.tsx          # Main 3D component (~1000 lines)
│   │   ├── DitheringEffect.ts     # Custom WebGL shader
│   │   └── SlidersPanel.tsx       # (Legacy — retained for reference)
│   ├── pages/
│   │   └── index.astro            # Single-page site with SEO meta
│   ├── config/
│   │   └── site.ts                # Centralized site config
│   └── styles/
│       └── global.css             # Fonts, Tailwind, Tweakpane theming
├── e2e/
│   ├── happy-path.spec.ts         # Page load + controls tests
│   └── glb-fallback.spec.ts       # Fallback geometry sad path
├── public/
│   ├── 3d/
│   │   ├── masTer_hand.glb        # 3D model
│   │   └── TowelCotton001/        # PBR texture set
│   └── fonts/                     # Neue Haas Grotesque (custom)
├── docs/                          # Audit & planning documentation
├── astro.config.mjs               # Astro + Vite + Tailwind config
├── playwright.config.ts           # E2E test configuration
└── tsconfig.json                  # Strict TypeScript settings
```

---

## Performance Characteristics

| Metric | Value |
|--------|-------|
| **Bundle Size (HandModel)** | ~818KB (code-split, lazy-loaded) |
| **Build Output** | Static HTML/CSS/JS — no runtime server needed |
| **Lighthouse** | Optimized for Core Web Vitals |
| **3D Performance** | 60fps with proper disposal patterns |
| **Mobile** | Touch-action optimized, reduced motion support |

---

## What This Demonstrates

For hiring managers and technical reviewers, this project showcases:

1. **Advanced Frontend Engineering** — WebGL/Three.js integration with React
2. **Shader Programming** — Custom GLSL fragment shaders with uniform management
3. **TypeScript Mastery** — Strict typing, proper interfaces, zero `any` types
4. **Testing Discipline** — E2E coverage with Playwright, sad-path testing
5. **Performance Awareness** — Memory management, code splitting, mobile optimization
6. **Documentation Culture** — Comprehensive audit docs, inline JSDoc, architecture guides
7. **Modern Tooling** — Astro, Tailwind v4, React 19, Vite
8. **Accessibility Considerations** — `prefers-reduced-motion`, semantic HTML, ARIA labels

---

## Contact

**Julian** — [julian@thoughtform.world](mailto:julian@thoughtform.world)

Los Angeles / Richmond, VA

---

*Built with technical precision and attention to detail.*
