import { Platform } from 'react-native';

export const SHIPMENT_TRACKING_PROXY_URL =
  Platform.select({
    ios: 'https://<SUBSTITUIR_PROJECT_REF>.supabase.co/functions/v1/track',
    android: 'https://<SUBSTITUIR_PROJECT_REF>.supabase.co/functions/v1/track'
  }) ?? 'https://<SUBSTITUIR_PROJECT_REF>.supabase.co/functions/v1/track';
