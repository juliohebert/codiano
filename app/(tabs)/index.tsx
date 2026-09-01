import { StyleSheet, View, Text, FlatList, TouchableOpacity, StatusBar, ActivityIndicator, Alert, TextInput, KeyboardAvoidingView, Platform, AppState, ScrollView, LayoutAnimation } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { loadReminders, removeReminder, updateReminder, appendHistory, type Reminder, DEFAULT_REMINDER_CATEGORIES, type DefaultCategory } from '../../src/storage/reminders';
import * as Location from 'expo-location';
import { scheduleRadiusNotification } from '../../src/notifications/notifications';
import { findRadiusTransitions } from '../../src/geo/proximity';
import { useRefreshToken } from '../refresh-context';

type Section = { key: 'active' | 'inactive' | 'completed'; title: string; data: Reminder[] };

const sortReminder = (a: Reminder, b: Reminder) => (a.title ?? '').localeCompare(b.title ?? '');

const toRad = (value: number) => (value * Math.PI) / 180;

const haversineDistanceMeters = (from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) => {
  const R = 6371000;
  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return R * 2 * Math.asin(Math.sqrt(h));
};

const buildSections = (items: Reminder[]): Section[] => {
  const active = items.filter((item) => !item.completed && item.active).sort(sortReminder);
  const inactive = items.filter((item) => !item.completed && !item.active).sort(sortReminder);
  const completed = items.filter((item) => item.completed).sort(sortReminder);

  const sections: Section[] = [
    { key: 'active', title: 'Ativos', data: active },
    { key: 'inactive', title: 'Inativos', data: inactive },
    { key: 'completed', title: 'Concluídos', data: completed }
  ];

  return sections.filter((section) => section.data.length > 0);
};

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export default function HomeScreen() {
  const { token } = useRefreshToken();
  const [items, setItems] = useState<Reminder[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'completed'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | DefaultCategory>('all');
  const [locationOnly, setLocationOnly] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [nearbyIds, setNearbyIds] = useState<Set<string>>(new Set());
  const [permissionMissing, setPermissionMissing] = useState(false);
  const prevNearbyIdsRef = useRef<Set<string>>(new Set());
  const baselineReadyRef = useRef(false);

  const read = useCallback(async () => {
    setLoadState('loading');
    setError(null);
    const data = await loadReminders();
    if (data === null) {
      setLoadState('error');
      setError('Não foi possível carregar os lembretes.');
    } else {
      setItems(data);
      setLoadState('ready');
    }
  }, []);

  const recomputeNearby = useCallback(async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        setNearbyIds(new Set());
        setPermissionMissing(true);
        return;
      }
      setPermissionMissing(false);
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      const current = position.coords;
      const reminders = await loadReminders();
      if (!reminders) {
        setNearbyIds(new Set());
        return;
      }

      const currentNearby = new Set<string>();
      for (const item of reminders) {
        if (!item.active || item.completed) continue;
        if (!item.location || typeof item.radiusMeters !== 'number') continue;
        const distance = haversineDistanceMeters(
          { latitude: current.latitude, longitude: current.longitude },
          item.location
        );
        if (distance <= item.radiusMeters) {
          currentNearby.add(item.id);
        }
      }

      const previous = prevNearbyIdsRef.current;
      if (!baselineReadyRef.current) {
        baselineReadyRef.current = true;
        prevNearbyIdsRef.current = currentNearby;
        setNearbyIds(currentNearby);
        return;
      }

      const transitions = findRadiusTransitions({
        previousNearbyIds: previous,
        currentNearbyIds: currentNearby,
        reminders
      });

      if (transitions.length === 0) {
        prevNearbyIdsRef.current = currentNearby;
        setNearbyIds(currentNearby);
        return;
      }

      let changed = false;

      for (const transition of transitions) {
        const reminder = reminders.find((r) => r.id === transition.id);
        if (!reminder) continue;

        const eventType = transition.direction === 'exit' ? 'exit' : 'enter';

        if (reminder.frequency === 'once') {
          await updateReminder({ ...reminder, completed: true, active: false });
        }

        await appendHistory({
          reminderId: reminder.id,
          reminderTitle: reminder.title,
          placeName: reminder.address,
          address: reminder.address,
          note: reminder.note,
          location: reminder.location,
          trigger: reminder.trigger,
          radiusMeters: reminder.radiusMeters,
          frequency: reminder.frequency,
          type: eventType,
          occurredAt: Date.now()
        });

        try { await scheduleRadiusNotification(reminder.title, eventType); } catch {}
        changed = true;
      }

      prevNearbyIdsRef.current = currentNearby;
      setNearbyIds(currentNearby);

      if (changed) {
        await read();
      }
    } catch {
      setNearbyIds(new Set());
    }
  }, [read]);

  useEffect(() => {
    read();
  }, [read, token]);

  useEffect(() => {
    recomputeNearby();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        recomputeNearby();
      }
    });
    return () => {
      subscription.remove();
    };
  }, [read, token, recomputeNearby]);

  const confirmDelete = async (item: Reminder) => {
    Alert.alert(
      'Excluir lembrete',
      `Deseja excluir "${item.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            await removeReminder(item.id);
            await read();
          }
        }
      ],
      { cancelable: true }
    );
  };

  const confirmComplete = async (item: Reminder) => {
    Alert.alert(
      'Concluir lembrete',
      `Deseja marcar "${item.title}" como concluído?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Concluir',
          onPress: async () => {
            await updateReminder({ ...item, completed: true, active: false });
            await appendHistory({
              reminderId: item.id,
              reminderTitle: item.title,
              placeName: item.address,
              address: item.address,
              note: item.note,
              location: item.location,
              trigger: item.trigger,
              radiusMeters: item.radiusMeters,
              frequency: item.frequency,
              type: 'completed',
              occurredAt: Date.now()
            });
            await read();
          }
        }
      ],
      { cancelable: true }
    );
  };

  const confirmDuplicate = async (item: Reminder) => {
    Alert.alert(
      'Duplicar lembrete',
      `Deseja criar uma cópia de "${item.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Duplicar',
          onPress: () => router.push(`/new-reminder?duplicate=${encodeURIComponent(item.id)}`)
        }
      ],
      { cancelable: true }
    );
  };

  const renderItem = ({ item }: { item: Reminder }) => {
    const isCompleted = Boolean(item.completed);
    const isNearby = nearbyIds.has(item.id);
    return (
      <TouchableOpacity
        style={[styles.item, !item.active && styles.itemInactive, isCompleted && styles.itemCompleted, isNearby && styles.itemNearby]}
        onPress={() => router.push(`/new-reminder?id=${encodeURIComponent(item.id)}`)}
        accessibilityRole="button"
        accessibilityLabel={`Editar lembrete ${item.title}${isNearby ? ' — você está próximo' : ''}`}
        activeOpacity={0.7}
      >
        <View style={styles.itemHeader}>
          <View style={styles.itemTitleRow}>
            {isNearby ? <View style={styles.nearbyDot} accessible={false} /> : null}
            <Text style={[styles.itemTitle, !item.active && styles.itemTitleInactive, isCompleted && styles.itemTitleCompleted]} numberOfLines={1}>
              {item.title}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => confirmDelete(item)}
            accessibilityRole="button"
            accessibilityLabel={`Excluir lembrete ${item.title}`}
            style={styles.deleteButton}
          >
            <Text style={styles.deleteButtonText}>Excluir</Text>
          </TouchableOpacity>
          {!isCompleted ? (
            <TouchableOpacity
              onPress={() => confirmComplete(item)}
              accessibilityRole="button"
              accessibilityLabel={`Concluir lembrete ${item.title}`}
              style={styles.completeButton}
            >
              <Text style={styles.completeButtonText}>Concluir</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={() => confirmDuplicate(item)}
            accessibilityRole="button"
            accessibilityLabel={`Duplicar lembrete ${item.title}`}
            style={styles.duplicateButton}
          >
            <Text style={styles.duplicateButtonText}>Duplicar</Text>
          </TouchableOpacity>
        </View>

        {item.note ? <Text style={[styles.itemNote, !item.active && styles.itemNoteInactive, isCompleted && styles.itemNoteCompleted]} numberOfLines={2}>{item.note}</Text> : null}

        <View style={styles.itemLocationRow}>
          {item.address ? (
            <Text style={[styles.itemLocationLabel, !item.active && styles.itemLocationLabelInactive, isCompleted && styles.itemLocationLabelCompleted]} numberOfLines={1}>
              {item.address}
            </Text>
          ) : item.location ? (
            <Text style={[styles.itemLocationLabel, !item.active && styles.itemLocationLabelInactive, isCompleted && styles.itemLocationLabelCompleted]}>
              {item.location.latitude.toFixed(5)}, {item.location.longitude.toFixed(5)}
            </Text>
          ) : null}
        </View>

        <View style={styles.itemPills}>
          {item.trigger ? (
            <View style={[styles.pill, styles.pillNeutral]}>
              <Text style={styles.pillText}>{item.trigger === 'enter' ? 'Ao entrar' : 'Ao sair'}</Text>
            </View>
          ) : null}
          {typeof item.radiusMeters === 'number' ? (
            <View style={[styles.pill, styles.pillNeutral]}>
              <Text style={styles.pillText}>{item.radiusMeters}m</Text>
            </View>
          ) : null}
          <View style={[styles.pill, styles.pillNeutral]}>
            <Text style={styles.pillText}>{(item.frequency ?? 'once') === 'once' ? 'Uma vez' : 'Sempre'}</Text>
          </View>
          {isCompleted ? (
            <View style={[styles.pill, styles.completedPill]}>
              <Text style={[styles.pillText, styles.completedPillText]}>Concluído</Text>
            </View>
          ) : (
            <View style={[styles.pill, item.active ? styles.pillActive : styles.pillInactive]}>
              <Text style={[styles.pillText, item.active ? styles.pillTextActive : styles.pillTextInactive]}>
                {item.active ? 'Ativo' : 'Inativo'}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const sections = useMemo(() => {
    const trimmed = searchQuery.trim();
    const q = trimmed ? trimmed.toLowerCase() : '';

    let base = items;
    if (statusFilter !== 'all') {
      if (statusFilter === 'completed') {
        base = items.filter((item) => item.completed);
      } else {
        base = items.filter((item) => !item.completed && item.active === (statusFilter === 'active'));
      }
    }

    if (categoryFilter !== 'all') {
      base = base.filter((item) => item.category === categoryFilter);
    }

    if (locationOnly) {
      base = base.filter((item) => Boolean(item.location && item.address));
    }

    const matches = base.filter((item) => {
      if (!q) return true;
      const haystacks = [
        item.title ?? '',
        item.address ?? '',
        item.location ? `${item.location.latitude}, ${item.location.longitude}` : ''
      ];
      return haystacks.some((text) => text.toLowerCase().includes(q));
    });

    return buildSections(matches);
  }, [items, searchQuery, statusFilter, categoryFilter, locationOnly]);

  const isLoading = loadState === 'loading';
  const isError = loadState === 'error';
  const trimmedQuery = searchQuery.trim();
  const hasSearch = trimmedQuery.length > 0;
  const isSearchEmpty = !isLoading && !isError && hasSearch && sections.length === 0;
  const isFilterEmpty = !isLoading && !isError && !hasSearch && statusFilter !== 'all' && sections.length === 0;
  const isAllEmpty = !isLoading && !isError && !hasSearch && statusFilter === 'all' && sections.length === 0;

  const renderSectionHeader = ({ section }: { section: Section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <Text style={styles.sectionCount}>{section.data.length}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.select({ ios: 8, android: 0 })}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Lembretes</Text>
          <Text style={styles.headerSubtitle}>Seus lembretes por localização</Text>
        </View>
        <View style={styles.filterContainer}>
          <View style={styles.filterHeader}>
            <TouchableOpacity
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setFiltersExpanded((prev) => !prev);
              }}
              accessibilityRole="button"
              accessibilityLabel={filtersExpanded ? 'Ocultar filtros' : 'Mostrar filtros'}
              accessibilityState={{ expanded: filtersExpanded }}
              activeOpacity={0.8}
              style={styles.filterToggle}
            >
              <Text style={styles.filterToggleText}>{filtersExpanded ? 'Ocultar filtros' : 'Expandir filtros'}</Text>
            </TouchableOpacity>
          </View>
          {filtersExpanded ? (
            <View style={styles.filterPanel}>
              <View style={styles.filterRow}>
                {[
                  { key: 'all', label: 'Todos' },
                  { key: 'active', label: 'Ativos' },
                  { key: 'inactive', label: 'Inativos' },
                  { key: 'completed', label: 'Concluídos' }
                ].map((option) => {
                  const selected = statusFilter === option.key;
                  return (
                    <TouchableOpacity
                      key={option.key}
                      onPress={() => setStatusFilter(option.key as typeof statusFilter)}
                      style={[styles.filterChip, selected && styles.filterChipSelected]}
                      accessibilityRole="button"
                      accessibilityLabel={`Filtro ${option.label}`}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>{option.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
                {[
                  { key: 'all', label: 'Todas' },
                  ...DEFAULT_REMINDER_CATEGORIES.map((category) => ({ key: category, label: category }))
                ].map((option) => {
                  const selected = categoryFilter === option.key;
                  return (
                    <TouchableOpacity
                      key={option.key}
                      onPress={() => setCategoryFilter(option.key as typeof categoryFilter)}
                      style={[styles.categoryChip, selected && styles.categoryChipSelected]}
                      accessibilityRole="button"
                      accessibilityLabel={`Categoria ${option.label}`}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.categoryChipText, selected && styles.categoryChipTextSelected]}>{option.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <View style={styles.filterRow}>
                <TouchableOpacity
                  onPress={() => setLocationOnly((prev) => !prev)}
                  style={[styles.filterChip, locationOnly && styles.filterChipSelected]}
                  accessibilityRole="button"
                  accessibilityLabel="Somente com local"
                  activeOpacity={0.8}
                >
                  <Text style={[styles.filterChipText, locationOnly && styles.filterChipTextSelected]}>Com local</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>
        <View style={styles.searchContainer}>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Buscar lembretes"
            placeholderTextColor="#94a3b8"
            style={styles.searchInput}
            autoCorrect={false}
            accessibilityLabel="Buscar lembretes"
            returnKeyType="search"
          />
          {!!searchQuery ? (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              accessibilityRole="button"
              accessibilityLabel="Limpar busca"
              style={styles.searchClear}
            >
              <Text style={styles.searchClearText}>Limpar</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {isLoading ? (
          <View style={styles.statusBox}>
            <View style={styles.loaderWrap}>
              <ActivityIndicator color="#0f172a" />
            </View>
            <Text style={styles.statusTitle}>Carregando</Text>
            <Text style={styles.statusText}>Buscando seus lembretes...</Text>
          </View>
        ) : isError ? (
          <View style={styles.statusBox}>
            <View style={styles.errorIconWrap}>
              <Text style={styles.errorIcon}>!</Text>
            </View>
            <Text style={styles.statusTitle}>Algo deu errado</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={read} accessibilityRole="button" accessibilityLabel="Tentar novamente" style={styles.retryButton}>
              <Text style={styles.retryText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : isSearchEmpty ? (
          <View style={styles.statusBox}>
            <View style={styles.emptyIllustration}>
              <Text style={styles.emptyIllustrationText}>🔍</Text>
            </View>
            <Text style={styles.statusTitle}>Nenhum lembrete encontrado</Text>
            <Text style={styles.emptyText}>Tente buscar por outro título, endereço ou categoria.</Text>
          </View>
        ) : isFilterEmpty ? (
          <View style={styles.statusBox}>
            <View style={styles.emptyIllustration}>
              <Text style={styles.emptyIllustrationText}>📋</Text>
            </View>
            <Text style={styles.statusTitle}>Nenhum lembrete neste estado</Text>
            <Text style={styles.emptyText}>Altere os filtros para ver mais lembretes.</Text>
          </View>
        ) : isAllEmpty ? (
          <View style={styles.statusBox}>
            <View style={styles.emptyIllustration}>
              <Text style={styles.emptyIllustrationText}>📝</Text>
            </View>
            <Text style={styles.statusTitle}>Nenhum lembrete criado</Text>
            <Text style={styles.emptyText}>Toque no botão + para criar o primeiro lembrete e começar a receber alertas por geolocalização.</Text>
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
            ItemSeparatorComponent={() => <View style={styles.sectionSeparator} />}
          />
        )}

        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/new-reminder')}
          accessibilityRole="button"
          accessibilityLabel="Criar novo lembrete"
          activeOpacity={0.85}
        >
          <Text style={styles.fabLabel}>＋</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  container: {
    flex: 1
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
  filterRow: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: '#eef2f7',
    borderRadius: 12,
    padding: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff'
  },
  filterChipSelected: {
    backgroundColor: '#eef2ff',
    borderColor: '#6366f1'
  },
  filterChipText: {
    fontSize: 12,
    color: '#334155'
  },
  filterChipTextSelected: {
    color: '#312e81',
    fontWeight: '600'
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  separator: {
    height: 10
  },
  sectionSeparator: {
    height: 20
  },
  sectionHeader: {
    paddingHorizontal: 4,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a'
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8'
  },
  sectionItem: {
    marginBottom: 10
  },
  statusBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12
  },
  loaderWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#eef2f7',
    alignItems: 'center',
    justifyContent: 'center'
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
  errorIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center'
  },
  errorIcon: {
    fontSize: 28,
    fontWeight: '800',
    color: '#b91c1c'
  },
  errorText: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center'
  },
  retryButton: {
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center'
  },
  retryText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700'
  },
  emptyIllustration: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: '#eef2f7',
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyIllustrationText: {
    fontSize: 36,
    color: '#0f172a',
    fontWeight: '700'
  },
  emptyText: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center'
  },
  item: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2
  },
  itemInactive: {
    opacity: 0.75
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  itemTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
    lineHeight: 21
  },
  itemTitleInactive: {
    color: '#64748b'
  },
  itemNote: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 19
  },
  itemNoteInactive: {
    color: '#94a3b8'
  },
  itemLocationRow: {
    marginTop: 8,
    paddingVertical: 2
  },
  itemLocationLabel: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 16
  },
  itemLocationLabelInactive: {
    color: '#94a3b8'
  },
  deleteButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#fee2e2'
  },
  deleteButtonText: {
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '700'
  },
  completeButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#e0f2fe'
  },
  completeButtonText: {
    color: '#0369a1',
    fontSize: 12,
    fontWeight: '700'
  },
  duplicateButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#f1f5f9'
  },
  duplicateButtonText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '700'
  },
  itemCompleted: {
    opacity: 0.8
  },
  itemTitleCompleted: {
    color: '#64748b'
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1
  },
  nearbyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6366f1'
  },
  itemNearby: {
    borderColor: '#6366f1',
    backgroundColor: '#eef2ff'
  },
  itemNoteCompleted: {
    color: '#94a3b8'
  },
  itemLocationLabelCompleted: {
    color: '#94a3b8'
  },
  completedPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    backgroundColor: '#e0f2fe'
  },
  completedPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0369a1'
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
  },
  itemMeta: {
    marginTop: 6,
    gap: 8
  },
  itemPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  itemLocationInactive: {
    color: '#94a3b8'
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    backgroundColor: '#f1f5f9'
  },
  pillNeutral: {
    backgroundColor: '#f1f5f9'
  },
  pillActive: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac'
  },
  pillInactive: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0'
  },
  pillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569'
  },
  pillTextActive: {
    color: '#14532d'
  },
  pillTextInactive: {
    color: '#94a3b8'
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8
  },
  searchInput: {
    backgroundColor: '#ffffff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0f172a'
  },
  searchClear: {
    position: 'absolute',
    right: 28,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  searchClearText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0369a1'
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 10
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  filterToggle: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#cbd5e1'
  },
  filterToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155'
  },
  filterPanel: {
    gap: 10
  },
  categoryRow: {
    gap: 8
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569'
  },
  categoryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  categoryScroll: {
    gap: 8,
    paddingVertical: 2
  },
  categoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0'
  },
  categoryChipSelected: {
    backgroundColor: '#eef2ff',
    borderColor: '#6366f1'
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569'
  },
  categoryChipTextSelected: {
    color: '#6366f1'
  }
});
