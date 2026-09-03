import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, Alert, ScrollView, TouchableWithoutFeedback, Keyboard, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { loadDocuments, updateDocument, addDocument, removeDocument } from '../../src/documents/storage';
import type { Document, DocumentFile } from '../../src/documents/types';

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

function formatDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function formatFileSize(bytes?: number): string {
  if (typeof bytes !== 'number') return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentFormScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const isEditing = Boolean(id);
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [validUntilRaw, setValidUntilRaw] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEditing);
  const [validUntilError, setValidUntilError] = useState<string | null>(null);
  const [file, setFile] = useState<DocumentFile | null | undefined>(undefined);
  const [picking, setPicking] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await loadDocuments();
      const current = data.find((item) => item.id === id);
      if (!current) {
        Alert.alert('Documento não encontrado');
        router.back();
        return;
      }
      setTitle(current.title);
      setValidUntilRaw(toDisplayDate(current.validUntil));
      setNote(current.note ?? '');
      setFile(current.file ?? null);
    } catch {
      Alert.alert('Não foi possível carregar o documento.');
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

  const pickDocument = async () => {
    try {
      setPicking(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true
      });
      if (result.canceled || !result.assets?.length) {
        setPicking(false);
        return;
      }
      const asset = result.assets[0];
      if (!asset.uri) {
        Alert.alert('Não foi possível selecionar o arquivo.');
        setPicking(false);
        return;
      }
      const dest = `${FileSystem.documentDirectory}/${asset.name ?? 'documento'}`;
      await FileSystem.copyAsync({ from: asset.uri, to: dest } as any);
      const info = await FileSystem.getInfoAsync(dest);
      setFile({
        uri: dest,
        name: asset.name ?? 'documento',
        mimeType: asset.mimeType ?? 'application/octet-stream'
      });
    } catch (e: any) {
      Alert.alert('Não foi possível selecionar o arquivo.', e?.message ?? '');
    } finally {
      setPicking(false);
    }
  };

  const removeFile = () => setFile(null);

  const save = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert('Informe o título do documento.');
      return;
    }

    const validUntil = toIsoDate(validUntilRaw);
    if (!validUntil) {
      Alert.alert('Informe a validade.');
      return;
    }

    const now = new Date().toISOString();
    if (isEditing && id) {
      const current = (await loadDocuments()).find((item) => item.id === id);
      const base = current ?? {
        id,
        createdAt: now,
        status: 'active'
      } as Document;
      const updated: Document = {
        ...base,
        title: trimmedTitle,
        validUntil: validUntil,
        note: note.trim() || undefined,
        file: file ?? undefined,
        updatedAt: now
      };
      setSaving(true);
      try {
        await updateDocument(updated);
        router.back();
      } catch {
        Alert.alert('Não foi possível salvar.');
        setSaving(false);
      }
      return;
    }

    const created: Document = {
      id: `local-${Date.now()}`,
      title: trimmedTitle,
      validUntil,
      note: note.trim() || undefined,
      status: 'active',
      file: file ?? undefined,
      createdAt: now,
      updatedAt: now
    };

    setSaving(true);
    try {
      await addDocument(created);
      router.replace('/(tabs)/documents/documents');
    } catch {
      Alert.alert('Não foi possível salvar.');
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!id) return;
    try {
      const data = await loadDocuments();
      const current = data.find((item) => item.id === id);
      if (current?.file?.uri) {
        try {
          await FileSystem.deleteAsync(current.file.uri, { idempotent: true });
        } catch {
          // no-op
        }
      }
    } catch {
      // no-op
    }
    Alert.alert(
      'Excluir documento',
      'Deseja excluir este documento?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeDocument(id);
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
          <Text style={styles.headerTitle}>{isEditing ? 'Documento' : 'Novo documento'}</Text>
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
              <Text style={styles.headerTitle}>{isEditing ? 'Documento' : 'Novo documento'}</Text>
              <Text style={styles.headerSubtitle}>Cadastre título, validade, observação e anexo.</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.field}>
                <Text style={styles.label}>Título</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Ex: IPVA 2026"
                  placeholderTextColor="#94a3b8"
                  style={styles.input}
                  returnKeyType="next"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Validade</Text>
                <TextInput
                  value={validUntilRaw}
                  onChangeText={(text) => {
                    setValidUntilRaw(formatDateInput(text));
                    setValidUntilError(null);
                  }}
                  onBlur={() => {
                    if (!toIsoDate(validUntilRaw)) {
                      setValidUntilError('Informe uma data válida no formato dd/mm/aaaa.');
                    }
                  }}
                  placeholder="dd/mm/aaaa"
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                  style={[styles.input, validUntilError ? styles.inputError : null]}
                  returnKeyType="next"
                />
                {!!validUntilError ? (
                  <Text style={styles.errorText}>{validUntilError}</Text>
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

              <View style={styles.field}>
                <Text style={styles.label}>Anexo</Text>
                {file ? (
                  <View style={styles.fileCard}>
                    <View style={styles.fileInfo}>
                      <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                      <Text style={styles.fileMeta}>
                        {file.mimeType.startsWith('image/') ? 'Imagem' : 'PDF'}
                      </Text>
                    </View>
                    <View style={styles.fileActions}>
                      <Pressable onPress={pickDocument} accessibilityRole="button" accessibilityLabel="Substituir anexo">
                        <Text style={styles.fileReplace}>Substituir</Text>
                      </Pressable>
                      <Pressable onPress={removeFile} accessibilityRole="button" accessibilityLabel="Remover anexo">
                        <Text style={styles.fileRemove}>Remover</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable style={styles.fileEmpty} onPress={pickDocument} disabled={picking}>
                    <View style={styles.fileEmptyIcon}>
                      <Text style={styles.fileEmptyIconText}>＋</Text>
                    </View>
                    <View style={styles.fileEmptyTexts}>
                      <Text style={styles.fileEmptyTitle}>{picking ? 'Selecionando...' : 'Adicionar arquivo'}</Text>
                      <Text style={styles.fileEmptySubtitle}>Toque para escolher imagem ou PDF</Text>
                    </View>
                  </Pressable>
                )}
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
  fileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  fileInfo: {
    flex: 1,
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
  fileReplace: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700'
  },
  fileRemove: {
    color: '#991b1b',
    fontSize: 13,
    fontWeight: '700'
  },
  fileEmpty: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14
  },
  fileEmptyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  fileEmptyIconText: {
    color: '#0f172a',
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '700'
  },
  fileEmptyTexts: {
    flex: 1,
    gap: 2
  },
  fileEmptyTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700'
  },
  fileEmptySubtitle: {
    color: '#475569',
    fontSize: 13
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
