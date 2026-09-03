import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { loadSubscriptions, updateSubscription, removeSubscription } from '../../src/subscriptions/storage';
import type { Subscription } from '../../src/subscriptions/types';
import { formatDateLocal, toLocalDate } from '../../src/common/dates';

function formatCurrency(value?: number) {
  if (typeof value !== 'number') return '—';
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

function toDisplayDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

export default function SubscriptionDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  const load = useCallback(async () => {
    if (!id || id === '0') {
      setError('Identificador da assinatura inválido.');
      setLoading(false);
      return;
    }
    try {
      const data = await loadSubscriptions();
      const current = data.find((item) => item.id === id) ?? null;
      if (!current) {
        Alert.alert('Assinatura não encontrada');
        router.back();
        return;
      }
      setSubscription(current);
    } catch {
      setError('Não foi possível carregar a assinatura.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const markAsCancelled = async () => {
    if (!subscription || !id) return;
    try {
      const updated: Subscription = {
        ...subscription,
        status: 'cancelled',
        updatedAt: new Date().toISOString()
      };
      await updateSubscription(updated);
      await load();
    } catch {
      Alert.alert('Não foi possível atualizar.');
    }
  };

  const reopen = async () => {
    if (!subscription || !id) return;
    try {
      const updated: Subscription = {
        ...subscription,
        status: 'active',
        updatedAt: new Date().toISOString()
      };
      await updateSubscription(updated);
      await load();
    } catch {
      Alert.alert('Não foi possível atualizar.');
    }
  };

  const pause = async () => {
    if (!subscription || !id) return;
    try {
      const updated: Subscription = {
        ...subscription,
        status: 'paused',
        updatedAt: new Date().toISOString()
      };
      await updateSubscription(updated);
      await load();
    } catch {
      Alert.alert('Não foi possível atualizar.');
    }
  };

  const confirmDelete = async () => {
    if (!id) return;
    Alert.alert(
      'Excluir assinatura',
      'Deseja excluir esta assinatura?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeSubscription(id);
              router.replace('/(tabs)/subscriptions');
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
      <SafeAreaView style={styles.safeArea} edges={['left','right','bottom']}>
        <View style={styles.statusBox}>
          <ActivityIndicator color="#0f172a" />
          <Text style={styles.statusText}>Carregando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !subscription) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left','right','bottom']}>
        <View style={styles.statusBox}>
          <Text style={styles.statusTitle}>Algo deu errado</Text>
          <Text style={styles.statusText}>{error ?? 'Assinatura não encontrada.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const frequencyLabel = subscription.frequency === 'yearly' ? 'Anual' : 'Mensal';
  const statusLabel = subscription.status === 'active' ? 'Ativa' : subscription.status === 'paused' ? 'Pausada' : 'Cancelada';

  return (
    <SafeAreaView style={styles.safeArea} edges={['left','right','bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Nome</Text>
            <Text style={styles.value}>{subscription.name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Valor</Text>
            <Text style={styles.value}>{formatCurrency(subscription.amount)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Próximo vencimento</Text>
            <Text style={styles.value}>{toDisplayDate(subscription.nextDueDate)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Recorrência</Text>
            <Text style={styles.value}>{frequencyLabel}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Lembrete</Text>
            <Text style={styles.value}>{subscription.reminderDaysBefore} dia(s) antes</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Status</Text>
            <Text style={styles.value}>{statusLabel}</Text>
          </View>
          {!!subscription.note ? (
            <View style={styles.row}>
              <Text style={styles.label}>Observação</Text>
              <Text style={styles.value}>{subscription.note}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.actions}>
          {subscription.status === 'active' ? (
            <Pressable style={styles.secondaryButton} onPress={pause}>
              <Text style={styles.secondaryButtonText}>Pausar</Text>
            </Pressable>
          ) : subscription.status === 'paused' ? (
            <Pressable style={styles.secondaryButton} onPress={reopen}>
              <Text style={styles.secondaryButtonText}>Reativar</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.secondaryButton} onPress={reopen}>
              <Text style={styles.secondaryButtonText}>Reabrir</Text>
            </Pressable>
          )}
          <Pressable style={styles.secondaryButton} onPress={() => router.push(`/(tabs)/subscription-form?id=${encodeURIComponent(id)}`)}>
            <Text style={styles.secondaryButtonText}>Editar</Text>
          </Pressable>
          <Pressable style={styles.dangerButton} onPress={confirmDelete}>
            <Text style={styles.dangerButtonText}>Excluir</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    padding: 14,
    gap: 10
  },
  row: {
    gap: 4
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b'
  },
  value: {
    fontSize: 15,
    color: '#0f172a'
  },
  actions: {
    gap: 10
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
