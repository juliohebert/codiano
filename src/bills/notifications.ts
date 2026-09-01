import { cancelBillNotification, scheduleBillNotification } from '../../src/notifications/bills';
import type { Bill } from '../../src/bills/types';

export async function syncBillNotification(bill: Bill) {
  await cancelBillNotification(bill.id);
  if (bill.status !== 'paid') {
    await scheduleBillNotification(bill);
  }
}

export async function syncAllBillNotifications() {
  const { loadBills } = await import('../../src/bills/storage');
  const bills = await loadBills();
  for (const bill of bills) {
    await syncBillNotification(bill);
  }
}

export async function scheduleBillAfterSave(bill: Bill) {
  await syncBillNotification(bill);
}
