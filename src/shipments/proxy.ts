import { SHIPMENT_TRACKING_PROXY_URL } from './config';

export async function fetchTrackingFromProxy(trackingNumber: string): Promise<any> {
  const response = await fetch(SHIPMENT_TRACKING_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tracking_number: trackingNumber.trim() })
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const message = data?.error === 'not_found' ? 'Código não encontrado.' : 'Não foi possível consultar o rastreio.';
    throw new Error(message);
  }

  return response.json().catch(() => ({}));
}
