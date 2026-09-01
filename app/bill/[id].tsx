import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { loadBills, updateBill, removeBill, addBill } from '../../src/bills/storage';
import { scheduleBillAfterSave } from '../../src/bills/notifications';
import { cancelBillNotification } from '../../src/notifications/bills';
import type { Bill, BillRecurrence } from '../../src/bills/types';

function addMonths(date: string, months: number): string {
  const digits = date.replace(/\D/g, '').slice(0, 8);
  if (digits.length !== 8) {
    throw new Error('Data inválida');
  }
  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4)) - 1;
  const year = Number(digits.slice(4, 8));
  const d = new Date(year, month, day);
  if (isNaN(d.getTime())) {
    throw new Error('Data inválida');
  }
  const targetDate = new Date(year, month + months, day);
  if (targetDate.getDate() !== day) {
    targetDate.setDate(0);
  }
  return targetDate.toISOString().slice(0, 10);
}

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
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
  } catch {
    return value;
  }
}

function toDisplayDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

export default function BillDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bill, setBill] = useState<Bill | null>(null);

  const load = useCallback(async () => {
    if (!id || id === '0') {
      setError('Identificador da conta inválido.');
      setLoading(false);
      return;
    }
    try {
      const data = await loadBills();
      const current = data.find((item) => item.id === id) ?? null;
      if (!current) {
        Alert.alert('Conta não encontrada');
        router.back();
        return;
      }
      setBill(current);
    } catch {
      setError('Não foi possível carregar a conta.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const ensureId = useCallback(() => {
    if (!id || id === '0') {
      setError('Identificador da conta inválido.');
      setLoading(false);
      return false;
    }
    return true;
  }, [id]);

  const markAsPaid = async () => {
    if (!bill || !id) return;

    const nowIso = new Date().toISOString();
    const paidBill: Bill = {
      ...bill,
      status: 'paid',
      paidAt: nowIso,
      updatedAt: nowIso
    };

    try {
      const current = (await loadBills()).find((item) => item.id === id);
      if (!current) {
        Alert.alert('Conta não encontrada');
        return;
      }

      if (current.recurrence === 'monthly') {
        const nextDue = addMonths(current.dueDate, 1);
        const all = await loadBills();
        const alreadyHasNext = all.some(
          (item) => item.id !== id && item.status !== 'paid' && item.dueDate === nextDue && item.name === current.name
        );

        if (!alreadyHasNext) {
          const nextId = `local-${Date.now()}`;
          const nextBill: Bill = {
            id: nextId,
            name: current.name,
            amount: current.amount,
            dueDate: nextDue,
            recurrence: current.recurrence,
            reminderDaysBefore: current.reminderDaysBefore,
            note: current.note,
            status: 'upcoming',
            createdAt: nowIso,
            updatedAt: nowIso
          };

          await addBill(nextBill);
          await scheduleBillAfterSave(nextBill);
        }
      }

      await updateBill(paidBill);
      await cancelBillNotification(id);
      await load();
    } catch {
      Alert.alert('Não foi possível atualizar.');
    }
  };

  const reopen = async () => {
    if (!bill || !id) return;
    try {
      const all = await loadBills();
      const current = all.find((item) => item.id === id);
      if (!current) {
        Alert.alert('Conta não encontrada');
        return;
      }

      const updated: Bill = {
        ...current,
        status: 'upcoming',
        paidAt: undefined,
        updatedAt: new Date().toISOString()
      };

      if (current.recurrence === 'monthly') {
        const nextDue = addMonths(current.dueDate, 1);
        const next = all.find(
          (item) => item.id !== id && item.status !== 'paid' && item.dueDate === nextDue && item.name === current.name
        );
        if (next) {
          await removeBill(next.id);
          await cancelBillNotification(next.id);
        }
      }

      await updateBill(updated);
      await scheduleBillAfterSave(updated);
      await load();
    } catch {
      Alert.alert('Não foi possível atualizar.');
    }
  };

  const confirmDelete = async () => {
    if (!id) return;
    Alert.alert(
      'Excluir conta',
      'Deseja excluir esta conta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelBillNotification(id);
              await removeBill(id);
              router.replace('/(tabs)/bills');
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

  if (error || !bill) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left','right','bottom']}>
        <View style={styles.statusBox}>
          <Text style={styles.statusTitle}>Algo deu errado</Text>
          <Text style={styles.statusText}>{error ?? 'Conta não encontrada.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const recurrenceLabel = bill.recurrence === 'monthly' ? 'Mensal' : 'Única';

  return (
    <SafeAreaView style={styles.safeArea} edges={['left','right','bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Nome</Text>
            <Text style={styles.value}>{bill.name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Valor</Text>
            <Text style={styles.value}>{formatCurrency(bill.amount)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Vencimento</Text>
            <Text style={styles.value}>{toDisplayDate(bill.dueDate)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Recorrência</Text>
            <Text style={styles.value}>{recurrenceLabel}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Lembrete</Text>
            <Text style={styles.value}>{bill.reminderDaysBefore} dia(s) antes</Text>
          </View>
          {!!bill.note ? (
            <View style={styles.row}>
              <Text style={styles.label}>Observação</Text>
              <Text style={styles.value}>{bill.note}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.actions}>
          {bill.status !== 'paid' ? (
            <Pressable style={styles.primaryButton} onPress={markAsPaid}>
              <Text style={styles.primaryButtonText}>Marcar como paga</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.secondaryButton} onPress={reopen}>
              <Text style={styles.secondaryButtonText}>Reabrir conta</Text>
            </Pressable>
          )}
          <Pressable style={styles.secondaryButton} onPress={() => router.push(`/(tabs)/bill-form?id=${encodeURIComponent(id)}`)}>
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
