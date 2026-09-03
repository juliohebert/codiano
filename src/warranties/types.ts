export type WarrantyStatus = 'active' | 'expired';

export type Warranty = {
  id: string;
  product: string;
  store?: string;
  purchaseDate: string;
  amount?: number;
  validUntil: string;
  note?: string;
  status: WarrantyStatus;
  file?: {
    uri: string;
    name: string;
    mimeType: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};
