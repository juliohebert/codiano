import { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Image, Alert } from 'react-native';
import { classifyAttachment, attachmentLabel, shareAttachment, ensureLocalFile, type AttachmentKind } from './attachment-helpers';

type AttachmentFile = {
  uri: string;
  name: string;
  mimeType: string;
};

type AttachmentCardProps = {
  file: AttachmentFile;
  onOpen?: () => void;
};

function OpenExternalIcon() {
  return (
    <Text style={styles.openIcon} accessibilityLabel="Abrir em outro app">
      {' '}↗
    </Text>
  );
}

export function AttachmentCard({ file, onOpen }: AttachmentCardProps) {
  const kind = classifyAttachment(file.mimeType);

  const handleOpen = useCallback(async () => {
    if (onOpen) {
      onOpen();
      return;
    }
    try {
      const localUri = await ensureLocalFile(file.uri);
      await shareAttachment(localUri, file.name, file.mimeType);
    } catch {
      Alert.alert('Não foi possível abrir o documento.');
    }
  }, [file, onOpen]);

  return (
    <View style={styles.fileCard}>
      <View style={styles.fileInfo}>
        <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
        <Text style={styles.fileMeta}>{attachmentLabel(kind)}</Text>
      </View>
      {kind === 'image' ? (
        <Image source={{ uri: file.uri }} style={styles.filePreview} resizeMode="cover" />
      ) : (
        <Pressable onPress={handleOpen} style={styles.openButton}>
          <Text style={styles.openButtonText}>Abrir em outro app</Text>
          <OpenExternalIcon />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  filePreview: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: '#e2e8f0'
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
  openButtonText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700'
  },
  openIcon: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a'
  }
});
