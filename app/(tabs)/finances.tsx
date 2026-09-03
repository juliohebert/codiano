import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

type FinanceEntry = {
  id: string;
  title: string;
  subtitle: string;
  route: string;
  icon: keyof typeof icons;
  badge?: string;
};

const icons = {
  bills: 'cash-outline',
  subscriptions: 'card-outline',
  history: 'time-outline'
} as const;

const ENTRIES: FinanceEntry[] = [
  {
    id: 'bills',
    title: 'Contas',
    subtitle: 'Vencimentos, pagas e vencidas.',
    route: '/(tabs)/bills',
    icon: 'bills'
  },
  {
    id: 'subscriptions',
    title: 'Assinaturas',
    subtitle: 'Assinaturas recorrentes ativas, pausadas e canceladas.',
    route: '/(tabs)/subscriptions',
    icon: 'subscriptions'
  },
  {
    id: 'history',
    title: 'Histórico',
    subtitle: 'Eventos dos seus lembretes.',
    route: '/(tabs)/history',
    icon: 'history'
  }
];

export default function FinancesScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<FinanceEntry[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      setItems(ENTRIES);
    } catch {
      setError('Não foi possível carregar Finanças.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const renderItem = ({ item }: { item: FinanceEntry }) => (
    <Pressable style={styles.item} onPress={() => router.push(item.route)}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.itemChevron}>›</Text>
      </View>
      <Text style={styles.itemSubtitle} numberOfLines={2}>{item.subtitle}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top','left','right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Finanças</Text>
        <Text style={styles.headerSubtitle}>Contas, assinaturas e histórico.</Text>
      </View>

      {loading ? (
        <View style={styles.statusBox}>
          <ActivityIndicator color="#0f172a" />
          <Text style={styles.statusTitle}>Carregando</Text>
          <Text style={styles.statusText}>Buscando suas informações...</Text>
        </View>
      ) : error ? (
        <View style={styles.statusBox}>
          <Text style={styles.statusTitle}>Algo deu errado</Text>
          <Text style={styles.statusText}>{error}</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.statusBox}>
          <Text style={styles.statusTitle}>Nenhuma área</Text>
          <Text style={styles.statusText}>Nenhuma área financeira disponível.</Text>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          contentContainerStyle={styles.listContent}
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '700',
    color: '#0f172a'
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#475569',
    marginTop: 2
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10
  },
  item: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    padding: 14,
    gap: 6
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    flex: 1
  },
  itemSubtitle: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18
  },
  itemChevron: {
    fontSize: 22,
    color: '#475569'
  },
  statusBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12
  },
  statusTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center'
  },
  statusText: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center'
  }
});
