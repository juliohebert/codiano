import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Shipment, ShipmentCheckpoint, ShipmentSummary } from './types';

const STORAGE_KEY = '@georeminder:shipments';

function mapStatus(tag?: string, subtag?: string): Shipment['status'] {
  const base = String(tag ?? '').toLowerCase();
  const sub = String(subtag ?? '').toLowerCase();

  if (base.includes('delivered') || sub.includes('delivered')) return 'delivered';
  if (base.includes('exception') || sub.includes('exception')) return 'exception';
  if (base.includes('transit') || sub.includes('transit')) return 'in_transit';
  if (base.includes('out_for_delivery') || base.includes('delivery') || sub.includes('out_for_delivery')) return 'out_for_delivery';
  if (base.includes('pending') || base.includes('inforeceived') || sub.includes('pending')) return 'pending';

  return 'unknown';
}

export function normalizeAfterShipTracking(data: {
  tracking_number?: string;
  tag?: string;
  subtag?: string;
  courier_name?: string;
  checkpoints?: Array<{
    checkpoint_time?: string;
    location?: string;
    message?: string;
    tag?: string;
    subtag?: string;
  }>;
  expected_delivery?: string;
  last_updated_at?: string;
}): Shipment {
  const trackingNumber = String(data.tracking_number ?? '').trim();
  const courierName = data.courier_name?.trim();
  const checkpoints: ShipmentCheckpoint[] = (data.checkpoints ?? []).map((item) => ({
    timestamp: item.checkpoint_time ?? '',
    location: item.location?.trim(),
    description: item.message?.trim() ?? '',
    status: mapStatus(item.tag ?? data.tag, item.subtag ?? data.subtag)
  }));

  return {
    id: trackingNumber,
    trackingNumber,
    carrier: courierName,
    status: mapStatus(data.tag, data.subtag),
    checkpoints,
    lastUpdatedAt: data.last_updated_at,
    estimatedDelivery: data.expected_delivery
  };
}

export async function loadShipments(): Promise<Shipment[]> {
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

export async function saveShipments(shipments: Shipment[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(shipments));
}

export async function addShipment(shipment: Shipment): Promise<Shipment[]> {
  const current = await loadShipments();
  const next = [shipment, ...current.filter((item) => item.trackingNumber !== shipment.trackingNumber)];
  await saveShipments(next);
  return next;
}

export async function removeShipment(trackingNumber: string): Promise<Shipment[]> {
  const current = await loadShipments();
  const next = current.filter((item) => item.trackingNumber !== trackingNumber);
  await saveShipments(next);
  return next;
}

export async function updateShipment(shipment: Shipment): Promise<Shipment[]> {
  const current = await loadShipments();
  const next = current.map((item) => (item.trackingNumber === shipment.trackingNumber ? shipment : item));
  await saveShipments(next);
  return next;
}

export async function searchShipments(query: string): Promise<Shipment[]> {
  const shipments = await loadShipments();
  const term = query.trim().toLowerCase();
  if (!term) return shipments;
  return shipments.filter((item) =>
    item.trackingNumber.toLowerCase().includes(term) || item.carrier?.toLowerCase().includes(term)
  );
}

export function groupShipmentsByStatus(shipments: ShipmentSummary[]): { inProgress: ShipmentSummary[]; delivered: ShipmentSummary[] } {
  const summaries: ShipmentSummary[] = shipments.map((item) => ({
    id: item.id,
    trackingNumber: item.trackingNumber,
    carrier: item.carrier,
    status: item.status,
    lastUpdatedAt: item.lastUpdatedAt,
    estimatedDelivery: item.estimatedDelivery
  }));

  const inProgress = summaries.filter((item) => item.status !== 'delivered');
  const delivered = summaries.filter((item) => item.status === 'delivered');

  return { inProgress, delivered };
}

export function summarizeShipment(shipment: Shipment): ShipmentSummary {
  return {
    id: shipment.id,
    trackingNumber: shipment.trackingNumber,
    carrier: shipment.carrier,
    status: shipment.status,
    lastUpdatedAt: shipment.lastUpdatedAt,
    estimatedDelivery: shipment.estimatedDelivery
  };
}
