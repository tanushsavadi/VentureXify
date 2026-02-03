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
      className={`relative cursor-pointer ${className}`}
    >
      {/* Card shadow - moves with tilt */}
      <motion.div 
        className="absolute inset-0 rounded-2xl bg-blue-900/30 blur-2xl"
        style={{
          transform: "translateZ(-50px) translateY(20px) scale(0.9)",
        }}
      />
      
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
        
        {/* Dynamic glare overlay */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.25) 0%, transparent 50%)`,
          }}
        />
        
        {/* Edge highlight */}
        <div 
          className="absolute inset-0 rounded-2xl border border-white/20 pointer-events-none"
          style={{ transform: "translateZ(2px)" }}
        />
      </div>
      
      {/* Floating reflection effect at bottom */}
      <motion.div
        className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-[80%] h-4 rounded-full bg-amber-500/20 blur-xl"
        style={{ transform: "translateZ(-30px)" }}
      />
    </motion.div>
  );
}
