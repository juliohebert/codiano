import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Warranty, WarrantyStatus } from './types';
import { parseLocalDate, toLocalDate } from '../../src/common/dates';

const STORAGE_KEY = '@georeminder:warranties';

export async function loadWarranties(): Promise<Warranty[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item: any) => {
      if (!item || typeof item !== 'object') return item;
      const warranty = item as Warranty;
      if (typeof warranty.purchaseDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(warranty.purchaseDate)) {
        return { ...warranty, purchaseDate: new Date().toISOString().slice(0, 10) };
      }
      if (typeof warranty.validUntil !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(warranty.validUntil)) {
        return { ...warranty, validUntil: new Date().toISOString().slice(0, 10) };
      }
      return { ...warranty, file: warranty.file ?? null };
    });
  } catch {
    return [];
  }
}

export async function saveWarranties(warranties: Warranty[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(warranties));
}

export async function addWarranty(warranty: Warranty): Promise<Warranty[]> {
  const current = await loadWarranties();
  const next = [warranty, ...current.filter((item) => item.id !== warranty.id)];
  await saveWarranties(next);
  return next;
}

export async function updateWarranty(warranty: Warranty): Promise<Warranty[]> {
  const current = await loadWarranties();
  const next = current.map((item) => (item.id === warranty.id ? warranty : item));
  await saveWarranties(next);
  return next;
}

export async function removeWarranty(id: string): Promise<Warranty[]> {
  const current = await loadWarranties();
  const target = current.find((item) => item.id === id);
  const next = current.filter((item) => item.id !== id);
  await saveWarranties(next);
  if (target?.file?.uri) {
    try {
      const FileSystem = await import('expo-file-system/legacy');
      await FileSystem.deleteAsync(target.file.uri, { idempotent: true });
    } catch {
      // no-op
    }
  }
  return next;
}

export function classifyWarrantyStatus(validUntil: string, status: WarrantyStatus): WarrantyStatus {
  if (status === 'expired') return 'expired';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { year, month, day } = parseLocalDate(validUntil);
  const due = toLocalDate(year, month, day);
  return due < today ? 'expired' : 'active';
}
