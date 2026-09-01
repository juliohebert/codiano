import { buildRadiusNotificationContent } from '../src/notifications/radius-content';

describe('radius notification payload', () => {
  it('builds enter payload', () => {
    expect(buildRadiusNotificationContent('Lembrete A', 'enter')).toEqual({
      title: 'Chegada',
      body: 'Lembrete A: Você entrou no raio.'
    });
  });

  it('builds exit payload', () => {
    expect(buildRadiusNotificationContent('Lembrete A', 'exit')).toEqual({
      title: 'Saída',
      body: 'Lembrete A: Você saiu do raio.'
    });
  });
});
