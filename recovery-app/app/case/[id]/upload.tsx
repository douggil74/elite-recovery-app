import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCase } from '@/hooks/useCase';
import { MultiFileUpload, UploadedFile } from '@/components/MultiFileUpload';

const DARK = {
  bg: '#0f1419',
  surface: '#1c2128',
  surfaceHover: '#262d36',
  border: '#30363d',
  primary: '#58a6ff',
  success: '#3fb950',
  warning: '#d29922',
  danger: '#f85149',
  text: '#e6edf3',
  textSecondary: '#8b949e',
  textMuted: '#6e7681',
};

export default function UploadScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { analyzeText, analyzeMultipleReports } = useCase(id!);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ value: 0, message: '' });

  const handleFilesReady = useCallback(
    async (files: UploadedFile[]) => {
      if (files.length === 0) return;

      setIsAnalyzing(true);
      setProgress({ value: 0, message: 'Starting analysis...' });

      try {
        if (files.length === 1) {
          // Single file analysis
          const file = files[0];
          if (!file.text) {
            Alert.alert('Error', 'No text content in file');
            setIsAnalyzing(false);
            return;
          }

          setProgress({ value: 0.2, message: `Analyzing ${file.name}...` });
          const result = await analyzeText(file.text);

          if (result.success) {
            setProgress({ value: 1, message: 'Complete!' });
            router.replace(`/case/${id}/brief`);
          } else {
            Alert.alert('Analysis Failed', result.error || 'Could not analyze the report.');
          }
        } else {
          // Multi-file cross-reference analysis
          const reports = files
            .filter((f) => f.text)
            .map((f, idx) => ({
              label: f.name,
              text: f.text!,
              relationship: f.relationship || (idx === 0 ? 'subject' : 'family'),
            }));

          setProgress({
            value: 0.2,
            message: `Cross-referencing ${reports.length} reports...`,
          });

          const result = await analyzeMultipleReports(reports);

          if (result.success) {
            setProgress({ value: 1, message: 'Complete!' });
            router.replace(`/case/${id}/brief`);
          } else {
            Alert.alert('Analysis Failed', result.error || 'Could not analyze reports.');
          }
        }
      } catch (error) {
        Alert.alert(
          'Error',
          error instanceof Error ? error.message : 'An unexpected error occurred.'
        );
      } finally {
        setIsAnalyzing(false);
      }
    },
    [analyzeText, analyzeMultipleReports, id, router]
  );

  if (isAnalyzing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={DARK.primary} />
        <Text style={styles.loadingText}>{progress.message}</Text>
        <View style={styles.progressBar}>
          <View
            style={[styles.progressFill, { width: `${progress.value * 100}%` }]}
          />
        </View>
        <Text style={styles.progressPercent}>
          {Math.round(progress.value * 100)}%
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={DARK.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Upload Reports</Text>
      </View>

      {/* Description */}
      <View style={styles.descCard}>
        <Text style={styles.descTitle}>Skip Trace Analysis</Text>
        <Text style={styles.descText}>
          Upload skip trace reports (PDF or text). AI will analyze addresses,
          phones, relatives, and patterns to rank likely locations.
        </Text>
        <View style={styles.tipBox}>
          <Ionicons name="bulb" size={16} color={DARK.warning} />
          <Text style={styles.tipText}>
            Pro tip: Upload multiple reports (subject + family) for cross-reference analysis
          </Text>
        </View>
      </View>

      {/* File Upload - always allows multiple */}
      <MultiFileUpload
        onFilesReady={handleFilesReady}
        maxFiles={10}
        showRelationshipField={true}
      />

      {/* Supported formats */}
      <View style={styles.formatsCard}>
        <Text style={styles.formatsTitle}>SUPPORTED</Text>
        <View style={styles.formatRow}>
          <Ionicons name="checkmark-circle" size={16} color={DARK.success} />
          <Text style={styles.formatText}>PDF files (auto-extracted)</Text>
        </View>
        <View style={styles.formatRow}>
          <Ionicons name="checkmark-circle" size={16} color={DARK.success} />
          <Text style={styles.formatText}>Text files (.txt)</Text>
        </View>
        <View style={styles.formatRow}>
          <Ionicons name="warning" size={16} color={DARK.warning} />
          <Text style={styles.formatText}>Images (paste text manually)</Text>
        </View>
      </View>
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
  loadingContainer: {
    flex: 1,
    backgroundColor: DARK.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    color: DARK.text,
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  progressBar: {
    width: '80%',
    height: 4,
    backgroundColor: DARK.border,
    borderRadius: 2,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: DARK.primary,
    borderRadius: 2,
  },
  progressPercent: {
    color: DARK.textSecondary,
    fontSize: 14,
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: DARK.text,
  },
  descCard: {
    backgroundColor: DARK.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: DARK.border,
  },
  descTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: DARK.text,
    marginBottom: 8,
  },
  descText: {
    fontSize: 14,
    color: DARK.textSecondary,
    lineHeight: 20,
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 10,
    backgroundColor: DARK.warning + '15',
    borderRadius: 8,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: DARK.warning,
  },
  formatsCard: {
    backgroundColor: DARK.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: DARK.border,
  },
  formatsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: DARK.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  formatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  formatText: {
    fontSize: 14,
    color: DARK.text,
  },
});
