import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RefreshProvider } from './refresh-context';
import { ensureNotificationCategories, setupNotificationActionHandler } from '../src/notifications/notifications';
import { useEffect } from 'react';
import { router } from 'expo-router';
import { loadReminders, updateReminder, appendHistory } from '../src/storage/reminders';

export default function RootLayout() {
  useEffect(() => {
    let subscription: (() => void) | undefined;
    const init = async () => {
      try {
        await ensureNotificationCategories();
      } catch {
        // no-op
      }
      subscription = setupNotificationActionHandler(() => ({
        complete: async (reminderId: string) => {
          try {
            const reminders = await loadReminders();
            const reminder = reminders?.find((item: { id: string }) => item.id === reminderId);
            if (!reminder || (reminder as any).completed) {
              return;
            }
            await updateReminder({ ...(reminder as any), completed: true, active: false } as any);
            await appendHistory({
              reminderId: (reminder as any).id,
              reminderTitle: (reminder as any).title,
              placeName: (reminder as any).address,
              address: (reminder as any).address,
              note: (reminder as any).note,
              location: (reminder as any).location,
              trigger: (reminder as any).trigger,
              radiusMeters: (reminder as any).radiusMeters,
              frequency: (reminder as any).frequency,
              type: 'completed',
              occurredAt: Date.now()
            });
          } catch {
            // no-op
          }
        },
        remindAgain: async (reminderId: string) => {
          try {
            router.push(`/new-reminder?historyEventId=${encodeURIComponent(reminderId)}`);
          } catch {
            // no-op
          }
        }
      }));
    };
    init();
    return () => {
      if (subscription) subscription();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <RefreshProvider>
        <Stack
          screenOptions={{
            headerShown: true
          }}
        >
          <Stack.Screen
            name="(tabs)"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="new-reminder"
            options={{
              presentation: 'card',
              headerShown: true,
              headerBackTitle: 'Voltar',
              headerStyle: { backgroundColor: '#f8fafc' },
              headerTintColor: '#0f172a',
              headerTitleStyle: { fontWeight: '600', color: '#0f172a' },
              headerShadowVisible: false,
              contentStyle: { paddingTop: 0 }
            }}
          />
          <Stack.Screen
            name="bill/[id]"
            options={{
              headerShown: true,
              headerBackTitle: 'Voltar',
              headerTitle: 'Conta',
              headerStyle: { backgroundColor: '#f8fafc' },
              headerTintColor: '#0f172a',
              headerTitleStyle: { fontWeight: '600', color: '#0f172a' },
              headerShadowVisible: false
            }}
          />
          <Stack.Screen
            name="warranty/[id]"
            options={{
              headerShown: true,
              headerBackTitle: 'Voltar',
              headerTitle: 'Garantia',
              headerStyle: { backgroundColor: '#f8fafc' },
              headerTintColor: '#0f172a',
              headerTitleStyle: { fontWeight: '600', color: '#0f172a' },
              headerShadowVisible: false
            }}
          />
          <Stack.Screen
            name="document/[id]"
            options={{
              headerShown: true,
              headerBackTitle: 'Voltar',
              headerTitle: 'Documento',
              headerStyle: { backgroundColor: '#f8fafc' },
              headerTintColor: '#0f172a',
              headerTitleStyle: { fontWeight: '600', color: '#0f172a' },
              headerShadowVisible: false
            }}
          />
          <Stack.Screen name="splash" options={{ headerShown: false }} />
        </Stack>
      </RefreshProvider>
    </SafeAreaProvider>
  );
}
