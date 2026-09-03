export type MaintenanceStatus = 'upcoming' | 'overdue' | 'done';

export type Maintenance = {
  id: string;
  title: string;
  dueDate: string;
  status: MaintenanceStatus;
  note?: string;
  createdAt: string;
  updatedAt?: string;
};
