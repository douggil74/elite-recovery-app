/**
 * Admin Page - Backend Testing, Diagnostics & User Management
 * Password protected - default: 2627f68597G!
 */
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '@/constants';

const BACKEND_URL = 'https://elite-recovery-osint.onrender.com';
const ADMIN_PASSWORD_KEY = 'elite_admin_password';
const ADMIN_USERS_KEY = 'elite_admin_users';
const DEFAULT_ADMIN_PASSWORD = '2627f68597G!';

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  result?: string;
  time?: number;
}

interface AppUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'agent' | 'viewer';
  createdAt: string;
  lastActive?: string;
}

export default function AdminScreen() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

  // Password change
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Tab state
  const [activeTab, setActiveTab] = useState<'diagnostics' | 'users'>('diagnostics');

  // Diagnostics
  const [tests, setTests] = useState<TestResult[]>([]);
  const [testUsername, setTestUsername] = useState('johndoe123');
  const [testEmail, setTestEmail] = useState('test@gmail.com');

  // User management
  const [users, setUsers] = useState<AppUser[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'agent' | 'viewer'>('agent');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const stored = await AsyncStorage.getItem(ADMIN_USERS_KEY);
      if (stored) {
        setUsers(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load users:', e);
    }
  };

  const saveUsers = async (newUsers: AppUser[]) => {
    try {
      await AsyncStorage.setItem(ADMIN_USERS_KEY, JSON.stringify(newUsers));
      setUsers(newUsers);
    } catch (e) {
      console.error('Failed to save users:', e);
    }
  };

  const handleLogin = async () => {
    setLoginError('');
    try {
      const storedPassword = await AsyncStorage.getItem(ADMIN_PASSWORD_KEY);
      const correctPassword = storedPassword || DEFAULT_ADMIN_PASSWORD;

      if (passwordInput === correctPassword) {
        setIsAuthenticated(true);
        setPasswordInput('');
      } else {
        setLoginError('Invalid password');
      }
    } catch (e) {
      setLoginError('Error verifying password');
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    try {
      await AsyncStorage.setItem(ADMIN_PASSWORD_KEY, newPassword);
      Alert.alert('Success', 'Admin password updated');
      setShowChangePassword(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) {
      Alert.alert('Error', 'Failed to update password');
    }
  };

  const handleAddUser = async () => {
    if (!newUserEmail || !newUserName) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const newUser: AppUser = {
      id: Date.now().toString(),
      email: newUserEmail,
      name: newUserName,
      role: newUserRole,
      createdAt: new Date().toISOString(),
    };

    const updatedUsers = [...users, newUser];
    await saveUsers(updatedUsers);

    setShowAddUser(false);
    setNewUserEmail('');
    setNewUserName('');
    setNewUserRole('agent');
    Alert.alert('Success', `User ${newUserName} added`);
  };

  const handleRemoveUser = async (userId: string) => {
    Alert.alert(
      'Remove User',
      'Are you sure you want to remove this user?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const updatedUsers = users.filter(u => u.id !== userId);
            await saveUsers(updatedUsers);
          },
        },
      ]
    );
  };

  const handleChangeUserRole = async (userId: string, newRole: 'admin' | 'agent' | 'viewer') => {
    const updatedUsers = users.map(u =>
      u.id === userId ? { ...u, role: newRole } : u
    );
    await saveUsers(updatedUsers);
  };

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

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return '#dc2626';
      case 'agent': return '#2563eb';
      case 'viewer': return '#6b7280';
      default: return '#6b7280';
    }
  };

  // Login Screen
  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push('/(tabs)/settings')} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Admin Access</Text>
        </View>

        <View style={styles.loginContainer}>
          <View style={styles.loginCard}>
            <Ionicons name="lock-closed" size={48} color={COLORS.primary} style={{ marginBottom: 16 }} />
            <Text style={styles.loginTitle}>Administrator Access</Text>
            <Text style={styles.loginSubtitle}>Enter admin password to continue</Text>

            <TextInput
              style={styles.passwordInput}
              value={passwordInput}
              onChangeText={setPasswordInput}
              placeholder="Password"
              placeholderTextColor="#6b7280"
              secureTextEntry
              autoCapitalize="none"
              onSubmitEditing={handleLogin}
            />

            {loginError ? (
              <Text style={styles.errorText}>{loginError}</Text>
            ) : null}

            <TouchableOpacity style={styles.loginBtn} onPress={handleLogin}>
              <Text style={styles.loginBtnText}>Access Admin Panel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/settings')} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Panel</Text>
        <TouchableOpacity onPress={() => setIsAuthenticated(false)} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'diagnostics' && styles.tabActive]}
          onPress={() => setActiveTab('diagnostics')}
        >
          <Ionicons name="flask" size={18} color={activeTab === 'diagnostics' ? '#fff' : '#a1a1aa'} />
          <Text style={[styles.tabText, activeTab === 'diagnostics' && styles.tabTextActive]}>
            Diagnostics
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'users' && styles.tabActive]}
          onPress={() => setActiveTab('users')}
        >
          <Ionicons name="people" size={18} color={activeTab === 'users' ? '#fff' : '#a1a1aa'} />
          <Text style={[styles.tabText, activeTab === 'users' && styles.tabTextActive]}>
            Users ({users.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {activeTab === 'diagnostics' ? (
          <>
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

            {/* Change Password */}
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.cardHeader}
                onPress={() => setShowChangePassword(!showChangePassword)}
              >
                <Text style={styles.cardTitle}>Change Admin Password</Text>
                <Ionicons name={showChangePassword ? 'chevron-up' : 'chevron-down'} size={20} color="#a1a1aa" />
              </TouchableOpacity>

              {showChangePassword && (
                <View style={styles.passwordSection}>
                  <TextInput
                    style={styles.input}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="New password"
                    placeholderTextColor="#6b7280"
                    secureTextEntry
                  />
                  <TextInput
                    style={[styles.input, { marginTop: 8 }]}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm password"
                    placeholderTextColor="#6b7280"
                    secureTextEntry
                  />
                  <TouchableOpacity style={styles.saveBtn} onPress={handleChangePassword}>
                    <Text style={styles.saveBtnText}>Update Password</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

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
          </>
        ) : (
          <>
            {/* Add User Button */}
            <TouchableOpacity
              style={styles.addUserBtn}
              onPress={() => setShowAddUser(!showAddUser)}
            >
              <Ionicons name="person-add" size={20} color="#fff" />
              <Text style={styles.addUserBtnText}>Add New User</Text>
            </TouchableOpacity>

            {/* Add User Form */}
            {showAddUser && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>New User</Text>
                <TextInput
                  style={styles.input}
                  value={newUserName}
                  onChangeText={setNewUserName}
                  placeholder="Full Name"
                  placeholderTextColor="#6b7280"
                />
                <TextInput
                  style={[styles.input, { marginTop: 8 }]}
                  value={newUserEmail}
                  onChangeText={setNewUserEmail}
                  placeholder="Email"
                  placeholderTextColor="#6b7280"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <View style={styles.roleSelector}>
                  {(['admin', 'agent', 'viewer'] as const).map(role => (
                    <TouchableOpacity
                      key={role}
                      style={[
                        styles.roleOption,
                        newUserRole === role && { backgroundColor: getRoleBadgeColor(role) }
                      ]}
                      onPress={() => setNewUserRole(role)}
                    >
                      <Text style={[
                        styles.roleOptionText,
                        newUserRole === role && { color: '#fff' }
                      ]}>
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity style={styles.saveBtn} onPress={handleAddUser}>
                  <Text style={styles.saveBtnText}>Add User</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* User List */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Users ({users.length})</Text>
              {users.length === 0 ? (
                <Text style={styles.emptyText}>No users added yet</Text>
              ) : (
                users.map(user => (
                  <View key={user.id} style={styles.userRow}>
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{user.name}</Text>
                      <Text style={styles.userEmail}>{user.email}</Text>
                      <Text style={styles.userDate}>
                        Added: {new Date(user.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={styles.userActions}>
                      <View style={[styles.roleBadge, { backgroundColor: getRoleBadgeColor(user.role) }]}>
                        <Text style={styles.roleBadgeText}>{user.role}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.removeBtn}
                        onPress={() => handleRemoveUser(user.id)}
                      >
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* Role Descriptions */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Role Permissions</Text>
              <View style={styles.roleDesc}>
                <View style={[styles.roleBadge, { backgroundColor: '#dc2626' }]}>
                  <Text style={styles.roleBadgeText}>admin</Text>
                </View>
                <Text style={styles.roleDescText}>Full access - manage users, settings, all cases</Text>
              </View>
              <View style={styles.roleDesc}>
                <View style={[styles.roleBadge, { backgroundColor: '#2563eb' }]}>
                  <Text style={styles.roleBadgeText}>agent</Text>
                </View>
                <Text style={styles.roleDescText}>Case access - create, view, edit assigned cases</Text>
              </View>
              <View style={styles.roleDesc}>
                <View style={[styles.roleBadge, { backgroundColor: '#6b7280' }]}>
                  <Text style={styles.roleBadgeText}>viewer</Text>
                </View>
                <Text style={styles.roleDescText}>Read only - view cases, no edits</Text>
              </View>
            </View>
          </>
        )}
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
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '600', color: '#fff' },
  logoutBtn: { padding: 4 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#18181b',
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  tabActive: {
    backgroundColor: '#dc2626',
  },
  tabText: { fontSize: 14, fontWeight: '500', color: '#a1a1aa' },
  tabTextActive: { color: '#fff' },
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    paddingVertical: 10,
    fontSize: 14,
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
  // Login styles
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loginCard: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 32,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  loginTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 4 },
  loginSubtitle: { fontSize: 13, color: '#a1a1aa', marginBottom: 24 },
  passwordInput: {
    width: '100%',
    backgroundColor: '#0f0f0f',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#27272a',
    marginBottom: 12,
  },
  loginBtn: {
    width: '100%',
    backgroundColor: '#dc2626',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  loginBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  // Password change
  passwordSection: { marginTop: 12 },
  saveBtn: {
    backgroundColor: '#22c55e',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 12,
  },
  saveBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  // User management
  addUserBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    padding: 14,
    borderRadius: 8,
    gap: 8,
    marginBottom: 16,
  },
  addUserBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  roleSelector: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  roleOption: {
    flex: 1,
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: '#27272a',
  },
  roleOptionText: { fontSize: 13, fontWeight: '500', color: '#a1a1aa' },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '600', color: '#fff' },
  userEmail: { fontSize: 13, color: '#a1a1aa', marginTop: 2 },
  userDate: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  userActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  roleBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff', textTransform: 'uppercase' },
  removeBtn: { padding: 4 },
  emptyText: { fontSize: 13, color: '#6b7280', fontStyle: 'italic' },
  roleDesc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  roleDescText: { flex: 1, fontSize: 12, color: '#a1a1aa' },
});
