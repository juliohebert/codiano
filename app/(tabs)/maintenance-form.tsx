import { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, Alert, ScrollView, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { loadMaintenances, updateMaintenance, addMaintenance, removeMaintenance } from '../../src/maintenance/storage';
import type { Maintenance } from '../../src/maintenance/types';

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
  const valid = d.getFullYear() === Number(year) && d.getMonth() === Number(month) - 1 && d.getDate() === Number(day);
  if (!valid) return null;
  return `${year}-${month}-${day}`;
}

function toDisplayDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

export default function MaintenanceFormScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const isEditing = Boolean(id);
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [dueDateRaw, setDueDateRaw] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEditing);
  const [dueDateError, setDueDateError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await loadMaintenances();
      const current = data.find((item) => item.id === id);
      if (!current) {
        Alert.alert('Manutenção não encontrada');
        router.back();
        return;
      }
      setTitle(current.title);
      setDueDateRaw(toDisplayDate(current.dueDate));
      setNote(current.note ?? '');
    } catch {
      Alert.alert('Não foi possível carregar a manutenção.');
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
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert('Informe o título da manutenção.');
      return;
    }

    const dueDate = toIsoDate(dueDateRaw);
    if (!dueDate) {
      Alert.alert('Informe uma data válida no formato dd/mm/aaaa.');
      return;
    }

    const now = new Date().toISOString();
    if (isEditing && id) {
      const current = (await loadMaintenances()).find((item) => item.id === id);
      const base = current ?? { id, createdAt: now, status: 'upcoming' } as Maintenance;
      const updated: Maintenance = {
        ...base,
        title: trimmedTitle,
        dueDate,
        note: note.trim() || undefined,
        updatedAt: now
      };
      setSaving(true);
      try {
        await updateMaintenance(updated);
        router.back();
      } catch {
        Alert.alert('Não foi possível salvar.');
        setSaving(false);
      }
      return;
    }

    const created: Maintenance = {
      id: `local-${Date.now()}`,
      title: trimmedTitle,
      dueDate,
      status: 'upcoming',
      note: note.trim() || undefined,
      createdAt: now,
      updatedAt: now
    };

    setSaving(true);
    try {
      await addMaintenance(created);
      router.replace('/(tabs)/maintenances');
    } catch {
      Alert.alert('Não foi possível salvar.');
      setSaving(false);
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
          <Text style={styles.headerTitle}>{isEditing ? 'Manutenção' : 'Nova manutenção'}</Text>
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
              <Text style={styles.headerTitle}>{isEditing ? 'Manutenção' : 'Nova manutenção'}</Text>
              <Text style={styles.headerSubtitle}>Cadastre título, data e observação.</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.field}>
                <Text style={styles.label}>Título</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Ex: Troca de óleo"
                  placeholderTextColor="#94a3b8"
                  style={styles.input}
                  returnKeyType="next"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Data</Text>
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
