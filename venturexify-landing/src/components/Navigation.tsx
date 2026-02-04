'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Sparkles } from 'lucide-react';

const navLinks = [
  { name: 'Features', href: '#features' },
  { name: 'How it Works', href: '#how-it-works' },
  { name: 'Privacy', href: '#privacy' },
  { name: 'About', href: '#why-i-built-this' },
];

export default function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const [isAtTop, setIsAtTop] = useState(true);
  const [isAtCTA, setIsAtCTA] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      
      setIsScrolled(scrollY > 50);
      setIsAtTop(scrollY < 100);
      
      // Check if at CTA section (near bottom of page)
      const ctaEl = document.getElementById('cta');
      const isNearBottom = scrollY + windowHeight >= documentHeight - 100;
      const isAtCtaSection = ctaEl ? scrollY >= ctaEl.offsetTop - 300 : false;
      setIsAtCTA(isNearBottom || isAtCtaSection);
      
      // Track active section - only when scrolled past hero
      if (scrollY < 400) {
        setActiveSection(''); // Clear active when at hero
        return;
      }
      
      // Clear active section when at CTA
      if (isNearBottom || isAtCtaSection) {
        setActiveSection('');
        return;
      }
      
      const sections = navLinks.map(link => link.href.replace('#', ''));
      let foundSection = '';
      for (const section of sections.reverse()) {
        const el = document.getElementById(section);
        if (el && scrollY >= el.offsetTop - 200) {
          foundSection = section;
          break;
        }
      }
      setActiveSection(foundSection);
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
            
            {/* Brand name with glow effect when at hero */}
            <div className="hidden sm:flex items-center relative">
              <motion.span
                className="text-base font-semibold text-white"
                animate={{
                  textShadow: isAtTop
                    ? '0 0 10px rgba(245, 158, 11, 0.6), 0 0 20px rgba(245, 158, 11, 0.4), 0 0 30px rgba(245, 158, 11, 0.2)'
                    : '0 0 0px rgba(245, 158, 11, 0)',
                }}
                transition={{ duration: 0.4 }}
              >
                VentureXify
              </motion.span>
            </div>
          </motion.a>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-1 relative z-10">
            {navLinks.map((link) => {
              const isActive = activeSection === link.href.replace('#', '');
              return (
                <motion.a
                  key={link.name}
                  href={link.href}
                  className={`
                    relative px-4 py-2 text-sm font-medium rounded-full
                    transition-colors duration-200
                    ${isActive 
                      ? 'text-white' 
                      : 'text-white/50 hover:text-white/80'
                    }
                  `}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {/* Active indicator pill */}
                  {isActive && (
                    <motion.span
                      layoutId="activeNav"
                      className="absolute inset-0 bg-white/10 rounded-full"
                      transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
                    />
                  )}
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
                    const isActive = activeSection === link.href.replace('#', '');
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
