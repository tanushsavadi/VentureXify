'use client';

import { motion } from 'framer-motion';
import { ExternalLink, Heart } from 'lucide-react';

const footerLinks = [
  { name: 'Features', href: '#features' },
  { name: 'How it Works', href: '#how-it-works' },
  { name: 'Privacy', href: '#privacy' },
  { name: 'GitHub', href: 'https://github.com/venturexify', external: true },
  { name: 'r/VentureX', href: 'https://reddit.com/r/venturex', external: true },
];

export default function Footer() {
  return (
    <footer className="py-12 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <motion.a
            href="#"
            className="flex items-center gap-2"
            whileHover={{ scale: 1.02 }}
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <span className="text-black font-bold text-sm">VX</span>
            </div>
            <span className="text-lg font-semibold text-white">VentureXify</span>
          </motion.a>

          {/* Links */}
          <nav className="flex flex-wrap items-center justify-center gap-6">
            {footerLinks.map((link) => (
              <motion.a
                key={link.name}
                href={link.href}
                target={link.external ? '_blank' : undefined}
                rel={link.external ? 'noopener noreferrer' : undefined}
                className="text-sm text-white/40 hover:text-white transition-colors flex items-center gap-1"
                whileHover={{ y: -2 }}
              >
                {link.name}
                {link.external && <ExternalLink className="w-3 h-3" />}
              </motion.a>
            ))}
          </nav>
        </div>

        {/* Bottom text */}
        <div className="mt-8 pt-8 border-t border-white/5">
          <p className="text-center text-sm text-white/40 flex items-center justify-center gap-1">
            Built with <Heart className="w-4 h-4 text-red-400" /> for r/VentureX • Not affiliated with Capital One
          </p>
          <p className="text-center text-xs text-white/20 mt-2">
            © {new Date().getFullYear()} VentureXify. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
