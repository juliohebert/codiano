import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { loadShipments } from '../../src/shipments/storage';
import type { Shipment } from '../../src/shipments/types';

type Props = {
  trackingNumber?: string;
};

export default function ShipmentDetailScreen({ trackingNumber }: Props) {
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!trackingNumber) return;
    setLoading(true);
    setError(null);
    try {
      const data = await loadShipments();
      const found = data.find((item) => item.trackingNumber === trackingNumber) ?? null;
      setShipment(found);
    } catch {
      setError('Não foi possível carregar a encomenda.');
    } finally {
      setLoading(false);
    }
  }, [trackingNumber]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top','left','right','bottom']}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.statusText}>Carregando...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : !shipment ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>Encomenda não encontrada.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Código</Text>
            <Text style={styles.value}>{shipment.trackingNumber}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Transportadora</Text>
            <Text style={styles.value}>{shipment.carrier ?? '—'}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Status</Text>
            <Text style={styles.value}>{shipment.status}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Previsão de entrega</Text>
            <Text style={styles.value}>{shipment.estimatedDelivery ?? '—'}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Histórico</Text>
            {shipment.checkpoints.length === 0 ? (
              <Text style={styles.emptyText}>Sem eventos registrados.</Text>
            ) : (
              shipment.checkpoints.map((item, index) => (
                <View key={`${item.timestamp}-${index}`} style={styles.timelineItem}>
                  <View style={styles.timelineDot} />
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineTitle}>{item.description}</Text>
                    {!!item.timestamp && <Text style={styles.timelineMeta}>{item.timestamp}</Text>}
                    {!!item.location && <Text style={styles.timelineMeta}>{item.location}</Text>}
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  scrollContent: {
    padding: 16,
    gap: 12
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 4
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase'
  },
  value: {
    fontSize: 15,
    color: '#0f172a'
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12
  },
  statusText: {
    color: '#475569'
  },
  errorText: {
    color: '#b91c1c'
  },
  emptyText: {
    color: '#475569'
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0'
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0f172a',
    marginTop: 6
  },
  timelineContent: {
    flex: 1,
    gap: 4
  },
  timelineTitle: {
    fontSize: 15,
    color: '#0f172a'
  },
  timelineMeta: {
    fontSize: 13,
    color: '#475569'
  }
});
