export function buildRadiusNotificationContent(title: string, type: 'enter' | 'exit') {
  const isEnter = type === 'enter';
  return {
    title: isEnter ? 'Chegada' : 'Saída',
    body: `${title}: ${isEnter ? 'Você entrou no raio' : 'Você saiu do raio'}.`
  };
}
