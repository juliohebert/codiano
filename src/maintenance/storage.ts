import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Maintenance } from './types';

const STORAGE_KEY = '@georeminder:maintenances';

export async function loadMaintenances(): Promise<Maintenance[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is Maintenance => !!item && typeof item === 'object' && typeof item.id === 'string');
  } catch {
    return [];
  }
}

export async function saveMaintenances(maintenances: Maintenance[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(maintenances));
}

export async function addMaintenance(maintenance: Maintenance): Promise<Maintenance[]> {
  const current = await loadMaintenances();
  const next = [maintenance, ...current.filter((item) => item.id !== maintenance.id)];
  await saveMaintenances(next);
  return next;
}

export async function updateMaintenance(maintenance: Maintenance): Promise<Maintenance[]> {
  const current = await loadMaintenances();
  const next = current.map((item) => (item.id === maintenance.id ? maintenance : item));
  await saveMaintenances(next);
  return next;
}

export async function removeMaintenance(id: string): Promise<Maintenance[]> {
  const current = await loadMaintenances();
  const next = current.filter((item) => item.id !== id);
  await saveMaintenances(next);
  return next;
}
