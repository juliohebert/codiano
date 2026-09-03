import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { loadMaintenances, updateMaintenance, removeMaintenance } from '../../src/maintenance/storage';
import type { Maintenance } from '../../src/maintenance/types';
import { formatDateLocal } from '../../src/maintenance/dates';

function formatDate(value: string) {
  try {
    return formatDateLocal(value);
  } catch {
    return value;
  }
}

export default function MaintenanceDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<Maintenance | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await loadMaintenances();
      const current = data.find((entry) => entry.id === id);
      setItem(current ?? null);
    } catch {
      Alert.alert('Não foi possível carregar a manutenção.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleStatus = async () => {
    if (!item || !id) return;
    const nextStatus: Maintenance['status'] = item.status === 'done' ? 'upcoming' : 'done';
    const updated: Maintenance = { ...item, status: nextStatus, updatedAt: new Date().toISOString() };
    try {
      await updateMaintenance(updated);
      setItem(updated);
    } catch {
      Alert.alert('Não foi possível atualizar o status.');
    }
  };

  const confirmDelete = async () => {
    if (!id) return;
    Alert.alert(
      'Excluir manutenção',
      'Deseja excluir esta manutenção?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeMaintenance(id);
              router.back();
            } catch {
              Alert.alert('Não foi possível excluir.');
            }
          }
        }
      ],
      { cancelable: true }
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top','left','right']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Manutenção</Text>
        </View>
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>Carregando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top','left','right']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Manutenção</Text>
        </View>
        <View style={styles.statusBox}>
          <Text style={styles.statusTitle}>Não encontrada</Text>
          <Text style={styles.statusText}>Esta manutenção não existe mais.</Text>
        </View>
        <Pressable style={styles.primaryButton} onPress={() => router.back()}>
          <Text style={styles.primaryButtonText}>Voltar</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const statusColor = item.status === 'done' ? '#065f46' : '#1e3a8a';
  const statusBackground = item.status === 'done' ? '#ecfdf5' : '#eef2ff';
  const statusLabel = item.status === 'done' ? 'Concluída' : 'Em aberto';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top','left','right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Manutenção</Text>
        <Text style={styles.headerSubtitle}>Detalhe e ações rápidas.</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <View style={[styles.badge, { backgroundColor: statusBackground }]}>
            <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>
        <View style={styles.cardMetaRow}>
          <Text style={styles.cardMetaLabel}>Data</Text>
          <Text style={styles.cardMetaValue}>{formatDate(item.dueDate)}</Text>
        </View>
        {!!item.note ? (
          <View style={styles.cardMetaRow}>
            <Text style={styles.cardMetaLabel}>Observação</Text>
            <Text style={styles.cardMetaValue}>{item.note}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.primaryButton} onPress={toggleStatus}>
          <Text style={styles.primaryButtonText}>{item.status === 'done' ? 'Reabrir' : 'Concluir'}</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => router.push(`/maintenance-form?id=${item.id}`)}>
          <Text style={styles.secondaryButtonText}>Editar</Text>
        </Pressable>
        <Pressable style={styles.dangerButton} onPress={confirmDelete}>
          <Text style={styles.dangerButtonText}>Excluir</Text>
        </Pressable>
      </View>
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
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    gap: 10
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
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
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  cardMetaLabel: {
    fontSize: 13,
    color: '#475569'
  },
  cardMetaValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a'
  },
  actions: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 10
  },
  primaryButton: {
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center'
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700'
  },
  secondaryButton: {
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    alignItems: 'center'
  },
  secondaryButtonText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700'
  },
  dangerButton: {
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    alignItems: 'center'
  },
  dangerButtonText: {
    color: '#991b1b',
    fontSize: 15,
    fontWeight: '700'
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
