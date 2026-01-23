import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import {
  PerksChecklist,
  TravelCredit,
  VENTURE_X_CONSTANTS,
} from '@/lib/types';
import {
  getPerksChecklist,
  updatePerksChecklist,
  getTravelCredits,
  addTravelCredit,
  getEraserQueue,
} from '@/lib/storage';
import {
  calculateVentureXScore,
  calculateValueCaptured,
  calculateRenewalROI,
} from '@/lib/calculators';

export function PerksTab() {
  const [checklist, setChecklist] = useState<PerksChecklist | null>(null);
  const [credits, setCredits] = useState<TravelCredit[]>([]);
  const [score, setScore] = useState(0);
  const [valueCaptured, setValueCaptured] = useState(0);
  const [roi, setRoi] = useState<{ roi: number; netValue: number; worthKeeping: boolean } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreditForm, setShowCreditForm] = useState(false);
  const [creditName, setCreditName] = useState('');
  const [creditValue, setCreditValue] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const [checklistData, creditsData, eraserItems] = await Promise.all([
      getPerksChecklist(),
      getTravelCredits(),
      getEraserQueue(),
    ]);

    setChecklist(checklistData);
    setCredits(creditsData);

    // Calculate metrics
    const erasedItems = eraserItems.filter((i) => i.status === 'erased');
    const scoreInput = {
      travelCreditUsed: checklistData.travelCreditUsed,
      globalEntryUsed: checklistData.globalEntryUsed,
      priorityPassActivated: checklistData.priorityPassActivated,
      partnerStatusEnrolled: checklistData.partnerStatusEnrolled,
      eraserItemsUsed: erasedItems.length,
      loungeVisits: checklistData.loungeVisitsYTD,
    };

    const calculatedScore = calculateVentureXScore(scoreInput);
    const calculatedValue = calculateValueCaptured(scoreInput);
    const calculatedRoi = calculateRenewalROI(calculatedValue);

    setScore(calculatedScore);
    setValueCaptured(calculatedValue);
    setRoi(calculatedRoi);
    setIsLoading(false);
  };

  const handleToggle = async (field: keyof PerksChecklist, value: boolean) => {
    if (!checklist) return;
    await updatePerksChecklist({ [field]: value });
    loadData();
  };

  const handleLoungeVisitUpdate = async (delta: number) => {
    if (!checklist) return;
    const newCount = Math.max(0, checklist.loungeVisitsYTD + delta);
    await updatePerksChecklist({ loungeVisitsYTD: newCount });
    loadData();
  };

  const handleTravelCreditUpdate = async (amount: number) => {
    if (!checklist) return;
    const newAmount = Math.min(
      VENTURE_X_CONSTANTS.TRAVEL_CREDIT,
      Math.max(0, amount)
    );
    await updatePerksChecklist({ travelCreditUsed: newAmount });
    loadData();
  };

  const handleAddCredit = async () => {
    if (!creditName || !creditValue) return;
    await addTravelCredit({
      id: `credit-${Date.now()}`,
      name: creditName,
      totalValue: parseFloat(creditValue),
      usedValue: 0,
    });
    setCreditName('');
    setCreditValue('');
    setShowCreditForm(false);
    loadData();
  };

  if (isLoading || !checklist) {
    return (
      <div className="space-y-4 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-24 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Venture X Score */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-surface-900 dark:text-surface-100">
              Venture X Score
            </h3>
            <p className="text-sm text-surface-500">
              Track your card value optimization
            </p>
          </div>
          <div className="text-4xl font-bold text-accent-600">{score}</div>
        </div>

        <div className="progress-bar">
          <motion.div
            className="progress-bar-fill"
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>

        <div className="flex justify-between mt-2 text-xs text-surface-400">
          <span>Getting Started</span>
          <span>Maximizing Value</span>
        </div>
      </div>

      {/* Value Captured & ROI */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card-soft p-4">
          <div className="text-2xl font-bold text-success">
            ${valueCaptured.toFixed(0)}
          </div>
          <div className="text-xs text-surface-500">Value Captured YTD</div>
        </div>
        <div className="card-soft p-4">
          <div className={clsx(
            'text-2xl font-bold',
            roi?.netValue && roi.netValue >= 0 ? 'text-success' : 'text-danger'
          )}>
            {roi ? (roi.netValue >= 0 ? '+' : '') + `$${roi.netValue.toFixed(0)}` : '--'}
          </div>
          <div className="text-xs text-surface-500">Net vs Annual Fee</div>
        </div>
      </div>

      {/* This Week's Actions */}
      <div className="card p-4">
        <h3 className="font-semibold text-surface-900 dark:text-surface-100 mb-3">
          This Week's Actions
        </h3>
        <div className="space-y-2">
          {checklist.travelCreditUsed < VENTURE_X_CONSTANTS.TRAVEL_CREDIT && (
            <ActionItem
              icon="💰"
              title="Use Travel Credit"
              description={`$${(VENTURE_X_CONSTANTS.TRAVEL_CREDIT - checklist.travelCreditUsed).toFixed(0)} remaining`}
              priority="high"
              howToUse="Book through Capital One Travel portal to use credit"
              commonMistake="Credit doesn't apply to direct hotel/airline bookings"
            />
          )}
          {!checklist.priorityPassActivated && (
            <ActionItem
              icon="✈️"
              title="Activate Priority Pass"
              description="Free lounge access worldwide"
              priority="medium"
              howToUse="Register via Capital One benefits page, use card for 2 free guests"
              commonMistake="Some lounges limit guests or charge restaurant surcharges"
            />
          )}
          {!checklist.globalEntryUsed && (
            <ActionItem
              icon="🛂"
              title="Apply for Global Entry"
              description="$100 credit available"
              priority="medium"
              howToUse="Pay with Venture X, credit posts as statement credit"
              commonMistake="TSA PreCheck is $78, save the extra $22 with Global Entry"
            />
          )}
          {checklist.loungeVisitsYTD < 2 && (
            <ActionItem
              icon="🍸"
              title="Visit a Lounge"
              description="Make the most of Priority Pass"
              priority="low"
              howToUse="Use Priority Pass app to find lounges at your departure airport"
            />
          )}
          {!checklist.partnerStatusEnrolled && (
            <ActionItem
              icon="🚗"
              title="Activate Hertz Benefits"
              description="Free Hertz President's Circle status"
              priority="medium"
              howToUse="Enroll via Capital One benefits page, includes upgrades & free additional driver"
              commonMistake="Must link your Hertz account before booking"
            />
          )}
        </div>
      </div>

      {/* Anniversary Miles Reminder */}
      <div className="card p-4 border-l-4 border-l-indigo-500">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🎁</span>
          <div className="flex-1">
            <h3 className="font-semibold text-surface-900 dark:text-surface-100">
              10,000 Anniversary Miles
            </h3>
            <p className="text-sm text-surface-500 mt-1">
              You'll receive 10,000 bonus miles on your card anniversary
            </p>
            <div className="text-xs text-indigo-500 mt-2">
              💡 Worth ~$180 when transferred to partners
            </div>
          </div>
        </div>
      </div>

      {/* Perks Checklist */}
      <div className="card p-4">
        <h3 className="font-semibold text-surface-900 dark:text-surface-100 mb-4">
          Benefits Activation
        </h3>
        <div className="space-y-3">
          <ChecklistItem
            label="Priority Pass Activated"
            checked={checklist.priorityPassActivated}
            onChange={(v) => handleToggle('priorityPassActivated', v)}
          />
          <ChecklistItem
            label="Global Entry/TSA PreCheck Credit Used"
            checked={checklist.globalEntryUsed}
            onChange={(v) => handleToggle('globalEntryUsed', v)}
          />
          <ChecklistItem
            label="Partner Statuses Enrolled"
            checked={checklist.partnerStatusEnrolled}
            onChange={(v) => handleToggle('partnerStatusEnrolled', v)}
            description="Hertz President's Circle, etc."
          />
        </div>
      </div>

      {/* Travel Credit Tracker */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-surface-900 dark:text-surface-100">
            $300 Travel Credit
          </h3>
          <span className="text-sm text-surface-500">
            ${checklist.travelCreditUsed} / ${VENTURE_X_CONSTANTS.TRAVEL_CREDIT}
          </span>
        </div>
        
        <div className="progress-bar mb-3">
          <motion.div
            className="progress-bar-fill bg-success"
            style={{ width: `${(checklist.travelCreditUsed / VENTURE_X_CONSTANTS.TRAVEL_CREDIT) * 100}%` }}
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handleTravelCreditUpdate(checklist.travelCreditUsed + 50)}
            className="btn btn-sm btn-secondary flex-1"
          >
            +$50
          </button>
          <button
            onClick={() => handleTravelCreditUpdate(checklist.travelCreditUsed + 100)}
            className="btn btn-sm btn-secondary flex-1"
          >
            +$100
          </button>
          <button
            onClick={() => handleTravelCreditUpdate(VENTURE_X_CONSTANTS.TRAVEL_CREDIT)}
            className="btn btn-sm btn-primary flex-1"
          >
            Mark Full
          </button>
        </div>
      </div>

      {/* Lounge Visits */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-surface-900 dark:text-surface-100">
              Lounge Visits YTD
            </h3>
            <p className="text-sm text-surface-500">
              ~${(checklist.loungeVisitsYTD * VENTURE_X_CONSTANTS.PRIORITY_PASS_VALUE).toFixed(0)} value captured
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleLoungeVisitUpdate(-1)}
              className="btn btn-sm btn-ghost w-8 h-8 p-0"
              disabled={checklist.loungeVisitsYTD <= 0}
            >
              -
            </button>
            <span className="text-2xl font-bold text-surface-900 dark:text-surface-100 w-8 text-center">
              {checklist.loungeVisitsYTD}
            </span>
            <button
              onClick={() => handleLoungeVisitUpdate(1)}
              className="btn btn-sm btn-ghost w-8 h-8 p-0"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Custom Credits */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-surface-900 dark:text-surface-100">
            Credit Wallet
          </h3>
          <button
            onClick={() => setShowCreditForm(!showCreditForm)}
            className="btn btn-sm btn-ghost"
          >
            + Add
          </button>
        </div>

        {showCreditForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="mb-3 p-3 bg-surface-50 dark:bg-surface-800/50 rounded-xl space-y-2"
          >
            <input
              type="text"
              placeholder="Credit name"
              value={creditName}
              onChange={(e) => setCreditName(e.target.value)}
              className="input"
            />
            <input
              type="number"
              placeholder="Value"
              value={creditValue}
              onChange={(e) => setCreditValue(e.target.value)}
              className="input"
            />
            <button onClick={handleAddCredit} className="btn btn-primary btn-sm w-full">
              Add Credit
            </button>
          </motion.div>
        )}

        {credits.length === 0 ? (
          <p className="text-sm text-surface-500 text-center py-4">
            Track additional credits here
          </p>
        ) : (
          <div className="space-y-2">
            {credits.map((credit) => (
              <div
                key={credit.id}
                className="flex items-center justify-between p-2 rounded-lg bg-surface-50 dark:bg-surface-800/50"
              >
                <span className="text-sm text-surface-700 dark:text-surface-300">
                  {credit.name}
                </span>
                <span className="text-sm font-medium">
                  ${credit.usedValue} / ${credit.totalValue}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper Components
function ActionItem({
  icon,
  title,
  description,
  priority,
  howToUse,
  commonMistake,
}: {
  icon: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  howToUse?: string;
  commonMistake?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  
  const priorityColors = {
    high: 'border-l-danger',
    medium: 'border-l-warning',
    low: 'border-l-accent-500',
  };

  return (
    <div
      className={clsx(
        'p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50',
        'border-l-4',
        priorityColors[priority],
        (howToUse || commonMistake) && 'cursor-pointer'
      )}
      onClick={() => (howToUse || commonMistake) && setExpanded(!expanded)}
    >
      <div className="flex items-center gap-3">
        <span className="text-xl">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-surface-900 dark:text-surface-100">
            {title}
          </div>
          <div className="text-xs text-surface-500">{description}</div>
        </div>
        {(howToUse || commonMistake) && (
          <span className="text-xs text-surface-400">
            {expanded ? '▼' : '▶'}
          </span>
        )}
      </div>
      
      {expanded && (howToUse || commonMistake) && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="mt-3 pt-3 border-t border-surface-200 dark:border-surface-700 space-y-2"
        >
          {howToUse && (
            <div className="text-xs">
              <span className="text-green-600 dark:text-green-400 font-medium">How to use: </span>
              <span className="text-surface-600 dark:text-surface-400">{howToUse}</span>
            </div>
          )}
          {commonMistake && (
            <div className="text-xs">
              <span className="text-amber-600 dark:text-amber-400 font-medium">⚠️ Common mistake: </span>
              <span className="text-surface-600 dark:text-surface-400">{commonMistake}</span>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

function ChecklistItem({
  label,
  checked,
  onChange,
  description,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  description?: string;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 w-full text-left p-2 -mx-2 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
    >
      <div className={clsx(
        'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors',
        checked
          ? 'bg-success border-success text-white'
          : 'border-surface-300 dark:border-surface-600'
      )}>
        {checked && (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <div className="flex-1">
        <div className={clsx(
          'text-sm',
          checked ? 'text-surface-500 line-through' : 'text-surface-900 dark:text-surface-100'
        )}>
          {label}
        </div>
        {description && (
          <div className="text-xs text-surface-400">{description}</div>
        )}
      </div>
    </button>
  );
}

export default PerksTab;
