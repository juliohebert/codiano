export type DocumentStatus = 'active' | 'expired';

export type DocumentFile = {
  uri: string;
  name: string;
  mimeType: string;
};

export type Document = {
  id: string;
  title: string;
  validUntil: string;
  note?: string;
  status: DocumentStatus;
  file?: DocumentFile | null;
  createdAt: string;
  updatedAt: string;
};
