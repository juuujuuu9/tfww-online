# Thoughtform Worldwide - AI Coding Agent Guide

## Project Overview

Thoughtform Worldwide is a boutique development studio website built with Astro, featuring an interactive 3D hand model rendered with Three.js. The site showcases the studio's focus on technical precision and cultural influence for creators and brands seeking specialized digital and physical infrastructure.

### Key Features
- Interactive 3D hand model with realistic towel cotton texture
- Mouse-responsive animations with proximity-based hover effects
- Clean, minimal design with blue/white color scheme
- Responsive layout with desktop-optimized 3D interaction area
- Custom typography using Neue Haas Grotesque and Lexend Mega

## Technology Stack

### Core Framework
- **Astro** (5.17.1) - Static site generator with partial hydration
- **React** (19.2.4) - UI framework for interactive components
- **TypeScript** - Type-safe development

### 3D Graphics
- **Three.js** (0.182.0) - Core 3D rendering engine
- **React Three Fiber** (9.5.0) - React renderer for Three.js
- **React Three Drei** (10.7.7) - High-level Three.js utilities

### Styling & UI
- **Tailwind CSS** (4.1.18) - Utility-first CSS framework
- **Custom CSS** - Global styles with custom fonts and 3D model effects

### Development Tools
- **Vite** - Build tool and development server (via Astro)
- **TSLint** - TypeScript linting (via Astro tsconfig)

## Project Structure

```
/
├── public/
│   ├── 3d/
│   │   ├── Super_Trug.glb (3D model)
│   │   ├── hand.glb (fallback model)
│   │   └── TowelCotton001/ (PBR texture maps)
│   ├── fonts/ (Neue Haas Grotesque fonts)
│   ├── MasTer-Hand.png (logo)
│   └── favicon.*
├── src/
│   ├── components/
│   │   ├── HandModel.tsx (Main 3D component)
│   │   └── SlidersPanel.tsx (UI controls - currently unused)
│   ├── pages/
│   │   └── index.astro (Main page)
│   └── styles/
│       └── global.css (Global styles & fonts)
├── astro.config.mjs (Astro configuration)
├── tsconfig.json (TypeScript configuration)
└── package.json
```

## Build and Development Commands

| Command | Action |
|---------|--------|
| `npm install` | Install dependencies |
| `npm run dev` | Start development server (localhost:4321) |
| `npm run build` | Build production site to `./dist/` |
| `npm run preview` | Preview production build locally |
| `npm run astro ...` | Run Astro CLI commands |

### Development Notes
- The project uses port 4321 for development by default (Astro's default)
- Automatic page reload on file changes
- 3D model and textures are served from `/public/3d/` during development

## Code Organization

### Main Entry Point
- `src/pages/index.astro` - Single-page application with header, main content, footer, and 3D hand integration

### 3D Component Architecture
- `src/components/HandModel.tsx` contains the complete 3D implementation:
  - Three.js scene setup with lighting
  - GLTF model loading with fallback placeholder geometry
  - Custom towel cotton material with PBR texture maps
  - Mouse interaction handling (cursor following, dragging, proximity detection)
  - Floating animation with proximity-based intensity scaling

### Styling System
- Tailwind CSS with custom color palette (blues)
- Custom font families: Neue Haas Grotesque (primary), Lexend Mega (fallback)
- Global CSS includes 3D model hover effects and font-face declarations
- Responsive grid layouts with mobile-first approach

## Key Technical Details

### 3D Model Implementation
- **Model Path**: `/3d/Super_Trug.glb` (primary), falls back to placeholder geometry
- **Material System**: Custom towel cotton shader with:
  - Color, normal, roughness, and AO texture maps
  - Repeat wrapping at 2x scale for realistic fabric appearance
  - Non-metallic, high-roughness PBR configuration
- **Lighting Setup**: Multi-light setup (ambient, key, fill, rim, overhead) for realistic material rendering
- **Interaction Model**:
  - Subtle cursor following with smoothed movement
  - Drag rotation with OrbitControls
  - Proximity-based hover detection (400px threshold)
  - Floating animation that intensifies on hover
  - Minimal scale effect (1% max) for subtle feedback

### Performance Considerations
- Renderer pixel ratio capped at 2x for mobile performance
- Efficient texture loading with error handling
- RequestAnimationFrame loop with proper cleanup
- Smoothed animations using linear interpolation (lerp)
- Proximity smoothing to prevent jarring transitions

### Browser Compatibility
- WebGL required for 3D visualization
- Modern browser features (ES6+, CSS Grid/Flexbox)
- Progressive enhancement: site remains functional if 3D fails to load

## Development Guidelines

### Code Style
- TypeScript strict mode enabled
- React functional components with hooks
- Explicit return types for functions
- Consistent naming: PascalCase for components, camelCase for functions/variables
- Use refs for Three.js objects to avoid re-renders

### File Organization
- Components in `src/components/` with `.tsx` extension
- Astro pages in `src/pages/` with `.astro` extension
- Styles in `src/styles/` with `.css` extension
- Static assets in `public/` maintaining path structure

### 3D Development Patterns
- Always provide fallback geometry for missing GLB files
- Use texture loaders with error callbacks
- Dispose Three.js objects properly in cleanup functions
- Separate model loading from animation logic
- Use wrapper groups for complex transformations

### Styling Conventions
- Tailwind CSS utility classes preferred for layout
- Custom CSS reserved for global styles and 3D effects
- Color scheme: blue-900 for primary, blue-800/90 for secondary text, #E6EDF7 for background
- Responsive breakpoints: sm (640px), lg (1024px), xl (1280px)

## Testing Strategy

### Manual Testing Checklist
- 3D model loads and displays correctly
- Mouse cursor affects model rotation/position
- Dragging rotates the model smoothly
- Hover effects trigger within 400px proximity
- Fallback geometry displays if GLB fails to load
- Responsive layout works across breakpoints
- Fonts load correctly (Neue Haas Grotesque)

### Browser Testing
- Chrome/Chromium (primary development)
- Safari/WebKit
- Firefox/Gecko
- Mobile browsers (iOS Safari, Chrome Mobile)

## Deployment Process

### Build Output
- Static site generated in `./dist/`
- All assets bundled and optimized
- 3D models and textures copied to appropriate paths

### Deployment Requirements
- Static file hosting (Netlify, Vercel, GitHub Pages, etc.)
- HTTPS required for all features
- Proper MIME types for `.glb` files (model/gltf-binary)

### Environment Variables
- No environment variables currently required
- All configuration via `astro.config.mjs`

## Security Considerations

- No user authentication or data storage
- Static site with no server-side processing
- 3D model and texture paths are public
- Email address exposed in footer (julian@thoughtform.world) - protected via obfuscation if needed

## Asset Management

### 3D Assets
- GLB models stored in `/public/3d/`
- PBR textures in `/public/3d/TowelCotton001/`
- Models should be optimized for web (under 1MB when possible)
- Texture resolution: 1K maps recommended for web performance

### Fonts
- Custom Neue Haas Grotesque fonts in `/public/fonts/`
- WOFF2 format preferred with WOFF fallback
- Font-display: swap for performance

### Images
- Logo: `MasTer-Hand.png` (high-res, optimized)
- Favicons: SVG and ICO formats
- Use WebP format for new images when possible

## Troubleshooting

### Common Issues
1. **3D Model Fails to Load**
   - Check console for GLTFLoader errors
   - Verify `/3d/Super_Trug.glb` exists in public directory
   - Fallback placeholder will display automatically

2. **Textures Not Loading**
   - Check network tab for 404s on texture files
   - Verify `/3d/TowelCotton001/` directory structure
   - Material will still render with base properties

3. **Performance Issues**
   - Reduce pixel ratio cap in HandModel.tsx
   - Lower texture resolution
   - Disable post-processing effects

4. **CORS Issues**
   - Ensure fonts are served from same origin
   - Check .htaccess or server config for font MIME types

### Development Tips
- Use `console.warn` instead of `console.error` for missing assets (graceful degradation)
- Test with network throttling to simulate slow connections
- Monitor GPU memory usage in browser dev tools
- Keep Three.js instances minimal for mobile performance
