import * as Notifications from 'expo-notifications';
import { scheduleLocalNotification, requestNotificationPermission } from './notifications';
import type { Bill } from '../../src/bills/types';

export type BillNotificationSchedule = {
  identifier: string;
  dueDate: string;
  reminderDaysBefore: number;
};

function computeReminderDate(bill: Bill): Date {
  const due = new Date(bill.dueDate);
  due.setHours(0, 0, 0, 0);
  const reminder = new Date(due);
  reminder.setDate(reminder.getDate() - bill.reminderDaysBefore);
  return reminder;
}

export async function scheduleBillNotification(bill: Bill): Promise<string | null> {
  try {
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') return null;

    const when = computeReminderDate(bill);
    const now = new Date();
    if (isNaN(when.getTime())) return null;
    let delaySeconds = (when.getTime() - now.getTime()) / 1000;
    if (delaySeconds < 0) delaySeconds = 1;
    if (delaySeconds > 60 * 60 * 24 * 365) delaySeconds = 60;

    const formattedDueDate = `${String(bill.dueDate.slice(8, 10)).padStart(2, '0')}/${String(bill.dueDate.slice(5, 7)).padStart(2, '0')}/${bill.dueDate.slice(0, 4)}`;
    const identifier = `bill-${bill.id}`;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: bill.name,
        body: `Conta vence em ${formattedDueDate}.`,
        data: { source: 'bill', billId: bill.id }
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(1, Math.floor(delaySeconds)) }
    });

    return identifier;
  } catch {
    return null;
  }
}

export async function cancelBillNotification(billId: string) {
  try {
    const identifier = `bill-${billId}`;
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch {
    // no-op
  }
}
