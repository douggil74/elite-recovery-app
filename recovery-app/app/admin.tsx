/**
 * Admin Page - Backend Testing & Diagnostics
 */
import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants';

const BACKEND_URL = 'https://elite-recovery-osint.onrender.com';

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  result?: string;
  time?: number;
}

export default function AdminScreen() {
  const router = useRouter();
  const [tests, setTests] = useState<TestResult[]>([]);
  const [testUsername, setTestUsername] = useState('johndoe123');
  const [testEmail, setTestEmail] = useState('test@gmail.com');

  const updateTest = (name: string, update: Partial<TestResult>) => {
    setTests(prev => prev.map(t => t.name === name ? { ...t, ...update } : t));
  };

  const runAllTests = async () => {
    const testList: TestResult[] = [
      { name: 'Backend Health', status: 'pending' },
      { name: 'AI Chat (GPT-4o-mini)', status: 'pending' },
      { name: 'AI Brief Generation', status: 'pending' },
      { name: 'Sherlock (Username)', status: 'pending' },
      { name: 'Holehe (Email)', status: 'pending' },
    ];
    setTests(testList);

    // Test 1: Backend Health
    updateTest('Backend Health', { status: 'running' });
    try {
      const start = Date.now();
      const res = await fetch(`${BACKEND_URL}/health`);
      const data = await res.json();
      updateTest('Backend Health', {
        status: 'success',
        result: `Status: ${data.status}\nTools: ${Object.entries(data.tools).map(([k,v]) => `${k}=${v}`).join(', ')}`,
        time: Date.now() - start,
      });
    } catch (e: any) {
      updateTest('Backend Health', { status: 'error', result: e.message });
    }

    // Test 2: AI Chat
    updateTest('AI Chat (GPT-4o-mini)', { status: 'running' });
    try {
      const start = Date.now();
      const res = await fetch(`${BACKEND_URL}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Say "AI working" in 3 words' }],
          model: 'gpt-4o-mini',
          max_tokens: 20,
        }),
      });
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || 'No response';
      updateTest('AI Chat (GPT-4o-mini)', {
        status: 'success',
        result: reply,
        time: Date.now() - start,
      });
    } catch (e: any) {
      updateTest('AI Chat (GPT-4o-mini)', { status: 'error', result: e.message });
    }

    // Test 3: AI Brief
    updateTest('AI Brief Generation', { status: 'running' });
    try {
      const start = Date.now();
      const res = await fetch(`${BACKEND_URL}/api/ai/brief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject_name: 'Test Subject',
          known_addresses: ['123 Test St'],
        }),
      });
      const data = await res.json();
      updateTest('AI Brief Generation', {
        status: 'success',
        result: `Generated ${data.brief?.length || 0} chars brief`,
        time: Date.now() - start,
      });
    } catch (e: any) {
      updateTest('AI Brief Generation', { status: 'error', result: e.message });
    }

    // Test 4: Sherlock
    updateTest('Sherlock (Username)', { status: 'running' });
    try {
      const start = Date.now();
      const res = await fetch(`${BACKEND_URL}/api/sherlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: testUsername, timeout: 30 }),
      });
      const data = await res.json();
      updateTest('Sherlock (Username)', {
        status: 'success',
        result: `Found ${data.found?.length || 0} profiles for "${testUsername}"`,
        time: Date.now() - start,
      });
    } catch (e: any) {
      updateTest('Sherlock (Username)', { status: 'error', result: e.message });
    }

    // Test 5: Holehe
    updateTest('Holehe (Email)', { status: 'running' });
    try {
      const start = Date.now();
      const res = await fetch(`${BACKEND_URL}/api/holehe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, timeout: 30 }),
      });
      const data = await res.json();
      updateTest('Holehe (Email)', {
        status: 'success',
        result: `Found ${data.registered_on?.length || 0} services for "${testEmail}"`,
        time: Date.now() - start,
      });
    } catch (e: any) {
      updateTest('Holehe (Email)', { status: 'error', result: e.message });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <Ionicons name="checkmark-circle" size={20} color="#22c55e" />;
      case 'error': return <Ionicons name="close-circle" size={20} color="#ef4444" />;
      case 'running': return <ActivityIndicator size="small" color="#eab308" />;
      default: return <Ionicons name="ellipse-outline" size={20} color="#6b7280" />;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/settings')} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin - Backend Tests</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Backend Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Backend URL</Text>
          <Text style={styles.url}>{BACKEND_URL}</Text>
        </View>

        {/* Test Inputs */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Test Parameters</Text>
          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Username:</Text>
            <TextInput
              style={styles.input}
              value={testUsername}
              onChangeText={setTestUsername}
              placeholder="johndoe123"
              placeholderTextColor="#6b7280"
            />
          </View>
          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Email:</Text>
            <TextInput
              style={styles.input}
              value={testEmail}
              onChangeText={setTestEmail}
              placeholder="test@gmail.com"
              placeholderTextColor="#6b7280"
            />
          </View>
        </View>

        {/* Run Tests Button */}
        <TouchableOpacity style={styles.runBtn} onPress={runAllTests}>
          <Ionicons name="flask" size={20} color="#fff" />
          <Text style={styles.runBtnText}>Run All Tests</Text>
        </TouchableOpacity>

        {/* Test Results */}
        {tests.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Test Results</Text>
            {tests.map((test, idx) => (
              <View key={idx} style={styles.testRow}>
                {getStatusIcon(test.status)}
                <View style={styles.testInfo}>
                  <Text style={styles.testName}>{test.name}</Text>
                  {test.result && (
                    <Text style={[styles.testResult, test.status === 'error' && styles.errorText]}>
                      {test.result}
                    </Text>
                  )}
                  {test.time && (
                    <Text style={styles.testTime}>{test.time}ms</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* API Endpoints Reference */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Available Endpoints</Text>
          <Text style={styles.endpoint}>GET /health - Backend health check</Text>
          <Text style={styles.endpoint}>POST /api/sherlock - Username search</Text>
          <Text style={styles.endpoint}>POST /api/maigret - Username intel</Text>
          <Text style={styles.endpoint}>POST /api/holehe - Email discovery</Text>
          <Text style={styles.endpoint}>POST /api/socialscan - Username check</Text>
          <Text style={styles.endpoint}>POST /api/investigate - Full investigation</Text>
          <Text style={styles.endpoint}>POST /api/ai/chat - AI chat</Text>
          <Text style={styles.endpoint}>POST /api/ai/analyze - Image/doc analysis</Text>
          <Text style={styles.endpoint}>POST /api/ai/brief - Recovery brief</Text>
        </View>

        {/* No API Keys Needed */}
        <View style={[styles.card, styles.successCard]}>
          <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
          <Text style={styles.successText}>
            No API keys needed - OpenAI is configured on the backend
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  backBtn: { marginRight: 12 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#fff' },
  scroll: { flex: 1 },
  content: { padding: 16 },
  card: {
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#a1a1aa', marginBottom: 12 },
  url: { fontSize: 12, color: '#60a5fa', fontFamily: 'monospace' },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  inputLabel: { width: 80, fontSize: 13, color: '#a1a1aa' },
  input: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  runBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
    padding: 14,
    borderRadius: 8,
    gap: 8,
    marginBottom: 16,
  },
  runBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  testRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
    gap: 12,
  },
  testInfo: { flex: 1 },
  testName: { fontSize: 14, fontWeight: '500', color: '#fff' },
  testResult: { fontSize: 12, color: '#a1a1aa', marginTop: 4 },
  errorText: { color: '#ef4444' },
  testTime: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  endpoint: { fontSize: 12, color: '#a1a1aa', fontFamily: 'monospace', marginBottom: 6 },
  successCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#052e16',
    borderColor: '#166534',
  },
  successText: { flex: 1, fontSize: 13, color: '#22c55e' },
});
