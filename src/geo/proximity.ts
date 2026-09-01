import type { Reminder } from '../storage/reminders';

export type TransitionDirection = 'enter' | 'exit';

export interface Transition {
  id: string;
  direction: TransitionDirection;
}

export function isReminderEligibleForTransition(reminder: Reminder): boolean {
  if (reminder.completed) return false;
  if (!reminder.active) return false;
  if (!reminder.trigger) return false;
  return true;
}

export function findRadiusTransitions({
  previousNearbyIds,
  currentNearbyIds,
  reminders
}: {
  previousNearbyIds: Set<string>;
  currentNearbyIds: Set<string>;
  reminders: Reminder[];
}): Transition[] {
  const entered = [...currentNearbyIds].filter((id) => !previousNearbyIds.has(id));
  const exited = [...previousNearbyIds].filter((id) => !currentNearbyIds.has(id));

  const eligibleIds = new Set(reminders.filter(isReminderEligibleForTransition).map((r) => r.id));

  const transitions: Transition[] = [];

  for (const id of exited) {
    if (!eligibleIds.has(id)) continue;
    const reminder = reminders.find((r) => r.id === id);
    if (!reminder) continue;
    if (reminder.trigger !== 'exit') continue;
    transitions.push({ id, direction: 'exit' });
  }

  for (const id of entered) {
    if (!eligibleIds.has(id)) continue;
    const reminder = reminders.find((r) => r.id === id);
    if (!reminder) continue;
    if (reminder.trigger !== 'enter') continue;
    transitions.push({ id, direction: 'enter' });
  }

  return transitions;
}

export function isFrequencyOnce(reminder: Reminder): boolean {
  return reminder.frequency === 'once';
}

export function shouldCompleteOnTransition(reminder: Reminder): boolean {
  return isFrequencyOnce(reminder);
}
