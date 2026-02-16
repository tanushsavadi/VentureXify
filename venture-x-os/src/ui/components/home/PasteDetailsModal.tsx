/**
 * PasteDetailsModal Component
 * 
 * Allows users to manually enter booking details when not on a supported page.
 * This is a fallback for edge sites and debugging.
 * 
 * Fields:
 * - Portal price
 * - Direct price
 * - Miles multipliers (optional)
 * - Credit amount (optional, uses default from prefs)
 * - Award miles + taxes (optional)
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, DollarSign, Plane, CreditCard, Sparkles, Check } from 'lucide-react';
import { GlassCard, GlassButton, GlassBadge, GlassDivider } from '../glass';
import { cn } from '../../../lib/utils';

// ============================================
// TYPES
// ============================================

export interface ManualBookingDetails {
  // Required
  portalPrice: number;
  directPrice: number;
  
  // Route info (optional)
  origin?: string;
  destination?: string;
  
  // Override defaults (optional)
  creditRemaining?: number;
  portalMultiplier?: number; // default 5
  directMultiplier?: number; // default 2
  
  // Award option (optional)
  awardMiles?: number;
  awardTaxes?: number;
  awardProgram?: string;
}

export interface PasteDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (details: ManualBookingDetails) => void;
  defaultCreditRemaining?: number;
}

// ============================================
// COMPONENT
// ============================================

export const PasteDetailsModal: React.FC<PasteDetailsModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  defaultCreditRemaining = 300,
}) => {
  // Form state
  const [portalPrice, setPortalPrice] = useState('');
  const [directPrice, setDirectPrice] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [creditRemaining, setCreditRemaining] = useState(defaultCreditRemaining.toString());
  const [portalMultiplier, setPortalMultiplier] = useState('5');
  const [directMultiplier, setDirectMultiplier] = useState('2');
  
  // Award section (collapsed by default)
  const [showAwardSection, setShowAwardSection] = useState(false);
  const [awardMiles, setAwardMiles] = useState('');
  const [awardTaxes, setAwardTaxes] = useState('');
  const [awardProgram, setAwardProgram] = useState('');
  
  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      setPortalPrice('');
      setDirectPrice('');
      setOrigin('');
      setDestination('');
      setCreditRemaining(defaultCreditRemaining.toString());
      setPortalMultiplier('5');
      setDirectMultiplier('2');
      setShowAwardSection(false);
      setAwardMiles('');
      setAwardTaxes('');
      setAwardProgram('');
      setErrors({});
    }
  }, [isOpen, defaultCreditRemaining]);

  // Validate and submit
  const handleSubmit = () => {
    const newErrors: Record<string, string> = {};
    
    const portalNum = parseFloat(portalPrice.replace(/[^0-9.]/g, ''));
    const directNum = parseFloat(directPrice.replace(/[^0-9.]/g, ''));
    
    if (isNaN(portalNum) || portalNum <= 0) {
      newErrors.portalPrice = 'Enter a valid portal price';
    }
    if (isNaN(directNum) || directNum <= 0) {
      newErrors.directPrice = 'Enter a valid direct price';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    const details: ManualBookingDetails = {
      portalPrice: portalNum,
      directPrice: directNum,
    };
    
    // Add optional fields
    if (origin.trim()) details.origin = origin.trim().toUpperCase();
    if (destination.trim()) details.destination = destination.trim().toUpperCase();
    
    const creditNum = parseFloat(creditRemaining);
    if (!isNaN(creditNum) && creditNum >= 0) {
      details.creditRemaining = Math.min(300, creditNum);
    }
    
    const portalMult = parseFloat(portalMultiplier);
    if (!isNaN(portalMult) && portalMult > 0) {
      details.portalMultiplier = portalMult;
    }
    
    const directMult = parseFloat(directMultiplier);
    if (!isNaN(directMult) && directMult > 0) {
      details.directMultiplier = directMult;
    }
    
    // Award data
    if (showAwardSection && awardMiles) {
      const milesNum = parseInt(awardMiles.replace(/,/g, ''), 10);
      if (!isNaN(milesNum) && milesNum > 0) {
        details.awardMiles = milesNum;
        
        const taxesNum = parseFloat(awardTaxes);
        if (!isNaN(taxesNum) && taxesNum >= 0) {
          details.awardTaxes = taxesNum;
        }
        
        if (awardProgram.trim()) {
          details.awardProgram = awardProgram.trim();
        }
      }
    }
    
    onSubmit(details);
    onClose();
  };

  // Common transfer partners
  const PARTNERS = [
    'Turkish Miles&Smiles',
    'Etihad Guest',
    'Emirates Skywards',
    'Air France/KLM',
    'British Airways',
    'Avianca LifeMiles',
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', duration: 0.4 }}
          className="w-full max-w-md max-h-[85vh] overflow-hidden"
        >
          <GlassCard variant="elevated" className="p-0 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#4a90d9]/20 border border-[#4a90d9]/30 flex items-center justify-center">
                  <Plane className="w-4 h-4 text-[#7eb8e0]" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">Paste Booking Details</h2>
                  <p className="text-xs text-white/50">Enter prices manually</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/[0.08] transition-colors"
              >
                <X className="w-5 h-5 text-white/60" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-4">
              {/* Required Prices */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-white/40" />
                  <span className="text-xs font-medium text-white/60 uppercase tracking-wider">
                    Prices (Required)
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-white/50 uppercase tracking-wider mb-1.5 block">
                      Portal Price
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">$</span>
                      <input
                        type="text"
                        value={portalPrice}
                        onChange={(e) => {
                          setPortalPrice(e.target.value);
                          setErrors({ ...errors, portalPrice: '' });
                        }}
                        placeholder="474"
                        className={cn(
                          'w-full pl-7 pr-3 py-2.5 rounded-lg text-sm',
                          'bg-white/[0.05] border text-white placeholder:text-white/30',
                          'focus:outline-none focus:ring-2 focus:ring-[#4a90d9]/30',
                          errors.portalPrice ? 'border-red-500/50' : 'border-white/[0.10]'
                        )}
                      />
                    </div>
                    {errors.portalPrice && (
                      <p className="text-[10px] text-red-400 mt-1">{errors.portalPrice}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="text-[10px] text-white/50 uppercase tracking-wider mb-1.5 block">
                      Direct Price
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">$</span>
                      <input
                        type="text"
                        value={directPrice}
                        onChange={(e) => {
                          setDirectPrice(e.target.value);
                          setErrors({ ...errors, directPrice: '' });
                        }}
                        placeholder="420"
                        className={cn(
                          'w-full pl-7 pr-3 py-2.5 rounded-lg text-sm',
                          'bg-white/[0.05] border text-white placeholder:text-white/30',
                          'focus:outline-none focus:ring-2 focus:ring-[#4a90d9]/30',
                          errors.directPrice ? 'border-red-500/50' : 'border-white/[0.10]'
                        )}
                      />
                    </div>
                    {errors.directPrice && (
                      <p className="text-[10px] text-red-400 mt-1">{errors.directPrice}</p>
                    )}
                  </div>
                </div>
              </div>

              <GlassDivider />

              {/* Optional Route */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Plane className="w-4 h-4 text-white/40" />
                  <span className="text-xs font-medium text-white/60 uppercase tracking-wider">
                    Route (Optional)
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-white/50 uppercase tracking-wider mb-1.5 block">
                      From
                    </label>
                    <input
                      type="text"
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value)}
                      placeholder="JFK"
                      maxLength={4}
                      className="w-full px-3 py-2.5 rounded-lg text-sm bg-white/[0.05] border border-white/[0.10] text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#4a90d9]/30 uppercase"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/50 uppercase tracking-wider mb-1.5 block">
                      To
                    </label>
                    <input
                      type="text"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      placeholder="AUH"
                      maxLength={4}
                      className="w-full px-3 py-2.5 rounded-lg text-sm bg-white/[0.05] border border-white/[0.10] text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#4a90d9]/30 uppercase"
                    />
                  </div>
                </div>
              </div>

              <GlassDivider />

              {/* Settings Overrides */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-white/40" />
                  <span className="text-xs font-medium text-white/60 uppercase tracking-wider">
                    Settings (Optional)
                  </span>
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] text-white/50 uppercase tracking-wider mb-1.5 block">
                      Credit $
                    </label>
                    <input
                      type="text"
                      value={creditRemaining}
                      onChange={(e) => setCreditRemaining(e.target.value)}
                      placeholder="300"
                      className="w-full px-3 py-2 rounded-lg text-xs bg-white/[0.05] border border-white/[0.10] text-white placeholder:text-white/30 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/50 uppercase tracking-wider mb-1.5 block">
                      Portal ×
                    </label>
                    <input
                      type="text"
                      value={portalMultiplier}
                      onChange={(e) => setPortalMultiplier(e.target.value)}
                      placeholder="5"
                      className="w-full px-3 py-2 rounded-lg text-xs bg-white/[0.05] border border-white/[0.10] text-white placeholder:text-white/30 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/50 uppercase tracking-wider mb-1.5 block">
                      Direct ×
                    </label>
                    <input
                      type="text"
                      value={directMultiplier}
                      onChange={(e) => setDirectMultiplier(e.target.value)}
                      placeholder="2"
                      className="w-full px-3 py-2 rounded-lg text-xs bg-white/[0.05] border border-white/[0.10] text-white placeholder:text-white/30 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <GlassDivider />

              {/* Award Section (Expandable) */}
              <div className="space-y-3">
                <button
                  onClick={() => setShowAwardSection(!showAwardSection)}
                  className="flex items-center gap-2 w-full text-left"
                >
                  <Sparkles className={cn(
                    'w-4 h-4 transition-colors',
                    showAwardSection ? 'text-[#5b9bd5]' : 'text-white/40'
                  )} />
                  <span className={cn(
                    'text-xs font-medium uppercase tracking-wider transition-colors',
                    showAwardSection ? 'text-[#7eb8e0]' : 'text-white/60'
                  )}>
                    Award Option
                  </span>
                  <GlassBadge variant="muted" size="sm">
                    {showAwardSection ? 'Collapse' : 'Expand'}
                  </GlassBadge>
                </button>
                
                <AnimatePresence>
                  {showAwardSection && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-3 pt-2">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] text-white/50 uppercase tracking-wider mb-1.5 block">
                              Miles Required
                            </label>
                            <input
                              type="text"
                              value={awardMiles}
                              onChange={(e) => setAwardMiles(e.target.value)}
                              placeholder="42,900"
                              className="w-full px-3 py-2.5 rounded-lg text-sm bg-white/[0.05] border border-white/[0.10] text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#2d4a63]/30"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-white/50 uppercase tracking-wider mb-1.5 block">
                              Taxes & Fees
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">$</span>
                              <input
                                type="text"
                                value={awardTaxes}
                                onChange={(e) => setAwardTaxes(e.target.value)}
                                placeholder="85"
                                className="w-full pl-7 pr-3 py-2.5 rounded-lg text-sm bg-white/[0.05] border border-white/[0.10] text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#2d4a63]/30"
                              />
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <label className="text-[10px] text-white/50 uppercase tracking-wider mb-1.5 block">
                            Transfer Program
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {PARTNERS.map((partner) => (
                              <button
                                key={partner}
                                onClick={() => setAwardProgram(partner)}
                                className={cn(
                                  'px-2 py-1 rounded text-[10px] transition-colors border',
                                  awardProgram === partner
                                    ? 'bg-[#2d4a63]/20 border-[#2d4a63]/30 text-white'
                                    : 'bg-white/[0.03] border-white/[0.06] text-white/50 hover:bg-white/[0.06]'
                                )}
                              >
                                {partner}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/[0.08] bg-black/20">
              <div className="flex gap-3">
                <GlassButton variant="secondary" className="flex-1" onClick={onClose}>
                  Cancel
                </GlassButton>
                <GlassButton variant="primary" className="flex-1" onClick={handleSubmit}>
                  <Check className="w-4 h-4" />
                  Compare Prices
                </GlassButton>
              </div>
              
              <p className="text-[10px] text-white/40 text-center mt-3">
                Enter prices from any booking site to compare
              </p>
            </div>
          </GlassCard>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PasteDetailsModal;
