import { useState, useEffect, useRef } from 'react';
import { View, Text, Alert } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { loadReminders, saveReminders, updateReminder, loadHistory, historyEventToReminder, type Reminder, type HistoryEvent } from '../src/storage/reminders';
import ReminderForm from './reminder-form';
import { useRefreshToken } from './refresh-context';

export default function NewReminderScreen() {
  const { id, duplicate, historyEventId } = useLocalSearchParams<{ id?: string; duplicate?: string; historyEventId?: string }>();
  const [reminder, setReminder] = useState<Reminder | null>(null);
  const [duplicateSource, setDuplicateSource] = useState<Reminder | null>(null);
  const [historyEvent, setHistoryEvent] = useState<HistoryEvent | null>(null);
  const [loading, setLoading] = useState(Boolean(id || duplicate || historyEventId));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const { bump } = useRefreshToken();
  const navigation = useNavigation();
  const navigationActionRef = useRef<{ type: string; data?: { type?: string } } | null>(null);

  const isDuplicate = Boolean(duplicate);
  const isHistory = Boolean(historyEventId);
  const sourceId = isDuplicate ? duplicate : id;

  const [initialFormState] = useState(() => {
    const base = reminder ?? (isDuplicate ? duplicateSource : null) ?? (isHistory && historyEvent ? historyEventToReminder(historyEvent) : null);
    return {
      title: base?.title ?? '',
      note: base?.note ?? '',
      active: base?.active ?? true,
      latitude: base?.location?.latitude?.toString() ?? '',
      longitude: base?.location?.longitude?.toString() ?? '',
      address: base?.address ?? '',
      trigger: base?.trigger ?? 'enter',
      radiusMeters: base?.radiusMeters?.toString() ?? '',
      frequency: base?.frequency ?? 'once',
      category: base?.category ?? 'Outro'
    };
  });

  const formState = () => ({
    title: reminder?.title ?? '',
    note: reminder?.note ?? '',
    active: reminder?.active ?? true,
    latitude: reminder?.location?.latitude?.toString() ?? '',
    longitude: reminder?.location?.longitude?.toString() ?? '',
    address: reminder?.address ?? '',
    trigger: reminder?.trigger ?? 'enter',
    radiusMeters: reminder?.radiusMeters?.toString() ?? '',
    frequency: reminder?.frequency ?? 'once',
    category: reminder?.category ?? 'Outro'
  });

  const isFormDirtyFn = (current: ReturnType<typeof formState>) => (
    current.title !== initialFormState.title ||
    current.note !== initialFormState.note ||
    current.active !== initialFormState.active ||
    current.latitude !== initialFormState.latitude ||
    current.longitude !== initialFormState.longitude ||
    current.address !== initialFormState.address ||
    current.trigger !== initialFormState.trigger ||
    current.radiusMeters !== initialFormState.radiusMeters ||
    current.frequency !== initialFormState.frequency ||
    current.category !== initialFormState.category
  );

  if (navigation?.addListener) {
    useEffect(() => {
      const unsubscribe = navigation.addListener('beforeRemove', (e) => {
        const dirty = isFormDirtyFn(formState());
        if (!dirty || saving) {
          return;
        }

        e.preventDefault();
        navigationActionRef.current = e.data.action;

        Alert.alert(
          'Descartar alterações?',
          'Você tem alterações não salvas. Se sair agora, elas serão perdidas.',
          [
            {
              text: 'Continuar editando',
              style: 'cancel',
              onPress: () => {
                navigationActionRef.current = null;
              }
            },
            {
              text: 'Descartar',
              style: 'destructive',
              onPress: () => {
                const action = navigationActionRef.current;
                navigationActionRef.current = null;
                if (action) {
                  navigation.dispatch(action);
                }
              }
            }
          ]
        );
      });

      return unsubscribe;
    }, [navigation, saving]);
  }

  useEffect(() => {
    if (navigation?.setOptions) {
      navigation.setOptions({
        headerTitle: isHistory ? 'Lembrar novamente' : isDuplicate ? 'Duplicar lembrete' : id ? 'Editar lembrete' : 'Novo lembrete'
      });
    }
  }, [navigation, id, duplicate, historyEventId, isDuplicate, isHistory]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!sourceId && !historyEventId) {
        setLoading(false);
        setReminder(null);
        setDuplicateSource(null);
        setHistoryEvent(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        if (historyEventId) {
          const history = await loadHistory();
          if (cancelled) return;
          const found = history?.find((item) => item.id === historyEventId) ?? null;
          if (!found) {
            setError('Evento de histórico não encontrado.');
            setHistoryEvent(null);
          } else {
            setHistoryEvent(found);
            setReminder(null);
            setDuplicateSource(null);
          }
        } else {
          const data = await loadReminders();
          if (cancelled) return;
          const found = data?.find((item) => item.id === sourceId) ?? null;
          if (!found) {
            setError('Lembrete não encontrado.');
            setReminder(null);
            setDuplicateSource(null);
          } else {
            if (isDuplicate) {
              setDuplicateSource(found);
              setReminder(null);
            } else {
              setReminder(found);
              setDuplicateSource(null);
            }
            setHistoryEvent(null);
          }
        }
      } catch {
        if (cancelled) return;
        setError('Não foi possível carregar os dados.');
        setReminder(null);
        setDuplicateSource(null);
        setHistoryEvent(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [sourceId, historyEventId, isDuplicate]);

  const handleSubmit = async ({
    title,
    note,
    active,
    location,
    address,
    trigger,
    radiusMeters,
    frequency,
    category
  }: {
    title: string;
    note: string;
    active?: boolean;
    location?: { latitude: number; longitude: number };
    address?: string;
    trigger?: 'enter' | 'exit';
    radiusMeters?: number;
    frequency?: 'once' | 'always';
    category?: 'Pessoal' | 'Trabalho' | 'Compras' | 'Saúde' | 'Casa' | 'Outro';
  }) => {
    setSaving(true);
    try {
      if (isHistory) {
        const current = (await loadReminders()) ?? [];
        const newReminder: Reminder = {
          id: `${Date.now()}`,
          title,
          note,
          active: active ?? true,
          location,
          address,
          trigger,
          radiusMeters,
          frequency: frequency ?? 'once',
          category
        };
        await saveReminders([newReminder, ...current]);
        bump();
        setSavedAt(Date.now());
        router.replace('/');
      } else if (isDuplicate && duplicateSource) {
        const current = (await loadReminders()) ?? [];
        const newReminder: Reminder = {
          id: `${Date.now()}`,
          title,
          note,
          active: active ?? true,
          location,
          address,
          trigger,
          radiusMeters,
          frequency: frequency ?? 'once',
          category
        };
        await saveReminders([newReminder, ...current]);
        bump();
        setSavedAt(Date.now());
        router.replace('/');
      } else if (reminder) {
        await updateReminder({
          ...reminder,
          title,
          note,
          active: active ?? reminder.active,
          location: location ?? reminder.location,
          address: address ?? reminder.address,
          trigger: trigger ?? reminder.trigger,
          radiusMeters: radiusMeters ?? reminder.radiusMeters,
          frequency: frequency ?? reminder.frequency ?? 'once',
          category
        });
        bump();
        setSavedAt(Date.now());
        router.back();
      } else {
        const current = (await loadReminders()) ?? [];
        const newReminder: Reminder = {
          id: `${Date.now()}`,
          title,
          note,
          active: active ?? true,
          location,
          address,
          trigger,
          radiusMeters,
          frequency: frequency ?? 'once',
          category
        };
        await saveReminders([newReminder, ...current]);
        bump();
        setSavedAt(Date.now());
        router.replace('/');
      }
    } catch {
      throw new Error('Não foi possível salvar o lembrete.');
    } finally {
      setSaving(false);
    }
  };

  const formReminder = isHistory && historyEvent ? historyEventToReminder(historyEvent) : isDuplicate ? duplicateSource ? { ...duplicateSource, active: true, completed: undefined } : null : reminder;
  const formCategory = (formReminder?.category ?? 'Outro') as string;

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#475569' }}>Carregando...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
        <Text style={{ fontSize: 17, fontWeight: '600', color: '#0f172a', textAlign: 'center' }}>Algo deu errado</Text>
        <Text style={{ fontSize: 15, color: '#475569', textAlign: 'center' }}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {savedAt ? (
        <View style={{ marginHorizontal: 16, marginBottom: 12, padding: 12, borderRadius: 12, backgroundColor: '#ecfdf5', borderWidth: 0.33, borderColor: '#a7f3d0', gap: 4 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#047857' }}>Lembrete salvo</Text>
          <Text style={{ fontSize: 14, color: '#065f46' }}>As alterações foram salvas com sucesso.</Text>
        </View>
      ) : null}
      <ReminderForm
        reminder={{ ...(formReminder ?? {}), category: formCategory } as any}
        submitLabel="Salvar"
        onSubmit={handleSubmit}
        isSubmitting={saving}
      />
    </View>
  );
}
