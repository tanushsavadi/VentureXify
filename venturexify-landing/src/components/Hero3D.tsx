'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

function CreditCard({ mouse }: { mouse: React.MutableRefObject<{ x: number; y: number }> }) {
  const meshRef = useRef<THREE.Group>(null);
  const targetRotation = useRef({ x: 0, y: 0 });

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    // Smooth parallax based on mouse position
    targetRotation.current.x = mouse.current.y * 0.3;
    targetRotation.current.y = mouse.current.x * 0.3;

    // Lerp to target rotation
    meshRef.current.rotation.x = THREE.MathUtils.lerp(
      meshRef.current.rotation.x,
      targetRotation.current.x,
      delta * 3
    );
    meshRef.current.rotation.y = THREE.MathUtils.lerp(
      meshRef.current.rotation.y,
      targetRotation.current.y + Math.sin(state.clock.elapsedTime * 0.5) * 0.1,
      delta * 3
    );
  });

  return (
    <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
      <group ref={meshRef}>
        {/* Card base */}
        <RoundedBox args={[3.4, 2.1, 0.05]} radius={0.1} smoothness={4}>
          <meshStandardMaterial
            color="#1a1a1a"
            metalness={0.8}
            roughness={0.2}
          />
        </RoundedBox>
        
        {/* Card front overlay with gradient effect */}
        <mesh position={[0, 0, 0.03]}>
          <planeGeometry args={[3.3, 2]} />
          <meshStandardMaterial
            color="#0f0f0f"
            metalness={0.9}
            roughness={0.3}
            transparent
            opacity={0.8}
          />
        </mesh>

        {/* Amber accent line at top */}
        <mesh position={[0, 0.85, 0.031]}>
          <planeGeometry args={[3.2, 0.08]} />
          <meshBasicMaterial color="#f59e0b" />
        </mesh>

        {/* Chip */}
        <mesh position={[-1, 0.2, 0.035]}>
          <boxGeometry args={[0.45, 0.35, 0.02]} />
          <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.2} />
        </mesh>

        {/* Capital One text placeholder */}
        <mesh position={[0.8, 0.7, 0.031]}>
          <planeGeometry args={[1.2, 0.2]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
        </mesh>

        {/* Venture X text placeholder */}
        <mesh position={[0, -0.6, 0.031]}>
          <planeGeometry args={[1.5, 0.15]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.8} />
        </mesh>
      </group>
    </Float>
  );
}

function Particles() {
  const count = 100;
  const mesh = useRef<THREE.InstancedMesh>(null);
  
  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
      const position = new THREE.Vector3(
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 10 - 5
      );
      const speed = 0.01 + Math.random() * 0.02;
      const scale = 0.02 + Math.random() * 0.04;
      temp.push({ position, speed, scale });
    }
    return temp;
  }, []);

  useFrame((state) => {
    if (!mesh.current) return;
    
    const dummy = new THREE.Object3D();
    particles.forEach((particle, i) => {
      particle.position.y += particle.speed;
      if (particle.position.y > 10) particle.position.y = -10;
      
      dummy.position.copy(particle.position);
      dummy.scale.setScalar(particle.scale + Math.sin(state.clock.elapsedTime + i) * 0.01);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color="#f59e0b" transparent opacity={0.4} />
    </instancedMesh>
  );
}

function OrbitingElements() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.z = state.clock.elapsedTime * 0.2;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Orbiting mile symbols */}
      {[0, 1, 2, 3, 4].map((i) => {
        const angle = (i / 5) * Math.PI * 2;
        const radius = 2.5;
        return (
          <mesh
            key={i}
            position={[
              Math.cos(angle) * radius,
              Math.sin(angle) * radius,
              0,
            ]}
          >
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshBasicMaterial color="#f59e0b" />
          </mesh>
        );
      })}
    </group>
  );
}

function Scene({ mouse }: { mouse: React.MutableRefObject<{ x: number; y: number }> }) {
  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={1} color="#f59e0b" />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#8b5cf6" />
      <spotLight
        position={[0, 5, 5]}
        angle={0.5}
        penumbra={1}
        intensity={1}
        color="#ffffff"
      />
      
      <CreditCard mouse={mouse} />
      <Particles />
      <OrbitingElements />
    </>
  );
}

export default function Hero3D() {
  const mouse = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    mouse.current.x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    mouse.current.y = ((e.clientY - rect.top) / rect.height - 0.5) * -2;
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full"
      onMouseMove={handleMouseMove}
    >
      <Canvas
        camera={{ position: [0, 0, 6], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <Scene mouse={mouse} />
      </Canvas>
    </div>
  );
}
