import AsyncStorage from '@react-native-async-storage/async-storage';

export type Reminder = {
  id: string;
  title: string;
  note: string;
  active?: boolean;
  completed?: boolean;
  category?: 'Pessoal' | 'Trabalho' | 'Compras' | 'Saúde' | 'Casa' | 'Outro';
  location?: { latitude: number; longitude: number };
  address?: string;
  trigger?: 'enter' | 'exit';
  radiusMeters?: number;
  frequency?: 'once' | 'always';
};

export const DEFAULT_REMINDER_CATEGORIES = ['Pessoal', 'Trabalho', 'Compras', 'Saúde', 'Casa', 'Outro'] as const;
export type DefaultCategory = typeof DEFAULT_REMINDER_CATEGORIES[number];

export type RecentLocation = {
  placeName: string;
  address: string;
  latitude: number;
  longitude: number;
  usedAt: number;
};

const STORAGE_KEY = '@georeminder:reminders';
const RECENT_KEY = '@georeminder:recent-locations';
const MAX_RECENT = 5;

function isSameLocation(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const dLat = Math.abs(a.latitude - b.latitude);
  const dLng = Math.abs(a.longitude - b.longitude);
  return dLat < 0.00005 && dLng < 0.00005;
}

export async function loadReminders(): Promise<Reminder[] | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const parsed = JSON.parse(raw) as Reminder[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return null;
  }
}

export async function saveReminders(reminders: Reminder[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
}

export async function updateReminder(updated: Reminder): Promise<void> {
  const reminders = await loadReminders();
  if (!reminders) return;
  const next = reminders.map((item) => (item.id === updated.id ? updated : item));
  await saveReminders(next);
}

export async function removeReminder(id: string): Promise<void> {
  const reminders = await loadReminders();
  if (!reminders) return;
  const next = reminders.filter((item) => item.id !== id);
  await saveReminders(next);
}

export async function loadRecentLocations(): Promise<RecentLocation[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentLocation[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export async function saveRecentLocations(locations: RecentLocation[]): Promise<void> {
  await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(locations));
}

export type FavoriteLocation = {
  placeName: string;
  address: string;
  latitude: number;
  longitude: number;
};

const FAVORITES_KEY = '@georeminder:favorite-locations';

export async function loadFavoriteLocations(): Promise<FavoriteLocation[]> {
  try {
    const raw = await AsyncStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FavoriteLocation[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export async function saveFavoriteLocations(locations: FavoriteLocation[]): Promise<void> {
  await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(locations));
}

export async function addFavoriteLocation(location: { placeName: string; address: string; latitude: number; longitude: number }): Promise<FavoriteLocation[]> {
  const current = await loadFavoriteLocations();
  const filtered = current.filter((item) => Math.abs(item.latitude - location.latitude) > 0.00005 || Math.abs(item.longitude - location.longitude) > 0.00005);
  const next = [{ ...location }, ...filtered];
  await saveFavoriteLocations(next);
  return next;
}

export async function removeFavoriteLocation(latitude: number, longitude: number): Promise<FavoriteLocation[]> {
  const current = await loadFavoriteLocations();
  const next = current.filter((item) => Math.abs(item.latitude - latitude) > 0.00005 || Math.abs(item.longitude - longitude) > 0.00005);
  await saveFavoriteLocations(next);
  return next;
}

export async function isFavoriteLocation(latitude: number, longitude: number): Promise<boolean> {
  const current = await loadFavoriteLocations();
  return current.some((item) => Math.abs(item.latitude - latitude) < 0.00005 && Math.abs(item.longitude - longitude) < 0.00005);
}

export async function addRecentLocation(location: {
  placeName: string;
  address: string;
  latitude: number;
  longitude: number;
}): Promise<void> {
  const recent = await loadRecentLocations();
  const now = Date.now();
  const filtered = recent.filter((item) => !isSameLocation(item, location));
  const next = [{ ...location, usedAt: now }, ...filtered].slice(0, MAX_RECENT);
  await saveRecentLocations(next);
}

export type HistoryEventType = 'completed' | 'enter' | 'exit';

export type HistoryEvent = {
  id: string;
  reminderId: string;
  reminderTitle: string;
  placeName?: string;
  address?: string;
  note?: string;
  location?: { latitude: number; longitude: number };
  trigger?: 'enter' | 'exit';
  radiusMeters?: number;
  frequency?: 'once' | 'always';
  type: HistoryEventType;
  occurredAt: number;
};

const HISTORY_KEY = '@georeminder:history';

export async function loadHistory(): Promise<HistoryEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryEvent[];
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => b.occurredAt - a.occurredAt);
  } catch {
    return [];
  }
}

export async function appendHistory(event: Omit<HistoryEvent, 'id'>): Promise<HistoryEvent> {
  const current = await loadHistory();
  const next: HistoryEvent = {
    ...event,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  };
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify([next, ...current]));
  return next;
}

export function historyEventToReminder(event: HistoryEvent): Reminder {
  return {
    id: `${Date.now()}`,
    title: event.reminderTitle,
    note: event.note ?? '',
    active: true,
    completed: undefined,
    location: event.location,
    address: event.address ?? event.placeName,
    trigger: event.trigger,
    radiusMeters: event.radiusMeters,
    frequency: event.frequency ?? 'once'
  };
}
