import { findRadiusTransitions, shouldCompleteOnTransition, type Transition } from '../src/geo/proximity';
import type { Reminder } from '../src/storage/reminders';

describe('findRadiusTransitions', () => {
  const baseReminders: Reminder[] = [
    { id: '1', title: 'A', note: '', active: true, completed: false, trigger: 'exit', frequency: 'once', location: { latitude: 0, longitude: 0 }, radiusMeters: 1000 },
    { id: '2', title: 'B', note: '', active: true, completed: false, trigger: 'enter', frequency: 'always', location: { latitude: 0, longitude: 0 }, radiusMeters: 1000 },
    { id: '3', title: 'C', note: '', active: false, completed: false, trigger: 'exit', frequency: 'once', location: { latitude: 0, longitude: 0 }, radiusMeters: 1000 },
    { id: '4', title: 'D', note: '', active: true, completed: true, trigger: 'exit', frequency: 'once', location: { latitude: 0, longitude: 0 }, radiusMeters: 1000 }
  ];

  it('gera transições de entrada/saída respeitando trigger e estado', () => {
    const previous = new Set<string>([]);
    const current = new Set<string>(['1', '2']);
    const transitions = findRadiusTransitions({ previousNearbyIds: previous, currentNearbyIds: current, reminders: baseReminders });
    expect(transitions).toEqual([{ id: '2', direction: 'enter' }]);
  });

  it('não gera transição quando estado não muda', () => {
    const reminders: Reminder[] = [
      { id: '1', title: 'A', note: '', active: true, completed: false, trigger: 'enter', frequency: 'always', location: { latitude: 0, longitude: 0 }, radiusMeters: 1000 }
    ];

    const previous = new Set<string>(['1']);
    const current = new Set<string>(['1']);
    const transitions = findRadiusTransitions({ previousNearbyIds: previous, currentNearbyIds: current, reminders });
    expect(transitions).toEqual([]);
  });

  it('ignora triggers opostos à direção da transição', () => {
    const reminders: Reminder[] = [
      { id: '1', title: 'A', note: '', active: true, completed: false, trigger: 'exit', frequency: 'once', location: { latitude: 0, longitude: 0 }, radiusMeters: 1000 },
      { id: '2', title: 'B', note: '', active: true, completed: false, trigger: 'enter', frequency: 'always', location: { latitude: 0, longitude: 0 }, radiusMeters: 1000 }
    ];

    const previous = new Set<string>(['1', '2']);
    const current = new Set<string>(['2']);
    const transitions = findRadiusTransitions({ previousNearbyIds: previous, currentNearbyIds: current, reminders });
    expect(transitions).toEqual([{ id: '1', direction: 'exit' }]);
  });

  it('ignora Inativos e Concluídos', () => {
    const reminders: Reminder[] = [
      { id: '1', title: 'A', note: '', active: true, completed: false, trigger: 'enter', frequency: 'always', location: { latitude: 0, longitude: 0 }, radiusMeters: 1000 },
      { id: '2', title: 'B', note: '', active: false, completed: false, trigger: 'enter', frequency: 'always', location: { latitude: 0, longitude: 0 }, radiusMeters: 1000 },
      { id: '3', title: 'C', note: '', active: true, completed: true, trigger: 'enter', frequency: 'always', location: { latitude: 0, longitude: 0 }, radiusMeters: 1000 }
    ];

    const previous = new Set<string>([]);
    const current = new Set<string>(['1', '2', '3']);
    const transitions = findRadiusTransitions({ previousNearbyIds: previous, currentNearbyIds: current, reminders });
    expect(transitions).toEqual([{ id: '1', direction: 'enter' }]);
  });

  it('ignora IDs na coleção que não existem nos lembretes (enter)', () => {
    const reminders: Reminder[] = [
      { id: '1', title: 'A', note: '', active: true, completed: false, trigger: 'enter', frequency: 'always', location: { latitude: 0, longitude: 0 }, radiusMeters: 1000 }
    ];

    const previous = new Set<string>([]);
    const current = new Set<string>(['1', 'FAKE_ID']);
    const transitions = findRadiusTransitions({ previousNearbyIds: previous, currentNearbyIds: current, reminders });
    expect(transitions).toEqual([{ id: '1', direction: 'enter' }]);
  });

  it('ignora IDs na coleção que não existem nos lembretes (exit)', () => {
    const reminders: Reminder[] = [
      { id: '1', title: 'A', note: '', active: true, completed: false, trigger: 'exit', frequency: 'once', location: { latitude: 0, longitude: 0 }, radiusMeters: 1000 }
    ];

    const previous = new Set<string>(['1', 'FAKE_ID']);
    const current = new Set<string>(['1']);
    const transitions = findRadiusTransitions({ previousNearbyIds: previous, currentNearbyIds: current, reminders });
    expect(transitions).toEqual([]);
  });
});

describe('frequency behavior', () => {
  it('frequency once deve indicar conclusão no primeiro evento válido', () => {
    const reminder: Reminder = { id: '1', title: 'A', note: '', active: true, completed: false, trigger: 'enter', frequency: 'once', location: { latitude: 0, longitude: 0 }, radiusMeters: 1000 };
    expect(shouldCompleteOnTransition(reminder)).toBe(true);
  });

  it('frequency always não deve concluir automaticamente', () => {
    const reminder: Reminder = { id: '2', title: 'B', note: '', active: true, completed: false, trigger: 'exit', frequency: 'always', location: { latitude: 0, longitude: 0 }, radiusMeters: 1000 };
    expect(shouldCompleteOnTransition(reminder)).toBe(false);
  });

  it('evento incompatível com trigger não deve concluir lembrete once', () => {
    const reminders: Reminder[] = [
      { id: '1', title: 'A', note: '', active: true, completed: false, trigger: 'enter', frequency: 'once', location: { latitude: 0, longitude: 0 }, radiusMeters: 1000 }
    ];
    const previous = new Set<string>(['1']);
    const current = new Set<string>([]);
    const transitions = findRadiusTransitions({ previousNearbyIds: previous, currentNearbyIds: current, reminders });
    expect(transitions).toEqual([]);
  });
});
