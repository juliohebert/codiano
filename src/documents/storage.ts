import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Document, DocumentStatus } from './types';

const STORAGE_KEY = '@georeminder:documents';

export async function loadDocuments(): Promise<Document[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item: any) => {
      if (!item || typeof item !== 'object') return item;
      const doc = item as Document;
      if (typeof doc.validUntil !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(doc.validUntil)) {
        return { ...doc, validUntil: new Date().toISOString().slice(0, 10) };
      }
      return doc;
    });
  } catch {
    return [];
  }
}

export async function saveDocuments(documents: Document[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
}

export async function addDocument(document: Document): Promise<Document[]> {
  const current = await loadDocuments();
  const next = [document, ...current.filter((item) => item.id !== document.id)];
  await saveDocuments(next);
  return next;
}

export async function updateDocument(document: Document): Promise<Document[]> {
  const current = await loadDocuments();
  const next = current.map((item) => (item.id === document.id ? document : item));
  await saveDocuments(next);
  return next;
}

export async function removeDocument(id: string): Promise<Document[]> {
  const current = await loadDocuments();
  const next = current.filter((item) => item.id !== id);
  await saveDocuments(next);
  return next;
}

export function classifyDocumentStatus(validUntil: string, status: DocumentStatus): DocumentStatus {
  if (status === 'expired') return 'expired';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(validUntil);
  due.setHours(0, 0, 0, 0);
  return due < today ? 'expired' : 'active';
}
