'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { Menu, X, Sparkles } from 'lucide-react';
import { ScrambleText } from './ScrambleText';
import { FlipText } from './FlipText';

const navLinks = [
  { name: 'Features', href: '#features' },
  { name: 'How it Works', href: '#how-it-works' },
  { name: 'Privacy', href: '#privacy' },
  { name: 'About', href: '#why-i-built-this' },
];

// Section display names for mobile indicator
const sectionDisplayNames: Record<number, string> = {
  [-1]: 'Home',
  0: 'Features',
  1: 'How it Works',
  2: 'Privacy',
  3: 'About',
  4: 'Get Access',
};

// Section IDs in order (including hero and CTA)
const ALL_SECTIONS = ['hero', 'features', 'how-it-works', 'privacy', 'why-i-built-this', 'cta'];

interface SectionBoundary {
  id: string;
  top: number;
  bottom: number;
  navIndex: number; // -1 for hero, 0-3 for nav links, 4 for CTA
}

export default function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAtTop, setIsAtTop] = useState(true);
  const [isAtCTA, setIsAtCTA] = useState(false);
  const [activeNavIndex, setActiveNavIndex] = useState(-1); // -1 = hero, 0-3 = nav items, 4 = CTA
  
  // Refs for nav link elements to get their positions
  const navLinksRef = useRef<(HTMLAnchorElement | null)[]>([]);
  const logoRef = useRef<HTMLAnchorElement>(null);
  const navContainerRef = useRef<HTMLDivElement>(null);
  
  // Motion values for smooth bubble animation
  const bubbleX = useMotionValue(0);
  const bubbleWidth = useMotionValue(0);
  const bubbleOpacity = useMotionValue(0);
  
  // Spring physics for ultra-smooth transitions
  const springConfig = { damping: 30, stiffness: 300, mass: 0.8 };
  const smoothX = useSpring(bubbleX, springConfig);
  const smoothWidth = useSpring(bubbleWidth, springConfig);
  const smoothOpacity = useSpring(bubbleOpacity, { damping: 25, stiffness: 200 });
  
  // Track scroll progress between sections (0-1 for each section transition)
  const scrollProgress = useMotionValue(0);
  const currentSectionIndex = useMotionValue(-1);
  
  // Calculate section boundaries
  const getSectionBoundaries = useCallback((): SectionBoundary[] => {
    const boundaries: SectionBoundary[] = [];
    
    ALL_SECTIONS.forEach((sectionId, index) => {
      let el: HTMLElement | null = null;
      
      if (sectionId === 'hero') {
        // Hero is from top to first section
        const featuresEl = document.getElementById('features');
        boundaries.push({
          id: 'hero',
          top: 0,
          bottom: featuresEl ? featuresEl.offsetTop : window.innerHeight,
          navIndex: -1,
        });
        return;
      }
      
      el = document.getElementById(sectionId);
      if (el) {
        const nextSectionId = ALL_SECTIONS[index + 1];
        const nextEl = nextSectionId ? document.getElementById(nextSectionId) : null;
        
        boundaries.push({
          id: sectionId,
          top: el.offsetTop,
          bottom: nextEl ? nextEl.offsetTop : document.documentElement.scrollHeight,
          navIndex: sectionId === 'cta' ? 4 : navLinks.findIndex(l => l.href === `#${sectionId}`),
        });
      }
    });
    
    return boundaries;
  }, []);

  // Update bubble position based on nav link positions
  const updateBubblePosition = useCallback((targetIndex: number, progress: number = 1) => {
    if (!navContainerRef.current) return;
    
    const containerRect = navContainerRef.current.getBoundingClientRect();
    
    // If at hero (targetIndex === -1) or CTA (targetIndex === 4), hide bubble
    if (targetIndex === -1 || targetIndex === 4 || targetIndex >= navLinks.length) {
      bubbleOpacity.set(0);
      return;
    }
    
    const currentLink = navLinksRef.current[targetIndex];
    if (!currentLink) return;
    
    const linkRect = currentLink.getBoundingClientRect();
    const relativeX = linkRect.left - containerRect.left;
    
    bubbleX.set(relativeX);
    bubbleWidth.set(linkRect.width);
    bubbleOpacity.set(1);
  }, [bubbleX, bubbleWidth, bubbleOpacity]);

  // Interpolate bubble position between two nav items
  const interpolateBubblePosition = useCallback((
    fromIndex: number,
    toIndex: number,
    progress: number
  ) => {
    if (!navContainerRef.current) return;
    
    const containerRect = navContainerRef.current.getBoundingClientRect();
    
    // Handle edge cases (hero and CTA)
    const isFromValid = fromIndex >= 0 && fromIndex < navLinks.length;
    const isToValid = toIndex >= 0 && toIndex < navLinks.length;
    
    // Transitioning from hero to first section
    if (fromIndex === -1 && isToValid) {
      const toLink = navLinksRef.current[toIndex];
      if (!toLink) return;
      
      const toRect = toLink.getBoundingClientRect();
      const toX = toRect.left - containerRect.left;
      
      // Slide in from the left with fade
      bubbleX.set(toX - (1 - progress) * 50);
      bubbleWidth.set(toRect.width);
      bubbleOpacity.set(progress);
      return;
    }
    
    // Transitioning from last section to CTA
    if (isFromValid && toIndex === 4) {
      const fromLink = navLinksRef.current[fromIndex];
      if (!fromLink) return;
      
      const fromRect = fromLink.getBoundingClientRect();
      const fromX = fromRect.left - containerRect.left;
      
      // Slide out to the right with fade
      bubbleX.set(fromX + progress * 50);
      bubbleWidth.set(fromRect.width);
      bubbleOpacity.set(1 - progress);
      return;
    }
    
    // Both indices invalid - hide bubble
    if (!isFromValid && !isToValid) {
      bubbleOpacity.set(0);
      return;
    }
    
    // Normal interpolation between two valid nav items
    if (isFromValid && isToValid) {
      const fromLink = navLinksRef.current[fromIndex];
      const toLink = navLinksRef.current[toIndex];
      
      if (!fromLink || !toLink) return;
      
      const fromRect = fromLink.getBoundingClientRect();
      const toRect = toLink.getBoundingClientRect();
      
      const fromX = fromRect.left - containerRect.left;
      const toX = toRect.left - containerRect.left;
      
      // Smooth interpolation
      const currentX = fromX + (toX - fromX) * progress;
      const currentWidth = fromRect.width + (toRect.width - fromRect.width) * progress;
      
      bubbleX.set(currentX);
      bubbleWidth.set(currentWidth);
      bubbleOpacity.set(1);
      return;
    }
    
    // One valid, use that position
    const validIndex = isFromValid ? fromIndex : toIndex;
    const validLink = navLinksRef.current[validIndex];
    if (validLink) {
      const rect = validLink.getBoundingClientRect();
      bubbleX.set(rect.left - containerRect.left);
      bubbleWidth.set(rect.width);
      bubbleOpacity.set(isFromValid ? (1 - progress) : progress);
    }
  }, [bubbleX, bubbleWidth, bubbleOpacity]);

  useEffect(() => {
    let ticking = false;
    
    const handleScroll = () => {
      if (ticking) return;
      
      ticking = true;
      requestAnimationFrame(() => {
        const scrollY = window.scrollY;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        
        setIsScrolled(scrollY > 50);
        setIsAtTop(scrollY < 100);
        
        // Check if at CTA section
        const ctaEl = document.getElementById('cta');
        const isNearBottom = scrollY + windowHeight >= documentHeight - 100;
        const isAtCtaSection = ctaEl ? scrollY >= ctaEl.offsetTop - 300 : false;
        setIsAtCTA(isNearBottom || isAtCtaSection);
        
        // Get section boundaries
        const boundaries = getSectionBoundaries();
        
        // Find current section and calculate progress
        const viewportCenter = scrollY + windowHeight * 0.4; // Slightly above center
        
        for (let i = 0; i < boundaries.length; i++) {
          const boundary = boundaries[i];
          const nextBoundary = boundaries[i + 1];
          
          if (viewportCenter >= boundary.top && viewportCenter < boundary.bottom) {
            const fromIndex = boundary.navIndex;
            const toIndex = nextBoundary ? nextBoundary.navIndex : boundary.navIndex;
            
            // Calculate progress within current section
            const sectionHeight = boundary.bottom - boundary.top;
            const progressInSection = Math.min(1, Math.max(0,
              (viewportCenter - boundary.top) / sectionHeight
            ));
            
            // Apply easing for smoother feel
            const easedProgress = progressInSection;
            
            // Determine transition threshold (when to start moving to next section)
            const transitionStart = 0.6; // Start transition at 60% through section
            
            if (progressInSection > transitionStart && nextBoundary && nextBoundary.navIndex !== boundary.navIndex) {
              // Transitioning to next section
              const transitionProgress = (progressInSection - transitionStart) / (1 - transitionStart);
              interpolateBubblePosition(fromIndex, toIndex, transitionProgress);
            } else {
              // Still in current section
              updateBubblePosition(fromIndex, 1);
            }
            
            currentSectionIndex.set(fromIndex);
            scrollProgress.set(progressInSection);
            
            // Update the activeNavIndex for mobile menu highlighting
            setActiveNavIndex(fromIndex);
            break;
          }
        }
        
        ticking = false;
      });
    };
    
    // Also update on resize to recalculate positions
    const handleResize = () => {
      handleScroll();
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });
    
    // Initial calculation after mount
    setTimeout(handleScroll, 100);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [getSectionBoundaries, updateBubblePosition, interpolateBubblePosition, currentSectionIndex, scrollProgress]);

  return (
    <>
      {/* Floating Navigation */}
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 pt-4 md:pt-6"
      >
        <motion.nav
          className={`
            relative flex items-center justify-between gap-4 md:gap-8
            w-full max-w-4xl
            px-4 md:px-8 py-3 md:py-3.5
            rounded-2xl md:rounded-full
            transition-all duration-500 ease-out
            ${isScrolled
              ? 'bg-black/40 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)]'
              : 'bg-white/[0.02] backdrop-blur-xl border border-white/[0.05]'
            }
          `}
          animate={{
            scale: isScrolled ? 1 : 1.02,
          }}
          transition={{ duration: 0.3 }}
        >
          {/* Gradient border glow effect */}
          <div className="absolute inset-0 rounded-2xl md:rounded-full overflow-hidden pointer-events-none">
            <div className={`
              absolute inset-0 rounded-2xl md:rounded-full
              transition-opacity duration-500
              ${isScrolled ? 'opacity-100' : 'opacity-0'}
            `}>
              <div className="absolute inset-[-1px] rounded-2xl md:rounded-full bg-gradient-to-r from-amber-500/20 via-transparent to-orange-500/20" />
            </div>
          </div>

          {/* Ambient glow */}
          <motion.div
            className="absolute inset-0 rounded-2xl md:rounded-full pointer-events-none"
            animate={{
              boxShadow: isScrolled 
                ? '0 0 60px rgba(245, 158, 11, 0.08), 0 0 100px rgba(249, 115, 22, 0.04)' 
                : '0 0 40px rgba(245, 158, 11, 0.03)'
            }}
            transition={{ duration: 0.5 }}
          />

          {/* Logo - Highlighted when at hero/top */}
          <motion.a
            ref={logoRef}
            href="#"
            className="relative flex items-center gap-2.5 z-10"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {/* Logo glow when at top - subtle */}
            <motion.div
              className="absolute -inset-1.5 rounded-2xl pointer-events-none"
              animate={{
                opacity: isAtTop ? 0.6 : 0,
                scale: isAtTop ? 1 : 0.9,
              }}
              transition={{ duration: 0.4 }}
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-amber-500/20 blur-lg" />
            </motion.div>
            
            {/* Logo icon */}
            <motion.div
              className={`
                relative w-9 h-9 rounded-xl flex items-center justify-center
                bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500
                transition-all duration-300
                ${isAtTop
                  ? 'shadow-[0_0_15px_rgba(245,158,11,0.35)]'
                  : 'shadow-lg shadow-amber-500/20'
                }
              `}
              animate={{
                scale: isAtTop ? 1.03 : 1,
              }}
              whileHover={{
                rotate: [0, -5, 5, 0],
                transition: { duration: 0.4 }
              }}
            >
              <span className="text-black font-bold text-sm">VX</span>
            </motion.div>
            
            {/* Brand name with encrypted reveal effect when at hero */}
            <div className="hidden sm:flex items-center relative">
              {/* Outer glow container */}
              <motion.div
                animate={{
                  textShadow: isAtTop
                    ? '0 0 10px rgba(245, 158, 11, 0.6), 0 0 20px rgba(245, 158, 11, 0.4), 0 0 30px rgba(245, 158, 11, 0.2)'
                    : '0 0 0px rgba(245, 158, 11, 0)',
                }}
                transition={{ duration: 0.4 }}
                className="text-base font-semibold text-white"
              >
                <ScrambleText
                  text="VentureXify"
                  isActive={isAtTop}
                  className={isAtTop ? 'aurora-text' : 'text-white'}
                  scrambleSpeed={40}
                  revealDelay={80}
                />
              </motion.div>
            </div>
          </motion.a>

          {/* Mobile Section Indicator - Minimal Premium Style */}
          <div className="flex md:hidden items-center flex-1 justify-center relative z-10">
            <motion.div
              className="flex items-center gap-1.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              {/* Subtle amber accent line */}
              <motion.div
                className="w-4 h-[1px] bg-gradient-to-r from-amber-500/60 to-transparent"
                animate={{
                  opacity: [0.4, 0.8, 0.4],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
              
              {/* Flip text section name - clean typography */}
              <FlipText
                text={sectionDisplayNames[activeNavIndex] || 'Home'}
                className="text-sm font-medium tracking-wide text-white/80"
                duration={0.35}
                direction="down"
              />
              
              {/* Subtle amber accent line */}
              <motion.div
                className="w-4 h-[1px] bg-gradient-to-l from-amber-500/60 to-transparent"
                animate={{
                  opacity: [0.4, 0.8, 0.4],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            </motion.div>
          </div>

          {/* Desktop Navigation Links */}
          <div
            ref={navContainerRef}
            className="hidden md:flex items-center gap-1 relative z-10"
          >
            {/* Animated bubble indicator - the smooth sliding background */}
            <motion.div
              className="absolute rounded-full bg-white/10 pointer-events-none"
              style={{
                x: smoothX,
                width: smoothWidth,
                opacity: smoothOpacity,
                height: '100%',
                top: 0,
              }}
            >
              {/* Inner glow effect */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-500/5 via-white/5 to-amber-500/5" />
              {/* Subtle border */}
              <div className="absolute inset-0 rounded-full border border-white/10" />
            </motion.div>
            
            {navLinks.map((link, index) => {
              return (
                <motion.a
                  key={link.name}
                  ref={(el) => { navLinksRef.current[index] = el; }}
                  href={link.href}
                  className="relative px-4 py-2 text-sm font-medium rounded-full text-white/50 hover:text-white/80 transition-colors duration-200"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span className="relative z-10">{link.name}</span>
                </motion.a>
              );
            })}
          </div>

          {/* CTA Button - Desktop - Highlighted when at CTA section */}
          <div className="hidden md:block relative z-10">
            {/* Rotating border light effect when at CTA - OUTSIDE the button */}
            {isAtCTA && (
              <div className="absolute -inset-[3px] rounded-full overflow-hidden pointer-events-none">
                <motion.div
                  className="absolute w-[200%] h-[200%] -top-1/2 -left-1/2"
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 2.5,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  style={{
                    background: 'conic-gradient(from 0deg, transparent 0deg, transparent 70deg, #fff 85deg, #fef3c7 100deg, #fff 115deg, transparent 130deg, transparent 360deg)',
                  }}
                />
                {/* Dark inner mask to show white border light */}
                <div className="absolute inset-[2px] rounded-full bg-[#0A0A0B]" />
              </div>
            )}
            
            <motion.a
              href="#cta"
              className="
                relative flex items-center gap-2
                text-sm font-semibold
                px-5 py-2.5 rounded-full
                bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500
                overflow-hidden
              "
              animate={{
                scale: isAtCTA ? 1.03 : 1,
                boxShadow: isAtCTA
                  ? '0 4px 15px rgba(245, 158, 11, 0.25)'
                  : '0 4px 10px rgba(245, 158, 11, 0.15)',
              }}
              whileHover={{
                scale: 1.06,
                boxShadow: '0 8px 20px rgba(245, 158, 11, 0.35)'
              }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              {/* Shine sweep effect when at CTA - synced with other buttons */}
              {isAtCTA && (
                <span
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/35 to-transparent"
                  style={{
                    animation: 'shimmer-slide 1.5s ease-in-out infinite',
                  }}
                />
              )}
              <Sparkles className="w-4 h-4 text-black relative z-10" />
              <span className="relative z-10 text-black font-semibold">Get Early Access</span>
            </motion.a>
          </div>

          {/* Mobile Menu Button */}
          <motion.button
            className="md:hidden relative z-10 p-2 text-white/60 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            whileTap={{ scale: 0.9 }}
          >
            <AnimatePresence mode="wait">
              {isMobileMenuOpen ? (
                <motion.div
                  key="close"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <X className="w-5 h-5" />
                </motion.div>
              ) : (
                <motion.div
                  key="menu"
                  initial={{ rotate: 90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Menu className="w-5 h-5" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </motion.nav>
      </motion.header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            
            {/* Menu Panel */}
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="fixed top-20 left-4 right-4 z-50 md:hidden"
            >
              <div className="
                bg-black/80 backdrop-blur-2xl 
                border border-white/10 
                rounded-2xl 
                p-4
                shadow-[0_20px_60px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.05)]
              ">
                {/* Navigation Links */}
                <div className="flex flex-col gap-1">
                  {navLinks.map((link, i) => {
                    const isActive = activeNavIndex === i;
                    return (
                      <motion.a
                        key={link.name}
                        href={link.href}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={`
                          px-4 py-3 rounded-xl
                          text-base font-medium
                          transition-colors duration-200
                          ${isActive
                            ? 'bg-white/10 text-white'
                            : 'text-white/60 hover:text-white hover:bg-white/5'
                          }
                        `}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {link.name}
                      </motion.a>
                    );
                  })}
                </div>
                
                {/* Divider */}
                <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-4" />
                
                {/* CTA Button */}
                <motion.a
                  href="#cta"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="
                    flex items-center justify-center gap-2
                    w-full py-3.5 rounded-xl
                    bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500
                    text-black font-semibold
                    shadow-lg shadow-amber-500/30
                  "
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Sparkles className="w-4 h-4" />
                  Get Early Access
                </motion.a>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
