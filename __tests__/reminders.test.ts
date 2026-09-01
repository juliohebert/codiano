import {
  loadReminders,
  saveReminders,
  updateReminder,
  removeReminder,
  loadRecentLocations,
  saveRecentLocations,
  addRecentLocation,
  loadFavoriteLocations,
  addFavoriteLocation,
  removeFavoriteLocation,
  isFavoriteLocation,
  loadHistory,
  appendHistory,
  historyEventToReminder,
  type Reminder,
  type RecentLocation,
  type FavoriteLocation,
  type HistoryEvent
} from '../src/storage/reminders';

import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn()
}));

const mockedGetItem = AsyncStorage.getItem as jest.MockedFunction<typeof AsyncStorage.getItem>;
const mockedSetItem = AsyncStorage.setItem as jest.MockedFunction<typeof AsyncStorage.setItem>;

const store: Record<string, string | null> = {};

function setStorage(records: Record<string, string | null>) {
  Object.assign(store, records);
  mockedGetItem.mockImplementation((key: string) => Promise.resolve(store[key] ?? null));
  mockedSetItem.mockImplementation((key: string, value: string) => {
    store[key] = value;
    return Promise.resolve();
  });
}

beforeEach(() => {
  mockedGetItem.mockClear();
  mockedSetItem.mockClear();
  Object.keys(store).forEach((key) => delete store[key]);
});

describe('reminders', () => {
  it('returns empty list when storage is empty', async () => {
    setStorage({});
    const result = await loadReminders();
    expect(result).toEqual([]);
  });

  it('parses reminders from storage', async () => {
    const reminders = [
      { id: '1', title: 'A', note: '', active: true, trigger: 'exit' }
    ] as Reminder[];
    setStorage({ '@georeminder:reminders': JSON.stringify(reminders) });
    const result = await loadReminders();
    expect(result).toEqual(reminders);
  });

  it('returns null on parse error', async () => {
    setStorage({ '@georeminder:reminders': 'not-json' });
    const result = await loadReminders();
    expect(result).toBeNull();
  });

  it('saveReminders writes JSON', async () => {
    mockedSetItem.mockImplementation((_key: string, _value: string) => Promise.resolve());
    const reminders = [{ id: '1', title: 'A', note: '' }] as Reminder[];
    await saveReminders(reminders);
    expect(mockedSetItem).toHaveBeenCalledTimes(1);
  });

  it('updateReminder replaces by id', async () => {
    const reminders = [
      { id: '1', title: 'A', note: '' },
      { id: '2', title: 'B', note: '' }
    ] as Reminder[];
    setStorage({ '@georeminder:reminders': JSON.stringify(reminders) });
    await updateReminder({ id: '1', title: 'A-updated', note: '' });
    expect(mockedSetItem).toHaveBeenCalledTimes(1);
  });

  it('removeReminder filters by id', async () => {
    const reminders = [
      { id: '1', title: 'A', note: '' },
      { id: '2', title: 'B', note: '' }
    ] as Reminder[];
    setStorage({ '@georeminder:reminders': JSON.stringify(reminders) });
    await removeReminder('1');
    expect(mockedSetItem).toHaveBeenCalledTimes(1);
  });
});

describe('recent locations', () => {
  it('returns empty list when none stored', async () => {
    setStorage({});
    const result = await loadRecentLocations();
    expect(result).toEqual([]);
  });

  it('adds recent and caps to 5', async () => {
    const existing = Array.from({ length: 5 }, (_, i) => ({
      placeName: `L${i}`,
      address: `A${i}`,
      latitude: i,
      longitude: i,
      usedAt: Date.now() - i * 1000
    })) as RecentLocation[];
    setStorage({ '@georeminder:recent-locations': JSON.stringify(existing) });
    await addRecentLocation({
      placeName: 'New',
      address: 'Addr',
      latitude: 10,
      longitude: 10
    });
    expect(mockedSetItem).toHaveBeenCalledTimes(1);
  });

  it('reuses recent and moves it to the top', async () => {
    const existing = [
      { placeName: 'Old', address: 'Addr1', latitude: 1, longitude: 1, usedAt: Date.now() - 1000 },
      { placeName: 'New', address: 'Addr2', latitude: 2, longitude: 2, usedAt: Date.now() }
    ] as RecentLocation[];
    setStorage({ '@georeminder:recent-locations': JSON.stringify(existing) });
    await addRecentLocation({
      placeName: 'New',
      address: 'Addr2',
      latitude: 2,
      longitude: 2
    });
    expect(mockedSetItem).toHaveBeenCalledTimes(1);
  });

  it('deduplicates recents by coordinates', async () => {
    const existing = [
      { placeName: 'A', address: 'X', latitude: 1, longitude: 1, usedAt: Date.now() }
    ] as RecentLocation[];
    setStorage({ '@georeminder:recent-locations': JSON.stringify(existing) });
    await addRecentLocation({
      placeName: 'A2',
      address: 'X2',
      latitude: 1,
      longitude: 1
    });
    expect(mockedSetItem).toHaveBeenCalledTimes(1);
  });

  it('does not mix favorites into recents', async () => {
    setStorage({});
    await addFavoriteLocation({
      placeName: 'Fav',
      address: 'F',
      latitude: 1,
      longitude: 1
    });
    expect(await loadRecentLocations()).toEqual([]);
  });
});

describe('favorite locations', () => {
  it('adds new favorite', async () => {
    setStorage({});
    const result = await addFavoriteLocation({
      placeName: 'B',
      address: 'Y',
      latitude: 2,
      longitude: 2
    });
    expect(result.map((item) => item.placeName)).toEqual(['B']);
  });

  it('deduplicates favorites by coordinates', async () => {
    const existing = [
      { placeName: 'A', address: 'X', latitude: 1, longitude: 1 },
      { placeName: 'B', address: 'Y', latitude: 2, longitude: 2 }
    ] as FavoriteLocation[];
    setStorage({ '@georeminder:favorite-locations': JSON.stringify(existing) });
    const afterDedup = await addFavoriteLocation({
      placeName: 'A-edit',
      address: 'X2',
      latitude: 1,
      longitude: 1
    });
    expect(afterDedup.map((item) => item.placeName)).toEqual(['A-edit', 'B']);
  });

  it('removeFavoriteLocation removes by coordinates', async () => {
    const existing = [
      { placeName: 'A', address: 'X', latitude: 1, longitude: 1 },
      { placeName: 'B', address: 'Y', latitude: 2, longitude: 2 }
    ] as FavoriteLocation[];
    setStorage({ '@georeminder:favorite-locations': JSON.stringify(existing) });
    const result = await removeFavoriteLocation(1, 1);
    expect(result.map((item) => item.placeName)).toEqual(['B']);
  });

  it('isFavoriteLocation matches and ignores near-duplicates', async () => {
    const existing = [
      { placeName: 'A', address: 'X', latitude: 1, longitude: 1 }
    ] as FavoriteLocation[];
    setStorage({ '@georeminder:favorite-locations': JSON.stringify(existing) });
    expect(await isFavoriteLocation(1, 1)).toBe(true);
    expect(await isFavoriteLocation(1.00001, 1.00001)).toBe(true);
    expect(await isFavoriteLocation(2, 2)).toBe(false);
  });

  it('persists favorites independently from recents', async () => {
    setStorage({});
    const result = await addFavoriteLocation({
      placeName: 'Fav',
      address: 'F',
      latitude: 1,
      longitude: 1
    });
    expect(result.map((item) => item.placeName)).toEqual(['Fav']);
    expect(await loadRecentLocations()).toEqual([]);
  });
});

describe('history', () => {
  it('returns empty list when no history', async () => {
    setStorage({});
    const result = await loadHistory();
    expect(result).toEqual([]);
  });

  it('orders history by most recent first', async () => {
    setStorage({});
    await appendHistory({
      reminderId: '1',
      reminderTitle: 'A',
      type: 'completed',
      occurredAt: 1000
    });
    await appendHistory({
      reminderId: '1',
      reminderTitle: 'A',
      type: 'enter',
      occurredAt: 3000
    });
    await appendHistory({
      reminderId: '1',
      reminderTitle: 'A',
      type: 'exit',
      occurredAt: 2000
    });
    const result = await loadHistory();
    expect(result.map((item) => item.type)).toEqual(['enter', 'exit', 'completed']);
  });

  it('preserves history after deleting reminder', async () => {
    setStorage({});
    await appendHistory({
      reminderId: '1',
      reminderTitle: 'A',
      type: 'completed',
      occurredAt: 1000
    });
    await removeReminder('1');
    const history = await loadHistory();
    expect(history.map((item) => item.reminderId)).toEqual(['1']);
  });
});

describe('historyEventToReminder / duplicate-remind', () => {
  it('creates new active reminder and does not copy completed state', () => {
    const event = {
      reminderId: '1',
      reminderTitle: 'A',
      address: 'Rua X',
      trigger: 'exit',
      radiusMeters: 200,
      frequency: 'always' as const,
      type: 'completed' as const,
      occurredAt: Date.now()
    } as HistoryEvent;
    const reminder = historyEventToReminder(event);
    expect(reminder.title).toBe('A');
    expect(reminder.active).toBe(true);
    expect(reminder.completed).toBeUndefined();
    expect(reminder.trigger).toBe('exit');
    expect(reminder.frequency).toBe('always');
  });

  it('generates a new id and preserves available data', () => {
    const event = {
      reminderId: '1',
      reminderTitle: 'A',
      note: 'Nota',
      address: 'Rua X',
      location: { latitude: 1, longitude: 1 },
      trigger: 'enter',
      radiusMeters: 100,
      frequency: 'once' as const,
      type: 'enter' as const,
      occurredAt: Date.now()
    } as HistoryEvent;
    const reminder = historyEventToReminder(event);
    expect(reminder.id).toBeTruthy();
    expect(reminder.note).toBe('Nota');
    expect(reminder.address).toBe('Rua X');
    expect(reminder.location).toEqual({ latitude: 1, longitude: 1 });
    expect(reminder.radiusMeters).toBe(100);
  });
});
