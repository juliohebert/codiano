import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { loadWarranties } from '../../src/warranties/storage';
import type { Warranty } from '../../src/warranties/types';
import { formatDateLocal } from '../../src/common/dates';

type Tab = 'active' | 'expired';

const TABS: { key: Tab; label: string }[] = [
  { key: 'active', label: 'Ativas' },
  { key: 'expired', label: 'Vencidas' }
];

function classify(warranty: Warranty): 'active' | 'expired' {
  return warranty.status === 'expired' ? 'expired' : 'active';
}

function formatCurrency(value?: number) {
  if (typeof value !== 'number') return '';
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  } catch {
    return `R$ ${value.toFixed(2)}`;
  }
}

function formatDate(value: string) {
  try {
    return formatDateLocal(value);
  } catch {
    return value;
  }
}

export default function WarrantiesScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [tab, setTab] = useState<Tab>('active');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadWarranties();
      setWarranties(data);
    } catch {
      setError('Não foi possível carregar as garantias.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const visible = warranties.filter((item) => classify(item) === tab);

  const renderItem = ({ item }: { item: Warranty }) => {
    const statusColor = classify(item) === 'expired' ? '#991b1b' : '#1e3a8a';
    const statusBackground = classify(item) === 'expired' ? '#fef2f2' : '#eef2ff';
    const statusLabel = classify(item) === 'expired' ? 'Vencida' : 'Ativa';
    return (
      <Pressable style={styles.item} onPress={() => router.push(`/warranty/${item.id}`)}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemTitle} numberOfLines={1}>{item.product}</Text>
          <View style={[styles.badge, { backgroundColor: statusBackground }]}>
            <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>
        <View style={styles.itemMetaRow}>
          <Text style={styles.itemMeta}>Compra: {formatDate(item.purchaseDate)}</Text>
          {typeof item.amount === 'number' ? <Text style={styles.itemAmount}>{formatCurrency(item.amount)}</Text> : null}
        </View>
        <View style={styles.itemMetaRow}>
          <Text style={styles.itemMeta}>Validade: {formatDate(item.validUntil)}</Text>
        </View>
        {!!item.store ? <Text style={styles.itemMeta}>Loja: {item.store}</Text> : null}
        {!!item.note ? <Text style={styles.itemNote} numberOfLines={2}>{item.note}</Text> : null}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top','left','right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Garantias</Text>
        <Text style={styles.headerSubtitle}>Acompanhe compras e validades.</Text>
      </View>

      <View style={styles.tabRow}>
        {TABS.map((item) => {
          const selected = tab === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setTab(item.key)}
              style={[styles.tab, selected && styles.tabActive]}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <Text style={[styles.tabLabel, selected && styles.tabLabelActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.statusBox}>
          <ActivityIndicator color="#0f172a" />
          <Text style={styles.statusTitle}>Carregando</Text>
          <Text style={styles.statusText}>Buscando suas garantias...</Text>
        </View>
      ) : error ? (
        <View style={styles.statusBox}>
          <Text style={styles.statusTitle}>Algo deu errado</Text>
          <Text style={styles.statusText}>{error}</Text>
        </View>
      ) : visible.length === 0 ? (
        <View style={styles.statusBox}>
          <Text style={styles.statusTitle}>Nenhuma garantia</Text>
          <Text style={styles.statusText}>Cadastre uma compra para começar.</Text>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          contentContainerStyle={styles.listContent}
          data={visible}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(tabs)/warranty-form')}
        accessibilityRole="button"
        accessibilityLabel="Adicionar garantia"
        activeOpacity={0.85}
      >
        <Text style={styles.fabLabel}>＋</Text>
      </TouchableOpacity>
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
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 8,
    marginTop: 8,
    marginBottom: 4
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#eef2f7'
  },
  tabActive: {
    backgroundColor: '#0f172a'
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569'
  },
  tabLabelActive: {
    color: '#ffffff'
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
    padding: 12,
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
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden'
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700'
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  itemMeta: {
    fontSize: 13,
    color: '#475569'
  },
  itemAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a'
  },
  itemNote: {
    fontSize: 13,
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
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4
  },
  fabLabel: {
    color: '#ffffff',
    fontSize: 30,
    lineHeight: 32,
    fontWeight: '600'
  }
});
