import { View, StyleSheet, Platform, Text, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
};

interface MapEmbedProps {
  addresses: { fullAddress: string; probability?: number; type?: string }[];
  height?: number;
  maxPins?: number;
}

export function MapEmbed({ addresses, height = 350, maxPins = 4 }: MapEmbedProps) {
  const topAddresses = addresses.slice(0, maxPins);

  if (topAddresses.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={styles.noData}>No addresses to display</Text>
      </View>
    );
  }

  // Google Maps Static API - shows markers without routes
  // Using labeled markers (A, B, C, D) for top locations
  const buildStaticMapUrl = () => {
    const markers = topAddresses.map((addr, idx) => {
      const label = String.fromCharCode(65 + idx); // A, B, C, D
      const color = idx === 0 ? 'red' : 'blue';
      return `markers=color:${color}|label:${label}|${encodeURIComponent(addr.fullAddress)}`;
    }).join('&');

    // Static map with all markers, auto-zoom to fit
    return `https://maps.googleapis.com/maps/api/staticmap?size=600x400&maptype=roadmap&${markers}&key=`;
  };

  // Fallback: Use iframe with first location centered
  const buildEmbedUrl = () => {
    // Center on first address
    const center = encodeURIComponent(topAddresses[0].fullAddress);
    return `https://maps.google.com/maps?q=${center}&z=12&output=embed`;
  };

  const openAllInMaps = () => {
    // Open Google Maps with all locations as search
    const locations = topAddresses.map(a => a.fullAddress).join(' to ');
    const url = `https://www.google.com/maps/search/${encodeURIComponent(topAddresses[0].fullAddress)}`;
    Linking.openURL(url);
  };

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { height }]}>
        <iframe
          src={buildEmbedUrl()}
          style={{
            border: 0,
            width: '100%',
            height: '100%',
            borderRadius: 12,
          }}
          allowFullScreen
          loading="lazy"
        />

        {/* Overlay showing pin legend */}
        <View style={styles.legend}>
          {topAddresses.map((addr, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.legendItem}
              onPress={() => {
                const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr.fullAddress)}`;
                Linking.openURL(url);
              }}
            >
              <View style={[styles.legendPin, idx === 0 && styles.legendPinPrimary]}>
                <Text style={styles.legendPinText}>{idx + 1}</Text>
              </View>
              <Text style={styles.legendAddress} numberOfLines={1}>
                {addr.fullAddress.split(',')[0]}
              </Text>
              {(addr as any).probability && (
                <Text style={styles.legendProb}>{(addr as any).probability}%</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  // Native: show list with map icons
  return (
    <View style={[styles.container, styles.nativeContainer, { height: 'auto' }]}>
      <Text style={styles.nativeTitle}>Top Locations</Text>
      {topAddresses.map((addr, idx) => (
        <TouchableOpacity
          key={idx}
          style={styles.nativeItem}
          onPress={() => {
            const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr.fullAddress)}`;
            Linking.openURL(url);
          }}
        >
          <View style={[styles.legendPin, idx === 0 && styles.legendPinPrimary]}>
            <Text style={styles.legendPinText}>{idx + 1}</Text>
          </View>
          <Text style={styles.nativeAddress} numberOfLines={2}>{addr.fullAddress}</Text>
          <Ionicons name="open-outline" size={18} color={DARK.primary} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: DARK.surface,
    position: 'relative',
    borderWidth: 1,
    borderColor: DARK.border,
  },
  noData: {
    textAlign: 'center',
    padding: 40,
    color: DARK.textSecondary,
  },
  legend: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(28, 33, 40, 0.95)',
    padding: 10,
    gap: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  legendPin: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: DARK.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendPinPrimary: {
    backgroundColor: DARK.danger,
  },
  legendPinText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  legendAddress: {
    flex: 1,
    fontSize: 13,
    color: DARK.text,
  },
  legendProb: {
    fontSize: 12,
    fontWeight: '600',
    color: DARK.success,
  },
  nativeContainer: {
    padding: 12,
  },
  nativeTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: DARK.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  nativeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: DARK.border,
  },
  nativeAddress: {
    flex: 1,
    fontSize: 14,
    color: DARK.text,
  },
});
