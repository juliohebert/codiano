import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

export type AttachmentKind = 'image' | 'pdf' | 'other';

export function classifyAttachment(mimeType: string): AttachmentKind {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  return 'other';
}

export async function ensureLocalFile(uri: string): Promise<string> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) throw new Error('Arquivo não encontrado.');
  return uri;
}

export async function shareAttachment(uri: string, name: string, mimeType: string) {
  try {
    const exists = await FileSystem.getInfoAsync(uri);
    if (!exists.exists) {
      Alert.alert('Arquivo não encontrado');
      return;
    }
    const canOpen = await Sharing.isAvailableAsync();
    if (!canOpen) {
      Alert.alert('Abertura indisponível', 'Não foi possível abrir este arquivo neste dispositivo.');
      return;
    }
    await Sharing.shareAsync(uri, {
      mimeType,
      dialogTitle: name,
      UTI: mimeType.startsWith('image/') ? 'public.image' : 'public.pdf'
    });
  } catch {
    Alert.alert('Não foi possível compartilhar o documento.');
  }
}

export function attachmentLabel(kind: AttachmentKind) {
  if (kind === 'image') return 'Imagem';
  if (kind === 'pdf') return 'PDF';
  return 'Arquivo';
}
