import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Linking,
  Alert,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCase } from '@/hooks/useCase';
import { audit } from '@/lib/audit';

// Dark theme
const DARK = {
  bg: '#0f1419',
  surface: '#1c2128',
  surfaceHover: '#262d36',
  border: '#30363d',
  primary: '#58a6ff',
  success: '#3fb950',
  danger: '#f85149',
  text: '#e6edf3',
  textSecondary: '#8b949e',
  textMuted: '#6e7681',
};

export default function JourneyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { caseData, reports, refresh } = useCase(id!);

  const [startingLocation, setStartingLocation] = useState('');
  const [selectedAddresses, setSelectedAddresses] = useState<Set<number>>(new Set());

  const latestReport = reports[0];
  const addresses = latestReport?.parsedData.addresses || [];

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const toggleAddress = (index: number) => {
    const newSelected = new Set(selectedAddresses);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedAddresses(newSelected);
  };

  // Open single address in Google Maps
  const openAddressInMaps = (address: string) => {
    const encoded = encodeURIComponent(address);
    const url = `https://www.google.com/maps/search/?api=1&query=${encoded}`;
    Linking.openURL(url);
  };

  // Generate route with selected addresses
  const generateRoute = () => {
    if (!startingLocation.trim()) {
      Alert.alert('Missing Start', 'Enter your starting location.');
      return;
    }

    if (selectedAddresses.size === 0) {
      Alert.alert('No Destinations', 'Select at least one address.');
      return;
    }

    const destinations = Array.from(selectedAddresses)
      .sort((a, b) => a - b)
      .map((idx) => addresses[idx].fullAddress);

    const origin = encodeURIComponent(startingLocation);
    const destination = encodeURIComponent(destinations[destinations.length - 1]);
    const waypoints =
      destinations.length > 1
        ? destinations.slice(0, -1).map((addr) => encodeURIComponent(addr)).join('|')
        : '';

    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
    if (waypoints) {
      url += `&waypoints=${waypoints}`;
    }

    audit('journey_created', {
      caseId: id,
      caseName: caseData?.name,
      additionalInfo: `${destinations.length} stops`,
    });

    Linking.openURL(url);
  };

  if (!latestReport) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="navigate-outline" size={64} color={DARK.textSecondary} />
        <Text style={styles.emptyTitle}>No Report Data</Text>
        <Text style={styles.emptyText}>
          Upload and analyze a report to plan your journey.
        </Text>
      </View>
    );
  }

  // Build embed URL for a single address
  const buildMapEmbedUrl = (address: string) => {
    const encoded = encodeURIComponent(address);
    return `https://maps.google.com/maps?q=${encoded}&z=15&output=embed`;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Route Planning */}
      <View style={styles.routeCard}>
        <Text style={styles.cardTitle}>Plan Route</Text>
        <TextInput
          style={styles.input}
          placeholder="Your starting address"
          placeholderTextColor={DARK.textMuted}
          value={startingLocation}
          onChangeText={setStartingLocation}
        />
      </View>

      {/* Addresses with inline maps */}
      <Text style={styles.sectionTitle}>
        Locations ({selectedAddresses.size} selected)
      </Text>

      {addresses.length > 0 ? (
        addresses.slice(0, 10).map((address, idx) => (
          <View key={idx} style={styles.locationCard}>
            {/* Location Info Row */}
            <View style={styles.addressRow}>
              <TouchableOpacity
                style={styles.addressSelect}
                onPress={() => toggleAddress(idx)}
              >
                {selectedAddresses.has(idx) ? (
                  <Ionicons name="checkmark-circle" size={24} color={DARK.primary} />
                ) : (
                  <Ionicons name="ellipse-outline" size={24} color={DARK.textMuted} />
                )}
              </TouchableOpacity>

              <View style={styles.addressContent}>
                <View style={styles.addressHeader}>
                  <View style={[styles.rankBadge, idx === 0 && styles.rankBadgeTop]}>
                    <Text style={styles.rankText}>{idx + 1}</Text>
                  </View>
                  {(address as any).probability && (
                    <Text style={styles.probability}>{(address as any).probability}%</Text>
                  )}
                </View>
                <Text style={styles.addressText}>{address.fullAddress}</Text>
                {(address as any).type && (
                  <Text style={styles.addressType}>{(address as any).type.replace('_', ' ')}</Text>
                )}
              </View>

              <TouchableOpacity
                style={styles.mapIcon}
                onPress={() => openAddressInMaps(address.fullAddress)}
              >
                <Ionicons name="open-outline" size={20} color={DARK.primary} />
              </TouchableOpacity>
            </View>

            {/* Inline Map */}
            {Platform.OS === 'web' ? (
              <View style={styles.inlineMapContainer}>
                <iframe
                  src={buildMapEmbedUrl(address.fullAddress)}
                  style={{
                    border: 0,
                    width: '100%',
                    height: '100%',
                    borderRadius: 8,
                  }}
                  loading="lazy"
                />
              </View>
            ) : (
              <TouchableOpacity
                style={styles.mobileMapButton}
                onPress={() => openAddressInMaps(address.fullAddress)}
              >
                <Ionicons name="map" size={18} color={DARK.primary} />
                <Text style={styles.mobileMapText}>View on Map</Text>
              </TouchableOpacity>
            )}
          </View>
        ))
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.noDataText}>No addresses found</Text>
        </View>
      )}

      {/* Launch Route */}
      {selectedAddresses.size > 0 && (
        <TouchableOpacity
          style={[styles.routeButton, !startingLocation.trim() && styles.routeButtonDisabled]}
          onPress={generateRoute}
          disabled={!startingLocation.trim()}
        >
          <Ionicons name="navigate" size={20} color={DARK.text} />
          <Text style={styles.routeButtonText}>
            Navigate to {selectedAddresses.size} Location{selectedAddresses.size > 1 ? 's' : ''}
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK.bg,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: DARK.bg,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: DARK.text,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: DARK.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  emptyCard: {
    backgroundColor: DARK.surface,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: DARK.border,
  },
  routeCard: {
    marginTop: 16,
    marginBottom: 16,
    backgroundColor: DARK.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: DARK.border,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: DARK.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  input: {
    backgroundColor: DARK.bg,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: DARK.text,
    borderWidth: 1,
    borderColor: DARK.border,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: DARK.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  locationCard: {
    backgroundColor: DARK.surface,
    borderRadius: 12,
    marginBottom: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: DARK.border,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addressSelect: {
    marginRight: 12,
  },
  addressContent: {
    flex: 1,
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: DARK.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeTop: {
    backgroundColor: DARK.danger,
  },
  rankText: {
    color: DARK.text,
    fontSize: 12,
    fontWeight: '700',
  },
  probability: {
    fontSize: 13,
    fontWeight: '600',
    color: DARK.success,
  },
  addressText: {
    fontSize: 14,
    color: DARK.text,
    lineHeight: 20,
  },
  addressType: {
    fontSize: 11,
    color: DARK.primary,
    fontWeight: '500',
    textTransform: 'uppercase',
    marginTop: 4,
  },
  mapIcon: {
    padding: 8,
    marginLeft: 8,
  },
  noDataText: {
    fontSize: 14,
    color: DARK.textSecondary,
    textAlign: 'center',
  },
  routeButton: {
    marginTop: 20,
    backgroundColor: DARK.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 12,
  },
  routeButtonDisabled: {
    backgroundColor: DARK.surfaceHover,
  },
  routeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: DARK.text,
  },
  inlineMapContainer: {
    height: 180,
    marginTop: 12,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: DARK.bg,
  },
  mobileMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 10,
    backgroundColor: DARK.bg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: DARK.border,
  },
  mobileMapText: {
    fontSize: 14,
    color: DARK.primary,
    fontWeight: '500',
  },
});
