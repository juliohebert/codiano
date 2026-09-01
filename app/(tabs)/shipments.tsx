import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { loadShipments, groupShipmentsByStatus } from '../../src/shipments/storage';
import type { ShipmentSummary } from '../../src/shipments/types';

export default function ShipmentsScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shipments, setShipments] = useState<ShipmentSummary[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadShipments();
      setShipments(data.map((item) => ({
        id: item.id,
        trackingNumber: item.trackingNumber,
        carrier: item.carrier,
        status: item.status,
        lastUpdatedAt: item.lastUpdatedAt,
        estimatedDelivery: item.estimatedDelivery
      })));
    } catch {
      setError('Não foi possível carregar suas encomendas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const { inProgress, delivered } = useMemo(() => groupShipmentsByStatus(shipments), [shipments]);

  const renderItem = ({ item }: { item: ShipmentSummary }) => (
    <Pressable
      style={styles.item}
      onPress={() => router.push(`/shipment/${item.trackingNumber}`)}
    >
      <View style={styles.itemHeader}>
        <Text style={styles.trackingNumber}>{item.trackingNumber}</Text>
        <Text style={[styles.badge, item.status === 'delivered' ? styles.badgeDelivered : styles.badgeInProgress]}>
          {item.status}
        </Text>
      </View>
      {!!item.carrier && <Text style={styles.meta}>{item.carrier}</Text>}
      {!!item.lastUpdatedAt && <Text style={styles.meta}>Atualizado: {item.lastUpdatedAt}</Text>}
      {!!item.estimatedDelivery && <Text style={styles.meta}>Entrega: {item.estimatedDelivery}</Text>}
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top','left','right']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.select({ ios: 8, android: 0 })}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Encomendas</Text>
          <Text style={styles.headerSubtitle}>Acompanhe suas encomendas em um só lugar.</Text>
        </View>

        {loading ? (
          <View style={styles.statusBox}>
            <ActivityIndicator color="#0f172a" />
            <Text style={styles.statusTitle}>Carregando</Text>
            <Text style={styles.statusText}>Buscando suas encomendas...</Text>
          </View>
        ) : error ? (
          <View style={styles.statusBox}>
            <Text style={styles.statusTitle}>Algo deu errado</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : inProgress.length === 0 && delivered.length === 0 ? (
          <View style={styles.statusBox}>
            <Text style={styles.emptyTitle}>Nenhuma encomenda</Text>
            <Text style={styles.emptyText}>Use o botão ＋ para adicionar um código de rastreio.</Text>
          </View>
        ) : (
          <View style={styles.root}>
            <FlatList
              style={{ flex: 1 }}
              contentContainerStyle={styles.listContent}
              data={inProgress}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              ListHeaderComponent={
                delivered.length > 0 ? (
                  <View>
                    <Text style={styles.sectionTitle}>Entregues</Text>
                    <FlatList
                      contentContainerStyle={styles.listContent}
                      data={delivered}
                      keyExtractor={(item) => item.id}
                      renderItem={renderItem}
                    />
                  </View>
                ) : null
              }
            />
          </View>
        )}
        <TouchableOpacity style={styles.fab} onPress={() => router.push('/(tabs)/add-shipment')} accessibilityRole="button" accessibilityLabel="Adicionar encomenda">
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
  root: {
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
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  item: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 6
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  trackingNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a'
  },
  meta: {
    fontSize: 13,
    color: '#475569'
  },
  badge: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden'
  },
  badgeInProgress: {
    backgroundColor: '#eef2ff',
    color: '#1e3a8a'
  },
  badgeDelivered: {
    backgroundColor: '#ecfdf5',
    color: '#065f46'
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
  errorText: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center'
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center'
  },
  emptyText: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center'
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    marginBottom: 8
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
  }
});
