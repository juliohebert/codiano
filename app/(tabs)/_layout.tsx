import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { router, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Slot } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type Props = {};

export default function TabsLayout() {
  const segments = useSegments() as string[];
  const isReminders = segments[0] === '(tabs)' && (!segments[1] || segments[1] === 'index');
  const isShipments = segments[0] === '(tabs)' && segments[1] === 'shipments';
  const isBills = segments[0] === '(tabs)' && segments[1] === 'bills';
  const isDocuments = segments[0] === '(tabs)' && segments[1] === 'documents';
  const isWarranties = segments[0] === '(tabs)' && segments[1] === 'warranties';
  const isHistory = segments[0] === '(tabs)' && segments[1] === 'history';
  const isSettings = segments[0] === '(tabs)' && segments[1] === 'settings';
  const insets = useSafeAreaInsets();

  const navigateIfNeeded = (target: string[]) => {
    const currentTab = segments[1] === 'index' ? '(tabs)' : segments[1];
    const targetTab = target[1] === 'index' ? '(tabs)' : target[1];
    if (currentTab === targetTab) return;
    router.replace(target.join('/'));
  };

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        <Slot />
      </View>
      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <TouchableOpacity
          style={[styles.tab, isReminders && styles.tabActive]}
          onPress={() => navigateIfNeeded(['(tabs)'])}
          accessibilityRole="button"
          accessibilityLabel="Lembretes"
        >
          <Ionicons
            name={isReminders ? 'location' : 'location-outline'}
            size={24}
            color={isReminders ? '#0f172a' : '#64748b'}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, isShipments && styles.tabActive]}
          onPress={() => navigateIfNeeded(['(tabs)', 'shipments'])}
          accessibilityRole="button"
          accessibilityLabel="Encomendas"
        >
          <Ionicons
            name={isShipments ? 'cube' : 'cube-outline'}
            size={24}
            color={isShipments ? '#0f172a' : '#64748b'}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, isBills && styles.tabActive]}
          onPress={() => navigateIfNeeded(['(tabs)', 'bills'])}
          accessibilityRole="button"
          accessibilityLabel="Contas"
        >
          <Ionicons
            name={isBills ? 'cash' : 'cash-outline'}
            size={24}
            color={isBills ? '#0f172a' : '#64748b'}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, isDocuments && styles.tabActive]}
          onPress={() => navigateIfNeeded(['(tabs)', 'documents'])}
          accessibilityRole="button"
          accessibilityLabel="Documentos"
        >
          <Ionicons
            name={isDocuments ? 'document-text' : 'document-text-outline'}
            size={24}
            color={isDocuments ? '#0f172a' : '#64748b'}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, isWarranties && styles.tabActive]}
          onPress={() => navigateIfNeeded(['(tabs)', 'warranties'])}
          accessibilityRole="button"
          accessibilityLabel="Garantias"
        >
          <Ionicons
            name={isWarranties ? 'shield' : 'shield-outline'}
            size={24}
            color={isWarranties ? '#0f172a' : '#64748b'}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, isHistory && styles.tabActive]}
          onPress={() => navigateIfNeeded(['(tabs)', 'history'])}
          accessibilityRole="button"
          accessibilityLabel="Histórico"
        >
          <Ionicons
            name={isHistory ? 'time' : 'time-outline'}
            size={24}
            color={isHistory ? '#0f172a' : '#64748b'}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, isSettings && styles.tabActive]}
          onPress={() => navigateIfNeeded(['(tabs)', 'settings'])}
          accessibilityRole="button"
          accessibilityLabel="Configurações"
        >
          <Ionicons
            name={isSettings ? 'settings' : 'settings-outline'}
            size={24}
            color={isSettings ? '#0f172a' : '#64748b'}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  content: {
    flex: 1
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderTopColor: '#e2e8f0',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingTop: 8,
    minHeight: 56
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 12
  },
  tabActive: {
    backgroundColor: '#eef2f7'
  }
});
