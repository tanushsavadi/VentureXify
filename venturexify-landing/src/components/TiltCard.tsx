'use client';

import * as React from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import Image from "next/image";

interface TiltCardProps {
  imageSrc: string;
  imageAlt: string;
  className?: string;
}

export function TiltCard({ imageSrc, imageAlt, className }: TiltCardProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  
  // Motion values for mouse position
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);
  
  // Smooth springs for rotation
  const rotateX = useSpring(useTransform(mouseY, [0, 1], [15, -15]), {
    stiffness: 150,
    damping: 20,
  });
  const rotateY = useSpring(useTransform(mouseX, [0, 1], [-15, 15]), {
    stiffness: 150,
    damping: 20,
  });
  
  // Glare position
  const glareX = useSpring(useTransform(mouseX, [0, 1], [0, 100]), {
    stiffness: 150,
    damping: 20,
  });
  const glareY = useSpring(useTransform(mouseY, [0, 1], [0, 100]), {
    stiffness: 150,
    damping: 20,
  });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0.5);
    mouseY.set(0.5);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      }}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className={`relative cursor-pointer group ${className}`}
    >
      {/* Card shadow - moves with tilt */}
      <motion.div
        className="absolute inset-0 rounded-2xl bg-blue-900/30 blur-2xl"
        style={{
          transform: "translateZ(-50px) translateY(20px) scale(0.9)",
        }}
      />
      
      {/* Rotating white border light */}
      <div
        className="absolute -inset-[3px] rounded-2xl overflow-hidden"
        style={{ transform: "translateZ(-1px)" }}
      >
        <div
          className="absolute w-[200%] h-[200%] -top-1/2 -left-1/2"
          style={{
            background: 'conic-gradient(from 0deg, transparent 0deg, transparent 60deg, rgba(255,255,255,0.6) 90deg, #fff 120deg, rgba(255,255,255,0.6) 150deg, transparent 180deg, transparent 360deg)',
            animation: 'spin-around 4s linear infinite',
          }}
        />
        {/* Dark background to mask inner area */}
        <div className="absolute inset-[3px] rounded-2xl bg-black" />
      </div>
      
      {/* Main card container */}
      <div
        className="relative rounded-2xl overflow-hidden shadow-2xl"
        style={{ transform: "translateZ(0px)" }}
      >
        {/* The actual card image */}
        <div className="relative w-[340px] h-[215px] sm:w-[380px] sm:h-[240px]">
          <Image
            src={imageSrc}
            alt={imageAlt}
            fill
            className="object-cover"
            priority
          />
        </div>
        
        {/* Dynamic glare overlay - enhanced metallic effect */}
        <motion.div
          className="absolute inset-0 pointer-events-none transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.1) 30%, transparent 60%)`,
          }}
        />
        
        {/* Metallic shine sweep on hover */}
        <div
          className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.3) 45%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0.3) 55%, transparent 60%)',
            transform: 'translateX(-100%)',
            animation: 'none',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none overflow-hidden"
        >
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100"
            style={{
              background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.4) 45%, rgba(255,255,255,0.6) 50%, rgba(255,255,255,0.4) 55%, transparent 60%)',
              animation: 'shimmer-slide 5s ease-in-out infinite',
            }}
          />
        </div>
        
        {/* Edge highlight - enhanced */}
        <div
          className="absolute inset-0 rounded-2xl border border-white/30 pointer-events-none group-hover:border-white/50 transition-colors duration-300"
          style={{ transform: "translateZ(2px)" }}
        />
      </div>
      
    </motion.div>
  );
}
