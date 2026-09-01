import { StyleSheet, View, Text, Pressable, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import {
  getLocationPermissionState,
  getNotificationPermissionState,
  requestLocationPermissionIfNeeded,
  requestNotificationPermissionIfNeeded,
  openAppSettings,
  statusText,
  type PermissionState
} from '../../src/permissions/permissions';

type PermissionItemState = PermissionState & { loading: boolean };

export default function SettingsPlaceholder() {
  const [location, setLocation] = useState<PermissionItemState>(() => ({ ...({ kind: 'location', status: 'undetermined', label: 'Localização', description: '' } as PermissionState), loading: false }));
  const [notifications, setNotifications] = useState<PermissionItemState>(() => ({ ...({ kind: 'notification', status: 'undetermined', label: 'Notificações', description: '' } as PermissionState), loading: false }));

  useEffect(() => {
    (async () => {
      const [locationState, notificationState] = await Promise.all([
        getLocationPermissionState(),
        getNotificationPermissionState()
      ]);
      setLocation({ ...locationState, loading: false });
      setNotifications({ ...notificationState, loading: false });
    })();
  }, []);

  const handleRequestLocation = async () => {
    setLocation((prev) => ({ ...prev, loading: true }));
    const next = await requestLocationPermissionIfNeeded();
    setLocation({ ...next, loading: false });
  };

  const handleRequestNotification = async () => {
    setNotifications((prev) => ({ ...prev, loading: true }));
    const next = await requestNotificationPermissionIfNeeded();
    setNotifications({ ...next, loading: false });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>⚙️</Text>
        </View>
        <Text style={styles.title}>Configurações</Text>
        <Text style={styles.subtitle}>Gerencie as permissões do app.</Text>

        <View style={styles.card}>
          <PermissionRow
            title={location.label}
            description={location.description}
            status={statusText(location.status)}
            loading={location.loading}
            buttonLabel={location.status === 'granted' ? 'Concedida' : 'Solicitar permissão'}
            onPress={location.status === 'granted' ? undefined : handleRequestLocation}
          />
          <View style={styles.separator} />
          <PermissionRow
            title={notifications.label}
            description={notifications.description}
            status={statusText(notifications.status)}
            loading={notifications.loading}
            buttonLabel={notifications.status === 'granted' ? 'Concedida' : 'Solicitar permissão'}
            onPress={notifications.status === 'granted' ? undefined : handleRequestNotification}
          />
        </View>

        {(location.status === 'denied' || notifications.status === 'denied') && (
          <Pressable style={styles.settingsButton} onPress={openAppSettings}>
            <Text style={styles.settingsButtonLabel}>Abrir Ajustes do iOS</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

type PermissionRowProps = {
  title: string;
  description: string;
  status: string;
  loading: boolean;
  buttonLabel: string;
  onPress?: () => void;
};

function PermissionRow({ title, description, status, loading, buttonLabel, onPress }: PermissionRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rowTextWrap}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDescription}>{description}</Text>
        <Text style={[styles.rowStatus, status === 'Concedida' ? styles.statusGranted : styles.statusOther]}>{status}</Text>
      </View>
      {onPress ? (
        <Pressable
          onPress={onPress}
          disabled={loading}
          style={({ pressed }) => [styles.rowButton, pressed && styles.rowButtonPressed, loading && styles.rowButtonDisabled]}
        >
          <Text style={styles.rowButtonLabel}>{loading ? '...' : buttonLabel}</Text>
        </Pressable>
      ) : (
        <View style={[styles.rowButton, styles.rowButtonDisabled]}>
          <Text style={styles.rowButtonLabel}>{buttonLabel}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 20
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: '#eef2f7',
    alignItems: 'center',
    justifyContent: 'center'
  },
  icon: {
    fontSize: 32,
    color: '#0f172a',
    fontWeight: '700'
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: '#0f172a'
  },
  subtitle: {
    fontSize: 15,
    color: '#475569'
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden'
  },
  separator: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 16
  },
  row: {
    padding: 16,
    gap: 12
  },
  rowTextWrap: {
    gap: 6
  },
  rowTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0f172a'
  },
  rowDescription: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 18
  },
  rowStatus: {
    fontSize: 13,
    fontWeight: '600'
  },
  statusGranted: {
    color: '#15803d'
  },
  statusOther: {
    color: '#b91c1c'
  },
  rowButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center'
  },
  rowButtonPressed: {
    opacity: 0.85
  },
  rowButtonDisabled: {
    opacity: 0.5
  },
  rowButtonLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700'
  },
  settingsButton: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center'
  },
  settingsButtonLabel: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700'
  }
});
