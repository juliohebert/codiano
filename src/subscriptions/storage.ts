import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Subscription } from './types';

const STORAGE_KEY = '@georeminder:subscriptions';

export async function loadSubscriptions(): Promise<Subscription[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export async function saveSubscriptions(subscriptions: Subscription[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(subscriptions));
}

export async function addSubscription(subscription: Subscription): Promise<Subscription[]> {
  const current = await loadSubscriptions();
  const next = [subscription, ...current.filter((item) => item.id !== subscription.id)];
  await saveSubscriptions(next);
  return next;
}

export async function updateSubscription(subscription: Subscription): Promise<Subscription[]> {
  const current = await loadSubscriptions();
  const next = current.map((item) => (item.id === subscription.id ? subscription : item));
  await saveSubscriptions(next);
  return next;
}

export async function removeSubscription(id: string): Promise<Subscription[]> {
  const current = await loadSubscriptions();
  const next = current.filter((item) => item.id !== id);
  await saveSubscriptions(next);
  return next;
}
