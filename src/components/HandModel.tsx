import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const GLB_PATH = '/3d/hand.glb';

// Simple placeholder geometry when GLB file is not available
const createPlaceholderHand = () => {
  const group = new THREE.Group();
  
  // Create a simple hand-like shape using basic geometries
  const palmGeometry = new THREE.BoxGeometry(0.8, 0.3, 0.1);
  const palmMaterial = new THREE.MeshStandardMaterial({ color: 0xf4f4f4 });
  const palm = new THREE.Mesh(palmGeometry, palmMaterial);
  palm.position.set(0, 0, 0);
  group.add(palm);
  
  // Fingers
  const fingerGeometry = new THREE.BoxGeometry(0.1, 0.6, 0.08);
  const fingerMaterial = new THREE.MeshStandardMaterial({ color: 0xe8e8e8 });
  
  for (let i = 0; i < 4; i++) {
    const finger = new THREE.Mesh(fingerGeometry, fingerMaterial);
    finger.position.set(-0.3 + i * 0.2, 0.3, 0);
    finger.rotation.z = Math.PI * 0.1;
    group.add(finger);
  }
  
  // Thumb
  const thumbGeometry = new THREE.BoxGeometry(0.08, 0.4, 0.08);
  const thumb = new THREE.Mesh(thumbGeometry, fingerMaterial);
  thumb.position.set(0.4, 0, 0);
  thumb.rotation.z = -Math.PI * 0.2;
  group.add(thumb);
  
  return group;
};

const INIT_POS = { x: 0.10, y: -0.75, z: 0.65 };
const INIT_ROT = { x: -1.34, y: 2.96, z: 0.11 };

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
const HOVER_FLOAT_AMPLITUDE = 0.08; // Same as normal, no extra floating when hovered
const HOVER_FLOAT_FREQUENCY = 0.004; // Slightly slower frequency when hovered
const PROXIMITY_THRESHOLD = 400; // Increased threshold for wider hover area
const PROXIMITY_SMOOTHING = 0.03; // Even slower smoothing for steadier transitions
const MIN_SCALE = 1.0;
const MAX_SCALE = 1.01; // Minimal scale effect (1%)
const SCALE_SMOOTHING = 0.02; // Very slow scale transitions

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}): JSX.Element {
  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="w-6 shrink-0 font-medium">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-black"
      />
      <span className="w-12 shrink-0 tabular-nums">{value.toFixed(2)}</span>
    </label>
  );
}

export function HandModel(): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const positionRef = useRef(INIT_POS);
  const rotationRef = useRef(INIT_ROT);
  /** Normalized cursor from viewport center: -1..1, (0,0) = center. */
  const cursorRef = useRef({ x: 0, y: 0 });
  const cursorSmoothedRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const tiltStrengthRef = useRef(CURSOR_TILT_STRENGTH);
  const mouseProximityRef = useRef(1); // 0 = very close, 1 = far away
  const mouseProximitySmoothedRef = useRef(1); // Smoothed version
  const timeRef = useRef(0);

  const [position, setPosition] = useState(INIT_POS);
  const [rotation, setRotation] = useState(INIT_ROT);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    positionRef.current = position;
    rotationRef.current = rotation;
  }, [position, rotation]);

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
    renderer.toneMappingExposure = 1;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 1.5;
    controls.maxDistance = 8;
    controls.target.set(0, 0, 0);

    const loader = new GLTFLoader();
    loader.load(
      GLB_PATH,
      (gltf) => {
        const model = gltf.scene;
        modelRef.current = model;

        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
            if (mat?.name === 'Material__350') {
              mesh.visible = false;
              return;
            }
            mesh.castShadow = true;
            mesh.receiveShadow = true;
          }
        });

        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);

        scene.add(model);
      },
      undefined,
      (err) => {
        console.warn('GLB file not found, using placeholder geometry:', err);
        // Create and use placeholder geometry
        const placeholderModel = createPlaceholderHand();
        modelRef.current = placeholderModel;
        
        // Center the placeholder
        const box = new THREE.Box3().setFromObject(placeholderModel);
        const center = box.getCenter(new THREE.Vector3());
        placeholderModel.position.sub(center);
        
        scene.add(placeholderModel);
      }
    );

    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 0.6);
    key.position.set(2, 2, 3);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.3);
    fill.position.set(-1, 0.5, 2);
    scene.add(fill);

    const centerX = (): number => window.innerWidth / 2;
    const centerY = (): number => window.innerHeight / 2;
    const onMouseMove = (e: MouseEvent): void => {
      const cx = centerX();
      const cy = centerY();
      const nx = Math.max(-1, Math.min(1, (e.clientX - cx) / cx));
      const ny = Math.max(-1, Math.min(1, (e.clientY - cy) / cy));
      cursorRef.current = { x: nx, y: ny };

      // Calculate mouse proximity to model center (right side of screen)
      const modelCenterX = window.innerWidth * 0.75; // Model is in right 50% of screen
      const modelCenterY = window.innerHeight * 0.5;
      const distance = Math.sqrt(
        Math.pow(e.clientX - modelCenterX, 2) + Math.pow(e.clientY - modelCenterY, 2)
      );
      // Normalize distance to 0-1 range (0 = very close, 1 = far away)
      // Use a wider threshold and smoother curve
      const normalizedDistance = Math.min(1, Math.max(0, distance / PROXIMITY_THRESHOLD));
      // Apply easing function for smoother transitions
      const easedProximity = 1 - (1 - normalizedDistance) * (1 - normalizedDistance); // Quadratic ease-out
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

      // Smooth proximity changes very gradually
      const currentProximity = mouseProximitySmoothedRef.current;
      const newProximity = currentProximity + (mouseProximityRef.current - currentProximity) * PROXIMITY_SMOOTHING;
      mouseProximitySmoothedRef.current = newProximity;

      // Update hover state for CSS effects
      const isNear = newProximity < 0.8; // Consider "hovered" when proximity is less than 80%
      if (isNear !== isHovered) {
        setIsHovered(isNear);
      }

      // Update time for floating animation
      timeRef.current += 16; // Approximate 60fps frame time

      const model = modelRef.current;
      if (model) {
        const p = positionRef.current;
        const r = rotationRef.current;
        const strength = tiltStrengthRef.current;
        const tiltX = sm.y * strength;
        const tiltY = sm.x * strength;

        // Use smoothed proximity for all effects
        const proximity = newProximity; // 0 = close, 1 = far
        const floatAmplitude = FLOAT_AMPLITUDE + (1 - proximity) * (HOVER_FLOAT_AMPLITUDE - FLOAT_AMPLITUDE);
        const floatFrequency = FLOAT_FREQUENCY + (1 - proximity) * (HOVER_FLOAT_FREQUENCY - FLOAT_FREQUENCY);
        
        // Add subtle floating motion
        const floatY = Math.sin(timeRef.current * floatFrequency) * floatAmplitude;
        const floatX = Math.cos(timeRef.current * floatFrequency * 0.7) * floatAmplitude * 0.5;
        const floatZ = Math.sin(timeRef.current * floatFrequency * 1.3) * floatAmplitude * 0.3;

        // Smooth scale transitions
        const currentScale = model.scale.x;
        const targetScale = MIN_SCALE + (1 - proximity) * (MAX_SCALE - MIN_SCALE);
        const newScale = currentScale + (targetScale - currentScale) * SCALE_SMOOTHING;
        model.scale.setScalar(newScale);

        // Reduced look-at effect to be very subtle
        const lookAtStrength = (1 - proximity) * 0.05; // Max 0.05 radians rotation (half of before)
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

  return (
    <div className={`relative h-full w-full min-h-[200px] transition-all duration-300 ease-out model-container ${isHovered ? 'hover' : ''}`} aria-hidden="true">
      <div ref={containerRef} className="h-full w-full" />
      <div
        className="absolute bottom-2 left-2 right-2 rounded-md border border-black/20 bg-white/90 p-3 shadow-sm backdrop-blur sm:right-auto sm:w-52"
        aria-hidden="true"
      >
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-black/70">Position</p>
        <div className="flex flex-col gap-1.5">
          <SliderRow
            label="X"
            value={position.x}
            min={-2}
            max={2}
            step={0.05}
            onChange={(x) => setPosition((p) => ({ ...p, x }))}
          />
          <SliderRow
            label="Y"
            value={position.y}
            min={-2}
            max={2}
            step={0.05}
            onChange={(y) => setPosition((p) => ({ ...p, y }))}
          />
          <SliderRow
            label="Z"
            value={position.z}
            min={-2}
            max={2}
            step={0.05}
            onChange={(z) => setPosition((p) => ({ ...p, z }))}
          />
        </div>
        <p className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wide text-black/70">Rotation</p>
        <div className="flex flex-col gap-1.5">
          <SliderRow
            label="X"
            value={rotation.x}
            min={-Math.PI}
            max={Math.PI}
            step={0.05}
            onChange={(x) => setRotation((r) => ({ ...r, x }))}
          />
          <SliderRow
            label="Y"
            value={rotation.y}
            min={-Math.PI}
            max={Math.PI}
            step={0.05}
            onChange={(y) => setRotation((r) => ({ ...r, y }))}
          />
          <SliderRow
            label="Z"
            value={rotation.z}
            min={-Math.PI}
            max={Math.PI}
            step={0.05}
            onChange={(z) => setRotation((r) => ({ ...r, z }))}
          />
        </div>
      </div>
    </div>
  );
}
