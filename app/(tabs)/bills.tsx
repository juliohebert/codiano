import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { loadBills } from '../../src/bills/storage';
import type { Bill } from '../../src/bills/types';
import { formatDateLocal, parseLocalDate, toLocalDate } from '../../src/common/dates';

type BillSectionKey = 'upcoming' | 'overdue' | 'paid';

type Section = { key: BillSectionKey; title: string; data: Bill[] };

function classify(bill: Bill): BillSectionKey {
  if (bill.status === 'paid') return 'paid';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { year, month, day } = parseLocalDate(bill.dueDate);
  const due = toLocalDate(year, month, day);
  if (due < today) return 'overdue';
  return 'upcoming';
}

const SECTIONS: { key: BillSectionKey; title: string }[] = [
  { key: 'upcoming', title: 'Próximas' },
  { key: 'overdue', title: 'Vencidas' },
  { key: 'paid', title: 'Pagas' }
];

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

export default function BillsScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [tab, setTab] = useState<BillSectionKey>('upcoming');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadBills();
      setBills(data);
    } catch {
      setError('Não foi possível carregar suas contas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const sections: Section[] = useMemo(() => {
    const grouped = new Map<BillSectionKey, Bill[]>();
    for (const section of SECTIONS) {
      grouped.set(section.key, []);
    }
    for (const bill of bills) {
      const key = classify(bill);
      grouped.set(key, [...(grouped.get(key) ?? []), bill]);
    }
    const sorted = (items: Bill[]) =>
      [...items].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    return SECTIONS.map((section) => ({
      key: section.key,
      title: section.title,
      data: sorted(grouped.get(section.key) ?? [])
    }));
  }, [bills]);

  const activeSection = useMemo(() => sections.find((item) => item.key === tab) ?? { key: tab, title: '', data: [] }, [sections, tab]);

  const renderItem = ({ item }: { item: Bill }) => {
    const statusColor = item.status === 'paid' ? '#065f46' : tab === 'overdue' ? '#991b1b' : '#1e3a8a';
    const statusBackground = item.status === 'paid' ? '#ecfdf5' : tab === 'overdue' ? '#fef2f2' : '#eef2ff';
    const statusLabel = item.status === 'paid' ? 'Paga' : tab === 'overdue' ? 'Vencida' : 'Aberta';
    return (
      <Pressable style={styles.item} onPress={() => router.push(`/bill/${item.id}`)}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemTitle} numberOfLines={1}>{item.name}</Text>
          <View style={[styles.badge, { backgroundColor: statusBackground }]}>
            <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>
        <View style={styles.itemMetaRow}>
          <Text style={styles.itemMeta}>{formatDate(item.dueDate)}</Text>
          {typeof item.amount === 'number' ? <Text style={styles.itemAmount}>{formatCurrency(item.amount)}</Text> : null}
        </View>
        {!!item.note ? <Text style={styles.itemNote} numberOfLines={2}>{item.note}</Text> : null}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top','left','right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Contas</Text>
        <Text style={styles.headerSubtitle}>Organize contas, vencimentos e lembretes.</Text>
      </View>

      <View style={styles.tabRow}>
        {SECTIONS.map((item) => {
          const selected = tab === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setTab(item.key)}
              style={[styles.tab, selected && styles.tabActive]}
              accessibilityRole="button"
              accessibilityLabel={item.title}
            >
              <Text style={[styles.tabLabel, selected && styles.tabLabelActive]}>{item.title}</Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.statusBox}>
          <ActivityIndicator color="#0f172a" />
          <Text style={styles.statusTitle}>Carregando</Text>
          <Text style={styles.statusText}>Buscando suas contas...</Text>
        </View>
      ) : error ? (
        <View style={styles.statusBox}>
          <Text style={styles.statusTitle}>Algo deu errado</Text>
          <Text style={styles.statusText}>{error}</Text>
        </View>
      ) : activeSection.data.length === 0 ? (
        <View style={styles.statusBox}>
          <Text style={styles.statusTitle}>Nenhuma conta</Text>
          <Text style={styles.statusText}>Cadastre uma conta para começar.</Text>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          contentContainerStyle={styles.listContent}
          data={activeSection.data}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/bill-form')}
        accessibilityRole="button"
        accessibilityLabel="Adicionar conta"
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
