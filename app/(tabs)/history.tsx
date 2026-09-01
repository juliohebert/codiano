import { StyleSheet, View, Text, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useCallback, useState, useMemo } from 'react';
import { router } from 'expo-router';
import { loadHistory, type HistoryEvent } from '../../src/storage/reminders';

const EVENT_LABEL: Record<string, string> = {
  completed: 'Concluído',
  enter: 'Chegada',
  exit: 'Saída'
};

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
};

const DATE_HEADER_OPTIONS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric'
};

function formatDate(timestamp: number) {
  try {
    return new Intl.DateTimeFormat('pt-BR', DATE_OPTIONS).format(new Date(timestamp));
  } catch {
    return String(timestamp);
  }
}

function formatDateHeader(timestamp: number) {
  try {
    return new Intl.DateTimeFormat('pt-BR', DATE_HEADER_OPTIONS).format(new Date(timestamp));
  } catch {
    return String(timestamp);
  }
}

function getDateKey(timestamp: number) {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function HistoryScreen() {
  const [items, setItems] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const read = useCallback(async () => {
    setError(null);
    try {
      const data = await loadHistory();
      setItems(data);
    } catch {
      setError('Não foi possível carregar o histórico.');
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    read();
  }, [read]);

  type HistorySection = { key: string; title: string; data: HistoryEvent[] };

  const sections: HistorySection[] = useMemo(() => {
    const map = new Map<string, HistoryEvent[]>();
    for (const item of items) {
      const key = getDateKey(item.occurredAt);
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, data]) => ({
        key,
        title: formatDateHeader(data[0].occurredAt),
        data: data.sort((a, b) => b.occurredAt - a.occurredAt)
      }));
  }, [items]);

  const renderSectionHeader = ({ section }: { section: HistorySection }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </View>
  );

  const renderItem = ({ item }: { item: HistoryEvent }) => {
    const label = EVENT_LABEL[item.type] ?? item.type;
    const location = [item.placeName, item.address].filter(Boolean).join(' • ') || undefined;
    return (
      <View style={styles.item}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemTitle} numberOfLines={1}>
            {item.reminderTitle}
          </Text>
          <View style={styles.itemBadge}>
            <Text style={styles.itemBadgeText}>{label}</Text>
          </View>
        </View>
        {location ? (
          <Text style={styles.itemLocation} numberOfLines={1}>
            {location}
          </Text>
        ) : null}
        <View style={styles.itemFooter}>
          <Text style={styles.itemDate}>{formatDate(item.occurredAt)}</Text>
          {(item.type === 'completed' || item.type === 'enter' || item.type === 'exit') ? (
            <TouchableOpacity
              onPress={() => router.push(`/new-reminder?historyEventId=${encodeURIComponent(item.id)}`)}
              accessibilityRole="button"
              accessibilityLabel={`Lembrar novamente ${item.reminderTitle}`}
              style={styles.rememberButton}
            >
              <Text style={styles.rememberButtonText}>Lembrar novamente</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Histórico</Text>
          <Text style={styles.headerSubtitle}>Eventos dos seus lembretes</Text>
        </View>
        <View style={styles.statusBox}>
          <ActivityIndicator color="#0f172a" />
          <Text style={styles.statusTitle}>Carregando</Text>
          <Text style={styles.statusText}>Buscando eventos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Histórico</Text>
        <Text style={styles.headerSubtitle}>Eventos dos seus lembretes</Text>
      </View>
      {error ? (
        <View style={styles.statusBox}>
          <Text style={styles.statusTitle}>Algo deu errado</Text>
          <Text style={styles.statusText}>{error}</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.statusBox}>
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>—</Text>
          </View>
          <Text style={styles.statusTitle}>Nenhum evento</Text>
          <Text style={styles.statusText}>Conclua um lembrete para registrar o histórico.</Text>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          contentContainerStyle={styles.listContent}
          data={sections}
          keyExtractor={(section) => section.key}
          renderItem={({ item: section }) => (
            <View>
              {renderSectionHeader({ section })}
              {section.data.map((item) => (
                <View key={item.id} style={styles.sectionItem}>
                  {renderItem({ item })}
                </View>
              ))}
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
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
    paddingVertical: 12
  },
  separator: {
    height: 10
  },
  sectionHeader: {
    paddingHorizontal: 4,
    paddingVertical: 8
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a'
  },
  sectionItem: {
    marginBottom: 10
  },
  item: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0'
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  itemTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a'
  },
  itemBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10
  },
  itemBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369a1'
  },
  itemLocation: {
    marginTop: 8,
    fontSize: 14,
    color: '#475569'
  },
  itemDate: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b'
  },
  itemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 12
  },
  rememberButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#0f172a'
  },
  rememberButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff'
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
  emptyBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#eef2f7',
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#475569'
  }
});
