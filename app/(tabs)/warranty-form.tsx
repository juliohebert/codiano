import { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, Alert, ScrollView, TouchableWithoutFeedback, Keyboard, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { loadWarranties, saveWarranties, removeWarranty } from '../../src/warranties/storage';
import type { Warranty } from '../../src/warranties/types';
import { classifyAttachment, ensureLocalFile, shareLocalFile } from '../../src/warranties/file-helpers';

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

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function showAlert(title: string, message: string) {
  Alert.alert(title, message, [{ text: 'OK' }], { cancelable: true });
}

function buildLocalDestination(name: string): string {
  const prefix = 'warranty-';
  const safe = name.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const fileName = `${prefix}${safe}`;
  return `${FileSystem.documentDirectory}${fileName}`;
}

export default function WarrantyFormScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const isEditing = Boolean(id);
  const insets = useSafeAreaInsets();

  const [product, setProduct] = useState('');
  const [store, setStore] = useState('');
  const [purchaseDateRaw, setPurchaseDateRaw] = useState('');
  const [amountRaw, setAmountRaw] = useState('');
  const [validUntilRaw, setValidUntilRaw] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<Warranty['status']>('active');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEditing);
  const [validUntilError, setValidUntilError] = useState<string | null>(null);
  const [purchaseDateError, setPurchaseDateError] = useState<string | null>(null);
  const [file, setFile] = useState<Warranty['file']>(null);
  const [picking, setPicking] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    try {
      const data = await loadWarranties();
      const current = data.find((item) => item.id === id);
      if (!current) {
        showAlert('Atenção', 'Garantia não encontrada.');
        router.replace('/(tabs)/warranties');
        return;
      }
      setProduct(current.product);
      setStore(current.store ?? '');
      setPurchaseDateRaw(toDisplayDate(current.purchaseDate));
      setAmountRaw(typeof current.amount === 'number' ? formatNumberToCurrencyInput(current.amount) : '');
      setValidUntilRaw(toDisplayDate(current.validUntil));
      setNote(current.note ?? '');
      setStatus(current.status);
      setFile(current.file ?? null);
    } catch {
      showAlert('Erro', 'Não foi possível carregar a garantia.');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    if (isEditing) load();
  }, [isEditing, load]);

  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  const validateDates = () => {
    setPurchaseDateError(null);
    setValidUntilError(null);
    if (!toIsoDate(purchaseDateRaw)) {
      setPurchaseDateError('Informe a data no formato dd/mm/aaaa.');
    }
    if (!toIsoDate(validUntilRaw)) {
      setValidUntilError('Informe a validade no formato dd/mm/aaaa.');
    }
    const cleanedPurchase = toIsoDate(purchaseDateRaw);
    const cleanedValid = toIsoDate(validUntilRaw);
    if (cleanedPurchase && cleanedValid && cleanedValid < cleanedPurchase) {
      setValidUntilError('A validade não pode ser anterior à data da compra.');
    }
    return { cleanedPurchase, cleanedValid };
  };

  const save = async () => {
    const { cleanedPurchase, cleanedValid } = validateDates();
    if (purchaseDateError || validUntilError || !cleanedPurchase || !cleanedValid) return;
    if (!product.trim() || !validUntilRaw.trim()) {
      showAlert('Atenção', 'Preencha pelo menos produto e validade.');
      return;
    }
    setSaving(true);
    try {
      const existing = id ? (await loadWarranties()).find((item) => item.id === id) : undefined;
      const payload: Warranty = {
        id: id || generateId(),
        product: product.trim(),
        store: store.trim() || undefined,
        purchaseDate: cleanedPurchase,
        amount: toNumberOrUndefined(amountRaw),
        validUntil: cleanedValid,
        note: note.trim() || undefined,
        status,
        file: file ?? undefined,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const next = await loadWarranties();
      const filtered = next.filter((item) => item.id !== payload.id);
      await saveWarranties([payload, ...filtered]);
      router.replace('/(tabs)/warranties');
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar a garantia.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top','left','right']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{isEditing ? 'Garantia' : 'Nova garantia'}</Text>
        </View>
        <View style={styles.statusBox}>
          <ActivityIndicator color="#0f172a" />
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
              <Text style={styles.headerTitle}>{isEditing ? 'Editar garantia' : 'Nova garantia'}</Text>
              <Text style={styles.headerSubtitle}>Cadastre produto, datas, valor e documento.</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.field}>
                <Text style={styles.label}>Produto *</Text>
                <TextInput
                  value={product}
                  onChangeText={setProduct}
                  placeholder="Ex: iPhone 15"
                  placeholderTextColor="#94a3b8"
                  style={styles.input}
                  returnKeyType="next"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Loja</Text>
                <TextInput
                  value={store}
                  onChangeText={setStore}
                  placeholder="Opcional"
                  placeholderTextColor="#94a3b8"
                  style={styles.input}
                  returnKeyType="next"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Data da compra</Text>
                <TextInput
                  value={purchaseDateRaw}
                  onChangeText={(text) => {
                    setPurchaseDateRaw(formatDate(text));
                    setPurchaseDateError(null);
                  }}
                  onBlur={() => {
                    const cleanedPurchase = toIsoDate(purchaseDateRaw);
                    if (!cleanedPurchase) {
                      setPurchaseDateError('Informe a data no formato dd/mm/aaaa.');
                    }
                  }}
                  placeholder="dd/mm/aaaa"
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                  style={[styles.input, purchaseDateError ? styles.inputError : null]}
                  maxLength={10}
                  returnKeyType="next"
                />
                {!!purchaseDateError ? <Text style={styles.errorText}>{purchaseDateError}</Text> : null}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Valor</Text>
                <TextInput
                  value={amountRaw}
                  onChangeText={(text) => {
                    const digits = text.replace(/\D/g, '').slice(0, 9);
                    setAmountRaw(formatCurrencyInput(digits));
                  }}
                  placeholder="R$ 0,00"
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                  style={styles.input}
                  returnKeyType="next"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Validade *</Text>
                <TextInput
                  value={validUntilRaw}
                  onChangeText={(text) => {
                    setValidUntilRaw(formatDate(text));
                    setValidUntilError(null);
                  }}
                  onBlur={() => {
                    const cleanedPurchase = toIsoDate(purchaseDateRaw);
                    const cleanedValid = toIsoDate(validUntilRaw);
                    if (!cleanedValid) {
                      setValidUntilError('Informe a validade no formato dd/mm/aaaa.');
                    } else if (cleanedPurchase && cleanedValid < cleanedPurchase) {
                      setValidUntilError('A validade não pode ser anterior à data da compra.');
                    }
                  }}
                  placeholder="dd/mm/aaaa"
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                  style={[styles.input, validUntilError ? styles.inputError : null]}
                  maxLength={10}
                  returnKeyType="next"
                />
                {!!validUntilError ? <Text style={styles.errorText}>{validUntilError}</Text> : null}
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
              <Pressable style={[styles.primaryButton, saving && styles.primaryButtonDisabled]} onPress={save} disabled={saving}>
                <Text style={styles.primaryButtonText}>{saving ? 'Salvando...' : 'Salvar'}</Text>
              </Pressable>
            </View>

            <View style={styles.fileSection}>
              <Pressable style={[styles.fileAction, picking && styles.fileActionDisabled]} onPress={async () => {
                try {
                  setPicking(true);
                  const result = await DocumentPicker.getDocumentAsync({
                    type: ['image/*', 'application/pdf'],
                    copyToCacheDirectory: true
                  });
                  if (result.canceled || !result.assets?.length) return;
                  const asset = result.assets[0];
                  const localUri = await ensureLocalFile(asset.uri);
                  const name = asset.name ?? `documento-${Date.now()}`;
                  const dest = buildLocalDestination(name);
                  if (localUri !== dest) {
                    await FileSystem.copyAsync({ from: localUri, to: dest } as any);
                  }
                  const mimeType = asset.mimeType ?? 'application/octet-stream';
                  setFile({ uri: dest, name, mimeType });
                } catch (error) {
                  const message = error instanceof Error ? error.message : 'Não foi possível selecionar o arquivo.';
                  Alert.alert('Anexo', message);
                } finally {
                  setPicking(false);
                }
              }} disabled={picking}>
                <Text style={styles.fileActionLabel}>{picking ? 'Selecionando...' : 'Adicionar documento'}</Text>
              </Pressable>

              {file ? (
                <View style={styles.fileCard}>
                  <View style={styles.fileInfo}>
                    <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                    <Text style={styles.fileMeta}>{classifyAttachment(file.mimeType) === 'image' ? 'Imagem' : 'PDF'}</Text>
                  </View>
                  <View style={styles.fileActions}>
                    <Pressable onPress={async () => {
                      try {
                        setPicking(true);
                        const result = await DocumentPicker.getDocumentAsync({
                          type: ['image/*', 'application/pdf'],
                          copyToCacheDirectory: true
                        });
                        if (result.canceled || !result.assets?.length) return;
                        const asset = result.assets[0];
                        const localUri = await ensureLocalFile(asset.uri);
                        const name = asset.name ?? `documento-${Date.now()}`;
                        const dest = buildLocalDestination(name);
                        if (localUri !== dest) {
                          await FileSystem.copyAsync({ from: localUri, to: dest } as any);
                        }
                        const mimeType = asset.mimeType ?? 'application/octet-stream';
                        setFile({ uri: dest, name, mimeType });
                      } catch (error) {
                        const message = error instanceof Error ? error.message : 'Não foi possível substituir o arquivo.';
                        Alert.alert('Anexo', message);
                      } finally {
                        setPicking(false);
                      }
                    }}>
                      <Text style={styles.fileActionText}>Substituir</Text>
                    </Pressable>
                    <Pressable onPress={() => setFile(null)}>
                      <Text style={styles.fileActionTextDanger}>Remover</Text>
                    </Pressable>
                  </View>
                </View>
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
  primaryButtonDisabled: {
    opacity: 0.6
  },
  primaryButtonText: {
    color: '#ffffff',
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
    color: '#475569',
    textAlign: 'center'
  },
  fileSection: {
    gap: 10
  },
  fileAction: {
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center'
  },
  fileActionDisabled: {
    opacity: 0.6
  },
  fileActionLabel: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700'
  },
  fileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 10
  },
  fileInfo: {
    gap: 2
  },
  fileName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a'
  },
  fileMeta: {
    fontSize: 13,
    color: '#475569'
  },
  fileActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  fileActionText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700'
  },
  fileActionTextDanger: {
    color: '#991b1b',
    fontSize: 13,
    fontWeight: '700'
  }
});
