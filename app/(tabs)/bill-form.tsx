import { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, Alert, ScrollView, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { loadBills, updateBill, addBill, removeBill } from '../../src/bills/storage';
import { scheduleBillAfterSave } from '../../src/bills/notifications';
import { cancelBillNotification } from '../../src/notifications/bills';
import type { Bill, BillRecurrence } from '../../src/bills/types';

function formatCurrency(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 9);
  const cents = digits.padEnd(3, '0').slice(-2);
  const ints = digits.slice(0, -2) || '0';
  const numberPart = Number(ints).toLocaleString('pt-BR');
  return `R$ ${numberPart},${cents}`;
}

function formatDate(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function toIsoDate(ddMMyyyy: string): string | null {
  const digits = ddMMyyyy.replace(/\D/g, '').slice(0, 8);
  if (digits.length !== 8) return null;
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  const d = new Date(`${year}-${month}-${day}T00:00:00`);
  const valid =
    d.getFullYear() === Number(year) &&
    d.getMonth() === Number(month) - 1 &&
    d.getDate() === Number(day);
  if (!valid) return null;
  return `${year}-${month}-${day}`;
}

function toDisplayDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

function toNumberOrUndefined(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const normalized = trimmed
    .replace(/^R\$\s?/, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const num = Number(normalized);
  return Number.isFinite(num) ? num : undefined;
}

function formatCurrencyInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 9);
  if (!digits) return '';
  const cents = digits.slice(-2).padStart(2, '0');
  const ints = digits.slice(0, -2) || '0';
  const numberPart = Number(ints).toLocaleString('pt-BR');
  return `R$ ${numberPart},${cents}`;
}

function formatNumberToCurrencyInput(value: number | undefined | null): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '';
  const fixed = Number(value.toFixed(2));
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(fixed);
}

export default function BillFormScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const isEditing = Boolean(id);
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [amountRaw, setAmountRaw] = useState('');
  const [dueDateRaw, setDueDateRaw] = useState('');
  const [recurrence, setRecurrence] = useState<BillRecurrence>('once');
  const [reminderDaysBefore, setReminderDaysBefore] = useState('1');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEditing);
  const [dueDateError, setDueDateError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await loadBills();
      const current = data.find((item) => item.id === id);
      if (!current) {
        Alert.alert('Conta não encontrada');
        router.back();
        return;
      }
      setName(current.name);
      setAmountRaw(current.amount != null ? formatNumberToCurrencyInput(current.amount) : '');
      setDueDateRaw(toDisplayDate(current.dueDate));
      setRecurrence(current.recurrence);
      setReminderDaysBefore(String(current.reminderDaysBefore));
      setNote(current.note ?? '');
    } catch {
      Alert.alert('Não foi possível carregar a conta.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (isEditing) load();
  }, [isEditing, load]);

  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  const save = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Informe o nome da conta.');
      return;
    }

    const amountNumber = toNumberOrUndefined(amountRaw);
    const reminderNumber = toNumberOrUndefined(reminderDaysBefore);
    const dueDate = toIsoDate(dueDateRaw);
    if (!dueDate) {
      Alert.alert('Informe o vencimento.');
      return;
    }

    const now = new Date().toISOString();
    if (isEditing && id) {
      const current = (await loadBills()).find((item) => item.id === id);
      const base = current ?? {
        id,
        createdAt: now,
        status: 'upcoming',
        paidAt: undefined
      } as Bill;
      const updated: Bill = {
        ...base,
        name: trimmedName,
        amount: amountNumber,
        dueDate,
        recurrence,
        reminderDaysBefore: reminderNumber ?? 1,
        note: note.trim() || undefined,
        updatedAt: now
      };
      console.log('FORM SAVE amountRaw=', amountRaw, 'amountNumber=', amountNumber);
      setSaving(true);
      try {
        await updateBill(updated);
        await scheduleBillAfterSave(updated);
        router.back();
      } catch {
        Alert.alert('Não foi possível salvar.');
        setSaving(false);
      }
      return;
    }

    const created: Bill = {
      id: `local-${Date.now()}`,
      name: trimmedName,
      amount: amountNumber,
      dueDate,
      recurrence,
      reminderDaysBefore: reminderNumber ?? 1,
      note: note.trim() || undefined,
      status: 'upcoming',
      createdAt: now,
      updatedAt: now
    };

    setSaving(true);
    try {
      await addBill(created);
      await scheduleBillAfterSave(created);
      router.replace('/(tabs)/bills');
    } catch {
      Alert.alert('Não foi possível salvar.');
      setSaving(false);
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
          <Text style={styles.headerTitle}>{isEditing ? 'Conta' : 'Nova conta'}</Text>
        </View>
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>Carregando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top','left','right']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.select({ ios: 8, android: 0 })}
      >
        <TouchableWithoutFeedback onPress={dismissKeyboard} accessible={false}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Math.max(insets.bottom + 24, 32) }
            ]}
            overScrollMode="always"
          >
            <View style={styles.header}>
              <Text style={styles.headerTitle}>{isEditing ? 'Conta' : 'Nova conta'}</Text>
              <Text style={styles.headerSubtitle}>Cadastre valor, vencimento, recorrência e lembrete.</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.field}>
                <Text style={styles.label}>Nome</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Ex: Aluguel"
                  placeholderTextColor="#94a3b8"
                  style={styles.input}
                  returnKeyType="next"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Valor</Text>
                <TextInput
                  value={amountRaw}
                  onChangeText={(text) => setAmountRaw(formatCurrencyInput(text))}
                  placeholder="R$ 0,00"
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                  style={styles.input}
                  returnKeyType="next"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Vencimento</Text>
                <TextInput
                  value={dueDateRaw}
                  onChangeText={(text) => {
                    setDueDateRaw(formatDate(text));
                    setDueDateError(null);
                  }}
                  onBlur={() => {
                    if (!toIsoDate(dueDateRaw)) {
                      setDueDateError('Informe uma data válida no formato dd/mm/aaaa.');
                    }
                  }}
                  placeholder="dd/mm/aaaa"
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                  style={[styles.input, dueDateError ? styles.inputError : null]}
                  returnKeyType="next"
                />
                {!!dueDateError ? (
                  <Text style={styles.errorText}>{dueDateError}</Text>
                ) : null}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Recorrência</Text>
                <View style={styles.row}>
                  <Pressable style={[styles.chip, recurrence === 'once' && styles.chipActive]} onPress={() => setRecurrence('once')}>
                    <Text style={[styles.chipLabel, recurrence === 'once' && styles.chipLabelActive]}>Única</Text>
                  </Pressable>
                  <Pressable style={[styles.chip, recurrence === 'monthly' && styles.chipActive]} onPress={() => setRecurrence('monthly')}>
                    <Text style={[styles.chipLabel, recurrence === 'monthly' && styles.chipLabelActive]}>Mensal</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Lembrete</Text>
                <TextInput
                  value={reminderDaysBefore}
                  onChangeText={setReminderDaysBefore}
                  placeholder="Dias antes"
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                  style={styles.input}
                  returnKeyType="done"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Observação</Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Opcional"
                  placeholderTextColor="#94a3b8"
                  style={[styles.input, styles.textarea]}
                  multiline
                  textAlignVertical="top"
                  returnKeyType="default"
                />
              </View>
            </View>

            <View style={styles.actions}>
              <Pressable style={styles.primaryButton} onPress={save} disabled={saving}>
                <Text style={styles.primaryButtonText}>{saving ? 'Salvando...' : 'Salvar'}</Text>
              </Pressable>
              {isEditing ? (
                <Pressable style={styles.dangerButton} onPress={confirmDelete}>
                  <Text style={styles.dangerButtonText}>Excluir</Text>
                </Pressable>
              ) : null}
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12
  },
  form: {
    gap: 12
  },
  field: {
    gap: 6
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a'
  },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0f172a'
  },
  inputError: {
    borderColor: '#dc2626'
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
    marginTop: 4
  },
  textarea: {
    minHeight: 96,
    textAlignVertical: 'top'
  },
  row: {
    flexDirection: 'row',
    gap: 10
  },
  chip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#eef2f7',
    alignItems: 'center'
  },
  chipActive: {
    backgroundColor: '#0f172a'
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569'
  },
  chipLabelActive: {
    color: '#ffffff'
  },
  actions: {
    paddingHorizontal: 16,
    paddingBottom: 16,
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
  statusText: {
    fontSize: 15,
    color: '#475569'
  }
});
