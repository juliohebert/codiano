import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

type MoreEntry = {
  id: string;
  title: string;
  subtitle: string;
  route: string;
};

const ENTRIES: MoreEntry[] = [
  {
    id: 'shipments',
    title: 'Encomendas',
    subtitle: 'Acompanhe suas encomendas em um só lugar.',
    route: '/(tabs)/shipments'
  },
  {
    id: 'maintenances',
    title: 'Manutenções',
    subtitle: 'Manutenções recorrentes e detalhes.',
    route: '/(tabs)/maintenances'
  },
  {
    id: 'settings',
    title: 'Configurações',
    subtitle: 'Gerencie as permissões do app.',
    route: '/(tabs)/settings'
  }
];

export default function MoreScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<MoreEntry[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      setItems(ENTRIES);
    } catch {
      setError('Não foi possível carregar Mais.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const renderItem = ({ item }: { item: MoreEntry }) => (
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
        <Text style={styles.headerTitle}>Mais</Text>
        <Text style={styles.headerSubtitle}>Encomendas, manutenções e ajustes.</Text>
      </View>

      {loading ? (
        <View style={styles.statusBox}>
          <ActivityIndicator color="#0f172a" />
          <Text style={styles.statusTitle}>Carregando</Text>
          <Text style={styles.statusText}>Buscando opções...</Text>
        </View>
      ) : error ? (
        <View style={styles.statusBox}>
          <Text style={styles.statusTitle}>Algo deu errado</Text>
          <Text style={styles.statusText}>{error}</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.statusBox}>
          <Text style={styles.statusTitle}>Nenhuma opção</Text>
          <Text style={styles.statusText}>Nenhuma área adicional disponível.</Text>
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
