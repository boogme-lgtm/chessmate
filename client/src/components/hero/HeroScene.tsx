import { Suspense, useRef } from "react";
import { Canvas, useFrame, extend } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Hero 3D scene — circle + lightning bolt + triangle.
 *
 * The brand motif from the editorial brief (logo = circle + bolt + triangle)
 * rendered as floating 3D primitives against the hero mesh backdrop.
 *
 * - Torus (circle), extruded bolt, tetrahedron (triangle)
 * - Slow rotation + sine-wave float
 * - Transparent canvas so the hero mesh bg shows through
 * - dpr capped at [1, 1.5] to stay cheap on high-DPR screens
 * - Ember primary accent lights the shapes against a dark/bone body
 */

// Lightning bolt 2D path → extruded to 3D.
function makeBoltShape() {
  const s = new THREE.Shape();
  // Classic zig-zag bolt, centred on origin-ish.
  s.moveTo(0.35, 1.0);
  s.lineTo(-0.45, 0.05);
  s.lineTo(-0.05, 0.05);
  s.lineTo(-0.35, -1.0);
  s.lineTo(0.55, 0.1);
  s.lineTo(0.1, 0.1);
  s.lineTo(0.35, 1.0);
  return s;
}

const BOLT_EXTRUDE = {
  depth: 0.22,
  bevelEnabled: true,
  bevelThickness: 0.04,
  bevelSize: 0.04,
  bevelSegments: 2,
};

function Torus() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!ref.current) return;
    ref.current.rotation.x = t * 0.12;
    ref.current.rotation.y = t * 0.18;
    ref.current.position.y = Math.sin(t * 0.5) * 0.15;
  });
  return (
    <mesh ref={ref} position={[-1.8, 0.3, 0]}>
      <torusGeometry args={[0.65, 0.12, 24, 96]} />
      <meshStandardMaterial
        color="#E8633A"
        metalness={0.35}
        roughness={0.35}
        emissive="#8B4513"
        emissiveIntensity={0.25}
      />
    </mesh>
  );
}

function Bolt() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!ref.current) return;
    ref.current.rotation.y = Math.sin(t * 0.35) * 0.4;
    ref.current.rotation.z = Math.sin(t * 0.22) * 0.08;
    ref.current.position.y = Math.sin(t * 0.4 + 1.5) * 0.18;
  });
  return (
    <mesh ref={ref} position={[0, -0.1, 0]} scale={0.9}>
      <extrudeGeometry args={[makeBoltShape(), BOLT_EXTRUDE]} />
      <meshStandardMaterial
        color="#F4EFE6"
        metalness={0.2}
        roughness={0.4}
        emissive="#E8633A"
        emissiveIntensity={0.15}
      />
    </mesh>
  );
}

function Triangle() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!ref.current) return;
    ref.current.rotation.x = t * 0.14;
    ref.current.rotation.y = -t * 0.2;
    ref.current.position.y = Math.sin(t * 0.45 + 3) * 0.16;
  });
  return (
    <mesh ref={ref} position={[1.85, 0.25, 0]}>
      <tetrahedronGeometry args={[0.85, 0]} />
      <meshStandardMaterial
        color="#8B4513"
        metalness={0.3}
        roughness={0.5}
        emissive="#E8633A"
        emissiveIntensity={0.18}
        flatShading
      />
    </mesh>
  );
}

export default function HeroScene() {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 5], fov: 42 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.45} />
      <directionalLight position={[4, 4, 5]} intensity={1.2} color="#F4EFE6" />
      <directionalLight position={[-4, -2, 3]} intensity={0.5} color="#E8633A" />
      <pointLight position={[0, 0, 3]} intensity={0.6} color="#E8633A" />
      <Suspense fallback={null}>
        <Torus />
        <Bolt />
        <Triangle />
      </Suspense>
    </Canvas>
  );
}
