import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { router, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Slot } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type Props = {};

const FINANCE_ROUTES = new Set(['bills', 'subscriptions', 'history']);
const DOCUMENTS_ROUTES = new Set(['documents', 'warranties']);
const MORE_ROUTES = new Set(['shipments', 'maintenances', 'settings']);

export default function TabsLayout() {
  const segments = useSegments() as string[];
  const tab = segments[1] ?? 'index';
  const isReminders = tab === 'index' || tab === '';
  const isFinances = FINANCE_ROUTES.has(tab);
  const isDocuments = DOCUMENTS_ROUTES.has(tab);
  const isMore = MORE_ROUTES.has(tab);
  const insets = useSafeAreaInsets();

  const navigateIfNeeded = (target: string[]) => {
    const isTargetReminders = target.length === 1 && target[0] === '(tabs)';
    const isCurrentReminders = segments[0] === '(tabs)' && (!segments[1] || segments[1] === 'index');

    if (isTargetReminders) {
      if (isCurrentReminders) return;
      router.replace('/(tabs)');
      return;
    }

    if (target.every((seg, i) => segments[i] === seg)) return;
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
          accessibilityLabel="Início"
        >
          <Ionicons
            name={isReminders ? 'home' : 'home-outline'}
            size={24}
            color={isReminders ? '#0f172a' : '#64748b'}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, isFinances && styles.tabActive]}
          onPress={() => navigateIfNeeded(['(tabs)', 'finances'])}
          accessibilityRole="button"
          accessibilityLabel="Finanças"
        >
          <Ionicons
            name={isFinances ? 'cash' : 'cash-outline'}
            size={24}
            color={isFinances ? '#0f172a' : '#64748b'}
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
          style={[styles.tab, isMore && styles.tabActive]}
          onPress={() => navigateIfNeeded(['(tabs)', 'more'])}
          accessibilityRole="button"
          accessibilityLabel="Mais"
        >
          <Ionicons
            name={isMore ? 'apps' : 'apps-outline'}
            size={24}
            color={isMore ? '#0f172a' : '#64748b'}
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
