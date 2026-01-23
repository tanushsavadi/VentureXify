import {
  UserPreferences,
  LocalStorageData,
  DecisionCard,
  EraserItem,
  PriceDropTracker,
  Trip,
  TravelCredit,
  PerksChecklist,
  DEFAULT_PREFERENCES,
  DEFAULT_LOCAL_DATA,
} from './types';

// ============================================
// SCHEMA VERSION & MIGRATIONS
// ============================================

const CURRENT_SCHEMA_VERSION = 1;

type MigrationFn = (data: LocalStorageData) => LocalStorageData;

const migrations: Record<number, MigrationFn> = {
  // Future migrations go here
  // 2: (data) => { ... return updated data }
};

function migrateData(data: LocalStorageData): LocalStorageData {
  let currentData = { ...data };
  const startVersion = data.schemaVersion || 1;

  for (let v = startVersion + 1; v <= CURRENT_SCHEMA_VERSION; v++) {
    if (migrations[v]) {
      currentData = migrations[v](currentData);
    }
  }

  currentData.schemaVersion = CURRENT_SCHEMA_VERSION;
  return currentData;
}

// ============================================
// SYNC STORAGE (User Preferences)
// ============================================

export async function getPreferences(): Promise<UserPreferences> {
  try {
    const result = await chrome.storage.sync.get('preferences');
    if (result.preferences) {
      return { ...DEFAULT_PREFERENCES, ...result.preferences };
    }
    return DEFAULT_PREFERENCES;
  } catch (error) {
    console.error('Error reading preferences:', error);
    return DEFAULT_PREFERENCES;
  }
}

export async function setPreferences(prefs: Partial<UserPreferences>): Promise<void> {
  try {
    const current = await getPreferences();
    const updated = { ...current, ...prefs };
    await chrome.storage.sync.set({ preferences: updated });
  } catch (error) {
    console.error('Error saving preferences:', error);
    throw error;
  }
}

export async function resetPreferences(): Promise<void> {
  try {
    await chrome.storage.sync.set({ preferences: DEFAULT_PREFERENCES });
  } catch (error) {
    console.error('Error resetting preferences:', error);
    throw error;
  }
}

// ============================================
// LOCAL STORAGE (Data)
// ============================================

async function getLocalData(): Promise<LocalStorageData> {
  try {
    const result = await chrome.storage.local.get('data');
    if (result.data) {
      const data = result.data as LocalStorageData;
      // Run migrations if needed
      if (data.schemaVersion < CURRENT_SCHEMA_VERSION) {
        const migrated = migrateData(data);
        await chrome.storage.local.set({ data: migrated });
        return migrated;
      }
      return { ...DEFAULT_LOCAL_DATA, ...data };
    }
    return DEFAULT_LOCAL_DATA;
  } catch (error) {
    console.error('Error reading local data:', error);
    return DEFAULT_LOCAL_DATA;
  }
}

async function setLocalData(data: Partial<LocalStorageData>): Promise<void> {
  try {
    const current = await getLocalData();
    const updated = { ...current, ...data };
    await chrome.storage.local.set({ data: updated });
  } catch (error) {
    console.error('Error saving local data:', error);
    throw error;
  }
}

// ============================================
// DECISION HISTORY
// ============================================

const MAX_DECISION_HISTORY = 100;

export async function getDecisionHistory(): Promise<DecisionCard[]> {
  const data = await getLocalData();
  return data.decisionHistory || [];
}

export async function saveDecision(decision: DecisionCard): Promise<void> {
  const data = await getLocalData();
  const history = [decision, ...data.decisionHistory].slice(0, MAX_DECISION_HISTORY);
  await setLocalData({ decisionHistory: history });
}

export async function deleteDecision(id: string): Promise<void> {
  const data = await getLocalData();
  const history = data.decisionHistory.filter((d) => d.id !== id);
  await setLocalData({ decisionHistory: history });
}

export async function clearDecisionHistory(): Promise<void> {
  await setLocalData({ decisionHistory: [] });
}

// ============================================
// ERASER QUEUE
// ============================================

export async function getEraserQueue(): Promise<EraserItem[]> {
  const data = await getLocalData();
  return data.eraserQueue || [];
}

export async function addEraserItem(item: EraserItem): Promise<void> {
  const data = await getLocalData();
  const queue = [...data.eraserQueue, item];
  await setLocalData({ eraserQueue: queue });
}

export async function updateEraserItem(id: string, updates: Partial<EraserItem>): Promise<void> {
  const data = await getLocalData();
  const queue = data.eraserQueue.map((item) =>
    item.id === id ? { ...item, ...updates } : item
  );
  await setLocalData({ eraserQueue: queue });
}

export async function deleteEraserItem(id: string): Promise<void> {
  const data = await getLocalData();
  const queue = data.eraserQueue.filter((item) => item.id !== id);
  await setLocalData({ eraserQueue: queue });
}

export async function getExpiringEraserItems(daysAhead: number = 14): Promise<EraserItem[]> {
  const data = await getLocalData();
  const now = Date.now();
  const threshold = now + daysAhead * 24 * 60 * 60 * 1000;

  return data.eraserQueue.filter(
    (item) =>
      item.status === 'pending' && item.expiryDate <= threshold && item.expiryDate > now
  );
}

export async function bulkAddEraserItems(items: EraserItem[]): Promise<void> {
  const data = await getLocalData();
  const queue = [...data.eraserQueue, ...items];
  await setLocalData({ eraserQueue: queue });
}

// ============================================
// PRICE DROP TRACKERS
// ============================================

export async function getPriceDropTrackers(): Promise<PriceDropTracker[]> {
  const data = await getLocalData();
  return data.priceDropTrackers || [];
}

export async function addPriceDropTracker(tracker: PriceDropTracker): Promise<void> {
  const data = await getLocalData();
  const trackers = [...data.priceDropTrackers, tracker];
  await setLocalData({ priceDropTrackers: trackers });
}

export async function updatePriceDropTracker(
  id: string,
  updates: Partial<PriceDropTracker>
): Promise<void> {
  const data = await getLocalData();
  const trackers = data.priceDropTrackers.map((t) =>
    t.id === id ? { ...t, ...updates } : t
  );
  await setLocalData({ priceDropTrackers: trackers });
}

export async function deletePriceDropTracker(id: string): Promise<void> {
  const data = await getLocalData();
  const trackers = data.priceDropTrackers.filter((t) => t.id !== id);
  await setLocalData({ priceDropTrackers: trackers });
}

// ============================================
// PERKS CHECKLIST
// ============================================

export async function getPerksChecklist(): Promise<PerksChecklist> {
  const data = await getLocalData();
  return data.perksChecklist;
}

export async function updatePerksChecklist(updates: Partial<PerksChecklist>): Promise<void> {
  const data = await getLocalData();
  const checklist = { ...data.perksChecklist, ...updates };
  await setLocalData({ perksChecklist: checklist });
}

// ============================================
// TRAVEL CREDIT WALLET
// ============================================

export async function getTravelCredits(): Promise<TravelCredit[]> {
  const data = await getLocalData();
  return data.travelCreditWallet || [];
}

export async function addTravelCredit(credit: TravelCredit): Promise<void> {
  const data = await getLocalData();
  const wallet = [...data.travelCreditWallet, credit];
  await setLocalData({ travelCreditWallet: wallet });
}

export async function updateTravelCredit(id: string, updates: Partial<TravelCredit>): Promise<void> {
  const data = await getLocalData();
  const wallet = data.travelCreditWallet.map((c) =>
    c.id === id ? { ...c, ...updates } : c
  );
  await setLocalData({ travelCreditWallet: wallet });
}

export async function deleteTravelCredit(id: string): Promise<void> {
  const data = await getLocalData();
  const wallet = data.travelCreditWallet.filter((c) => c.id !== id);
  await setLocalData({ travelCreditWallet: wallet });
}

// ============================================
// TRIPS
// ============================================

export async function getTrips(): Promise<Trip[]> {
  const data = await getLocalData();
  return data.trips || [];
}

export async function addTrip(trip: Trip): Promise<void> {
  const data = await getLocalData();
  const trips = [...data.trips, trip];
  await setLocalData({ trips: trips });
}

export async function updateTrip(id: string, updates: Partial<Trip>): Promise<void> {
  const data = await getLocalData();
  const trips = data.trips.map((t) => (t.id === id ? { ...t, ...updates } : t));
  await setLocalData({ trips: trips });
}

export async function deleteTrip(id: string): Promise<void> {
  const data = await getLocalData();
  const trips = data.trips.filter((t) => t.id !== id);
  await setLocalData({ trips: trips });
}

// ============================================
// UTILITY
// ============================================

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export async function exportAllData(): Promise<{
  preferences: UserPreferences;
  data: LocalStorageData;
}> {
  const preferences = await getPreferences();
  const data = await getLocalData();
  return { preferences, data };
}

export async function importData(importedData: {
  preferences?: Partial<UserPreferences>;
  data?: Partial<LocalStorageData>;
}): Promise<void> {
  if (importedData.preferences) {
    await setPreferences(importedData.preferences);
  }
  if (importedData.data) {
    await setLocalData(importedData.data);
  }
}

export async function clearAllData(): Promise<void> {
  await chrome.storage.sync.clear();
  await chrome.storage.local.clear();
}

// ============================================
// STORAGE EVENT LISTENERS
// ============================================

type StorageChangeCallback = (changes: { [key: string]: chrome.storage.StorageChange }) => void;

const syncListeners: StorageChangeCallback[] = [];
const localListeners: StorageChangeCallback[] = [];

export function onPreferencesChange(callback: StorageChangeCallback): () => void {
  syncListeners.push(callback);
  return () => {
    const index = syncListeners.indexOf(callback);
    if (index > -1) syncListeners.splice(index, 1);
  };
}

export function onDataChange(callback: StorageChangeCallback): () => void {
  localListeners.push(callback);
  return () => {
    const index = localListeners.indexOf(callback);
    if (index > -1) localListeners.splice(index, 1);
  };
}

// Initialize storage change listener
if (typeof chrome !== 'undefined' && chrome.storage) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync') {
      syncListeners.forEach((cb) => cb(changes));
    } else if (areaName === 'local') {
      localListeners.forEach((cb) => cb(changes));
    }
  });
}
