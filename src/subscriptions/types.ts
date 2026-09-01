export type SubscriptionFrequency = 'monthly' | 'yearly';

export type SubscriptionStatus = 'active' | 'paused' | 'cancelled';

export type Subscription = {
  id: string;
  name: string;
  amount?: number;
  nextDueDate: string;
  frequency: SubscriptionFrequency;
  reminderDaysBefore: number;
  note?: string;
  status: SubscriptionStatus;
  createdAt: string;
  updatedAt: string;
};
