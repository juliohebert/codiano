import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Platform, Linking, Alert } from 'react-native';

export type PermissionKind = 'location' | 'notification';

export type PermissionState = {
  kind: PermissionKind;
  status: 'granted' | 'denied' | 'undetermined';
  label: string;
  description: string;
};

const LOCATION_LABEL = 'Localização';
const LOCATION_DESCRIPTION = 'Usada para registrar o local do lembrete e, no futuro, avisar quando você chegar ou sair da região.';

const NOTIFICATION_LABEL = 'Notificações';
const NOTIFICATION_DESCRIPTION = 'Usada para enviar alertas de lembrete mesmo quando o app não está aberto.';

function normalizeStatus(status: string): PermissionState['status'] {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

export async function getNotificationPermissionState(): Promise<PermissionState> {
  const { status } = await Notifications.getPermissionsAsync();
  return {
    kind: 'notification',
    status: normalizeStatus(status),
    label: NOTIFICATION_LABEL,
    description: NOTIFICATION_DESCRIPTION,
  };
}

export async function getLocationPermissionState(): Promise<PermissionState> {
  const { status } = await Location.getForegroundPermissionsAsync();
  return {
    kind: 'location',
    status: normalizeStatus(status),
    label: LOCATION_LABEL,
    description: LOCATION_DESCRIPTION,
  };
}

export async function requestLocationPermissionIfNeeded(): Promise<PermissionState> {
  const current = await getLocationPermissionState();
  if (current.status === 'granted') {
    return current;
  }

  const { status } = await Location.requestForegroundPermissionsAsync();
  const updated = await getLocationPermissionState();
  if (updated.status === 'denied') {
    Alert.alert(
      'Permissão de localização negada',
      'Habilite o acesso em Ajustes > Cotidiano > Localização para usar lembretes por local.'
    );
  }

  return updated;
}

export async function requestNotificationPermissionIfNeeded(): Promise<PermissionState> {
  const current = await getNotificationPermissionState();
  if (current.status === 'granted') {
    return current;
  }

  const status = await Notifications.requestPermissionsAsync();
  const updated = await getNotificationPermissionState();
  if (updated.status === 'denied') {
    Alert.alert(
      'Notificações desativadas',
      'Habilite as notificações em Ajustes > Cotidiano > Notificações para receber alertas.'
    );
  }

  return updated;
}

export function openAppSettings(): void {
  Linking.openSettings().catch(() => {
    Alert.alert('Ajustes', 'Abra os Ajustes do iOS, busque Cotidiano e revise as permissões.');
  });
}

export function statusText(status: PermissionState['status']): string {
  if (status === 'granted') return 'Concedida';
  if (status === 'denied') return 'Negada';
  return 'Ainda não solicitada';
}
