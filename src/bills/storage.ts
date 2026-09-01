import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Bill } from './types';

const STORAGE_KEY = '@georeminder:bills';

export async function loadBills(): Promise<Bill[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const migrated = parsed.map((item: Bill) => {
      if (!item || typeof item !== 'object') return item;
      if (typeof item.dueDate !== 'string') return item;
      const match = item.dueDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!match) return item;
      const [, dd, mm, yyyy] = match;
      return { ...item, dueDate: `${yyyy}-${mm}-${dd}` };
    });
    if (migrated.some((item: Bill, idx: number) => item.dueDate !== (parsed[idx] as Bill).dueDate)) {
      await saveBills(migrated);
    }
    return migrated;
  } catch {
    return [];
  }
}

export async function saveBills(bills: Bill[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(bills));
}

export async function addBill(bill: Bill): Promise<Bill[]> {
  const current = await loadBills();
  const next = [bill, ...current.filter((item) => item.id !== bill.id)];
  await saveBills(next);
  return next;
}

export async function updateBill(bill: Bill): Promise<Bill[]> {
  const current = await loadBills();
  const next = current.map((item) => (item.id === bill.id ? bill : item));
  await saveBills(next);
  return next;
}

export async function removeBill(id: string): Promise<Bill[]> {
  const current = await loadBills();
  const next = current.filter((item) => item.id !== id);
  await saveBills(next);
  return next;
}
