export type ShipmentStatus =
  | 'pending'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'exception'
  | 'unknown';

export type ShipmentCheckpoint = {
  timestamp: string;
  location?: string;
  description: string;
  status?: ShipmentStatus;
};

export type Shipment = {
  id: string;
  trackingNumber: string;
  carrier?: string;
  status: ShipmentStatus;
  checkpoints: ShipmentCheckpoint[];
  lastUpdatedAt?: string;
  estimatedDelivery?: string;
  raw?: unknown;
};

export type ShipmentSummary = {
  id: string;
  trackingNumber: string;
  carrier?: string;
  status: ShipmentStatus;
  lastUpdatedAt?: string;
  estimatedDelivery?: string;
};
