export type BillRecurrence = 'once' | 'monthly';

export type BillStatus = 'upcoming' | 'overdue' | 'paid';

export type Bill = {
  id: string;
  name: string;
  amount?: number;
  dueDate: string;
  recurrence: BillRecurrence;
  reminderDaysBefore: number;
  note?: string;
  status: BillStatus;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
};
