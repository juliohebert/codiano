import type { Reminder } from '../storage/reminders';

export type TransitionDirection = 'enter' | 'exit';

export interface Transition {
  id: string;
  direction: TransitionDirection;
}

export interface GeofenceEvent {
  id: string;
  type: 'enter' | 'exit';
  trigger: 'enter' | 'exit';
  reminderId: string;
}

export interface GeofenceState {
  nearbyIds: Set<string>;
  baselineReady: boolean;
}

export function createGeofenceState(): GeofenceState {
  return {
    nearbyIds: new Set(),
    baselineReady: false
  };
}

export function updateGeofenceState(
  state: GeofenceState,
  currentNearbyIds: Set<string>,
  reminders: Reminder[]
): Transition[] {
  const previous = state.nearbyIds;

  if (!state.baselineReady) {
    state.baselineReady = true;
    state.nearbyIds = currentNearbyIds;
    return [];
  }

  const entered = [...currentNearbyIds].filter((id) => !previous.has(id));
  const exited = [...previous].filter((id) => !currentNearbyIds.has(id));

  if (entered.length === 0 && exited.length === 0) {
    state.nearbyIds = currentNearbyIds;
    return [];
  }

  const transitions: Transition[] = [];

  for (const id of exited) {
    const reminder = reminders.find((r) => r.id === id);
    if (!reminder) continue;
    if (reminder.completed) continue;
    if (reminder.trigger !== 'exit') continue;
    transitions.push({ id, direction: 'exit' });
  }

  for (const id of entered) {
    const reminder = reminders.find((r) => r.id === id);
    if (!reminder) continue;
    if (reminder.completed) continue;
    if (reminder.trigger !== 'enter') continue;
    transitions.push({ id, direction: 'enter' });
  }

  state.nearbyIds = currentNearbyIds;
  return transitions;
}

export function shouldProcessEvent(
  reminder: Reminder,
  transition: Transition
): boolean {
  if (reminder.completed) return false;
  if (!reminder.active) return false;
  if (!reminder.trigger) return false;
  if (transition.direction !== reminder.trigger) return false;
  return true;
}

export function getEventType(transition: Transition): 'enter' | 'exit' {
  return transition.direction;
}

export function isFrequencyOnce(reminder: Reminder): boolean {
  return reminder.frequency === 'once';
}
