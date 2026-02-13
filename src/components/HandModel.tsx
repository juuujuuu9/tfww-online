import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TextureLoader } from 'three';
import { EffectComposer, EffectPass, RenderPass } from 'postprocessing';
import { Pane } from 'tweakpane';
import { DitheringEffect } from './DitheringEffect';

const GLB_PATH = '/3d/masTer_hand.glb';

// Towel cotton texture paths
const TEXTURE_BASE_PATH = '/3d/TowelCotton001';
const TOWEL_TEXTURES = {
  color: `${TEXTURE_BASE_PATH}/TowelCotton001_COL_1K.png`,
  normal: `${TEXTURE_BASE_PATH}/TowelCotton001_NRM_1K.png`,
  roughness: `${TEXTURE_BASE_PATH}/TowelCotton001_ROUGHNESS_1K_METALNESS.png`,
  ao: `${TEXTURE_BASE_PATH}/TowelCotton001_AO_1K.png`,
  displacement: `${TEXTURE_BASE_PATH}/TowelCotton001_DISP_1K.png`
};

// Material: white base with strong form definition (normals, AO) so hand reads clearly
const createLightMaterial = (textureLoader: TextureLoader) => {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xeeeeee,
    emissiveIntensity: 0.08, // Very low so lighting defines form, not a flat blob
    roughness: 0.4,
    metalness: 0.05,
  });

  // Load color texture for surface detail
  textureLoader.load(
    TOWEL_TEXTURES.color,
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(2, 2);
      material.map = texture;
      material.mapIntensity = 0.85; // Strong enough to show fabric detail
      material.needsUpdate = true;
    },
    undefined,
    (error) => console.warn('Failed to load color texture:', error)
  );

  // Load normal map — critical for fingers and surface definition
  textureLoader.load(
    TOWEL_TEXTURES.normal,
    (texture) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(2, 2);
      material.normalMap = texture;
      material.normalScale = new THREE.Vector2(1.2, 1.2); // Slightly stronger to define form
      material.needsUpdate = true;
    },
    undefined,
    (error) => console.warn('Failed to load normal texture:', error)
  );

  // Load roughness map
  textureLoader.load(
    TOWEL_TEXTURES.roughness,
    (texture) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(2, 2);
      material.roughnessMap = texture;
      material.needsUpdate = true;
    },
    undefined,
    (error) => console.warn('Failed to load roughness texture:', error)
  );

  // Load ambient occlusion map with reduced intensity for lighter appearance
  textureLoader.load(
    TOWEL_TEXTURES.ao,
    (texture) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(2, 2);
      material.aoMap = texture;
      material.aoMapIntensity = 0.45; // Restore AO so fingers, knuckles and folds have definition
      material.needsUpdate = true;
    },
    undefined,
    (error) => console.warn('Failed to load AO texture:', error)
  );

  return material;
};

// Keep the original towel cotton material function as fallback
const createTowelCottonMaterial = createLightMaterial;

// Simple placeholder geometry when GLB file is not available
const createPlaceholderHand = (textureLoader: TextureLoader) => {
  const group = new THREE.Group();
  
  // Create lighter material for placeholder
  const placeholderMaterial = createLightMaterial(textureLoader);
  
  // Create a simple hand-like shape using basic geometries
  const palmGeometry = new THREE.BoxGeometry(0.8, 0.3, 0.1);
  const palm = new THREE.Mesh(palmGeometry, placeholderMaterial);
  palm.position.set(0, 0, 0);
  group.add(palm);
  
  // Fingers
  const fingerGeometry = new THREE.BoxGeometry(0.1, 0.6, 0.08);
  
  for (let i = 0; i < 4; i++) {
    const finger = new THREE.Mesh(fingerGeometry, placeholderMaterial);
    finger.position.set(-0.3 + i * 0.2, 0.3, 0);
    finger.rotation.z = Math.PI * 0.1;
    group.add(finger);
  }
  
  // Thumb
  const thumbGeometry = new THREE.BoxGeometry(0.08, 0.4, 0.08);
  const thumb = new THREE.Mesh(thumbGeometry, placeholderMaterial);
  thumb.position.set(0.4, 0, 0);
  thumb.rotation.z = -Math.PI * 0.2;
  group.add(thumb);
  
  return group;
};

/** Default dark dither color as RGB 0–1 (#1e3a8a) */
const DEFAULT_DARK_RGB: [number, number, number] = [30 / 255, 58 / 255, 138 / 255];
/** Default custom light dither color as RGB 0–1 (r: 230, g: 237, b: 247) */
const DEFAULT_LIGHT_RGB: [number, number, number] = [230 / 255, 237 / 255, 247 / 255];

const INIT_POS = { x: 0.55, y: -0.60, z: 0.65 };
const INIT_ROT = { x: 0, y: -8 * Math.PI / 180, z: 0 };
const INIT_SCALE = 0.9;
const RAD_TO_DEG = 180 / Math.PI;

/** Max rotation (radians) when cursor is at edge; rest state. */
const CURSOR_TILT_STRENGTH = 0.12;
/** Tilt strength while user is dragging the hand. */
const DRAG_TILT_STRENGTH = 0.4;
const CURSOR_LERP = 0.08;
/** Tighter follow while dragging. */
const DRAG_LERP = 0.18;
const TILT_STRENGTH_LERP = 0.12;

/** Floating animation constants */
const FLOAT_AMPLITUDE = 0.08;
const FLOAT_FREQUENCY = 0.003;

export type DitherColorOption = [number, number, number];

export interface HandModelProps {
  /** Dither dark pixel color [r,g,b] 0-1. Default: black. */
  ditherColorDark?: DitherColorOption;
  /** Dither light pixel color [r,g,b] 0-1, or omit to use scene color. */
  ditherColorLight?: DitherColorOption | null;
}

export function HandModel({ ditherColorDark, ditherColorLight }: HandModelProps = {}): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const baseScaleRef = useRef(1);
  const positionRef = useRef(INIT_POS);
  const rotationRef = useRef(INIT_ROT);
  const rotationSliderRef = useRef({ ...INIT_ROT });
  const scaleSliderRef = useRef(INIT_SCALE);
  const positionYSliderRef = useRef(INIT_POS.y);
  const positionXSliderRef = useRef(INIT_POS.x);

  const [rotationDeg, setRotationDeg] = useState({
    x: Math.round(INIT_ROT.x * RAD_TO_DEG),
    y: Math.round(INIT_ROT.y * RAD_TO_DEG),
    z: Math.round(INIT_ROT.z * RAD_TO_DEG)
  });
  const [scale, setScale] = useState(INIT_SCALE);
  const [positionX, setPositionX] = useState(INIT_POS.x);
  const [positionY, setPositionY] = useState(INIT_POS.y);
  /** Normalized cursor from viewport center: -1..1, (0,0) = center. */
  const cursorRef = useRef({ x: 0, y: 0 });
  const cursorSmoothedRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const tiltStrengthRef = useRef(CURSOR_TILT_STRENGTH);
  const timeRef = useRef(0);
  const shakeIntensityRef = useRef(0);
  const isShakingRef = useRef(false);
  const [isShaking, setIsShaking] = useState(false);
  const [panelExpanded, setPanelExpanded] = useState(true);
  /** True when tray has fully collapsed (after Tweakpane’s ~200ms animation). */
  const [barRoundedBottom, setBarRoundedBottom] = useState(false);
  const collapseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dithering effect state
  const [ditheringEnabled, setDitheringEnabled] = useState(true);
  const [gridSize, setGridSize] = useState(2.0);
  const [pixelSizeRatio, setPixelSizeRatio] = useState(1.0);
  const [grayscaleOnly, setGrayscaleOnly] = useState(false);
  const [colorDark, setColorDark] = useState<[number, number, number]>(() => ditherColorDark ?? DEFAULT_DARK_RGB);
  const [useCustomLightColor, setUseCustomLightColor] = useState(true);
  const [colorLight, setColorLight] = useState<[number, number, number]>(DEFAULT_LIGHT_RGB);
  const ditheringEffectRef = useRef<DitheringEffect | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const paneContainerRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<Pane | null>(null);

  // Draggable controls panel: position in px, start ~600px right of left edge
  const [panelPosition, setPanelPosition] = useState(() => ({
    x: 616,
    y: Math.max(16, (typeof window !== 'undefined' ? window.innerHeight : 600) - 420) + 225
  }));
  const dragStartRef = useRef<{ clientX: number; clientY: number; panelX: number; panelY: number } | null>(null);


  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, width / height, 0.1, 100);
    camera.position.set(0, 0, 4);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.6; // Balanced so we keep detail, not blown-out blob
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Create effect composer with dithering effect
    const composer = new EffectComposer(renderer);
    composerRef.current = composer;
    
    // Add render pass
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    
    // Add dithering effect
    const ditheringEffect = new DitheringEffect({
      gridSize: 2.0,
      pixelSizeRatio: 1.0,
      grayscaleOnly: false,
      ditheringEnabled: true,
      colorDark: ditherColorDark ?? DEFAULT_DARK_RGB,
      colorLight: ditherColorLight ?? (useCustomLightColor ? DEFAULT_LIGHT_RGB : undefined)
    });
    ditheringEffect.setResolution(width, height);
    ditheringEffectRef.current = ditheringEffect;

    const effectPass = new EffectPass(camera, ditheringEffect);
    composer.addPass(effectPass);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 1.5;
    controls.maxDistance = 8;
    controls.target.set(0, 0, 0);

    const loader = new GLTFLoader();
    const textureLoader = new TextureLoader();
    const TARGET_SIZE = 1.8;

    loader.load(
      GLB_PATH,
      (gltf) => {
        const model = gltf.scene;
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;

            // Remove the bullet by material name
            if (mat?.name === 'Material__350') {
              mesh.visible = false;
              mesh.geometry.dispose();
              if (Array.isArray(mesh.material)) {
                mesh.material.forEach((m) => m.dispose());
              } else if (mesh.material) {
                mesh.material.dispose();
              }
              return;
            }

            mesh.castShadow = true;
            mesh.receiveShadow = true;
          }
        });

        // Center and scale (only visible hand)
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z, 0.001);
        const baseScale = (TARGET_SIZE / maxDim) * INIT_SCALE;
        baseScaleRef.current = baseScale;
        model.scale.setScalar(baseScale);

        modelRef.current = model;
        scene.add(model);
      },
      undefined,
      (err) => {
        console.warn('GLB file not found, using placeholder geometry:', err);
        const placeholderModel = createPlaceholderHand(textureLoader);
        const box = new THREE.Box3().setFromObject(placeholderModel);
        const center = box.getCenter(new THREE.Vector3());
        placeholderModel.position.sub(center);
        placeholderModel.scale.setScalar(INIT_SCALE);
        modelRef.current = placeholderModel;
        baseScaleRef.current = INIT_SCALE;
        scene.add(placeholderModel);
      }
    );

    // Moderate ambient — enough to keep it light, not so much that form disappears
    const ambient = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambient);
    
    // Key light from front-side to define fingers and palm
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(2, 1.5, 3);
    scene.add(key);
    
    // Enhanced fill light to reduce harsh shadows
    const fill = new THREE.DirectionalLight(0xffffff, 0.8);
    fill.position.set(-1, 0.5, 2);
    scene.add(fill);
    
    // Stronger rim light from behind to highlight surface details
    const rim = new THREE.DirectionalLight(0xffffff, 0.6);
    rim.position.set(0, 0, -3);
    scene.add(rim);
    
    // Additional soft overhead light for even illumination
    const overhead = new THREE.DirectionalLight(0xffffff, 0.4);
    overhead.position.set(0, 3, 0);
    scene.add(overhead);
    
    // Add subtle side fill light for better surface detail visibility
    const sideFill = new THREE.DirectionalLight(0xffffff, 0.3);
    sideFill.position.set(3, 0, 1);
    scene.add(sideFill);

    // Spotlight from above — adds top highlight without washing out form
    const topSpotlight = new THREE.SpotLight(0xffffff, 1.2, 10, Math.PI / 6, 0.5, 1);
    topSpotlight.position.set(0, 5, 0); // Directly above the model
    topSpotlight.target.position.set(0, 0, 0); // Point at model center
    topSpotlight.castShadow = true;
    topSpotlight.shadow.mapSize.width = 1024;
    topSpotlight.shadow.mapSize.height = 1024;
    scene.add(topSpotlight);
    scene.add(topSpotlight.target);

    // Add a simple ground plane to catch shadows
    const groundGeometry = new THREE.PlaneGeometry(10, 10);
    const groundMaterial = new THREE.MeshLambertMaterial({ 
      color: 0xffffff, 
      transparent: true, 
      opacity: 0.1 
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2;
    ground.receiveShadow = true;
    scene.add(ground);

    const centerX = (): number => window.innerWidth / 2;
    const centerY = (): number => window.innerHeight / 2;
    const onMouseMove = (e: MouseEvent): void => {
      const cx = centerX();
      const cy = centerY();
      const nx = Math.max(-1, Math.min(1, (e.clientX - cx) / cx));
      const ny = Math.max(-1, Math.min(1, (e.clientY - cy) / cy));
      cursorRef.current = { x: nx, y: ny };
    };
    const onMouseDown = (): void => {
      isDraggingRef.current = true;
      controls.enabled = false;
    };
    const onMouseUp = (): void => {
      isDraggingRef.current = false;
      controls.enabled = true;
    };
    const onClick = (): void => {
      // Trigger shake animation on click
      isShakingRef.current = true;
      shakeIntensityRef.current = 1;
      setIsShaking(true);
    };
    window.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('click', onClick);

    let frameId: number;
    const animate = (): void => {
      frameId = requestAnimationFrame(animate);

      const dragging = isDraggingRef.current;
      const targetStrength = dragging ? DRAG_TILT_STRENGTH : CURSOR_TILT_STRENGTH;
      tiltStrengthRef.current += (targetStrength - tiltStrengthRef.current) * TILT_STRENGTH_LERP;

      const cur = cursorRef.current;
      const sm = cursorSmoothedRef.current;
      const cursorLerp = dragging ? DRAG_LERP : CURSOR_LERP;
      sm.x += (cur.x - sm.x) * cursorLerp;
      sm.y += (cur.y - sm.y) * cursorLerp;
      cursorSmoothedRef.current = sm;

      // Update time for floating animation
      timeRef.current += 16; // Approximate 60fps frame time

      // Handle shake animation
      if (isShakingRef.current) {
        shakeIntensityRef.current *= 0.92; // Decay shake intensity
        if (shakeIntensityRef.current < 0.01) {
          isShakingRef.current = false;
          shakeIntensityRef.current = 0;
          setIsShaking(false);
        }
      }

      const model = modelRef.current;
      if (model) {
        const p = positionRef.current;
        const r = rotationSliderRef.current;
        const strength = tiltStrengthRef.current;
        const tiltX = sm.y * strength;
        const tiltY = sm.x * strength;

        // Add subtle floating motion
        const floatY = Math.sin(timeRef.current * FLOAT_FREQUENCY) * FLOAT_AMPLITUDE;
        const floatX = Math.cos(timeRef.current * FLOAT_FREQUENCY * 0.7) * FLOAT_AMPLITUDE * 0.5;
        const floatZ = Math.sin(timeRef.current * FLOAT_FREQUENCY * 1.3) * FLOAT_AMPLITUDE * 0.3;

        // Add shake effect if active
        let shakeX = 0, shakeY = 0, shakeZ = 0;
        if (isShakingRef.current && shakeIntensityRef.current > 0) {
          const shakeIntensity = shakeIntensityRef.current;
          const shakeFrequency = 0.3; // Fast shake
          const time = timeRef.current;
          shakeX = (Math.sin(time * shakeFrequency * 8) * 0.02 + Math.sin(time * shakeFrequency * 13) * 0.015) * shakeIntensity;
          shakeY = (Math.cos(time * shakeFrequency * 11) * 0.02 + Math.sin(time * shakeFrequency * 17) * 0.015) * shakeIntensity;
          shakeZ = (Math.sin(time * shakeFrequency * 9) * 0.01 + Math.cos(time * shakeFrequency * 15) * 0.01) * shakeIntensity;
        }

        // Simple scale: base * slider only
        const baseScale = baseScaleRef.current;
        const scaleMult = scaleSliderRef.current;
        model.scale.setScalar(baseScale * scaleMult);

        model.position.set(positionXSliderRef.current + floatX + shakeX, positionYSliderRef.current + floatY + shakeY, p.z + floatZ + shakeZ);
        model.rotation.set(r.x + tiltX + shakeX * 2, r.y + tiltY + shakeY * 2, r.z + shakeZ * 3);
      }

      controls.update();
      composer.render();
    };
    animate();

    const onResize = (): void => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      if (composerRef.current) {
        composerRef.current.setSize(w, h);
      }
      // Update dithering resolution
      if (ditheringEffectRef.current) {
        ditheringEffectRef.current.setResolution(w, h);
      }
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('click', onClick);
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(frameId);
      controls.dispose();
      if (composerRef.current) {
        composerRef.current.dispose();
      }
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const onRotationChange = (axis: 'x' | 'y' | 'z', valueDeg: number): void => {
    const rad = (valueDeg * Math.PI) / 180;
    setRotationDeg((prev) => ({ ...prev, [axis]: valueDeg }));
    rotationSliderRef.current = { ...rotationSliderRef.current, [axis]: rad };
  };

  const onScaleChange = (value: number): void => {
    setScale(value);
    scaleSliderRef.current = value;
  };

  const onPositionYChange = (value: number): void => {
    setPositionY(value);
    positionYSliderRef.current = value;
  };

  const onPositionXChange = (value: number): void => {
    setPositionX(value);
    positionXSliderRef.current = value;
  };

  // Dithering control functions
  const onDitheringEnabledChange = (enabled: boolean): void => {
    setDitheringEnabled(enabled);
    if (ditheringEffectRef.current) {
      ditheringEffectRef.current.setDitheringEnabled(enabled);
    }
  };

  const onGridSizeChange = (value: number): void => {
    setGridSize(value);
    if (ditheringEffectRef.current) {
      ditheringEffectRef.current.setGridSize(value);
    }
  };

  const onPixelSizeRatioChange = (value: number): void => {
    setPixelSizeRatio(value);
    if (ditheringEffectRef.current) {
      ditheringEffectRef.current.setPixelSizeRatio(value);
    }
  };

  const onGrayscaleOnlyChange = (grayscale: boolean): void => {
    setGrayscaleOnly(grayscale);
    if (ditheringEffectRef.current) {
      ditheringEffectRef.current.setGrayscaleOnly(grayscale);
    }
  };

  const onColorDarkChange = (rgb: [number, number, number]): void => {
    setColorDark(rgb);
    if (ditheringEffectRef.current) {
      ditheringEffectRef.current.setColorDark(rgb);
    }
  };

  const onColorLightChange = (rgb: [number, number, number] | null): void => {
    setUseCustomLightColor(rgb != null);
    if (rgb != null) setColorLight(rgb);
    if (ditheringEffectRef.current) {
      ditheringEffectRef.current.setColorLight(rgb ?? null);
    }
  };

  // Tweakpane: create once on mount, dispose on unmount
  useEffect(() => {
    const container = paneContainerRef.current;
    if (!container) return;

    const pane = new Pane({ container, expanded: true }); // No title: we use our own combined header
    paneRef.current = pane;

    const params = {
      rotationX: rotationDeg.x,
      rotationY: rotationDeg.y,
      rotationZ: rotationDeg.z,
      scale,
      positionX,
      positionY,
      ditheringEnabled,
      gridSize,
      pixelSizeRatio,
      grayscaleOnly,
      colorDark: {
        r: Math.round(colorDark[0] * 255),
        g: Math.round(colorDark[1] * 255),
        b: Math.round(colorDark[2] * 255)
      },
      useCustomLight: useCustomLightColor,
      colorLight: {
        r: Math.round(colorLight[0] * 255),
        g: Math.round(colorLight[1] * 255),
        b: Math.round(colorLight[2] * 255)
      }
    };

    const modelFolder = pane.addFolder({ title: 'Model', expanded: true });
    modelFolder.addBinding(params, 'rotationX', { min: -180, max: 180, step: 1, label: 'rotate X' })
      .on('change', (ev) => onRotationChange('x', ev.value as number));
    modelFolder.addBinding(params, 'rotationY', { min: -180, max: 180, step: 1, label: 'rotate Y' })
      .on('change', (ev) => onRotationChange('y', ev.value as number));
    modelFolder.addBinding(params, 'rotationZ', { min: -180, max: 180, step: 1, label: 'rotate Z' })
      .on('change', (ev) => onRotationChange('z', ev.value as number));
    modelFolder.addBinding(params, 'scale', { min: 0.5, max: 3, step: 0.1 })
      .on('change', (ev) => onScaleChange(ev.value as number));
    modelFolder.addBinding(params, 'positionX', { min: -2, max: 2, step: 0.05, label: 'position X' })
      .on('change', (ev) => onPositionXChange(ev.value as number));
    modelFolder.addBinding(params, 'positionY', { min: -2, max: 2, step: 0.05, label: 'position Y' })
      .on('change', (ev) => onPositionYChange(ev.value as number));

    const ditherFolder = pane.addFolder({ title: 'Dithering', expanded: true });
    ditherFolder.addBinding(params, 'ditheringEnabled', { label: 'enabled' })
      .on('change', (ev) => onDitheringEnabledChange(ev.value as boolean));
    ditherFolder.addBinding(params, 'gridSize', { min: 1, max: 20, step: 0.5, label: 'grid size' })
      .on('change', (ev) => onGridSizeChange(ev.value as number));
    ditherFolder.addBinding(params, 'pixelSizeRatio', { min: 1, max: 10, step: 0.5, label: 'pixelation' })
      .on('change', (ev) => onPixelSizeRatioChange(ev.value as number));
    ditherFolder.addBinding(params, 'grayscaleOnly', { label: 'grayscale' })
      .on('change', (ev) => onGrayscaleOnlyChange(ev.value as boolean));
    ditherFolder.addBinding(params, 'colorDark', { label: 'dark' })
      .on('change', (ev) => {
        const c = ev.value as { r: number; g: number; b: number };
        onColorDarkChange([c.r / 255, c.g / 255, c.b / 255]);
      });
    ditherFolder.addBinding(params, 'useCustomLight', { label: 'custom light' })
      .on('change', (ev) => onColorLightChange((ev.value as boolean)
        ? [params.colorLight.r / 255, params.colorLight.g / 255, params.colorLight.b / 255]
        : null));
    ditherFolder.addBinding(params, 'colorLight', { label: 'light' })
      .on('change', (ev) => {
        const c = ev.value as { r: number; g: number; b: number };
        onColorLightChange([c.r / 255, c.g / 255, c.b / 255]);
      });

    return () => {
      pane.dispose();
      paneRef.current = null;
    };
  }, []); // Intentionally run once; pane drives refs/state via change handlers

  const panelWrapperRef = useRef<HTMLDivElement>(null);

  // Tweakpane color pickers: close on Enter (accept) and click outside
  useEffect(() => {
    const isInsidePicker = (el: Element | null): boolean =>
      !!el?.closest('.tp-popv');

    const handleKeydown = (e: KeyboardEvent): void => {
      if (e.key !== 'Enter') return;
      const active = document.activeElement;
      if (active && isInsidePicker(active)) {
        (active as HTMLElement).blur();
      }
    };

    const handleMousedown = (e: MouseEvent): void => {
      const target = e.target as Element;
      const active = document.activeElement;
      if (active && isInsidePicker(active) && !isInsidePicker(target)) {
        (active as HTMLElement).blur();
      }
    };

    document.addEventListener('keydown', handleKeydown, true);
    document.addEventListener('mousedown', handleMousedown, true);
    return () => {
      document.removeEventListener('keydown', handleKeydown, true);
      document.removeEventListener('mousedown', handleMousedown, true);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (collapseTimeoutRef.current) clearTimeout(collapseTimeoutRef.current);
    };
  }, []);

  const handlePanelExpandToggle = (): void => {
    const next = !panelExpanded;
    setPanelExpanded(next);
    if (paneRef.current) paneRef.current.expanded = next;
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }
    if (next) {
      setBarRoundedBottom(false);
    } else {
      collapseTimeoutRef.current = setTimeout(() => {
        setBarRoundedBottom(true);
        collapseTimeoutRef.current = null;
      }, 220); // Slightly after Tweakpane’s 200ms height transition
    }
  };

  const handlePanelDragStart = (e: React.MouseEvent): void => {
    if (e.button !== 0) return;
    e.preventDefault();
    const wrapper = panelWrapperRef.current;
    if (!wrapper) return;
    const parent = wrapper.offsetParent as HTMLElement;
    if (!parent) return;
    const wrapperRect = wrapper.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    const panelX = wrapperRect.left - parentRect.left;
    const panelY = wrapperRect.top - parentRect.top;
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      panelX,
      panelY
    };
    const onMove = (e2: MouseEvent): void => {
      if (!dragStartRef.current) return;
      const dx = e2.clientX - dragStartRef.current.clientX;
      const dy = e2.clientY - dragStartRef.current.clientY;
      setPanelPosition({
        x: dragStartRef.current.panelX + dx,
        y: dragStartRef.current.panelY + dy
      });
    };
    const onUp = (): void => {
      dragStartRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div className={`relative h-full w-full min-h-[200px] model-container ${isShaking ? 'shake' : ''}`} aria-hidden="true">
      <div ref={containerRef} className="h-full w-full" />
      <div
        ref={panelWrapperRef}
        className="absolute z-50 select-none"
        style={{ left: panelPosition.x, top: panelPosition.y }}
        aria-label="Controls"
      >
        <div
          className={`grid cursor-grab grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-t-md bg-[#1e3a8a]/90 px-1 py-0.5 active:cursor-grabbing ${barRoundedBottom ? 'rounded-b-md' : ''}`}
          onMouseDown={handlePanelDragStart}
          role="presentation"
        >
          <span className="text-[#E6EDF7]/70" aria-hidden="true">⋮⋮</span>
          <span className="font-mono uppercase text-xs font-medium text-[#E6EDF7]">Controls</span>
          <button
            type="button"
            className="justify-self-end cursor-pointer rounded-md p-0.5 text-[#E6EDF7] hover:bg-white/15 focus:outline-none"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); handlePanelExpandToggle(); }}
            aria-label={panelExpanded ? 'Collapse controls' : 'Expand controls'}
            aria-expanded={panelExpanded}
          >
            <span aria-hidden="true">
              {panelExpanded ? (
                <svg fill="currentColor" viewBox="-1.7 0 20.4 20.4" xmlns="http://www.w3.org/2000/svg" className="size-4" aria-hidden>
                  <path d="M16.417 10.283A7.917 7.917 0 1 1 8.5 2.366a7.916 7.916 0 0 1 7.917 7.917zm-6.804.01 3.032-3.033a.792.792 0 0 0-1.12-1.12L8.494 9.173 5.46 6.14a.792.792 0 0 0-1.12 1.12l3.034 3.033-3.033 3.033a.792.792 0 0 0 1.12 1.119l3.032-3.033 3.033 3.033a.792.792 0 0 0 1.12-1.12z" />
                </svg>
              ) : (
                <svg fill="currentColor" viewBox="-1 0 19 19" xmlns="http://www.w3.org/2000/svg" className="size-4" aria-hidden>
                  <path d="M16.416 9.579A7.917 7.917 0 1 1 8.5 1.662a7.916 7.916 0 0 1 7.916 7.917zm-2.548-2.395a.792.792 0 0 0-1.12 0L8.5 11.433l-4.249-4.25a.792.792 0 0 0-1.12 1.12l4.809 4.809a.792.792 0 0 0 1.12 0l4.808-4.808a.792.792 0 0 0 0-1.12z" />
                </svg>
              )}
            </span>
          </button>
        </div>
        <div ref={paneContainerRef} className="tweakpane-theme-invert" />
      </div>
    </div>
  );
}
