/**
 * COPY THIS ENTIRE FILE for the 3D scene.
 * Project: Thoughtform Worldwide. Astro + React + Three.js (vanilla).
 * Page: 3D hand lives in a fixed right panel (66vw × 100dvh). Background #E6EDF7.
 * Model: /3d/masTer_hand.glb. Textures: /3d/TowelCotton001/*.png (towel cotton PBR).
 * File in repo: src/components/HandModel.tsx
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TextureLoader } from 'three';

const GLB_PATH = '/3d/masTer_hand.glb';

const TEXTURE_BASE_PATH = '/3d/TowelCotton001';
const TOWEL_TEXTURES = {
  color: `${TEXTURE_BASE_PATH}/TowelCotton001_COL_1K.png`,
  normal: `${TEXTURE_BASE_PATH}/TowelCotton001_NRM_1K.png`,
  roughness: `${TEXTURE_BASE_PATH}/TowelCotton001_ROUGHNESS_1K_METALNESS.png`,
  ao: `${TEXTURE_BASE_PATH}/TowelCotton001_AO_1K.png`,
  displacement: `${TEXTURE_BASE_PATH}/TowelCotton001_DISP_1K.png`
};

const createTowelCottonMaterial = (textureLoader: TextureLoader) => {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.8,
    metalness: 0.0,
  });

  textureLoader.load(
    TOWEL_TEXTURES.color,
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(2, 2);
      material.map = texture;
      material.needsUpdate = true;
    },
    undefined,
    (error) => console.warn('Failed to load color texture:', error)
  );

  textureLoader.load(
    TOWEL_TEXTURES.normal,
    (texture) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(2, 2);
      material.normalMap = texture;
      material.needsUpdate = true;
    },
    undefined,
    (error) => console.warn('Failed to load normal texture:', error)
  );

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

  textureLoader.load(
    TOWEL_TEXTURES.ao,
    (texture) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(2, 2);
      material.aoMap = texture;
      material.needsUpdate = true;
    },
    undefined,
    (error) => console.warn('Failed to load AO texture:', error)
  );

  return material;
};

const createPlaceholderHand = (textureLoader: TextureLoader) => {
  const group = new THREE.Group();
  const placeholderMaterial = createTowelCottonMaterial(textureLoader);
  const palmGeometry = new THREE.BoxGeometry(0.8, 0.3, 0.1);
  const palm = new THREE.Mesh(palmGeometry, placeholderMaterial);
  palm.position.set(0, 0, 0);
  group.add(palm);
  const fingerGeometry = new THREE.BoxGeometry(0.1, 0.6, 0.08);
  for (let i = 0; i < 4; i++) {
    const finger = new THREE.Mesh(fingerGeometry, placeholderMaterial);
    finger.position.set(-0.3 + i * 0.2, 0.3, 0);
    finger.rotation.z = Math.PI * 0.1;
    group.add(finger);
  }
  const thumbGeometry = new THREE.BoxGeometry(0.08, 0.4, 0.08);
  const thumb = new THREE.Mesh(thumbGeometry, placeholderMaterial);
  thumb.position.set(0.4, 0, 0);
  thumb.rotation.z = -Math.PI * 0.2;
  group.add(thumb);
  return group;
};

const INIT_POS = { x: 0.10, y: -0.75, z: 0.65 };
const INIT_ROT = { x: -1.34, y: 2.96, z: 0.11 };
const RAD_TO_DEG = 180 / Math.PI;
const CURSOR_TILT_STRENGTH = 0.12;
const DRAG_TILT_STRENGTH = 0.4;
const CURSOR_LERP = 0.08;
const DRAG_LERP = 0.18;
const TILT_STRENGTH_LERP = 0.12;
const FLOAT_AMPLITUDE = 0.08;
const FLOAT_FREQUENCY = 0.003;
const HOVER_FLOAT_AMPLITUDE = 0.08;
const HOVER_FLOAT_FREQUENCY = 0.004;
const PROXIMITY_THRESHOLD = 400;
const PROXIMITY_SMOOTHING = 0.03;
const MIN_SCALE = 1.0;
const MAX_SCALE = 1.01;
const SCALE_SMOOTHING = 0.02;

export function HandModel(): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const baseScaleRef = useRef(1);
  const positionRef = useRef(INIT_POS);
  const rotationRef = useRef(INIT_ROT);
  const rotationSliderRef = useRef({ ...INIT_ROT });
  const scaleSliderRef = useRef(1);
  const [rotationDeg, setRotationDeg] = useState({
    x: Math.round(INIT_ROT.x * RAD_TO_DEG),
    y: Math.round(INIT_ROT.y * RAD_TO_DEG),
    z: Math.round(INIT_ROT.z * RAD_TO_DEG)
  });
  const [scale, setScale] = useState(1);
  const cursorRef = useRef({ x: 0, y: 0 });
  const cursorSmoothedRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const tiltStrengthRef = useRef(CURSOR_TILT_STRENGTH);
  const mouseProximityRef = useRef(1);
  const mouseProximitySmoothedRef = useRef(1);
  const timeRef = useRef(0);
  const [isHovered, setIsHovered] = useState(false);

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
    renderer.toneMappingExposure = 1.5;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 1.5;
    controls.maxDistance = 8;
    controls.target.set(0, 0, 0);

    const loader = new GLTFLoader();
    const textureLoader = new TextureLoader();
    const TARGET_SIZE = 1.8;

    const processModel = (model: THREE.Group, texLoader: TextureLoader): THREE.Group => {
      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
          if (mat?.name === 'Material__350') {
            mesh.visible = false;
            return;
          }
          mesh.material = createTowelCottonMaterial(texLoader);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
      });
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      model.position.sub(center);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z, 0.001);
      const baseScale = TARGET_SIZE / maxDim;
      baseScaleRef.current = baseScale;
      model.scale.setScalar(baseScale);
      return model;
    };

    loader.load(
      GLB_PATH,
      (gltf) => {
        const model = processModel(gltf.scene, textureLoader);
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
        modelRef.current = placeholderModel;
        baseScaleRef.current = 1;
        scene.add(placeholderModel);
      }
    );

    const ambient = new THREE.AmbientLight(0xffffff, 0.95);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(2, 2, 3);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.6);
    fill.position.set(-1, 0.5, 2);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.4);
    rim.position.set(0, 0, -3);
    scene.add(rim);
    const overhead = new THREE.DirectionalLight(0xffffff, 0.3);
    overhead.position.set(0, 3, 0);
    scene.add(overhead);

    const centerX = (): number => window.innerWidth / 2;
    const centerY = (): number => window.innerHeight / 2;
    const onMouseMove = (e: MouseEvent): void => {
      const cx = centerX();
      const cy = centerY();
      const nx = Math.max(-1, Math.min(1, (e.clientX - cx) / cx));
      const ny = Math.max(-1, Math.min(1, (e.clientY - cy) / cy));
      cursorRef.current = { x: nx, y: ny };
      const modelCenterX = window.innerWidth * 0.75;
      const modelCenterY = window.innerHeight * 0.5;
      const distance = Math.sqrt(
        Math.pow(e.clientX - modelCenterX, 2) + Math.pow(e.clientY - modelCenterY, 2)
      );
      const normalizedDistance = Math.min(1, Math.max(0, distance / PROXIMITY_THRESHOLD));
      const easedProximity = 1 - (1 - normalizedDistance) * (1 - normalizedDistance);
      mouseProximityRef.current = easedProximity;
    };
    const onMouseDown = (): void => {
      isDraggingRef.current = true;
      controls.enabled = false;
    };
    const onMouseUp = (): void => {
      isDraggingRef.current = false;
      controls.enabled = true;
    };
    window.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);

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
      const currentProximity = mouseProximitySmoothedRef.current;
      const newProximity = currentProximity + (mouseProximityRef.current - currentProximity) * PROXIMITY_SMOOTHING;
      mouseProximitySmoothedRef.current = newProximity;
      const isNear = newProximity < 0.8;
      if (isNear !== isHovered) {
        setIsHovered(isNear);
      }
      timeRef.current += 16;

      const model = modelRef.current;
      if (model) {
        const p = positionRef.current;
        const r = rotationSliderRef.current;
        const strength = tiltStrengthRef.current;
        const tiltX = sm.y * strength;
        const tiltY = sm.x * strength;
        const proximity = newProximity;
        const floatAmplitude = FLOAT_AMPLITUDE + (1 - proximity) * (HOVER_FLOAT_AMPLITUDE - FLOAT_AMPLITUDE);
        const floatFrequency = FLOAT_FREQUENCY + (1 - proximity) * (HOVER_FLOAT_FREQUENCY - FLOAT_FREQUENCY);
        const floatY = Math.sin(timeRef.current * floatFrequency) * floatAmplitude;
        const floatX = Math.cos(timeRef.current * floatFrequency * 0.7) * floatAmplitude * 0.5;
        const floatZ = Math.sin(timeRef.current * floatFrequency * 1.3) * floatAmplitude * 0.3;
        const targetHoverScale = MIN_SCALE + (1 - proximity) * (MAX_SCALE - MIN_SCALE);
        const baseScale = baseScaleRef.current;
        const scaleMult = scaleSliderRef.current;
        const currentHover = model.scale.x / (baseScale * scaleMult);
        const newHover = currentHover + (targetHoverScale - currentHover) * SCALE_SMOOTHING;
        model.scale.setScalar(baseScale * scaleMult * newHover);
        const lookAtStrength = (1 - proximity) * 0.05;
        const lookAtX = sm.y * lookAtStrength;
        const lookAtY = sm.x * lookAtStrength;
        model.position.set(p.x + floatX, p.y + floatY, p.z + floatZ);
        model.rotation.set(r.x + tiltX + lookAtX, r.y + tiltY + lookAtY, r.z);
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = (): void => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      modelRef.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(frameId);
      controls.dispose();
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

  return (
    <div className={`relative h-full w-full min-h-[200px] transition-all duration-300 ease-out model-container ${isHovered ? 'hover' : ''}`} aria-hidden="true">
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
        </div>
      </div>
    </div>
  );
}
