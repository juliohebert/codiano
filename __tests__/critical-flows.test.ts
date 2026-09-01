import {
  loadReminders,
  saveReminders,
  updateReminder,
  removeReminder,
  loadHistory,
  appendHistory,
  loadFavoriteLocations,
  isFavoriteLocation,
  type Reminder,
  type FavoriteLocation
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

describe('critical flows — reminders/history/favorites', () => {
  it('loadReminders returns empty array when storage key is missing', async () => {
    setStorage({});
    const result = await loadReminders();
    expect(result).toEqual([]);
  });

  it('saveReminders persists reminders and loadReminders recovers them unchanged', async () => {
    const reminders = [
      { id: '1', title: 'A', note: 'N1', active: true, completed: false, trigger: 'enter', frequency: 'always', location: { latitude: 1, longitude: 1 }, radiusMeters: 100, category: 'Pessoal', address: 'Rua A' },
      { id: '2', title: 'B', note: '', active: false, completed: true, trigger: 'exit', frequency: 'once', location: { latitude: 2, longitude: 2 }, radiusMeters: 200, category: 'Trabalho', address: 'Rua B' }
    ] as Reminder[];

    await saveReminders(reminders);
    const loaded = await loadReminders();

    expect(loaded).toEqual(reminders);
    expect(mockedSetItem).toHaveBeenCalledTimes(1);
    expect(mockedSetItem).toHaveBeenCalledWith('@georeminder:reminders', JSON.stringify(reminders));
  });

  it('updateReminder updates only the target id and preserves others', async () => {
    const reminders = [
      { id: '1', title: 'A', note: '', active: true, completed: false, trigger: 'enter', frequency: 'once', location: { latitude: 0, longitude: 0 }, radiusMeters: 100, category: 'Outro', address: '' },
      { id: '2', title: 'B', note: '', active: true, completed: false, trigger: 'exit', frequency: 'always', location: { latitude: 0, longitude: 0 }, radiusMeters: 200, category: 'Outro', address: '' }
    ] as Reminder[];
    setStorage({ '@georeminder:reminders': JSON.stringify(reminders) });

    await updateReminder({ id: '2', title: 'B-updated', note: '' });

    const stored = JSON.parse(store['@georeminder:reminders'] ?? '[]') as Reminder[];
    expect(stored[0].title).toBe('A');
    expect(stored[1].title).toBe('B-updated');
  });

  it('removeReminder removes the target and keeps others', async () => {
    const reminders = [
      { id: '1', title: 'A', note: '', active: true, completed: false, trigger: 'enter', frequency: 'once', location: { latitude: 0, longitude: 0 }, radiusMeters: 100, category: 'Outro', address: '' },
      { id: '2', title: 'B', note: '', active: true, completed: false, trigger: 'exit', frequency: 'always', location: { latitude: 0, longitude: 0 }, radiusMeters: 200, category: 'Outro', address: '' }
    ] as Reminder[];
    setStorage({ '@georeminder:reminders': JSON.stringify(reminders) });

    await removeReminder('1');

    const stored = JSON.parse(store['@georeminder:reminders'] ?? '[]') as Reminder[];
    expect(stored.map((item) => item.id)).toEqual(['2']);
  });

  it('removeReminder is a no-op when id does not exist', async () => {
    const reminders = [
      { id: '1', title: 'A', note: '', active: true, completed: false, trigger: 'enter', frequency: 'once', location: { latitude: 0, longitude: 0 }, radiusMeters: 100, category: 'Outro', address: '' }
    ] as Reminder[];
    setStorage({ '@georeminder:reminders': JSON.stringify(reminders) });

    await removeReminder('missing');

    const stored = JSON.parse(store['@georeminder:reminders'] ?? '[]') as Reminder[];
    expect(stored).toEqual(reminders);
  });

  it('loadHistory returns most recent events first', async () => {
    setStorage({});
    await appendHistory({ reminderId: '1', reminderTitle: 'A', address: 'Rua A', location: { latitude: 0, longitude: 0 }, trigger: 'enter', radiusMeters: 100, frequency: 'once', type: 'enter', occurredAt: 1000 });
    await appendHistory({ reminderId: '1', reminderTitle: 'A', address: 'Rua A', location: { latitude: 0, longitude: 0 }, trigger: 'enter', radiusMeters: 100, frequency: 'once', type: 'exit', occurredAt: 3000 });
    await appendHistory({ reminderId: '1', reminderTitle: 'A', address: 'Rua A', location: { latitude: 0, longitude: 0 }, trigger: 'enter', radiusMeters: 100, frequency: 'once', type: 'enter', occurredAt: 2000 });

    const history = await loadHistory();
    expect(history.map((item) => item.type)).toEqual(['exit', 'enter', 'enter']);
    expect(history.map((item) => item.occurredAt)).toEqual([3000, 2000, 1000]);
  });

  it('loadHistory preserves events after reminder deletion', async () => {
    setStorage({ '@georeminder:reminders': JSON.stringify([{ id: '1', title: 'A', note: '' }]) });
    await appendHistory({ reminderId: '1', reminderTitle: 'A', address: 'Rua A', location: { latitude: 0, longitude: 0 }, trigger: 'enter', radiusMeters: 100, frequency: 'once', type: 'completed', occurredAt: 1000 });
    await removeReminder('1');

    const history = await loadHistory();
    expect(history.map((item) => item.reminderId)).toEqual(['1']);
    expect(history.map((item) => item.type)).toEqual(['completed']);
  });

  it('favorites are persisted and reloaded unchanged', async () => {
    const favorites = [
      { placeName: 'F1', address: 'A1', latitude: 1, longitude: 1 },
      { placeName: 'F2', address: 'A2', latitude: 2, longitude: 2 }
    ] as FavoriteLocation[];
    setStorage({ '@georeminder:favorite-locations': JSON.stringify(favorites) });

    const loaded = await loadFavoriteLocations();
    expect(loaded).toEqual(favorites);
  });

  it('isFavoriteLocation matches exact coordinates and nearby duplicates within tolerance', async () => {
    const favorites = [
      { placeName: 'F1', address: 'A1', latitude: 1, longitude: 1 }
    ] as FavoriteLocation[];
    setStorage({ '@georeminder:favorite-locations': JSON.stringify(favorites) });

    expect(await isFavoriteLocation(1, 1)).toBe(true);
    expect(await isFavoriteLocation(1.00001, 1.00001)).toBe(true);
    expect(await isFavoriteLocation(2, 2)).toBe(false);
  });
});
