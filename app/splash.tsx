import { StyleSheet, View, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { router } from 'expo-router';

export default function SplashScreen() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const go = () => router.replace('/(tabs)');
    go();
  }, [ready]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="dark" />
      <View style={styles.root}>
        <View style={styles.logoWrap}>
          <View style={styles.logoMark} />
          <View style={styles.logoAccent} />
        </View>
        <Text style={styles.name}>Cotidiano</Text>
        <Text style={styles.tagline}>Facilidades para o seu dia a dia.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 24
  },
  logoWrap: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center'
  },
  logoMark: {
    width: 52,
    height: 52,
    borderTopWidth: 7,
    borderLeftWidth: 7,
    borderBottomWidth: 7,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderColor: '#f8fafc'
  },
  logoAccent: {
    position: 'absolute',
    right: 10,
    top: 10,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#6366f1'
  },
  name: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center'
  },
  tagline: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center'
  }
});
