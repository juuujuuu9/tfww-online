import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TextureLoader } from 'three';
import { EffectComposer, EffectPass, RenderPass } from 'postprocessing';
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

const INIT_POS = { x: 0.10, y: -0.55, z: 0.65 };
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
  const positionYSliderRef = useRef(-0.55);

  const [rotationDeg, setRotationDeg] = useState({
    x: Math.round(INIT_ROT.x * RAD_TO_DEG),
    y: Math.round(INIT_ROT.y * RAD_TO_DEG),
    z: Math.round(INIT_ROT.z * RAD_TO_DEG)
  });
  const [scale, setScale] = useState(INIT_SCALE);
  const [positionY, setPositionY] = useState(-0.55);
  /** Normalized cursor from viewport center: -1..1, (0,0) = center. */
  const cursorRef = useRef({ x: 0, y: 0 });
  const cursorSmoothedRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const tiltStrengthRef = useRef(CURSOR_TILT_STRENGTH);
  const timeRef = useRef(0);
  const shakeIntensityRef = useRef(0);
  const isShakingRef = useRef(false);
  const [isShaking, setIsShaking] = useState(false);

  // Dithering effect state
  const [ditheringEnabled, setDitheringEnabled] = useState(true);
  const [gridSize, setGridSize] = useState(4.0);
  const [pixelSizeRatio, setPixelSizeRatio] = useState(1.0);
  const [grayscaleOnly, setGrayscaleOnly] = useState(false);
  const [colorDark, setColorDark] = useState<[number, number, number]>([0, 0, 0]);
  const [useCustomLightColor, setUseCustomLightColor] = useState(false);
  const [colorLight, setColorLight] = useState<[number, number, number]>([1, 1, 1]);
  const ditheringEffectRef = useRef<DitheringEffect | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);


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
      gridSize: 4.0,
      pixelSizeRatio: 1.0,
      grayscaleOnly: false,
      ditheringEnabled: true,
      colorDark: ditherColorDark ?? [0, 0, 0],
      colorLight: ditherColorLight ?? undefined
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

        model.position.set(p.x + floatX + shakeX, positionYSliderRef.current + floatY + shakeY, p.z + floatZ + shakeZ);
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

  return (
    <div className={`relative h-full w-full min-h-[200px] model-container ${isShaking ? 'shake' : ''}`} aria-hidden="true">
      <div ref={containerRef} className="h-full w-full" />
      <div className="absolute bottom-4 left-4 z-50 rounded-lg border border-blue-900/20 bg-white/90 p-3 shadow-sm backdrop-blur">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-blue-900/70">Model</p>
        <div className="space-y-2">
          <div>
            <label className="mb-0.5 flex justify-between text-xs">
              <span>Rotate X</span>
              <span>{rotationDeg.x}°</span>
            </label>
            <input
              type="range"
              min={-180}
              max={180}
              value={rotationDeg.x}
              onChange={(e) => onRotationChange('x', Number(e.target.value))}
              className="h-1.5 w-32 accent-blue-900"
            />
          </div>
          <div>
            <label className="mb-0.5 flex justify-between text-xs">
              <span>Rotate Y</span>
              <span>{rotationDeg.y}°</span>
            </label>
            <input
              type="range"
              min={-180}
              max={180}
              value={rotationDeg.y}
              onChange={(e) => onRotationChange('y', Number(e.target.value))}
              className="h-1.5 w-32 accent-blue-900"
            />
          </div>
          <div>
            <label className="mb-0.5 flex justify-between text-xs">
              <span>Rotate Z</span>
              <span>{rotationDeg.z}°</span>
            </label>
            <input
              type="range"
              min={-180}
              max={180}
              value={rotationDeg.z}
              onChange={(e) => onRotationChange('z', Number(e.target.value))}
              className="h-1.5 w-32 accent-blue-900"
            />
          </div>
          <div>
            <label className="mb-0.5 flex justify-between text-xs">
              <span>Scale</span>
              <span>{scale.toFixed(1)}</span>
            </label>
            <input
              type="range"
              min={0.5}
              max={3}
              step={0.1}
              value={scale}
              onChange={(e) => onScaleChange(Number(e.target.value))}
              className="h-1.5 w-32 accent-blue-900"
            />
          </div>
          <div>
            <label className="mb-0.5 flex justify-between text-xs">
              <span>Vertical Position</span>
              <span>{positionY.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min={-2}
              max={2}
              step={0.05}
              value={positionY}
              onChange={(e) => onPositionYChange(Number(e.target.value))}
              className="h-1.5 w-32 accent-blue-900"
            />
          </div>
        </div>
        
        {/* Dithering Controls */}
        <div className="mt-3 pt-3 border-t border-blue-900/10">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-blue-900/70">Dithering</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs">Enable Dithering</label>
              <button
                type="button"
                onClick={() => onDitheringEnabledChange(!ditheringEnabled)}
                className={`relative h-4 w-8 rounded-full transition-colors ${
                  ditheringEnabled ? 'bg-blue-900' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${
                    ditheringEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <div>
              <label className="mb-0.5 flex justify-between text-xs">
                <span>Grid Size</span>
                <span>{gridSize.toFixed(1)}</span>
              </label>
              <input
                type="range"
                min={1}
                max={20}
                step={0.5}
                value={gridSize}
                onChange={(e) => onGridSizeChange(Number(e.target.value))}
                className="h-1.5 w-32 accent-blue-900"
                disabled={!ditheringEnabled}
              />
            </div>
            <div>
              <label className="mb-0.5 flex justify-between text-xs">
                <span>Pixelation</span>
                <span>{pixelSizeRatio.toFixed(1)}</span>
              </label>
              <input
                type="range"
                min={1}
                max={10}
                step={0.5}
                value={pixelSizeRatio}
                onChange={(e) => onPixelSizeRatioChange(Number(e.target.value))}
                className="h-1.5 w-32 accent-blue-900"
                disabled={!ditheringEnabled}
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs">Grayscale</label>
              <button
                type="button"
                onClick={() => onGrayscaleOnlyChange(!grayscaleOnly)}
                disabled={!ditheringEnabled}
                className={`relative h-4 w-8 rounded-full transition-colors ${
                  grayscaleOnly ? 'bg-blue-900' : 'bg-gray-300'
                } ${!ditheringEnabled ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${
                    grayscaleOnly ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            {/* Color controls */}
            <div className="mt-2 space-y-1.5 border-t border-blue-900/10 pt-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-blue-900/60">Colors</p>
              <div>
                <label className="mb-0.5 block text-xs">Dark (R,G,B)</label>
                <div className="flex gap-1">
                  {([0, 1, 2] as const).map((i) => (
                    <input
                      key={i}
                      type="range"
                      min={0}
                      max={1}
                      step={0.02}
                      value={colorDark[i]}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        const next: [number, number, number] = [...colorDark];
                        next[i] = v;
                        onColorDarkChange(next);
                      }}
                      disabled={!ditheringEnabled}
                      className="h-1.5 flex-1 accent-blue-900"
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-xs">Custom light</label>
                <button
                  type="button"
                  onClick={() => onColorLightChange(useCustomLightColor ? null : [1, 1, 1])}
                  disabled={!ditheringEnabled}
                  className={`relative h-4 w-8 rounded-full transition-colors ${
                    useCustomLightColor ? 'bg-blue-900' : 'bg-gray-300'
                  } ${!ditheringEnabled ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${
                      useCustomLightColor ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              {useCustomLightColor && (
                <div>
                  <label className="mb-0.5 block text-xs">Light (R,G,B)</label>
                  <div className="flex gap-1">
                    {([0, 1, 2] as const).map((i) => (
                      <input
                        key={i}
                        type="range"
                        min={0}
                        max={1}
                        step={0.02}
                        value={colorLight[i]}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          const next: [number, number, number] = [...colorLight];
                          next[i] = v;
                          onColorLightChange(next);
                        }}
                        disabled={!ditheringEnabled}
                        className="h-1.5 flex-1 accent-blue-900"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
