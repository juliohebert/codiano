import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView, Image, Modal, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { loadWarranties, removeWarranty } from '../../src/warranties/storage';
import type { Warranty } from '../../src/warranties/types';

function OpenExternalIcon() {
  return (
    <Text style={styles.openIcon} accessibilityLabel="Abrir em outro app">
      {' '}
      ↗
    </Text>
  );
}

function formatCurrency(value?: number) {
  if (typeof value !== 'number') return '—';
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  } catch {
    return `R$ ${value.toFixed(2)}`;
  }
}

function toDisplayDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

export default function WarrantyDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<Warranty | null>(null);
  const insets = useSafeAreaInsets();
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [viewerVisible, setViewerVisible] = useState(false);

  const load = useCallback(async () => {
    if (!id || id === '0') {
      setError('Identificador da garantia inválido.');
      setLoading(false);
      return;
    }
    try {
      const data = await loadWarranties();
      const current = data.find((warranty) => warranty.id === id) ?? null;
      setItem(current);
    } catch {
      setError('Não foi possível carregar a garantia.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const openPdf = async () => {
    if (!item?.file?.uri) return;
    setPdfError(null);
    setViewerVisible(true);
    try {
      const exists = await FileSystem.getInfoAsync(item.file.uri);
      if (!exists.exists) {
        setPdfError('Arquivo não encontrado.');
        return;
      }
      const canOpen = await Sharing.isAvailableAsync();
      if (!canOpen) {
        setPdfError('Abertura indisponível neste dispositivo.');
        return;
      }
      await Sharing.shareAsync(item.file.uri, {
        mimeType: item.file.mimeType,
        dialogTitle: item.file.name,
        UTI: 'public.pdf'
      });
    } catch {
      setPdfError('Não foi possível abrir o documento.');
    }
  };

  const confirmDelete = async () => {
    if (!id || !item) return;
    Alert.alert(
      'Excluir garantia',
      `Deseja excluir a garantia de "${item.product}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeWarranty(id);
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

  if (error || !item) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left','right','bottom']}>
        <View style={styles.statusBox}>
          <Text style={styles.statusTitle}>Algo deu errado</Text>
          <Text style={styles.statusText}>{error ?? 'Garantia não encontrada.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusLabel = item.status === 'expired' ? 'Vencida' : 'Ativa';
  const statusColor = item.status === 'expired' ? '#991b1b' : '#1e3a8a';
  const statusBackground = item.status === 'expired' ? '#fef2f2' : '#eef2ff';

  return (
    <SafeAreaView style={styles.safeArea} edges={['left','right','bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Produto</Text>
            <Text style={styles.value}>{item.product}</Text>
          </View>
          {!!item.store ? (
            <View style={styles.row}>
              <Text style={styles.label}>Loja</Text>
              <Text style={styles.value}>{item.store}</Text>
            </View>
          ) : null}
          <View style={styles.row}>
            <Text style={styles.label}>Data da compra</Text>
            <Text style={styles.value}>{toDisplayDate(item.purchaseDate)}</Text>
          </View>
          {typeof item.amount === 'number' ? (
            <View style={styles.row}>
              <Text style={styles.label}>Valor</Text>
              <Text style={styles.value}>{formatCurrency(item.amount)}</Text>
            </View>
          ) : null}
          <View style={styles.row}>
            <Text style={styles.label}>Validade</Text>
            <Text style={styles.value}>{toDisplayDate(item.validUntil)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Status</Text>
            <View style={[styles.badge, { backgroundColor: statusBackground }]}>
              <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>
          {!!item.note ? (
            <View style={styles.row}>
              <Text style={styles.label}>Observação</Text>
              <Text style={styles.value}>{item.note}</Text>
            </View>
          ) : null}

          {item.file ? (
            <View style={styles.row}>
              <Text style={styles.label}>Documento</Text>
              <View style={styles.fileCard}>
                <View style={styles.fileInfo}>
                  <Text style={styles.fileName} numberOfLines={1}>{item.file.name}</Text>
                  <Text style={styles.fileMeta}>
                    {item.file.mimeType.startsWith('image/') ? 'Imagem' : 'PDF'}
                  </Text>
                </View>
                {item.file.mimeType.startsWith('image/') ? (
                  <Image source={{ uri: item.file.uri }} style={styles.filePreview} resizeMode="cover" />
                ) : (
                  <Pressable onPress={openPdf} style={styles.openButton}>
                    <Text style={styles.openButtonText}>Abrir em outro app</Text>
                    <OpenExternalIcon />
                  </Pressable>
                )}
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.secondaryButton} onPress={() => router.push(`/(tabs)/warranty-form?id=${item.id}`)}>
            <Text style={styles.secondaryButtonText}>Editar</Text>
          </Pressable>
          <Pressable style={styles.dangerButton} onPress={confirmDelete}>
            <Text style={styles.dangerButtonText}>Excluir</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal visible={viewerVisible} animationType="slide" onRequestClose={() => setViewerVisible(false)}>
        <SafeAreaView style={styles.viewerSafeArea} edges={['left','right','bottom']}>
          <View style={[styles.viewerHeader, { paddingTop: insets.top }]}>
            <Pressable onPress={() => setViewerVisible(false)}>
              <Text style={styles.viewerClose}>Fechar</Text>
            </Pressable>
            <Text style={styles.viewerTitle}>Visualizar documento</Text>
            <Pressable onPress={openPdf} disabled={!item?.file?.uri}>
              <Text style={styles.viewerShare}>Abrir em outro app</Text>
            </Pressable>
          </View>
          <View style={styles.viewerBody}>
            {pdfError ? (
              <View style={styles.viewerError}>
                <Text style={styles.viewerErrorText}>{pdfError}</Text>
              </View>
            ) : (
              <View style={styles.viewerEmpty}>
                <Text style={styles.viewerEmptyText}>
                  O preview interno de PDF não está disponível no momento.
                </Text>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>
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
  filePreview: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: '#e2e8f0'
  },
  openButtonText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700'
  },
  openButton: {
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48
  },
  openIcon: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a'
  },
  fileActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  fileShare: {
    color: '#0f172a',
    fontSize: 13,
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
  viewerSafeArea: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  viewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0'
  },
  viewerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a'
  },
  viewerClose: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700'
  },
  viewerShare: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700'
  },
  viewerBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 12
  },
  viewerError: {
    gap: 8
  },
  viewerErrorText: {
    color: '#991b1b',
    fontSize: 15,
    textAlign: 'center'
  },
  viewerEmpty: {
    gap: 12,
    alignItems: 'center'
  },
  viewerEmptyText: {
    color: '#475569',
    fontSize: 15,
    textAlign: 'center'
  }
});
