import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Linking,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import OpenAI from 'openai';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCase } from '@/hooks/useCase';
import { deleteCase } from '@/lib/database';
import { deleteCaseDirectory, getSettings } from '@/lib/storage';
import { confirm } from '@/lib/confirm';
import { audit } from '@/lib/audit';
import { syncChat, syncPhoto, fetchSyncedChat, fetchSyncedPhoto, isSyncEnabled, deleteSyncedCase } from '@/lib/sync';

// Dark theme
const DARK = {
  bg: '#0f1419',
  surface: '#1c2128',
  surfaceHover: '#262d36',
  border: '#30363d',
  primary: '#58a6ff',
  primaryDim: '#388bfd',
  success: '#3fb950',
  warning: '#d29922',
  danger: '#f85149',
  text: '#e6edf3',
  textSecondary: '#8b949e',
  textMuted: '#6e7681',
};

interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: Date;
  type?: 'text' | 'file' | 'locations' | 'phones';
  data?: any;
}

const isWeb = Platform.OS === 'web';

export default function CaseDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { caseData, reports, refresh, analyzeText } = useCase(id!);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoaded, setChatLoaded] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [subjectPhoto, setSubjectPhoto] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const latestReport = reports[0];
  const parsedData = latestReport?.parsedData;
  const addresses = parsedData?.addresses || [];
  const phones = parsedData?.phones || [];
  const relatives = parsedData?.relatives || [];

  // Load saved photo and chat history (local + cloud)
  useEffect(() => {
    if (id) {
      const loadData = async () => {
        // Load local photo first
        const localPhoto = await AsyncStorage.getItem(`case_photo_${id}`);
        if (localPhoto) setSubjectPhoto(localPhoto);

        // Load local chat first
        const localChat = await AsyncStorage.getItem(`case_chat_${id}`);
        if (localChat) {
          try {
            const parsed = JSON.parse(localChat);
            const messages = parsed.map((m: any) => ({
              ...m,
              timestamp: new Date(m.timestamp),
            }));
            setChatMessages(messages);
          } catch (e) {
            console.error('Failed to parse chat history:', e);
          }
        }

        // Then try to fetch from cloud (may have newer data from other device)
        const cloudEnabled = await isSyncEnabled();
        if (cloudEnabled) {
          const cloudChat = await fetchSyncedChat(id);
          if (cloudChat && cloudChat.length > 0) {
            // Merge: use cloud if it has more messages (simple strategy)
            const localMsgs = localChat ? JSON.parse(localChat) : [];
            if (cloudChat.length > localMsgs.length) {
              const messages = cloudChat.map((m: any) => ({
                ...m,
                timestamp: new Date(m.timestamp),
              }));
              setChatMessages(messages);
              // Update local storage with cloud data
              await AsyncStorage.setItem(`case_chat_${id}`, JSON.stringify(cloudChat));
            }
          }

          const cloudPhoto = await fetchSyncedPhoto(id);
          if (cloudPhoto && !localPhoto) {
            setSubjectPhoto(cloudPhoto);
            await AsyncStorage.setItem(`case_photo_${id}`, cloudPhoto);
          }
        }

        setChatLoaded(true);
      };

      loadData();
    }
  }, [id]);

  // Save chat history when it changes (local + cloud)
  useEffect(() => {
    if (id && chatLoaded && chatMessages.length > 0) {
      // Save locally
      AsyncStorage.setItem(`case_chat_${id}`, JSON.stringify(chatMessages));

      // Sync to cloud
      isSyncEnabled().then((enabled) => {
        if (enabled) {
          syncChat(id, chatMessages);
        }
      });
    }
  }, [id, chatMessages, chatLoaded]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // Initialize chat with greeting (only if no stored history)
  useEffect(() => {
    if (caseData && chatLoaded && chatMessages.length === 0) {
      const greeting = latestReport
        ? `Case loaded: ${parsedData?.subject?.fullName || caseData.name}. Got ${addresses.length} addresses and ${phones.length} numbers on file. What do you need?`
        : `New case: ${caseData.name}. Drop a report file here or paste the text and I'll analyze it.`;

      setChatMessages([
        {
          id: 'greeting',
          role: 'agent',
          content: greeting,
          timestamp: new Date(),
        },
      ]);
    }
  }, [caseData, latestReport, chatLoaded, chatMessages.length]);

  // Update chat when report data changes
  useEffect(() => {
    if (latestReport && chatMessages.length > 0) {
      const hasDataMessage = chatMessages.some(m => m.type === 'locations');
      if (!hasDataMessage && addresses.length > 0) {
        // Add location summary card to chat
        setChatMessages(prev => [...prev, {
          id: 'locations-' + Date.now(),
          role: 'system',
          content: '',
          timestamp: new Date(),
          type: 'locations',
          data: addresses.slice(0, 5),
        }]);
      }
    }
  }, [latestReport, addresses]);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // Handle file upload
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingFile(true);

    // Import pdf-extract dynamically
    const { processUploadedFile } = await import('@/lib/pdf-extract');

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileType = file.type.toLowerCase();
      const fileName = file.name.toLowerCase();

      // Check if it's an image - treat as target photo
      const isImage = fileType.startsWith('image/') ||
        fileName.endsWith('.png') ||
        fileName.endsWith('.jpg') ||
        fileName.endsWith('.jpeg') ||
        fileName.endsWith('.gif') ||
        fileName.endsWith('.webp');

      if (isImage) {
        // Save as subject/target photo
        const reader = new FileReader();
        reader.onload = async (e) => {
          const dataUrl = e.target?.result as string;
          if (dataUrl && id) {
            setSubjectPhoto(dataUrl);
            await AsyncStorage.setItem(`case_photo_${id}`, dataUrl);

            // Sync photo to cloud
            const cloudEnabled = await isSyncEnabled();
            if (cloudEnabled) {
              await syncPhoto(id, dataUrl);
            }

            setChatMessages(prev => [...prev, {
              id: Date.now().toString() + '-photo',
              role: 'agent',
              content: `Target photo saved. I'll keep this on file for the recovery.`,
              timestamp: new Date(),
            }]);
            scrollToBottom();
          }
        };
        reader.readAsDataURL(file);
        continue;
      }

      // Not an image - treat as skip trace report
      setChatMessages(prev => [...prev, {
        id: Date.now().toString() + i,
        role: 'user',
        content: `📄 ${file.name}`,
        timestamp: new Date(),
        type: 'file',
      }]);
      scrollToBottom();

      const processingId = Date.now().toString() + '-processing-' + i;
      setChatMessages(prev => [...prev, {
        id: processingId,
        role: 'agent',
        content: 'Processing report... extracting text and analyzing.',
        timestamp: new Date(),
      }]);
      scrollToBottom();

      try {
        const extractResult = await processUploadedFile(file);

        setChatMessages(prev => prev.filter(m => m.id !== processingId));

        if (!extractResult.success || !extractResult.text) {
          setChatMessages(prev => [...prev, {
            id: Date.now().toString() + '-error-' + i,
            role: 'agent',
            content: extractResult.error || 'Could not read file. Try pasting the text.',
            timestamp: new Date(),
          }]);
          continue;
        }

        const result = await analyzeText(extractResult.text);

        if (result.success && result.data) {
          const addrCount = result.data.addresses?.length || 0;
          const phoneCount = result.data.phones?.length || 0;
          const relCount = result.data.relatives?.length || 0;

          setChatMessages(prev => [...prev, {
            id: Date.now().toString() + '-result-' + i,
            role: 'agent',
            content: `Got it. Found ${addrCount} addresses, ${phoneCount} phone numbers, and ${relCount} known associates. Top location: ${result.data.addresses?.[0]?.fullAddress || 'unknown'}. What's your play?`,
            timestamp: new Date(),
          }]);

          await refresh();
        } else {
          setChatMessages(prev => [...prev, {
            id: Date.now().toString() + '-error-' + i,
            role: 'agent',
            content: `Couldn't analyze that file. ${result.error || 'Try pasting the text directly.'}`,
            timestamp: new Date(),
          }]);
        }
      } catch (err) {
        setChatMessages(prev => prev.filter(m => m.id !== processingId));
        setChatMessages(prev => [...prev, {
          id: Date.now().toString() + '-error-' + i,
          role: 'agent',
          content: 'Error processing file. Check Settings for API key.',
          timestamp: new Date(),
        }]);
      }
    }

    setIsProcessingFile(false);
    scrollToBottom();

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle photo upload
  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl && id) {
        setSubjectPhoto(dataUrl);
        await AsyncStorage.setItem(`case_photo_${id}`, dataUrl);

        // Sync photo to cloud
        const cloudEnabled = await isSyncEnabled();
        if (cloudEnabled) {
          await syncPhoto(id, dataUrl);
        }

        setChatMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'system',
          content: 'Subject photo updated.',
          timestamp: new Date(),
        }]);
        scrollToBottom();
      }
    };
    reader.readAsDataURL(file);

    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const sendMessage = async () => {
    if (!inputText.trim() || isSending) return;

    const userText = inputText.trim();
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userText,
      timestamp: new Date(),
    };

    setChatMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsSending(true);
    scrollToBottom();

    // Check if it looks like pasted report data (long text)
    if (userText.length > 500 && !latestReport) {
      setChatMessages(prev => [...prev, {
        id: Date.now().toString() + '-processing',
        role: 'agent',
        content: 'Looks like report data. Analyzing...',
        timestamp: new Date(),
      }]);
      scrollToBottom();

      try {
        const result = await analyzeText(userText);
        setChatMessages(prev => prev.filter(m => !m.id.includes('-processing')));

        if (result.success && result.data) {
          const addrCount = result.data.addresses?.length || 0;
          setChatMessages(prev => [...prev, {
            id: Date.now().toString() + '-result',
            role: 'agent',
            content: `Analyzed. Found ${addrCount} locations. Subject: ${result.data.subject?.fullName || 'Unknown'}. Data's loaded - what do you want to know?`,
            timestamp: new Date(),
          }]);
          await refresh();
        } else {
          setChatMessages(prev => [...prev, {
            id: Date.now().toString() + '-error',
            role: 'agent',
            content: result.error || 'Analysis failed. Check your API key.',
            timestamp: new Date(),
          }]);
        }
      } catch (err) {
        setChatMessages(prev => prev.filter(m => !m.id.includes('-processing')));
        setChatMessages(prev => [...prev, {
          id: Date.now().toString() + '-error',
          role: 'agent',
          content: 'Error. Check Settings for API key.',
          timestamp: new Date(),
        }]);
      }
      setIsSending(false);
      scrollToBottom();
      return;
    }

    // Regular chat with AI
    try {
      const settings = await getSettings();
      if (!settings.openaiApiKey) {
        setChatMessages(prev => [...prev, {
          id: Date.now().toString() + '-error',
          role: 'agent',
          content: 'Need API key in Settings to chat.',
          timestamp: new Date(),
        }]);
        setIsSending(false);
        return;
      }

      const client = new OpenAI({
        apiKey: settings.openaiApiKey,
        dangerouslyAllowBrowser: true,
      });

      const caseContext = latestReport
        ? `
CASE: ${caseData?.name}
SUBJECT: ${parsedData?.subject?.fullName || 'Unknown'}
DOB: ${parsedData?.subject?.dob || 'Unknown'}

TOP ADDRESSES:
${addresses.slice(0, 5).map((a: any, i: number) => `${i + 1}. ${a.fullAddress} ${a.probability ? `(${a.probability}%)` : ''} ${a.type || ''}`).join('\n')}

PHONES:
${phones.slice(0, 5).map((p: any) => `- ${p.number} (${p.type || 'unknown'})`).join('\n')}

CONTACTS:
${relatives.slice(0, 5).map((r: any) => `- ${r.name} (${r.relationship})`).join('\n')}
`
        : 'No report data yet. User needs to upload or paste a skip-trace report.';

      const completion = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You're a veteran bail recovery agent helping a partner work a case. Be direct, tactical, practical.

Talk like a pro: "hit that address", "run down the lead", "door knock", etc.
Give specific advice based on the data. Reference actual addresses and names.
Keep it brief - you're in the field, not writing reports.
If they ask about approach, give tactical advice (best times, what to look for).
If no data yet, tell them to drop a report file or paste the text.

${caseContext}`,
          },
          ...chatMessages.slice(-10).map(m => ({
            role: m.role === 'agent' ? 'assistant' as const : 'user' as const,
            content: m.content,
          })),
          { role: 'user', content: userText },
        ],
        temperature: 0.7,
        max_tokens: 400,
      });

      const response = completion.choices[0]?.message?.content || 'Lost signal.';
      setChatMessages(prev => [...prev, {
        id: Date.now().toString() + '-agent',
        role: 'agent',
        content: response,
        timestamp: new Date(),
      }]);
    } catch (err) {
      setChatMessages(prev => [...prev, {
        id: Date.now().toString() + '-error',
        role: 'agent',
        content: 'Connection error. Check API key.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsSending(false);
      scrollToBottom();
    }
  };

  const openMaps = (address: string) => {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`);
  };

  const callPhone = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Delete Case',
      message: `Delete "${caseData?.name}"? This cannot be undone.`,
      confirmText: 'Delete',
      destructive: true,
    });

    if (confirmed) {
      await deleteCase(id!);
      await deleteCaseDirectory(id!);
      // Clear stored chat and photo
      await AsyncStorage.removeItem(`case_chat_${id}`);
      await AsyncStorage.removeItem(`case_photo_${id}`);
      // Delete from cloud
      const cloudEnabled = await isSyncEnabled();
      if (cloudEnabled) {
        await deleteSyncedCase(id!);
      }
      router.back();
    }
  };

  if (!caseData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={DARK.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Hidden file inputs */}
      {isWeb && (
        <>
          <input
            ref={fileInputRef as any}
            type="file"
            accept=".pdf,.txt,.text,text/plain,application/pdf,image/*"
            multiple
            onChange={handleFileChange as any}
            style={{ display: 'none' }}
          />
          <input
            ref={photoInputRef as any}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange as any}
            style={{ display: 'none' }}
          />
        </>
      )}

      {/* Compact Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={DARK.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.photoContainer}
          onPress={() => photoInputRef.current?.click()}
        >
          {subjectPhoto ? (
            <Image source={{ uri: subjectPhoto }} style={styles.photo} />
          ) : (
            <Ionicons name="person" size={24} color={DARK.textMuted} />
          )}
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <Text style={styles.caseName} numberOfLines={1}>{parsedData?.subject?.fullName || caseData.name}</Text>
          {addresses.length > 0 && (
            <Text style={styles.headerMeta}>{addresses.length} locations • {phones.length} phones</Text>
          )}
        </View>

        <TouchableOpacity style={styles.headerBtn} onPress={() => router.push(`/case/${id}/journey`)}>
          <Ionicons name="navigate" size={22} color={DARK.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerBtn} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={20} color={DARK.danger} />
        </TouchableOpacity>
      </View>

      {/* Chat Area */}
      <ScrollView
        ref={scrollRef}
        style={styles.chatArea}
        contentContainerStyle={styles.chatContent}
        keyboardShouldPersistTaps="handled"
      >
        {chatMessages.map((msg) => {
          // Location card
          if (msg.type === 'locations' && msg.data) {
            return (
              <View key={msg.id} style={styles.dataCard}>
                <Text style={styles.dataCardTitle}>TOP LOCATIONS</Text>
                {msg.data.map((addr: any, idx: number) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.locationRow}
                    onPress={() => openMaps(addr.fullAddress)}
                  >
                    <View style={[styles.rankBadge, idx === 0 && styles.rankBadgeTop]}>
                      <Text style={styles.rankText}>{idx + 1}</Text>
                    </View>
                    <View style={styles.locationInfo}>
                      <Text style={styles.locationAddress} numberOfLines={1}>{addr.fullAddress}</Text>
                      {addr.probability && <Text style={styles.probability}>{addr.probability}%</Text>}
                    </View>
                    <Ionicons name="open-outline" size={16} color={DARK.primary} />
                  </TouchableOpacity>
                ))}
              </View>
            );
          }

          // System message
          if (msg.role === 'system') {
            return (
              <View key={msg.id} style={styles.systemMsg}>
                <Text style={styles.systemMsgText}>{msg.content}</Text>
              </View>
            );
          }

          // Chat bubble
          return (
            <View
              key={msg.id}
              style={[
                styles.chatBubble,
                msg.role === 'user' ? styles.userBubble : styles.agentBubble,
              ]}
            >
              {msg.role === 'agent' && (
                <Text style={styles.agentLabel}>Recovery Agent</Text>
              )}
              <Text style={[styles.chatText, msg.role === 'user' && styles.userText]}>
                {msg.content}
              </Text>
            </View>
          );
        })}

        {(isSending || isProcessingFile) && (
          <View style={[styles.chatBubble, styles.agentBubble]}>
            <ActivityIndicator size="small" color={DARK.primary} />
          </View>
        )}
      </ScrollView>

      {/* Input Area */}
      <View style={styles.inputContainer}>
        <TouchableOpacity
          style={styles.attachBtn}
          onPress={() => fileInputRef.current?.click()}
        >
          <Ionicons name="attach" size={24} color={DARK.textSecondary} />
        </TouchableOpacity>

        <TextInput
          style={styles.textInput}
          placeholder="Message or paste report..."
          placeholderTextColor={DARK.textMuted}
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
          multiline
          maxLength={10000}
        />

        <TouchableOpacity
          style={[styles.sendBtn, (!inputText.trim() || isSending) && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!inputText.trim() || isSending}
        >
          <Ionicons name="send" size={20} color={inputText.trim() && !isSending ? '#fff' : DARK.textMuted} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: DARK.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DARK.surface,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: DARK.border,
    gap: 8,
  },
  backBtn: {
    padding: 4,
  },
  photoContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DARK.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 4,
  },
  caseName: {
    fontSize: 16,
    fontWeight: '700',
    color: DARK.text,
  },
  headerMeta: {
    fontSize: 12,
    color: DARK.textSecondary,
    marginTop: 1,
  },
  headerBtn: {
    padding: 8,
  },
  chatArea: {
    flex: 1,
  },
  chatContent: {
    padding: 16,
    paddingBottom: 20,
  },
  dataCard: {
    backgroundColor: DARK.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: DARK.border,
  },
  dataCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: DARK.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: DARK.border,
    gap: 10,
  },
  rankBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: DARK.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeTop: {
    backgroundColor: DARK.danger,
  },
  rankText: {
    fontSize: 11,
    fontWeight: '700',
    color: DARK.text,
  },
  locationInfo: {
    flex: 1,
  },
  locationAddress: {
    fontSize: 13,
    color: DARK.text,
  },
  probability: {
    fontSize: 11,
    color: DARK.success,
    fontWeight: '600',
  },
  systemMsg: {
    alignSelf: 'center',
    backgroundColor: DARK.surfaceHover,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginVertical: 8,
  },
  systemMsgText: {
    fontSize: 12,
    color: DARK.textSecondary,
  },
  chatBubble: {
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
    maxWidth: '85%',
  },
  userBubble: {
    backgroundColor: DARK.primary,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  agentBubble: {
    backgroundColor: DARK.surface,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: DARK.border,
  },
  agentLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: DARK.primary,
    marginBottom: 4,
  },
  chatText: {
    fontSize: 14,
    color: DARK.text,
    lineHeight: 20,
  },
  userText: {
    color: '#fff',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    backgroundColor: DARK.surface,
    borderTopWidth: 1,
    borderTopColor: DARK.border,
    gap: 8,
  },
  attachBtn: {
    padding: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: DARK.bg,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: DARK.text,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: DARK.border,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DARK.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: DARK.surfaceHover,
  },
});
