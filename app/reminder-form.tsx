import { StyleSheet, View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, Keyboard, ActivityIndicator, Switch, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { searchPlaces, type PlaceSearchResult } from '../src/geo/search';
import { guessCountryCodeFromAddress } from '../src/geo/countries';
import { loadRecentLocations, addRecentLocation, type RecentLocation } from '../src/storage/reminders';
import { loadFavoriteLocations, addFavoriteLocation, removeFavoriteLocation, isFavoriteLocation } from '../src/storage/reminders';
import { type Reminder } from '../src/storage/reminders';

type Props = {
  reminder?: Reminder;
  onSubmit: (reminder: { title: string; note: string; active?: boolean; completed?: boolean; category?: 'Pessoal' | 'Trabalho' | 'Compras' | 'Saúde' | 'Casa' | 'Outro'; location?: Reminder['location']; address?: string; trigger?: Reminder['trigger']; radiusMeters?: number; frequency?: 'once' | 'always' }) => Promise<void>;
  isSubmitting?: boolean;
  submitLabel?: string;
  onDirtyChange?: (dirty: boolean) => void;
  onSaved?: () => void;
};

function buildAddressText(addr?: Location.LocationGeocodedAddress | null): string {
  if (!addr) return '';

  const norm = (v?: string | null) => (v ?? '').trim().toLowerCase();
  const equals = (a?: string | null, b?: string | null) => {
    const av = norm(a);
    const bv = norm(b);
    return av && bv && av === bv;
  };
  const contains = (hay?: string | null, needle?: string | null) => {
    const hv = norm(hay);
    const nv = norm(needle);
    return hv && nv && hv.includes(nv);
  };

  let street = '';
  const streetCandidates = [addr.street, addr.name].filter(Boolean) as string[];
  if (streetCandidates.length === 1) {
    street = streetCandidates[0] as string;
  } else if (streetCandidates.length > 1) {
    const withoutCity = streetCandidates.find((s) => !contains(s, addr.city));
    if (withoutCity) street = withoutCity;
    else if (equals(streetCandidates[0], streetCandidates[1])) street = streetCandidates[0];
    else street = streetCandidates.join(', ');
  }
  if (equals(street, addr.city)) street = '';

  const number = addr.streetNumber || '';
  const streetLine = number ? (street ? `${street} ${number}` : number) : street;

  let district = '';
  const districtCandidates = [addr.district, addr.subregion].filter(Boolean) as string[];
  if (districtCandidates.length === 1) {
    district = districtCandidates[0] as string;
  } else if (districtCandidates.length > 1) {
    const withoutCity = districtCandidates.find((d) => !contains(d, addr.city));
    if (withoutCity) district = withoutCity;
    else if (equals(districtCandidates[0], districtCandidates[1])) district = districtCandidates[0];
    else district = districtCandidates.join(', ');
  }
  if (equals(district, addr.city)) district = '';

  const city = addr.city || '';
  const region = addr.region || '';
  const country = addr.country || '';
  const cityRegion = equals(city, region) ? city : [city, region].filter(Boolean).join(' - ');
  const finalCountry = equals(country, region) || equals(country, city) ? '' : country;

  const parts = [streetLine, district, cityRegion, finalCountry].filter(Boolean);

  const dedupCity = (items: string[]) => {
    const cityNorm = norm(city);
    if (!cityNorm || items.length < 2) return items;
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of items) {
      const n = norm(item);
      if (n === cityNorm) {
        if (seen.has(cityNorm)) continue;
        seen.add(cityNorm);
      }
      out.push(item);
    }
    return out;
  };

  const deduped = dedupCity(parts);

  const cleaned = [''];
  for (const part of deduped) {
    const normalized = part.trim().toLowerCase();
    const last = cleaned[cleaned.length - 1].trim().toLowerCase();
    if (normalized && normalized !== last) cleaned.push(part);
  }
  return cleaned.slice(1).join(', ');
}

export default function ReminderForm({
  reminder,
  onSubmit,
  isSubmitting = false,
  submitLabel = 'Salvar',
  onDirtyChange,
  onSaved
}: Props) {
  const insets = useSafeAreaInsets();
  const [titleValue, setTitleValue] = useState(reminder?.title ?? '');
  const [noteValue, setNoteValue] = useState(reminder?.note ?? '');
  const [active, setActive] = useState(reminder?.active ?? true);
  const [latitude, setLatitude] = useState<string>(reminder?.location?.latitude?.toString() ?? '');
  const [longitude, setLongitude] = useState<string>(reminder?.location?.longitude?.toString() ?? '');
  const [address, setAddress] = useState<string>(reminder?.address ?? '');
  const [trigger, setTrigger] = useState<'enter' | 'exit'>(reminder?.trigger ?? 'enter');
  const [radiusMeters, setRadiusMeters] = useState<string>(reminder?.radiusMeters?.toString() ?? '');
  const [frequency, setFrequency] = useState<'once' | 'always'>(reminder?.frequency ?? 'once');
  const [category, setCategory] = useState<'Pessoal' | 'Trabalho' | 'Compras' | 'Saúde' | 'Casa' | 'Outro'>(reminder?.category ?? 'Outro');
  const [error, setError] = useState<string | null>(null);
  const [noteFocused, setNoteFocused] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchState, setSearchState] = useState<'idle' | 'loading' | 'results' | 'empty' | 'error'>('idle');
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [currentCountryCode, setCurrentCountryCode] = useState<string | undefined>(undefined);
  const [searchOrigin, setSearchOrigin] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [searchOriginFetched, setSearchOriginFetched] = useState(false);
  const [searchOriginLoading, setSearchOriginLoading] = useState(false);
  const [searchOriginError, setSearchOriginError] = useState<string | null>(null);
  const submittedRef = useRef(false);
  const latestQueryRef = useRef<string>('');
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; location?: string; radius?: string }>({});
  const [recentLocations, setRecentLocations] = useState<Array<{ placeName: string; address: string; latitude: number; longitude: number }>>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentError, setRecentError] = useState<string | null>(null);
  const recentLoadedRef = useRef(false);

  const [favoriteLocations, setFavoriteLocations] = useState<Array<{ placeName: string; address: string; latitude: number; longitude: number }>>([]);
  const favoriteLoadedRef = useRef(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | undefined>(undefined);

  const initialValues = useRef({
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

  const isDirty =
    titleValue !== initialValues.current.title ||
    noteValue !== initialValues.current.note ||
    active !== initialValues.current.active ||
    latitude !== initialValues.current.latitude ||
    longitude !== initialValues.current.longitude ||
    address !== initialValues.current.address ||
    trigger !== initialValues.current.trigger ||
    radiusMeters !== initialValues.current.radiusMeters ||
    frequency !== initialValues.current.frequency ||
    category !== initialValues.current.category;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const hasLocation = Boolean(address || (latitude.trim().length > 0 && longitude.trim().length > 0));
  const radiusTrimmed = radiusMeters.trim();
  const radiusNum = radiusTrimmed ? Number(radiusTrimmed) : NaN;
  const radiusValid = !radiusTrimmed || (!Number.isNaN(radiusNum) && radiusNum > 0);
  const validationMessage = (() => {
    if (!titleValue.trim()) return 'Informe o título do lembrete.';
    return null;
  })();

  const clearFieldError = (field: 'title' | 'location' | 'radius') => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const canSave = titleValue.trim().length > 0 && !isSubmitting && !validationMessage;

  const handleSubmit = async () => {
    submittedRef.current = true;
    const nextFieldErrors: { title?: string; location?: string; radius?: string } = {};
    if (!titleValue.trim()) nextFieldErrors.title = 'Informe o título do lembrete.';

    setFieldErrors(nextFieldErrors);

    const firstError = nextFieldErrors.title;
    if (firstError) {
      setError(firstError);
      return;
    }

    setError(null);
    try {
      await onSubmit({
        title: titleValue.trim(),
        note: noteValue.trim(),
        active,
        location: latitude && longitude ? { latitude: Number(latitude), longitude: Number(longitude) } : undefined,
        address: address || undefined,
        trigger,
        radiusMeters: radiusTrimmed ? Number(radiusTrimmed) : undefined,
        frequency,
        category
      });

      if (hasLocation) {
        const placeName = titleValue.trim();
        const locAddress = address.trim();
        const lat = Number(latitude);
        const lng = Number(longitude);
        if (placeName && !Number.isNaN(lat) && !Number.isNaN(lng)) {
          await addRecentLocation({ placeName, address: locAddress, latitude: lat, longitude: lng });
          setRecentLocations((prev) => {
            const filtered = prev.filter((item) => Math.abs(item.latitude - lat) > 0.00005 || Math.abs(item.longitude - lng) > 0.00005);
            const next = [{ placeName, address: locAddress, latitude: lat, longitude: lng, usedAt: Date.now() }, ...filtered];
            return next.slice(0, 5);
          });
          recentLoadedRef.current = true;
        }
      }

      submittedRef.current = false;
      setFieldErrors({});
      onSaved?.();
    } catch {
      setError('Não foi possível salvar o lembrete.');
    }
  };

  const showValidation = Boolean(submittedRef.current && validationMessage);
  const currentError = showValidation ? validationMessage : error;

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setSearchOriginLoading(true);
      setSearchOriginError(null);
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (cancelled) return;
        if (status !== 'granted') {
          setSearchOriginFetched(false);
          return;
        }

        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        const origin = { lat: pos.coords.latitude, lng: pos.coords.longitude };

        const [geocode] = await Location.reverseGeocodeAsync({
          latitude: origin.lat,
          longitude: origin.lng
        });
        if (cancelled) return;

        const cc = guessCountryCodeFromAddress(geocode);
        setSearchOrigin(origin);
        setCurrentPosition(origin);
        setCurrentCountryCode(cc);
        setSearchOriginFetched(true);
      } catch {
        if (!cancelled) {
          setSearchOriginError('Não foi possível obter a localização para busca.');
          setSearchOriginFetched(false);
        }
      } finally {
        if (!cancelled) setSearchOriginLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadRecents = async () => {
    if (recentLoadedRef.current) return;
    setRecentLoading(true);
    setRecentError(null);
    try {
      const data = await loadRecentLocations();
      setRecentLocations(data.slice(0, 5));
      recentLoadedRef.current = true;
    } catch {
      setRecentError('Não foi possível carregar os locais recentes.');
    } finally {
      setRecentLoading(false);
    }
  };

  useEffect(() => {
    loadRecents();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (favoriteLoadedRef.current) return;
      try {
        const data = await loadFavoriteLocations();
        if (!cancelled) {
          setFavoriteLocations(data.slice(0, 50));
        }
      } catch {
        // silent for favorites; they are secondary to the form flow
      } finally {
        if (!cancelled) favoriteLoadedRef.current = true;
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const fillCurrentLocation = async () => {
    setLocLoading(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Permissão de localização negada. Habilite nas configurações para usar esta função.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLatitude(pos.coords.latitude.toString());
      setLongitude(pos.coords.longitude.toString());
      setAddress('');
      setCurrentPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });

      const [geocode] = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude
      });
      const formatted = buildAddressText(geocode);
      if (formatted) setAddress(formatted);
      const cc = guessCountryCodeFromAddress(geocode);
      setCurrentCountryCode(cc);
    } catch {
      setError('Não foi possível obter a localização atual.');
    } finally {
      setLocLoading(false);
    }
  };

  useEffect(() => {
    const MIN_CHARS = 3;
    const DEBOUNCE_MS = 600;

    const timeout = setTimeout(async () => {
      const trimmed = searchQuery.trim();
      if (trimmed.length < MIN_CHARS) {
        setSearchState('idle');
        setSearchResults([]);
        return;
      }

      latestQueryRef.current = trimmed;
      setSearchState('loading');
      const queryForRequest = latestQueryRef.current;
      const origin = currentPosition;
      const countryCode = currentCountryCode;
      const { results, state } = await searchPlaces(queryForRequest, origin, countryCode);

      if (latestQueryRef.current !== queryForRequest) return;
      setSearchResults(results);
      setSearchState(state);
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timeout);
      if (searchQuery.trim().length < MIN_CHARS) {
        latestQueryRef.current = '';
      }
    };
  }, [searchQuery, currentPosition, currentCountryCode]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
        keyboardVerticalOffset={Platform.select({ ios: 0, android: 0 })}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom + 24, 32) }
          ]}
          overScrollMode="always"
        >
          <View style={styles.card}>
            <View style={styles.fieldGroup}>
              <View style={styles.fieldHeader}>
                <Text style={styles.label}>Título</Text>
                <Text style={styles.required}>Obrigatório</Text>
              </View>
              <TextInput
                value={titleValue}
                onChangeText={(text) => {
                  setTitleValue(text);
                  if (text.trim()) clearFieldError('title');
                }}
                placeholder="Ex.: Comprar pão"
                placeholderTextColor="#94a3b8"
                style={styles.input}
                autoCorrect={false}
                returnKeyType="next"
                accessibilityLabel="Título do lembrete"
              />
              {fieldErrors.title ? <Text style={styles.fieldError}>{fieldErrors.title}</Text> : null}
            </View>

            <View style={styles.divider} />

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Nota</Text>
              <TextInput
                value={noteValue}
                onChangeText={setNoteValue}
                placeholder="Detalhes opcionais"
                placeholderTextColor="#94a3b8"
                style={[styles.input, styles.textArea]}
                multiline
                textAlignVertical="top"
                accessibilityLabel="Nota do lembrete"
                onFocus={() => setNoteFocused(true)}
                onBlur={() => setNoteFocused(false)}
              />
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.label}>Ativo</Text>
                <Text style={styles.hint}>Ativar ou desativar este lembrete.</Text>
              </View>
              <Switch value={active} onValueChange={setActive} />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Local</Text>
            {address ? (
              <View style={styles.addressBox}>
                <Text style={styles.addressText}>{address}</Text>
                <Pressable onPress={() => { setAddress(''); setLatitude(''); setLongitude(''); }} style={styles.addressClear}>
                  <Text style={styles.addressClearText}>Alterar</Text>
                </Pressable>
              </View>
            ) : (
              <View>
                {!recentLoading && favoriteLocations.length > 0 ? (
                  <View style={styles.recentLocations}>
                    <View style={styles.sectionHeaderRow}>
                      <Text style={styles.sectionIcon}>⭐</Text>
                      <Text style={styles.favoritesHeader}>Favoritos</Text>
                    </View>
                    <ScrollView style={styles.recentScroll} nestedScrollEnabled>
                      {favoriteLocations.map((item, index) => {
                        const isSelected = Boolean(address) && Math.abs(Number(latitude) - item.latitude) < 0.00005 && Math.abs(Number(longitude) - item.longitude) < 0.00005;
                        return (
                          <View key={`fav-${item.latitude}-${item.longitude}-${index}`} style={styles.recentItem}>
                            <Pressable
                              style={({ pressed }) => [styles.recentItemPressable, pressed && styles.recentItemPressed]}
                              onPress={() => {
                                setAddress(item.address);
                                setLatitude(String(item.latitude));
                                setLongitude(String(item.longitude));
                                setSearchQuery('');
                                setSearchState('idle');
                                setSearchResults([]);
                                clearFieldError('location');
                              }}
                            >
                              <View style={styles.recentItemContent}>
                                <Text style={styles.recentItemName} numberOfLines={1}>{item.placeName}</Text>
                                <Text style={styles.recentItemAddress} numberOfLines={1}>{item.address}</Text>
                              </View>
                              {isSelected ? <Text style={styles.favoriteIcon}>★</Text> : null}
                            </Pressable>
                            <Pressable
                              style={styles.unfavoriteButton}
                              onPress={async () => {
                                Alert.alert(
                                  'Desfavoritar',
                                  `Deseja remover "${item.placeName}" dos favoritos?`,
                                  [
                                    { text: 'Cancelar', style: 'cancel' },
                                    {
                                      text: 'Desfavoritar',
                                      style: 'destructive',
                                      onPress: async () => {
                                        try {
                                          const next = await removeFavoriteLocation(item.latitude, item.longitude);
                                          setFavoriteLocations(next);
                                        } catch {}
                                      }
                                    }
                                  ],
                                  { cancelable: true }
                                );
                              }}
                            >
                              <Text style={styles.unfavoriteText} accessibilityLabel="Desfavoritar">Desfavoritar</Text>
                            </Pressable>
                          </View>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : null}

                {!recentLoading && recentLocations.length > 0 ? (
                  <View style={styles.recentLocations}>
                    <View style={styles.sectionHeaderRow}>
                      <Text style={styles.sectionIcon}>🕒</Text>
                      <Text style={styles.favoritesHeader}>Locais recentes</Text>
                    </View>
                    <ScrollView style={styles.recentScroll} nestedScrollEnabled>
                      {recentLocations.map((item, index) => (
                        <Pressable
                          key={`recent-${item.latitude}-${item.longitude}-${index}`}
                          style={({ pressed }) => [styles.recentItem, pressed && styles.recentItemPressed]}
                          onPress={() => {
                            setAddress(item.address);
                            setLatitude(String(item.latitude));
                            setLongitude(String(item.longitude));
                            setSearchQuery('');
                            setSearchState('idle');
                            setSearchResults([]);
                            clearFieldError('location');
                          }}
                        >
                          <View style={styles.recentItemContent}>
                            <Text style={styles.recentItemName} numberOfLines={1}>{item.placeName}</Text>
                            <Text style={styles.recentItemAddress} numberOfLines={1}>{item.address}</Text>
                          </View>
                          <Pressable
                            style={styles.unfavoriteButton}
                            onPress={async (e) => {
                              e.stopPropagation();
                              const next = await addFavoriteLocation({ placeName: item.placeName, address: item.address, latitude: item.latitude, longitude: item.longitude });
                              setFavoriteLocations(next);
                            }}
                          >
                            <Text style={styles.favoriteAddText}>Favoritar</Text>
                          </Pressable>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                ) : null}

                {recentError ? (
                  <View style={styles.searchStatusBox}>
                    <Text style={styles.searchStatusText}>{recentError}</Text>
                  </View>
                ) : null}
                <View style={styles.searchWrap}>
                  <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Buscar local ou endereço"
                    placeholderTextColor="#94a3b8"
                    style={styles.searchInput}
                    autoCorrect={false}
                    accessibilityLabel="Buscar local ou endereço"
                    returnKeyType="search"
                    onSubmitEditing={() => {}}
                  />
                  {searchState === 'loading' && (
                    <View style={styles.searchLoadingWrap}>
                      <ActivityIndicator color="#475569" />
                    </View>
                  )}
                </View>

                {searchState === 'results' && searchResults.length > 0 && (
                  <View style={styles.searchResults}>
                    {searchResults.map((item) => (
                      <Pressable
                        key={item.id}
                        style={({ pressed }) => [styles.searchResultItem, pressed && styles.searchResultItemPressed, selectedPlaceId === item.id && styles.searchResultItemSelected]}
                        onPress={() => {
                          setAddress(item.address);
                          setLatitude(String(item.latitude));
                          setLongitude(String(item.longitude));
                          setSearchQuery('');
                          setSearchState('idle');
                          setSearchResults([]);
                          setSelectedPlaceId(item.id);
                          clearFieldError('location');
                        }}
                      >
                        <View style={styles.searchResultTextWrap}>
                          <Text style={styles.searchResultName} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <View style={styles.searchResultMeta}>
                            {!!item.category && (
                              <Text style={styles.searchResultCategory}>{item.category}</Text>
                            )}
                            {!!item.neighborhood && (
                              <Text style={styles.searchResultMetaText}>{item.neighborhood}</Text>
                            )}
                            {!!item.city && (
                              <Text style={styles.searchResultMetaText}>
                                {item.city}{item.state ? ` - ${item.state}` : ''}
                              </Text>
                            )}
                          </View>
                          <View style={styles.searchResultFooter}>
                            <Text style={styles.searchResultAddress} numberOfLines={1}>
                              {item.address}
                            </Text>
                            {typeof item.distanceKm === 'number' && (
                              <Text style={styles.searchResultDistance}>
                                {item.distanceKm < 1
                                  ? `${Math.round(item.distanceKm * 1000)} m`
                                  : `${item.distanceKm.toFixed(1)} km`}
                              </Text>
                            )}
                          </View>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                )}

                {searchState === 'empty' && (
                  <View style={styles.searchStatusBox}>
                    <Text style={styles.searchStatusText}>Nenhum resultado encontrado.</Text>
                  </View>
                )}

                {searchState === 'error' && (
                  <View style={styles.searchStatusBox}>
                    <Text style={styles.searchStatusText}>Não foi possível buscar. Tente novamente.</Text>
                  </View>
                )}

                <Pressable onPress={fillCurrentLocation} disabled={locLoading || searchState === 'loading'} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>{locLoading ? 'Obtendo local...' : 'Usar local atual'}</Text>
                </Pressable>
                {fieldErrors.location ? <Text style={styles.fieldError}>{fieldErrors.location}</Text> : null}
              </View>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Disparo</Text>
            <View style={styles.segmentWrap}>
              <Pressable
                style={[styles.segment, trigger === 'enter' && styles.segmentActive]}
                onPress={() => setTrigger('enter')}
              >
                <Text style={[styles.segmentText, trigger === 'enter' && styles.segmentTextActive]}>Ao entrar</Text>
              </Pressable>
              <Pressable
                style={[styles.segment, trigger === 'exit' && styles.segmentActive]}
                onPress={() => setTrigger('exit')}
              >
                <Text style={[styles.segmentText, trigger === 'exit' && styles.segmentTextActive]}>Ao sair</Text>
              </Pressable>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Raio (metros)</Text>
              <TextInput
                value={radiusMeters}
                onChangeText={(text) => {
                  setRadiusMeters(text);
                  clearFieldError('radius');
                }}
                placeholder="Ex.: 200"
                placeholderTextColor="#94a3b8"
                style={styles.input}
                keyboardType="numeric"
                accessibilityLabel="Raio em metros"
              />
              {fieldErrors.radius ? <Text style={styles.fieldError}>{fieldErrors.radius}</Text> : null}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Frequência</Text>
            <View style={styles.segmentWrap}>
              <Pressable
                style={[styles.segment, frequency === 'once' && styles.segmentActive]}
                onPress={() => setFrequency('once')}
              >
                <Text style={[styles.segmentText, frequency === 'once' && styles.segmentTextActive]}>Uma vez</Text>
              </Pressable>
              <Pressable
                style={[styles.segment, frequency === 'always' && styles.segmentActive]}
                onPress={() => setFrequency('always')}
              >
                <Text style={[styles.segmentText, frequency === 'always' && styles.segmentTextActive]}>Sempre</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Categoria</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
              {(['Outro', 'Pessoal', 'Trabalho', 'Compras', 'Saúde', 'Casa'] as const).map((option) => {
                const selected = category === option;
                return (
                  <Pressable
                    key={option}
                    style={[styles.categoryChip, selected && styles.categoryChipSelected]}
                    onPress={() => setCategory(option)}
                  >
                    <Text style={[styles.categoryChipText, selected && styles.categoryChipTextSelected]}>{option}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {currentError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>Erro</Text>
              <Text style={styles.errorText}>{currentError}</Text>
            </View>
          ) : null}

          {validationMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>Campos obrigatórios</Text>
              <Text style={styles.errorText}>{validationMessage}</Text>
            </View>
          ) : null}

          {Platform.OS === 'ios' && noteFocused ? (
            <View style={styles.iosKeyboardBar}>
              <Pressable onPress={() => Keyboard.dismiss()} style={styles.iosKeyboardBarButton}>
                <Text style={styles.iosKeyboardBarButtonText}>Concluir</Text>
              </Pressable>
              <Pressable onPress={handleSubmit} style={styles.iosKeyboardBarButton}>
                <Text style={[styles.iosKeyboardBarButtonText, styles.iosKeyboardBarButtonTextPrimary]}>
                  {isSubmitting ? 'Salvando...' : submitLabel}
                </Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.buttonWrap}>
            <Pressable
              onPress={handleSubmit}
              disabled={!canSave}
              style={({ pressed }) => [
                styles.primaryButton,
                !canSave && styles.primaryButtonDisabled,
                pressed && canSave && styles.pressed
              ]}
              accessibilityRole="button"
              accessibilityLabel={submitLabel}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={[styles.primaryButtonLabel, !canSave && styles.primaryButtonLabelDisabled]}>
                  {submitLabel}
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  keyboardContainer: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 24,
    gap: 16
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 10
  },
  fieldGroup: {
    gap: 6
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a'
  },
  required: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500'
  },
  hint: {
    fontSize: 13,
    color: '#64748b'
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e2e8f0'
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0f172a'
  },
  textArea: {
    minHeight: 130
  },
  fieldError: {
    fontSize: 13,
    color: '#b91c1c',
    marginTop: 6
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  rowText: {
    flex: 1,
    gap: 2
  },
  addressFields: {},
  segmentWrap: {
    flexDirection: 'row',
    gap: 10
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    alignItems: 'center'
  },
  segmentActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a'
  },
  segmentText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569'
  },
  segmentTextActive: {
    color: '#ffffff'
  },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  addressText: {
    flex: 1,
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '600'
  },
  addressClear: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#eef2f7'
  },
  addressClearText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700'
  },
  errorBox: {
    backgroundColor: '#fff1f2',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#fecdd3',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#b91c1c'
  },
  errorText: {
    fontSize: 14,
    color: '#7f1d1d'
  },
  buttonWrap: {
    paddingHorizontal: 4,
    paddingBottom: 8
  },
  primaryButton: {
    backgroundColor: '#0f172a',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
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
  },
  primaryButtonLabelDisabled: {
    color: '#ffffff'
  },
  iosKeyboardBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#f1f5f9',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0'
  },
  iosKeyboardBarButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  iosKeyboardBarButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a'
  },
  iosKeyboardBarButtonTextPrimary: {
    fontWeight: '700'
  },
  secondaryButton: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    alignItems: 'center'
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a'
  },
  searchWrap: {
    gap: 8
  },
  searchInput: {
    backgroundColor: '#f8fafc',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0f172a'
  },
  searchLoadingWrap: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center'
  },
  searchResults: {
    gap: 10
  },
  searchResultItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    gap: 4
  },
  searchResultItemPressed: {
    opacity: 0.85
  },
  searchResultItemSelected: {
    backgroundColor: '#eef2ff',
    borderColor: '#6366f1'
  },
  searchResultTextWrap: {
    gap: 4
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a'
  },
  searchResultAddress: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    fontSize: 13,
    color: '#475569'
  },
  searchStatusBox: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#eef2f7',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0'
  },
  searchStatusText: {
    fontSize: 14,
    color: '#475569'
  },
  searchResultMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  searchResultCategory: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  searchResultMetaText: {
    fontSize: 13,
    color: '#475569'
  },
  searchResultFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12
  },
  searchResultDistance: {
    flexShrink: 0,
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '700'
  },
  recentLocations: {
    gap: 8,
    marginBottom: 12
  },
  recentScroll: {
    maxHeight: 180
  },
  favoritesHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase'
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6
  },
  sectionIcon: {
    fontSize: 16,
    color: '#475569'
  },
  recentItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  recentItemPressable: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  recentItemContent: {
    flex: 1,
    minWidth: 0
  },
  recentItemPressed: {
    opacity: 0.85
  },
  recentItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a'
  },
  recentItemAddress: {
    fontSize: 13,
    color: '#475569'
  },
  unfavoriteButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#eef2f7',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0'
  },
  unfavoriteText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569'
  },
  favoriteAddText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369a1'
  },
  favoriteIcon: {
    fontSize: 18,
    color: '#f59e0b',
    fontWeight: '700'
  },
  categoryScroll: {
    gap: 8,
    paddingVertical: 2
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    backgroundColor: '#f1f5f9'
  },
  categoryChipSelected: {
    backgroundColor: '#eef2ff',
    borderColor: '#6366f1'
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569'
  },
  categoryChipTextSelected: {
    color: '#6366f1'
  }
});
