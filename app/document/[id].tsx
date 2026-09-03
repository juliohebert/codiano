import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { loadDocuments, removeDocument } from '../../src/documents/storage';
import type { Document } from '../../src/documents/types';
import { AttachmentCard } from '../../src/common/attachment-card';
import { formatDateLocal } from '../../src/common/dates';

function formatDate(value: string) {
  try {
    return formatDateLocal(value);
  } catch {
    return value;
  }
}

export default function DocumentDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [document, setDocument] = useState<Document | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await loadDocuments();
      const current = data.find((item) => item.id === id);
      if (!current) {
        setError('Documento não encontrado');
        return;
      }
      setDocument(current);
    } catch {
      setError('Não foi possível carregar o documento.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const confirmDelete = async () => {
    if (!id || !document) return;
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
      <SafeAreaView style={styles.safeArea} edges={['left','right','bottom']}>
        <View style={styles.statusBox}>
          <ActivityIndicator color="#0f172a" />
          <Text style={styles.statusText}>Carregando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !document) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left','right','bottom']}>
        <View style={styles.statusBox}>
          <Text style={styles.statusTitle}>Algo deu errado</Text>
          <Text style={styles.statusText}>{error ?? 'Documento não encontrado'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusColor = document.status === 'expired' ? '#991b1b' : '#1e3a8a';
  const statusBackground = document.status === 'expired' ? '#fef2f2' : '#eef2ff';
  const statusLabel = document.status === 'expired' ? 'Vencido' : 'Ativo';

  return (
    <SafeAreaView style={styles.safeArea} edges={['left','right','bottom']}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Título</Text>
            <Text style={styles.value}>{document.title}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Validade</Text>
            <Text style={styles.value}>{formatDate(document.validUntil)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Status</Text>
            <View style={[styles.badge, { backgroundColor: statusBackground }]}>
              <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>
          {!!document.note ? (
            <View style={styles.row}>
              <Text style={styles.label}>Observação</Text>
              <Text style={styles.value}>{document.note}</Text>
            </View>
          ) : null}

          {document.file ? (
            <View style={styles.row}>
              <Text style={styles.label}>Arquivo</Text>
              <AttachmentCard file={document.file} />
            </View>
          ) : null}
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.secondaryButton} onPress={() => router.push(`/document-form?id=${document.id}`)}>
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
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden'
  },
  badgeText: {
    fontSize: 12,
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
  }
});
