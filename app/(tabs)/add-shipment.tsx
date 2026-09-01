import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { addShipment } from '../../src/shipments/storage';
import { fetchTrackingFromProxy } from '../../src/shipments/proxy';
import type { Shipment } from '../../src/shipments/types';

export default function AddShipmentScreen() {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTrack = async () => {
    const value = trackingNumber.trim();
    if (!value) {
      setError('Informe o código de rastreio.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchTrackingFromProxy(value);
      if (!data.tracking_number) {
        throw new Error('Resposta inválida do serviço de rastreamento.');
      }

      const shipment: Shipment = {
        id: data.tracking_number.trim(),
        trackingNumber: data.tracking_number.trim(),
        carrier: data.courier_name?.trim() ?? null,
        status: data.tag ?? 'unknown',
        checkpoints: (data.checkpoints ?? []).map((item: any) => ({
          timestamp: item.checkpoint_time ?? '',
          location: item.location?.trim() ?? null,
          description: item.message?.trim() ?? '',
          status: item.tag ?? data.tag ?? 'unknown'
        })),
        lastUpdatedAt: data.last_updated_at,
        estimatedDelivery: data.expected_delivery
      };

      await addShipment(shipment);
      router.back();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top','left','right','bottom']}>
      <View style={styles.container}>
        <Text style={styles.title}>Adicionar encomenda</Text>
        <Text style={styles.helper}>Informe o código de rastreio para consultar o status.</Text>
        <TextInput
          value={trackingNumber}
          onChangeText={(text) => {
            setTrackingNumber(text);
            setError(null);
          }}
          placeholder="Ex.: AA123456789BR"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          autoCapitalize="characters"
          autoCorrect={false}
          accessibilityLabel="Código de rastreio"
          returnKeyType="send"
          onSubmitEditing={handleTrack}
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Pressable
          onPress={handleTrack}
          disabled={loading}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
            loading && styles.primaryButtonDisabled
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.primaryButtonLabel}>Rastrear</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  container: {
    flex: 1,
    padding: 16,
    gap: 12
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a'
  },
  helper: {
    fontSize: 14,
    color: '#475569'
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0f172a'
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13
  },
  primaryButton: {
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center'
  },
  primaryButtonDisabled: {
    opacity: 0.45
  },
  pressed: {
    opacity: 0.85
  },
  primaryButtonLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700'
  }
});
