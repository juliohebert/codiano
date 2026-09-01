import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

export type NotificationPermissionStatus = 'granted' | 'denied' | 'undetermined';

export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C'
      });
    } catch {
      // no-op
    }
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') {
    return 'granted';
  }

  const { status } = await Notifications.requestPermissionsAsync();
  if (status === 'granted') {
    return 'granted';
  }

  return 'denied';
}

export async function ensureNotificationCategories() {
  await Notifications.setNotificationCategoryAsync('radius-transition', [
    {
      identifier: 'complete',
      buttonTitle: 'Concluir',
      options: {}
    },
    {
      identifier: 'remind-again',
      buttonTitle: 'Lembrar novamente',
      options: {}
    }
  ]);
}

export async function scheduleLocalNotification(title: string, body: string, delaySeconds = 1) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: { source: 'georeminder-test' }
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: delaySeconds }
  });
}

export { buildRadiusNotificationContent } from './radius-content';

export async function scheduleRadiusNotification(title: string, type: 'enter' | 'exit', reminderId?: string) {
  const { buildRadiusNotificationContent } = await import('./radius-content');
  const content = buildRadiusNotificationContent(title, type);
  await Notifications.scheduleNotificationAsync({
    content: {
      ...content,
      data: {
        source: 'radius-transition',
        reminderId: reminderId ?? null,
        transitionType: type,
        reminderTitle: title
      },
      categoryIdentifier: 'radius-transition'
    },
    trigger: null
  });
}

type ActionHandler = {
  complete: (reminderId: string) => Promise<void>;
  remindAgain: (reminderId: string) => Promise<void>;
};

let actionHandler: ActionHandler | null = null;

export function setupNotificationActionHandler(getActions: () => ActionHandler) {
  actionHandler = getActions();
  const listener = Notifications.addNotificationResponseReceivedListener(async (response) => {
    try {
      const actionId = response.actionIdentifier;
      const data = (response.notification.request.content.data || {}) as {
        source?: string;
        reminderId?: string | null;
      };
      if (data.source !== 'radius-transition') {
        return;
      }
      const reminderId = data.reminderId;
      if (!reminderId || !actionHandler) {
        return;
      }
      if (actionId === 'complete') {
        await actionHandler.complete(reminderId);
      } else if (actionId === 'remind-again') {
        await actionHandler.remindAgain(reminderId);
      }
    } catch {
      // no-op
    }
  });
  return () => listener.remove();
}
