import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Linking,
  ActivityIndicator,
  Image,
  Modal,
  useWindowDimensions,
  RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCase } from '@/hooks/useCase';
import { useSettings } from '@/hooks/useSettings';
import { deleteCase, updateCase } from '@/lib/database';
import { deleteCaseDirectory } from '@/lib/storage';
import { confirm } from '@/lib/confirm';
import { syncChat, syncPhoto, fetchSyncedChat, fetchSyncedPhoto, isSyncEnabled } from '@/lib/sync';
import {
  // AISquadOrchestrator disabled - using backend proxy
  type AgentMessage,
  type RankedLocation,
} from '@/lib/ai-squad';
import {
  performOSINTSearch,
  type ProfileCheckResult,
  type PeopleSearchResult,
} from '@/lib/osint-service';
import {
  FaceMatchingService,
  type FacialFeatures,
} from '@/lib/face-match';
import {
  fullOSINTSweep,
  type UsernameSearchResult,
  type PersonSearchResult,
} from '@/lib/osint-api';
import {
  photoIntelligence,
  type PhotoIntelligence,
} from '@/lib/photo-intelligence';
import {
  analyzeSubject,
  formatSubjectAnalysisForChat,
  type SubjectAnalysis,
} from '@/lib/subject-analysis';
import {
  smartOsintSearch,
  checkBackendHealth,
  investigatePerson,
  type InvestigationResult,
} from '@/lib/python-osint';
import { buildTracePrompt } from '@/prompts';
import {
  loadCaseIntel,
  saveCaseIntel,
  parseActions,
  applyAction,
  applyActions,
  intelSummary,
  type CaseIntel,
} from '@/lib/case-intel';

const DARK = {
  bg: '#000000',
  surface: '#0a0a0a',
  surfaceHover: '#18181b',
  border: '#27272a',
  primary: '#dc2626',
  primaryDim: '#991b1b',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  text: '#fafafa',
  textSecondary: '#a1a1aa',
  textMuted: '#71717a',
  facebook: '#1877f2',
  instagram: '#e4405f',
  tiktok: '#000000',
  twitter: '#1da1f2',
  linkedin: '#0a66c2',
};

interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: Date;
}

interface UploadedFile {
  id: string;
  name: string;
  type: 'pdf' | 'image' | 'text' | 'doc';
  uploadedAt: Date;
  extractedText?: string; // Store the raw text for follow-up questions
}

interface SocialProfile {
  platform: string;
  username: string;
  url: string;
  status: 'found' | 'searching' | 'not_found';
}

interface AgentInsight {
  id: string;
  messageId: string;
  preview: string;
  fullText: string;
  capturedAt: string;
  addedToReport: boolean;
}

// Generate comprehensive social search profiles
const generateSocialProfiles = (rawName: string): SocialProfile[] => {
  const fullName = normalizeName(rawName) || rawName;
  const nameParts = fullName.toLowerCase().split(' ').filter(p => p.length > 0);
  const first = nameParts[0] || '';
  const last = nameParts[nameParts.length - 1] || '';
  const middle = nameParts.length > 2 ? nameParts[1] : '';

  // Username variations
  const variations = [
    `${first}${last}`,
    `${first}.${last}`,
    `${first}_${last}`,
    `${last}${first}`,
    `${first}${last}${Math.floor(Math.random() * 99)}`,
    middle ? `${first}${middle[0]}${last}` : `${first}${last}`,
  ].filter((v, i, arr) => arr.indexOf(v) === i);

  const baseUsername = variations[0];

  return [
    // Social Media
    { platform: 'Facebook', username: fullName, url: `https://www.facebook.com/search/people/?q=${encodeURIComponent(fullName)}`, status: 'searching' },
    { platform: 'Instagram', username: baseUsername, url: `https://www.instagram.com/${baseUsername}/`, status: 'searching' },
    { platform: 'TikTok', username: baseUsername, url: `https://www.tiktok.com/@${baseUsername}`, status: 'searching' },
    { platform: 'Twitter/X', username: baseUsername, url: `https://twitter.com/search?q=${encodeURIComponent(fullName)}&f=user`, status: 'searching' },
    { platform: 'LinkedIn', username: fullName, url: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(fullName)}`, status: 'searching' },
    { platform: 'Snapchat', username: baseUsername, url: `https://www.snapchat.com/add/${baseUsername}`, status: 'searching' },

    // People Search / Public Records
    { platform: 'TruePeopleSearch', username: fullName, url: `https://www.truepeoplesearch.com/results?name=${encodeURIComponent(fullName)}`, status: 'searching' },
    { platform: 'FastPeopleSearch', username: fullName, url: `https://www.fastpeoplesearch.com/name/${encodeURIComponent(fullName.replace(/ /g, '-'))}`, status: 'searching' },
    { platform: 'Whitepages', username: fullName, url: `https://www.whitepages.com/name/${encodeURIComponent(fullName.replace(/ /g, '-'))}`, status: 'searching' },
    { platform: 'Spokeo', username: fullName, url: `https://www.spokeo.com/${encodeURIComponent(fullName.replace(/ /g, '-'))}`, status: 'searching' },

    // Court Records
    { platform: 'CourtListener', username: fullName, url: `https://www.courtlistener.com/?q=${encodeURIComponent(fullName)}`, status: 'searching' },

    // Scam/Romance Fraud
    { platform: 'Catfish', username: fullName, url: `https://www.social-catfish.com/search/results?q=${encodeURIComponent(fullName)}`, status: 'searching' },
    { platform: 'ScamDigger', username: fullName, url: `https://scamdigger.com/search?q=${encodeURIComponent(fullName)}`, status: 'searching' },
    { platform: 'RomanceScam', username: fullName, url: `https://www.romancescam.com/search/?q=${encodeURIComponent(fullName)}`, status: 'searching' },
  ];
};

// Username search tool (Sherlock-style)
const generateUsernameSearchUrl = (username: string): string => {
  return `https://whatsmyname.app/?q=${encodeURIComponent(username)}`;
};

const isWeb = Platform.OS === 'web';

// Generate unique ID to avoid React key collisions
const uniqueId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const compressImage = (dataUrl: string, maxWidth = 400, quality = 0.7): Promise<string> => {
  return new Promise((resolve) => {
    if (!isWeb) { resolve(dataUrl); return; }
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ratio = Math.min(maxWidth / img.width, maxWidth / img.height, 1);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};

// Normalize name from "LAST, First Middle" to "First Middle Last" for OSINT searches
const normalizeName = (name: string | undefined | null): string => {
  if (!name || typeof name !== 'string') return '';

  // Check if name is in "LAST, First" format
  if (name.includes(',')) {
    const parts = name.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      // "KNOTEN, Sandra L" -> "Sandra L Knoten"
      const lastName = parts[0];
      const firstMiddle = parts.slice(1).join(' ');
      return `${firstMiddle} ${lastName}`.trim();
    }
  }

  return name.trim();
};

// Deduce relationship based on context clues (detective reasoning)
const deduceRelationship = (
  associateSubject: any,
  primaryTarget: any,
  sharedVehicles: any[]
): string => {
  // Check for shared vehicle - indicates close relationship
  const hasSharedVehicle = sharedVehicles && sharedVehicles.length > 0;

  // Try to calculate age difference from DOBs
  let ageDiff = 0;
  try {
    const assocDob = associateSubject?.dob;
    const targetDob = primaryTarget?.dob;
    if (assocDob && targetDob && typeof assocDob === 'string' && typeof targetDob === 'string') {
      const assocYear = parseInt(assocDob.split('/').pop() || '0');
      const targetYear = parseInt(targetDob.split('/').pop() || '0');
      if (assocYear > 1900 && targetYear > 1900) {
        ageDiff = assocYear - targetYear; // Negative = associate is older
      }
    }
  } catch (e) {
    // Ignore parsing errors
  }

  // Deduce relationship based on clues
  if (ageDiff < -15) {
    // Associate is 15+ years older
    if (hasSharedVehicle) {
      return 'parent (co-owned vehicle)';
    }
    return 'likely parent';
  }

  if (ageDiff > 15) {
    // Associate is 15+ years younger
    return 'likely child';
  }

  if (Math.abs(ageDiff) <= 10 && ageDiff !== 0) {
    // Similar age
    if (hasSharedVehicle) {
      return 'spouse/partner (co-owned vehicle)';
    }
    return 'sibling or partner';
  }

  // Default based on shared vehicle
  if (hasSharedVehicle) {
    return 'family (co-owned vehicle)';
  }

  return 'associate';
};

export default function CaseDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width: screenWidth } = useWindowDimensions();
  const isMobile = screenWidth < 768;
  const { caseData, reports, refresh, analyzeText } = useCase(id!);
  const { settings } = useSettings();
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoaded, setChatLoaded] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [subjectPhoto, setSubjectPhoto] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  // Orchestrator disabled - using backend proxy for chat
  const [squadLocations, setSquadLocations] = useState<RankedLocation[]>([]);
  const [socialProfiles, setSocialProfiles] = useState<SocialProfile[]>([]);
  const [osintResults, setOsintResults] = useState<ProfileCheckResult[]>([]);
  const [peopleSearchResults, setPeopleSearchResults] = useState<PeopleSearchResult[]>([]);
  const [isSearchingOSINT, setIsSearchingOSINT] = useState(false);
  const [osintSearched, setOsintSearched] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [facialFeatures, setFacialFeatures] = useState<FacialFeatures | null>(null);
  const [isExtractingFace, setIsExtractingFace] = useState(false);
  const [faceMatchService, setFaceMatchService] = useState<FaceMatchingService | null>(null);
  const [photoIntel, setPhotoIntel] = useState<PhotoIntelligence | null>(null);
  const [allPhotoIntel, setAllPhotoIntel] = useState<PhotoIntelligence[]>([]);  // Store ALL photo analysis results
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const [subjectAnalysisResult, setSubjectAnalysisResult] = useState<SubjectAnalysis | null>(null);
  const [isAnalyzingSubject, setIsAnalyzingSubject] = useState(false);
  const [tacticalAdvice, setTacticalAdvice] = useState<string[]>([]);
  const [selectedLinkNode, setSelectedLinkNode] = useState<string | null>(null); // For link analysis interactivity
  const [editingLinkRel, setEditingLinkRel] = useState<string | null>(null); // Which node is editing relationship
  const [showAddAssociate, setShowAddAssociate] = useState(false);
  const [newAssocName, setNewAssocName] = useState('');
  const [newAssocRel, setNewAssocRel] = useState('associate');
  const [pythonBackendAvailable, setPythonBackendAvailable] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<TextInput>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);

  const latestReport = reports[0];
  const parsedData = latestReport?.parsedData;
  const addresses = parsedData?.addresses || [];
  const phones = parsedData?.phones || [];
  const baseRelatives = parsedData?.relatives || [];

  // Discovered associates from analyzing associate documents (stored separately)
  const [discoveredAssociates, setDiscoveredAssociates] = useState<any[]>([]);

  // Case intelligence - persistent store for AI/user modifications
  const [caseIntel, setCaseIntel] = useState<CaseIntel | null>(null);
  const [intelRefreshing, setIntelRefreshing] = useState(false);

  // Agent Insights - auto-captured substantive AI messages
  const [agentInsights, setAgentInsights] = useState<AgentInsight[]>([]);
  const [insightsExpanded, setInsightsExpanded] = useState(!isMobile);
  const [expandedInsightId, setExpandedInsightId] = useState<string | null>(null);
  const insightsCapturedRef = useRef<Set<string>>(new Set());

  // Merge base relatives with discovered associates for display
  const relatives = [...baseRelatives, ...discoveredAssociates].filter(
    (rel, idx, arr) => arr.findIndex(r => r.name?.toLowerCase() === rel.name?.toLowerCase()) === idx
  );

  // --- Agent Insight capture logic ---
  const PROCESSING_PREFIXES = ['Extracting', 'Analyzing', 'Re-analyzing', 'Searching', 'Comparing', 'Processing', 'Running'];
  const STATUS_PREFIXES = ['[ERROR]', '[WARN]', '[OK]', '[FOUND]'];

  const shouldCaptureInsight = useCallback((msg: ChatMessage): boolean => {
    if (msg.role !== 'agent') return false;
    if (msg.content.length <= 150) return false;
    const trimmed = msg.content.trimStart();
    if (PROCESSING_PREFIXES.some(p => trimmed.startsWith(p))) return false;
    if (STATUS_PREFIXES.some(p => trimmed.startsWith(p))) return false;
    if (trimmed.includes('FACE BIOMETRICS EXTRACTED')) return false;
    return true;
  }, []);

  const extractPreview = useCallback((text: string): string => {
    // Split on sentence boundaries and take first 2 sentences
    const sentences = text.match(/[^.!?\n]+[.!?]+[\s]*/g);
    if (sentences && sentences.length >= 2) {
      return (sentences[0] + sentences[1]).trim();
    }
    if (sentences && sentences.length === 1) {
      return sentences[0].trim();
    }
    // Fallback: first 200 chars
    return text.slice(0, 200).trim() + (text.length > 200 ? '...' : '');
  }, []);

  // Auto-capture insights from new agent messages
  useEffect(() => {
    if (chatMessages.length === 0) return;
    const lastMsg = chatMessages[chatMessages.length - 1];
    if (insightsCapturedRef.current.has(lastMsg.id)) return;
    if (!shouldCaptureInsight(lastMsg)) return;
    insightsCapturedRef.current.add(lastMsg.id);
    setAgentInsights(prev => [...prev, {
      id: uniqueId(),
      messageId: lastMsg.id,
      preview: extractPreview(lastMsg.content),
      fullText: lastMsg.content,
      capturedAt: new Date().toISOString(),
      addedToReport: false,
    }]);
  }, [chatMessages, shouldCaptureInsight, extractPreview]);

  const formatInsightTime = useCallback((iso: string): string => {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const hours = d.getHours();
    const mins = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h = hours % 12 || 12;
    if (sameDay) return `${h}:${mins} ${ampm}`;
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}, ${h}:${mins} ${ampm}`;
  }, []);

  const addInsightToReport = useCallback(async (insight: AgentInsight) => {
    if (!caseIntel || !id || insight.addedToReport) return;
    const { intel: updated } = applyAction(caseIntel, { type: 'ADD_NOTE', text: insight.fullText });
    await saveCaseIntel(updated);
    setCaseIntel(updated);
    setAgentInsights(prev => prev.map(i =>
      i.id === insight.id ? { ...i, addedToReport: true } : i
    ));
  }, [caseIntel, id]);

  // Load saved data — all local reads in parallel for speed
  useEffect(() => {
    if (id) {
      const loadData = async () => {
        // Parallel local reads (instant from AsyncStorage)
        const [localPhoto, localChat, localSocial, localPhotoIntel, localAssociates, intel, localInsights] =
          await Promise.all([
            AsyncStorage.getItem(`case_photo_${id}`),
            AsyncStorage.getItem(`case_chat_${id}`),
            AsyncStorage.getItem(`case_social_${id}`),
            AsyncStorage.getItem(`case_all_photo_intel_${id}`),
            AsyncStorage.getItem(`case_associates_${id}`),
            loadCaseIntel(id),
            AsyncStorage.getItem(`case_insights_${id}`),
          ]);

        if (localPhoto) setSubjectPhoto(localPhoto);
        if (localChat) {
          try {
            const parsed = JSON.parse(localChat);
            setChatMessages(parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })));
          } catch (e) {}
        }
        if (localSocial) { try { setSocialProfiles(JSON.parse(localSocial)); } catch (e) {} }
        if (localPhotoIntel) { try { setAllPhotoIntel(JSON.parse(localPhotoIntel)); } catch (e) {} }
        if (localAssociates) { try { setDiscoveredAssociates(JSON.parse(localAssociates)); } catch (e) {} }
        if (localInsights) {
          try {
            const parsed = JSON.parse(localInsights) as AgentInsight[];
            setAgentInsights(parsed);
            // Mark their message IDs as already captured
            parsed.forEach(i => insightsCapturedRef.current.add(i.messageId));
          } catch (e) {}
        }
        setCaseIntel(intel);
        setChatLoaded(true);

        // Cloud sync in background — don't block UI
        isSyncEnabled().then(async (cloudEnabled) => {
          if (!cloudEnabled) return;
          const [cloudChat, cloudPhoto] = await Promise.all([
            fetchSyncedChat(id).catch(() => null),
            fetchSyncedPhoto(id).catch(() => null),
          ]);
          if (cloudChat && cloudChat.length > 0) {
            const localMsgs = localChat ? JSON.parse(localChat) : [];
            if (cloudChat.length > localMsgs.length) {
              setChatMessages(cloudChat.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })));
              AsyncStorage.setItem(`case_chat_${id}`, JSON.stringify(cloudChat)).catch(() => {});
            }
          }
          if (cloudPhoto && !localPhoto) {
            setSubjectPhoto(cloudPhoto);
            AsyncStorage.setItem(`case_photo_${id}`, cloudPhoto).catch(() => {});
          }
        }).catch(() => {});
      };
      loadData();
    }
  }, [id]);

  // Save chat (debounced — don't write on every single message)
  useEffect(() => {
    if (!id || !chatLoaded || chatMessages.length === 0) return;
    const timer = setTimeout(() => {
      AsyncStorage.setItem(`case_chat_${id}`, JSON.stringify(chatMessages)).catch(() => {});
      isSyncEnabled().then((enabled) => {
        if (enabled) syncChat(id, chatMessages);
      }).catch(() => {});
    }, 1000);
    return () => clearTimeout(timer);
  }, [id, chatMessages, chatLoaded]);

  // Save agent insights (debounced)
  useEffect(() => {
    if (!id || agentInsights.length === 0) return;
    const timer = setTimeout(() => {
      AsyncStorage.setItem(`case_insights_${id}`, JSON.stringify(agentInsights)).catch(() => {});
    }, 1000);
    return () => clearTimeout(timer);
  }, [id, agentInsights]);

  // Save social profiles
  useEffect(() => {
    if (id && socialProfiles.length > 0) {
      AsyncStorage.setItem(`case_social_${id}`, JSON.stringify(socialProfiles));
    }
  }, [id, socialProfiles]);

  // Save all photo intel results
  useEffect(() => {
    if (id && allPhotoIntel.length > 0) {
      AsyncStorage.setItem(`case_all_photo_intel_${id}`, JSON.stringify(allPhotoIntel));
    }
  }, [id, allPhotoIntel]);

  // Save discovered associates
  useEffect(() => {
    if (id && discoveredAssociates.length > 0) {
      AsyncStorage.setItem(`case_associates_${id}`, JSON.stringify(discoveredAssociates));
    }
  }, [id, discoveredAssociates]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  // Native DOM drag-and-drop handlers for web
  useEffect(() => {
    if (!isWeb) return;

    // Use document.getElementById with nativeID (more reliable than refs in RN Web)
    const node = document.getElementById('chat-drop-zone');
    if (!node) return;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(true);
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Only set false if we're leaving the drop zone entirely
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;
      if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
        setIsDragOver(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = e.dataTransfer?.files;
      if (files?.length > 0 && fileInputRef.current) {
        const dt = new DataTransfer();
        for (let i = 0; i < files.length; i++) {
          dt.items.add(files[i]);
        }
        fileInputRef.current.files = dt.files;
        fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
      }
    };

    node.addEventListener('dragenter', handleDragEnter);
    node.addEventListener('dragover', handleDragOver);
    node.addEventListener('dragleave', handleDragLeave);
    node.addEventListener('drop', handleDrop);

    return () => {
      node.removeEventListener('dragenter', handleDragEnter);
      node.removeEventListener('dragover', handleDragOver);
      node.removeEventListener('dragleave', handleDragLeave);
      node.removeEventListener('drop', handleDrop);
    };
  }, [isWeb]);

  // Initialize Face Matching Service (no API key needed - uses backend proxy)
  useEffect(() => {
    setFaceMatchService(new FaceMatchingService());
  }, []);

  // Check Python OSINT backend availability
  useEffect(() => {
    const checkPythonBackend = async () => {
      const health = await checkBackendHealth();
      if (health && health.status === 'healthy') {
        setPythonBackendAvailable(true);
        console.log('Python OSINT backend available:', health.tools);
      }
    };
    checkPythonBackend();
  }, []);

  // Extract facial features when photo is set
  useEffect(() => {
    const extractFacialFeatures = async () => {
      if (subjectPhoto && faceMatchService && !facialFeatures && !isExtractingFace) {
        setIsExtractingFace(true);

        setChatMessages(prev => [...prev, {
          id: uniqueId(),
          role: 'agent',
          content: 'FACE ANALYSIS: Extracting facial biometrics for matching...',
          timestamp: new Date(),
        }]);

        try {
          const result = await faceMatchService.setTargetFace(subjectPhoto);

          if (result.success && result.features) {
            setFacialFeatures(result.features);

            // Save features
            if (id) {
              AsyncStorage.setItem(`case_face_${id}`, JSON.stringify(result.features));
            }

            setChatMessages(prev => [...prev, {
              id: uniqueId(),
              role: 'agent',
              content: `FACE BIOMETRICS EXTRACTED

Bone Structure:
- Face: ${result.features.faceShape}, ${result.features.jawline} jaw
- Cheekbones: ${result.features.cheekbones}

Eyes:
- Shape: ${result.features.eyeShape}, ${result.features.eyeSpacing} spacing
- Color: ${result.features.eyeColor}

Nose:
- ${result.features.noseShape}, ${result.features.noseWidth} width

Distinctive:
${result.features.distinctiveFeatures?.length > 0 ? result.features.distinctiveFeatures.map(f => `- ${f}`).join('\n') : '- None noted'}

*Use this profile to match against any photo.*`,
              timestamp: new Date(),
            }]);
          } else {
            // Silent failure - face extraction is optional
            console.log('Face extraction skipped:', result.error);
          }
        } catch (err: any) {
          // Silent failure - don't clutter chat with face errors
          console.log('Face extraction skipped:', err?.message);
        }

        setIsExtractingFace(false);
        scrollToBottom();
      }
    };

    // Load saved features first
    const loadSavedFeatures = async () => {
      if (id) {
        const saved = await AsyncStorage.getItem(`case_face_${id}`);
        if (saved) {
          try {
            setFacialFeatures(JSON.parse(saved));
          } catch (e) {}
        }
      }
    };

    loadSavedFeatures().then(() => {
      if (!facialFeatures) extractFacialFeatures();
    });
  }, [subjectPhoto, faceMatchService, id]);

  // AI Squad Orchestrator disabled - using backend proxy for chat instead
  // This eliminates duplicate "Investigation initialized" messages and removes API key requirement

  // Check if a name is a valid subject name (not a placeholder) - defined early for use in effects
  const isValidSubjectName = useCallback((name: string | undefined | null): boolean => {
    if (!name || typeof name !== 'string') return false;
    const trimmed = name.trim().toLowerCase();
    const placeholders = ['?', 'unknown', 'subject', 'test', 'new', 'new case', ''];
    return !placeholders.includes(trimmed) && trimmed.length >= 2;
  }, []);

  // Auto-run OSINT search when we have a valid target name (not "Unknown" or "?")
  useEffect(() => {
    // Get best available name, skip placeholders like "?"
    const subjectName = parsedData?.subject?.fullName;
    const caseName = caseData?.name;
    const validName = isValidSubjectName(subjectName) ? subjectName : (isValidSubjectName(caseName) ? caseName : null);

    if (validName && !osintSearched && !isSearchingOSINT) {
      runOSINTSearch(validName);
    }
  }, [parsedData?.subject?.fullName, caseData?.name, osintSearched, isValidSubjectName]);

  // Generate username variations from a name
  const generateUsernameVariations = (fullName: string): string[] => {
    const nameParts = fullName.toLowerCase().split(' ').filter(p => p.length > 0);
    const first = nameParts[0] || '';
    const last = nameParts[nameParts.length - 1] || '';
    const middle = nameParts.length > 2 ? nameParts[1] : '';
    const firstInitial = first[0] || '';
    const lastInitial = last[0] || '';

    const variations = [
      // Common patterns
      `${first}${last}`,           // amandadriskell
      `${first}_${last}`,          // amanda_driskell
      `${first}.${last}`,          // amanda.driskell
      `${first}-${last}`,          // amanda-driskell
      `${last}${first}`,           // driskellamanda
      `${firstInitial}${last}`,    // adriskell
      `${first}${lastInitial}`,    // amandad
      `${first}${last[0]}`,        // amandad
      `${firstInitial}.${last}`,   // a.driskell
      `${first}_${lastInitial}`,   // amanda_d
      `${last}_${first}`,          // driskell_amanda
      `${last}${firstInitial}`,    // driskella
      `${first}${last}1`,          // amandadriskell1
      `${first}${last}123`,        // amandadriskell123
      `${first}_${last}_`,         // amanda_driskell_
      `_${first}${last}`,          // _amandadriskell
      `${first}official`,          // amandaofficial
      `real${first}${last}`,       // realamandadriskell
      `the${first}${last}`,        // theamandadriskell
      // With middle name/initial if exists
      ...(middle ? [
        `${first}${middle[0]}${last}`,  // amandajdriskell
        `${first}_${middle[0]}_${last}`, // amanda_j_driskell
      ] : []),
    ];

    // Remove duplicates and empty strings
    return [...new Set(variations.filter(v => v.length > 2))];
  };

  const runOSINTSearch = async (fullName: string, email?: string) => {
    setIsSearchingOSINT(true);
    setOsintSearched(true);

    // Check if we have mugshot for photo verification
    const hasMugshot = subjectPhoto || caseData?.mugshotUrl;
    const demographics = caseData?.rosterData?.inmate ? {
      race: caseData.rosterData.inmate.race || caseData.rosterData.inmate.Race,
      sex: caseData.rosterData.inmate.sex || caseData.rosterData.inmate.Sex,
      age: caseData.rosterData.inmate.age || caseData.rosterData.inmate.Age,
    } : null;

    try {
      if (pythonBackendAvailable) {
        // Use Python backend
        const investigation = await investigatePerson(fullName, email);

        // Update social profiles
        const updatedProfiles = generateSocialProfiles(fullName).map(profile => {
          const foundMatch = investigation.confirmed_profiles.find(p =>
            p.platform.toLowerCase().includes(profile.platform.toLowerCase().split('/')[0]) ||
            profile.platform.toLowerCase().includes(p.platform.toLowerCase())
          );
          return foundMatch ? { ...profile, status: 'found' as const, url: foundMatch.url } : profile;
        });
        setSocialProfiles(updatedProfiles);

        // Store results
        setOsintResults(investigation.confirmed_profiles.map(p => ({
          platform: p.platform,
          username: p.username || '',
          exists: true,
          profileUrl: p.url,
          confidence: 95,
        })));

        setPeopleSearchResults(investigation.people_search_links.map(l => ({
          source: l.name,
          url: l.url,
          status: 'unknown' as const,
        })));

        // Single summary message with actionable OSINT instructions
        const found = investigation.confirmed_profiles.length;
        let resultMessage = '';

        if (found > 0) {
          resultMessage = `[FOUND]${found} PROFILES FOUND** for "${fullName}"\n\n`;
          resultMessage += investigation.confirmed_profiles.slice(0, 5).map(p =>
            `${p.platform}: ${p.url}`
          ).join('\n');
          if (found > 5) resultMessage += `\n• +${found - 5} more`;

          resultMessage += `\n\n[REPORT]OSINT CHECKLIST:**`;
          resultMessage += `\n1. Open each profile and compare photo to mugshot`;
          resultMessage += `\n2. Check for current location in bio/posts`;
          resultMessage += `\n3. Note friends/family who comment often`;
          resultMessage += `\n4. Look for check-ins or tagged locations`;
          resultMessage += `\n5. Screenshot anything useful`;

          if (hasMugshot) {
            const demographicInfo = demographics
              ? `\n\n[PERSON]Match Against:** ${demographics.race || ''} ${demographics.sex || ''}, Age ${demographics.age || 'Unknown'}`
              : '';
            resultMessage += demographicInfo;
          }

          resultMessage += `\n\n[TIP]Found intel?** Tell me: "add [name] as [relationship]" or paste any addresses/phones you find.`;
        } else {
          resultMessage = `[ERROR]No confirmed profiles for "${fullName}".\n\n`;
          resultMessage += `Try manually:\n`;
          resultMessage += `• Facebook People Search\n`;
          resultMessage += `• Search nicknames or aliases\n`;
          resultMessage += `• Search family members' profiles\n`;
          resultMessage += `\nUse the search links in OSINT TOOLS →`;
        }

        setChatMessages(prev => [...prev, {
          id: uniqueId(),
          role: 'agent',
          content: resultMessage,
          timestamp: new Date(),
        }]);

      } else {
        // Fallback to JS search
        await runJSFallbackSearch(fullName);
      }
    } catch (error: any) {
      console.error('OSINT error:', error);
      await runJSFallbackSearch(fullName);
    }

    setIsSearchingOSINT(false);
    scrollToBottom();
  };

  // JS fallback search
  const runJSFallbackSearch = async (fullName: string) => {
    try {
      const localResults = await performOSINTSearch(fullName, { checkAllVariations: true });
      setOsintResults(localResults.profiles);
      setPeopleSearchResults(localResults.peopleSearchResults);

      const updatedProfiles = generateSocialProfiles(fullName).map(profile => {
        const osintResult = localResults.profiles.find(r =>
          r.platform.toLowerCase() === profile.platform.toLowerCase()
        );
        if (osintResult) {
          return {
            ...profile,
            status: osintResult.exists === true ? 'found' as const :
                    osintResult.exists === false ? 'not_found' as const : 'searching' as const,
            url: osintResult.profileUrl || profile.url,
          };
        }
        return profile;
      });
      setSocialProfiles(updatedProfiles);

      setChatMessages(prev => [...prev, {
        id: uniqueId(),
        role: 'agent',
        content: `[OK]Local OSINT complete. Found ${localResults.profiles.filter(p => p.exists === true).length} profiles.`,
        timestamp: new Date(),
      }]);
    } catch (localError: any) {
      setChatMessages(prev => [...prev, {
        id: uniqueId(),
        role: 'agent',
        content: `[WARN]OSINT search error: ${localError?.message || 'Unknown error'}. Try manual search links.`,
        timestamp: new Date(),
      }]);
    }
  };

  // Get the subject name - ALWAYS use the user-entered case name
  // IMPORTANT: The target name is set ONLY by the user. It should NEVER be auto-replaced.
  // Format should be "First Last" (no middle name) for best OSINT results.
  const getSubjectName = useCallback(() => {
    // Priority: USER-ENTERED CASE NAME > primaryTarget > roster data > 'Subject'
    // We NEVER use parsedData.subject.fullName because documents may have
    // different name formats (Last, First) that break OSINT searches.
    // All returns are normalized to "First Last" format for OSINT/social URLs.
    if (caseData?.name && isValidSubjectName(caseData.name)) {
      return normalizeName(caseData.name) || caseData.name;
    }
    if (caseData?.primaryTarget?.fullName && isValidSubjectName(caseData.primaryTarget.fullName)) {
      return normalizeName(caseData.primaryTarget.fullName) || caseData.primaryTarget.fullName;
    }
    if (caseData?.rosterData?.inmate?.name && isValidSubjectName(caseData.rosterData.inmate.name)) {
      return normalizeName(caseData.rosterData.inmate.name) || caseData.rosterData.inmate.name;
    }
    return 'Subject';
  }, [caseData]);

  // Init greeting
  useEffect(() => {
    if (caseData && chatLoaded && chatMessages.length === 0) {
      const subjectName = getSubjectName();
      setChatMessages([{
        id: 'greeting',
        role: 'agent',
        content: latestReport
          ? `[TARGET]${subjectName}** - ${addresses.length} addresses, ${phones.length} phones.`
          : `[SEARCH]${subjectName}** - Drop files or paste report data.`,
        timestamp: new Date(),
      }]);
    }
  }, [caseData, latestReport, chatLoaded, chatMessages.length, getSubjectName]);

  // Auto-update case name when documents reveal real name (if current name is placeholder)
  useEffect(() => {
    const updateCaseNameIfNeeded = async () => {
      if (!caseData?.id) return;

      // IMPORTANT: Target name is ONLY set by the user manually
      // We no longer auto-update case name from parsed documents
      // This prevents confusion during OSINT analysis when names change unexpectedly
      // The user types the fugitive's name exactly as they want it searched
    };

    updateCaseNameIfNeeded();
  }, [caseData?.id, caseData?.name]);

  const scrollToBottom = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

  const openMaps = (address: string) => {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`);
  };

  const openUrl = (url: string) => {
    Linking.openURL(url);
  };

  // Analyze photo for investigative intelligence
  const analyzePhotoForIntel = async (imageData: string, fileName?: string) => {
    console.log('[PhotoIntel] Starting analysis for:', fileName);
    setIsAnalyzingPhoto(true);
    try {
      const intel = await photoIntelligence.analyzePhoto(imageData, fileName);
      console.log('[PhotoIntel] Analysis result:', intel ? 'Success' : 'No result', 'Addresses:', intel?.addresses?.length);
      if (intel) {
        setPhotoIntel(intel);
        setAllPhotoIntel(prev => [...prev, intel]);  // Accumulate all photo intel
        // Don't generate tactical advice automatically - wait for user to request it

        // Build detailed message for chat
        const parts: string[] = [`[PHOTO]PHOTO INTELLIGENCE REPORT**${intel.sourceFileName ? ` - ${intel.sourceFileName}` : ''}\n`];

        // EXIF METADATA - Display first as it's highest priority
        if (intel.exifData) {
          if (intel.exifData.gps) {
            parts.push(`\n[TARGET]CRITICAL: GPS LOCATION FOUND!**`);
            parts.push(`Coordinates: ${intel.exifData.gps.latitude.toFixed(6)}, ${intel.exifData.gps.longitude.toFixed(6)}`);
            parts.push(`[Open in Google Maps](${intel.exifData.gps.googleMapsUrl})`);
          }
          if (intel.exifData.dateTime?.original) {
            parts.push(`\n[DATE]Photo Taken:** ${intel.exifData.dateTime.original}`);
          }
          if (intel.exifData.device) {
            const device = [intel.exifData.device.make, intel.exifData.device.model].filter(Boolean).join(' ');
            if (device) {
              parts.push(`[DEVICE]Device:** ${device}`);
            }
          }
          if (intel.exifData.gps || intel.exifData.dateTime?.original) {
            parts.push(''); // Empty line after EXIF section
          }
        }

        if (intel.addresses.length > 0) {
          parts.push(`\n[ADDRESS]ADDRESSES DETECTED (${intel.addresses.length}):**`);
          intel.addresses.forEach(a => {
            parts.push(`• "${a.text}" (${a.confidence} confidence) - ${a.context}`);
          });
        }

        if (intel.vehicles.length > 0) {
          parts.push(`\n[VEHICLES]VEHICLES DETECTED (${intel.vehicles.length}):**`);
          intel.vehicles.forEach(v => {
            const plateInfo = v.licensePlate ? ` - PLATE: ${v.licensePlate}${v.plateState ? ` (${v.plateState})` : ''}` : '';
            parts.push(`• ${v.color} ${v.make || ''} ${v.model || ''} ${v.type}${plateInfo}`);
          });
        }

        if (intel.businesses.length > 0) {
          parts.push(`\n[BUSINESS]BUSINESSES/LANDMARKS (${intel.businesses.length}):**`);
          intel.businesses.forEach(b => {
            parts.push(`• ${b.name} (${b.type})`);
          });
        }

        if (intel.people.length > 0) {
          parts.push(`\n[CONTACTS]PEOPLE IN PHOTO (${intel.people.length}):**`);
          intel.people.forEach(p => {
            parts.push(`• ${p.description} - ${p.clothing}`);
            if (p.distinguishingFeatures?.length > 0) {
              parts.push(`  Features: ${p.distinguishingFeatures.join(', ')}`);
            }
          });
        }

        if (intel.geography.length > 0) {
          parts.push(`\n[GEO]GEOGRAPHIC INDICATORS:**`);
          intel.geography.forEach(g => {
            parts.push(`• ${g.indicator}${g.possibleRegion ? ` → Possible: ${g.possibleRegion}` : ''}`);
          });
        }

        if (intel.leads.length > 0) {
          const highPriority = intel.leads.filter(l => l.priority === 'high');
          if (highPriority.length > 0) {
            parts.push(`\n[WARNING]HIGH PRIORITY LEADS (${highPriority.length}):**`);
            highPriority.forEach(l => {
              parts.push(`• ${l.description}`);
              parts.push(`  Action: ${l.actionItem}`);
            });
          }
        }

        parts.push(`\n[LOCATION]SETTING:** ${intel.metadata.settingType} (${intel.metadata.indoorOutdoor})`);
        parts.push(`TIME: ${intel.metadata.estimatedTimeOfDay}, ${intel.metadata.estimatedSeason}`);

        setChatMessages(prev => [...prev, {
          id: uniqueId(),
          role: 'agent',
          content: parts.join('\n'),
          timestamp: new Date(),
        }]);

        scrollToBottom();
      } else {
        setChatMessages(prev => [...prev, {
          id: uniqueId(),
          role: 'agent',
          content: '[WARN]Could not analyze photo. Backend may be unavailable - try again in a moment.',
          timestamp: new Date(),
        }]);
      }
    } catch (error: any) {
      setChatMessages(prev => [...prev, {
        id: uniqueId(),
        role: 'agent',
        content: `[ERROR]Photo analysis error: ${error?.message || 'Unknown error'}`,
        timestamp: new Date(),
      }]);
    }
    setIsAnalyzingPhoto(false);
    scrollToBottom();
  };

  // Analyze subject photo for identifying features (tattoos, scars, physical description)
  const runSubjectAnalysis = async () => {
    if (!subjectPhoto) return;

    setIsAnalyzingSubject(true);
    setChatMessages(prev => [...prev, {
      id: uniqueId(),
      role: 'system',
      content: '[SEARCH]ANALYZING SUBJECT** - Scanning for tattoos, scars, dental features, physical description, clothing...',
      timestamp: new Date(),
    }]);
    scrollToBottom();

    try {
      const analysis = await analyzeSubject(subjectPhoto);

      if (analysis) {
        setSubjectAnalysisResult(analysis);

        // Format for chat display
        const formattedAnalysis = formatSubjectAnalysisForChat(analysis);

        setChatMessages(prev => [...prev, {
          id: uniqueId(),
          role: 'agent',
          content: formattedAnalysis,
          timestamp: new Date(),
        }]);
      } else {
        setChatMessages(prev => [...prev, {
          id: uniqueId(),
          role: 'agent',
          content: '[WARN]Could not analyze subject photo. Try uploading a clearer image.',
          timestamp: new Date(),
        }]);
      }
    } catch (error: any) {
      setChatMessages(prev => [...prev, {
        id: uniqueId(),
        role: 'agent',
        content: `[ERROR]Subject analysis error: ${error?.message || 'Unknown error'}`,
        timestamp: new Date(),
      }]);
    }

    setIsAnalyzingSubject(false);
    scrollToBottom();
  };

  // Handle file upload
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[Upload] File change event triggered');
    const files = event.target.files;
    if (!files || files.length === 0) {
      console.log('[Upload] No files selected');
      return;
    }
    console.log('[Upload] Processing', files.length, 'files:', Array.from(files).map(f => f.name).join(', '));
    setIsProcessingFile(true);

    const { processUploadedFile } = await import('@/lib/pdf-extract');

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = file.name.toLowerCase();
      const isImage = file.type.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp)$/.test(fileName);

      if (isImage) {
        const reader = new FileReader();
        const currentFileName = file.name;
        const hasExistingSubject = !!subjectPhoto;
        const hasFeatures = !!facialFeatures;
        const matchService = faceMatchService;

        reader.onload = async (e) => {
          const rawDataUrl = e.target?.result as string;
          if (rawDataUrl && id) {
            const dataUrl = await compressImage(rawDataUrl, 400, 0.7);

            // If we already have a subject photo and facial features, compare faces
            if (hasExistingSubject && hasFeatures && matchService) {
              setUploadedFiles(prev => [...prev, { id: uniqueId(), name: currentFileName, type: 'image', uploadedAt: new Date() }]);
              setChatMessages(prev => [...prev, {
                id: uniqueId(),
                role: 'user',
                content: `Compare face: ${currentFileName}`,
                timestamp: new Date(),
              }]);
              scrollToBottom();

              setChatMessages(prev => [...prev, {
                id: uniqueId(),
                role: 'agent',
                content: `[ANALYSIS]COMPARING FACES** - Analyzing bone structure...`,
                timestamp: new Date(),
              }]);

              try {
                const result = await matchService.compareFaces(dataUrl, facialFeatures);

                const emoji = result.verdict === 'LIKELY_MATCH' ? '🟢' :
                              result.verdict === 'POSSIBLE_MATCH' ? '🟡' :
                              result.verdict === 'UNLIKELY_MATCH' ? '🟠' : '🔴';

                setChatMessages(prev => [...prev, {
                  id: uniqueId(),
                  role: 'agent',
                  content: `FACE MATCH RESULT: ${result.verdict}

Score: ${result.matchScore}% (Confidence: ${result.confidence}%)

Matching Features:
${result.matchingFeatures.length > 0 ? result.matchingFeatures.map(f => `✓ ${f}`).join('\n') : '- None significant'}

Differences:
${result.differingFeatures.length > 0 ? result.differingFeatures.map(f => `✗ ${f}`).join('\n') : '- None noted'}

Analysis:
${result.explanation}`,
                  timestamp: new Date(),
                }]);

              } catch (err: any) {
                setChatMessages(prev => [...prev, {
                  id: uniqueId(),
                  role: 'agent',
                  content: `[WARN]Face comparison failed: ${err?.message || 'Unknown error'}`,
                  timestamp: new Date(),
                }]);
              }

              scrollToBottom();
              return; // Don't save as subject photo
            }

            // If we already have a subject photo, ask: replace subject or add associate?
            if (subjectPhoto) {
              console.log('[PhotoUpload] Subject photo exists - asking user for intent');

              // Store temporarily and ask for details
              const tempAssociateId = uniqueId();
              await AsyncStorage.setItem(`case_temp_associate_photo_${id}`, JSON.stringify({
                id: tempAssociateId,
                photoUrl: dataUrl,
                fileName: currentFileName,
              }));

              setUploadedFiles(prev => [...prev, { id: tempAssociateId, name: currentFileName, type: 'image', uploadedAt: new Date() }]);
              setChatMessages(prev => [...prev, {
                id: uniqueId(),
                role: 'agent',
                content: `NEW PHOTO RECEIVED\n\nType "subject" to replace the current subject photo, or type a name to add as an associate.`,
                timestamp: new Date(),
              }]);
              scrollToBottom();

              // Mark that we're waiting for photo choice (subject replacement or associate name)
              await AsyncStorage.setItem(`case_waiting_photo_choice_${id}`, 'true');
            } else {
              // No subject photo yet - save as subject photo
              console.log('[PhotoUpload] Saving subject photo:', currentFileName);
              setSubjectPhoto(dataUrl);
              try { await AsyncStorage.setItem(`case_photo_${id}`, dataUrl); } catch {}
              setUploadedFiles(prev => [...prev, { id: uniqueId(), name: currentFileName, type: 'image', uploadedAt: new Date() }]);
              setChatMessages(prev => [...prev, { id: uniqueId(), role: 'agent', content: `Subject photo set: ${currentFileName}\n\nAnalyzing photo for investigative leads...`, timestamp: new Date() }]);
              scrollToBottom();
            }

            // Run photo intelligence analysis with filename
            console.log('[PhotoUpload] Running photo intelligence for:', currentFileName);
            analyzePhotoForIntel(dataUrl, currentFileName);
          }
        };
        reader.readAsDataURL(file);
        continue;
      }

      const docType: 'pdf' | 'doc' | 'text' = fileName.endsWith('.pdf') ? 'pdf' : fileName.endsWith('.doc') ? 'doc' : 'text';
      const fileId = uniqueId() + i;
      setUploadedFiles(prev => [...prev, { id: fileId, name: file.name, type: docType, uploadedAt: new Date() }]);
      setChatMessages(prev => [...prev, { id: uniqueId(), role: 'user', content: `📄 ${file.name}`, timestamp: new Date() }]);
      scrollToBottom();

      try {
        console.log('[PDF] Starting extraction for:', file.name);
        setChatMessages(prev => [...prev, { id: uniqueId(), role: 'agent', content: `🔄 Extracting text from ${file.name}...`, timestamp: new Date() }]);
        scrollToBottom();

        const extractResult = await processUploadedFile(file);
        console.log('[PDF] Extraction result:', extractResult.success, extractResult.error, extractResult.text?.length);

        if (extractResult.usedOcr) {
          setChatMessages(prev => [...prev, { id: uniqueId(), role: 'agent', content: `📷 PDF is scanned - using OCR to extract text...`, timestamp: new Date() }]);
          scrollToBottom();
        }
        if (!extractResult.success || !extractResult.text) {
          setChatMessages(prev => [...prev, { id: uniqueId(), role: 'agent', content: `[ERROR]${extractResult.error || 'Could not read file.'}`, timestamp: new Date() }]);
          continue;
        }

        // STORE the extracted text for follow-up questions (in state AND AsyncStorage)
        setUploadedFiles(prev => prev.map(f =>
          f.id === fileId ? { ...f, extractedText: extractResult.text } : f
        ));
        // Persist to AsyncStorage for /reanalyze across reloads
        try {
          const storageKey = `case_docs_${id}`;
          const existing = await AsyncStorage.getItem(storageKey);
          const docs: { name: string; text: string; date: string }[] = existing ? JSON.parse(existing) : [];
          docs.push({ name: file.name, text: extractResult.text!, date: new Date().toISOString() });
          await AsyncStorage.setItem(storageKey, JSON.stringify(docs));
        } catch (e) { console.warn('[Docs] Failed to persist:', e); }

        setChatMessages(prev => [...prev, { id: uniqueId(), role: 'agent', content: `📝 Extracted ${extractResult.text.length.toLocaleString()} characters. Analyzing with AI...`, timestamp: new Date() }]);
        scrollToBottom();

        // Analyze document text directly
        console.log('[PDF] Starting AI analysis...');
        const result = await analyzeText(extractResult.text);
        console.log('[PDF] Analysis result:', result.success, result.error);
        if (result.success && result.data) {
          const d = result.data;
          const subject = d.subject || {};
          const addresses = d.addresses || [];
          const phones = d.phones || [];
          const relatives = d.relatives || [];
          const vehicles = d.vehicles || [];
          const employment = d.employment || [];
          const flags = d.flags || [];
          const recommendations = d.recommendations || [];

          // Build TRACE intelligence report
          let intelReport = '';
          const dAny = d as any;
          const cosigners = dAny.cosigners || [];
          const references = dAny.references || [];
          const checkIns = dAny.checkIns || [];
          const trace = dAny.traceAnalysis;

          // Check if this is an associate document
          const primaryName = getSubjectName();
          const normalizedSubject = normalizeName(subject.fullName);
          const normalizedPrimary = normalizeName(primaryName);
          const isAboutAssociate = result.isAssociateDocument ||
            (normalizedSubject &&
             normalizedSubject !== 'Unknown' &&
             normalizedPrimary &&
             !normalizedSubject.toLowerCase().includes(normalizedPrimary.split(' ')[0]?.toLowerCase() || '') &&
             !normalizedPrimary.toLowerCase().includes(normalizedSubject.split(' ')[0]?.toLowerCase() || ''));

          if (isAboutAssociate) {
            intelReport += `[REPORT]ASSOCIATE INTEL** (for locating ${primaryName})\n`;
            if (normalizedSubject && normalizedSubject !== 'Unknown') {
              const newAssociate = {
                name: normalizedSubject,
                relationship: deduceRelationship(subject, caseData?.primaryTarget, vehicles),
                phones: phones.length > 0 ? [phones[0].number] : undefined,
                currentAddress: addresses.length > 0 ? addresses[0].fullAddress : undefined,
                source: 'document_analysis',
              };
              setDiscoveredAssociates(prev => {
                const exists = prev.some(a => normalizeName(a.name)?.toLowerCase() === normalizedSubject.toLowerCase());
                return exists ? prev : [...prev, newAssociate];
              });
            }
            intelReport += `Document about ${normalizedSubject || 'Unknown'} - may have intel on ${primaryName}.\n\n`;
          } else {
            intelReport += `[REPORT]TRACE ANALYSIS - ${subject.fullName || 'UNKNOWN'}**\n`;
            intelReport += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
          }

          // ═══ SUBJECT PROFILE ═══
          intelReport += `[PERSON]SUBJECT PROFILE**\n`;
          intelReport += `Name: ${subject.fullName || 'Unknown'}\n`;
          if (subject.dob) intelReport += `DOB: ${subject.dob}\n`;
          if (subject.partialSsn) intelReport += `SSN: XXX-XX-${subject.partialSsn}\n`;
          if (phones.length > 0) intelReport += `Phone: ${phones[0].number}\n`;
          if (subject.aliases?.length > 0) intelReport += `AKA: ${subject.aliases.join(', ')}\n`;
          intelReport += `\n`;

          // ═══ CHARGES & BOND ═══
          const bondRecs = recommendations.filter((r: string) => r.includes('Bond') || r.includes('Charge'));
          if (bondRecs.length > 0) {
            intelReport += `[CHARGES]CHARGES & BOND**\n`;
            bondRecs.forEach((info: string) => { intelReport += `• ${info}\n`; });
            intelReport += `\n`;
          }

          // ═══ EMPLOYMENT ═══
          if (employment.length > 0) {
            intelReport += `[EMPLOYMENT]EMPLOYMENT ANALYSIS**\n`;
            employment.forEach((emp: any) => {
              intelReport += `• ${emp.employer}`;
              if (emp.isCurrent) intelReport += ` (CURRENT)`;
              if (emp.title) intelReport += ` - ${emp.title}`;
              intelReport += `\n`;
              if (emp.address) intelReport += `  Address: ${emp.address}\n`;
              if (emp.phone) intelReport += `  Phone: ${emp.phone}\n`;
            });
            intelReport += `\n`;
          }

          // ═══ COSIGNERS / INDEMNITORS ═══
          if (cosigners.length > 0) {
            intelReport += `[COSIGNER]COSIGNERS / INDEMNITORS**\n`;
            intelReport += `These people put up bail - HIGH leverage contacts:\n\n`;
            cosigners.forEach((cs: any, i: number) => {
              intelReport += `${i + 1}. ${cs.name} (${cs.relationship})\n`;
              if (cs.phone) intelReport += `   Phone: ${cs.phone}\n`;
              if (cs.address) intelReport += `   Address: ${cs.address}\n`;
              if (cs.employer) intelReport += `   Employer: ${cs.employer}\n`;
            });
            intelReport += `\n`;
          }

          // ═══ REFERENCES ═══
          if (references.length > 0) {
            intelReport += `[CONTACTS]REFERENCES**\n`;
            references.forEach((ref: any, i: number) => {
              intelReport += `${i + 1}. ${ref.name} (${ref.relationship})`;
              if (ref.phone) intelReport += ` - ${ref.phone}`;
              intelReport += `\n`;
              if (ref.address) intelReport += `   ${ref.address}\n`;
            });
            intelReport += `\n`;
          }

          // ═══ OTHER KNOWN ASSOCIATES ═══
          const otherContacts = relatives.filter((r: any) =>
            !r.relationship?.includes('COSIGNER') && !r.relationship?.includes('REFERENCE')
          );
          if (otherContacts.length > 0) {
            intelReport += `[CONTACTS]KNOWN ASSOCIATES**\n`;
            otherContacts.forEach((rel: any) => {
              intelReport += `• ${rel.name} (${rel.relationship})`;
              if (rel.phones?.[0]) intelReport += ` - ${rel.phones[0]}`;
              intelReport += `\n`;
              if (rel.currentAddress) intelReport += `  ${rel.currentAddress}\n`;
            });
            intelReport += `\n`;
          }

          // ═══ VEHICLES ═══
          if (vehicles.length > 0) {
            intelReport += `[VEHICLES]VEHICLES**\n`;
            vehicles.forEach((v: any) => {
              const desc = [v.year, v.make, v.model, v.color].filter(Boolean).join(' ') || v.description || 'Unknown';
              intelReport += `• ${desc}`;
              if (v.plate) intelReport += ` | PLATE: ${v.plate}`;
              if (v.vin) intelReport += ` | VIN: ${v.vin}`;
              intelReport += `\n`;
            });
            intelReport += `\n`;
          }

          // ═══ CHECK-IN TIMELINE ═══
          if (checkIns.length > 0) {
            intelReport += `[TIMELINE]CHECK-IN TIMELINE (${checkIns.length} entries)**\n`;
            checkIns.slice(0, 20).forEach((ci: any) => {
              intelReport += `• ${ci.date} - ${ci.location || ci.city || 'Unknown'}`;
              if (ci.state && !ci.location?.includes(ci.state)) intelReport += `, ${ci.state}`;
              if (ci.notes) intelReport += ` (${ci.notes})`;
              intelReport += `\n`;
            });
            if (checkIns.length > 20) {
              intelReport += `  ...and ${checkIns.length - 20} more check-ins\n`;
            }
            intelReport += `\n`;
          }

          // ═══ ANCHOR POINTS ═══
          if (trace?.anchorPoints?.length > 0) {
            intelReport += `[ANCHOR]ANCHOR POINTS (High Value)**\n`;
            intelReport += `Locations subject RETURNS TO - best for apprehension:\n\n`;
            trace.anchorPoints.forEach((ap: any, i: number) => {
              intelReport += `${i + 1}. ${ap.location}\n`;
              if (ap.type) intelReport += `   Type: ${ap.type.replace(/_/g, ' ').toUpperCase()}\n`;
              if (ap.owner) intelReport += `   Contact: ${ap.owner}\n`;
              if (ap.checkInCount) intelReport += `   Check-ins: ${ap.checkInCount}x\n`;
              if (ap.confidence) intelReport += `   Confidence: ${ap.confidence}%\n`;
              if (ap.reason) intelReport += `   → ${ap.reason}\n`;
              intelReport += `\n`;
            });
          }

          // ═══ TRANSIENT LOCATIONS ═══
          if (trace?.transientLocations?.length > 0) {
            intelReport += `[SKIP]TRANSIENT LOCATIONS (Filtered Out)**\n`;
            intelReport += `One-time stops - LOW value for apprehension:\n`;
            trace.transientLocations.slice(0, 5).forEach((loc: string) => {
              intelReport += `• ${loc}\n`;
            });
            if (trace.transientLocations.length > 5) {
              intelReport += `  ...and ${trace.transientLocations.length - 5} more\n`;
            }
            intelReport += `\n`;
          }

          // ═══ PATTERN ANALYSIS ═══
          if (trace?.patternAnalysis) {
            const pa = trace.patternAnalysis;
            intelReport += `[PATTERN]PATTERN ANALYSIS**\n`;
            if (pa.isTruckDriver) intelReport += `TRUCK DRIVER - Most check-in locations are road stops, NOT residences\n`;
            if (pa.checkInFrequency) intelReport += `Check-in Frequency: ${pa.checkInFrequency}\n`;
            if (pa.typicalReturnDay) intelReport += `Typical Return: ${pa.typicalReturnDay}\n`;
            if (pa.routePattern) intelReport += `Route Pattern: ${pa.routePattern}\n`;
            if (pa.homeBaseLocation) intelReport += `HOME BASE: ${pa.homeBaseLocation}\n`;
            intelReport += `\n`;
          }

          // ═══ PREDICTION MODEL ═══
          if (trace?.predictionModel) {
            const pm = trace.predictionModel;
            intelReport += `[PREDICT]PREDICTION MODEL**\n`;
            if (pm.nextLikelyLocation) intelReport += `Next Likely Location: ${pm.nextLikelyLocation}\n`;
            if (pm.bestTimeWindow) intelReport += `Best Time Window: ${pm.bestTimeWindow}\n`;
            if (pm.confidence) intelReport += `Confidence: ${pm.confidence}%\n`;
            if (pm.reasoning) intelReport += `Reasoning: ${pm.reasoning}\n`;
            intelReport += `\n`;
          }

          // ═══ SURVEILLANCE RECOMMENDATIONS ═══
          if (trace?.surveillanceRecommendations?.length > 0) {
            intelReport += `[SURVEILLANCE]RECOMMENDED APPREHENSION STRATEGY**\n`;
            trace.surveillanceRecommendations.forEach((rec: string, i: number) => {
              intelReport += `${i + 1}. ${rec}\n`;
            });
            intelReport += `\n`;
          }

          // ═══ ALL ADDRESSES (ranked) ═══
          if (addresses.length > 0) {
            intelReport += `[LOCATION]ALL KNOWN ADDRESSES (${addresses.length})**\n`;
            addresses.slice(0, 8).forEach((addr: any, i: number) => {
              const confidence = addr.confidence ? ` (${Math.round(addr.confidence * 100)}%)` : '';
              intelReport += `${i + 1}. ${addr.fullAddress || addr.address}${confidence}\n`;
              if (addr.reasons?.[0]) intelReport += `   → ${addr.reasons[0]}\n`;
            });
            intelReport += `\n`;
          }

          // ═══ ALL PHONES ═══
          if (phones.length > 0) {
            intelReport += `[PHONES]PHONE INTELLIGENCE (${phones.length})**\n`;
            phones.forEach((p: any) => {
              intelReport += `• ${p.number} (${p.type || 'unknown'})\n`;
            });
            intelReport += `\n`;
          }

          // ═══ WARNINGS ═══
          if (flags.length > 0) {
            intelReport += `[WARNING]RED FLAGS**\n`;
            flags.forEach((f: any) => { intelReport += `• ${f.message}\n`; });
            intelReport += `\n`;
          }

          // ═══ CRITICAL OBSERVATIONS ═══
          if (trace?.criticalObservations?.length > 0) {
            intelReport += `[CRITICAL]CRITICAL OBSERVATIONS**\n`;
            trace.criticalObservations.forEach((obs: string) => {
              intelReport += `• ${obs}\n`;
            });
            intelReport += `\n`;
          }

          // ═══ KEY INTEL ═══
          const keyIntel = recommendations.filter((r: string) => !r.includes('Bond') && !r.includes('Charge'));
          if (keyIntel.length > 0) {
            intelReport += `[TIP]KEY INTEL**\n`;
            keyIntel.forEach((note: string) => { intelReport += `• ${note}\n`; });
          }

          setChatMessages(prev => [...prev, {
            id: uniqueId(),
            role: 'agent',
            content: intelReport,
            timestamp: new Date(),
          }]);
          await refresh();
        } else {
          setChatMessages(prev => [...prev, { id: uniqueId(), role: 'agent', content: `[WARN]Analysis failed: ${result.error || 'Unknown error'}`, timestamp: new Date() }]);
        }
      } catch (err: any) {
        console.error('[PDF] Processing error:', err);
        setChatMessages(prev => [...prev, { id: uniqueId(), role: 'agent', content: `[ERROR]Error processing file: ${err?.message || 'Unknown error'}`, timestamp: new Date() }]);
      }
    }

    setIsProcessingFile(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle profile photo selection from device
  const handleProfilePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !id) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const rawDataUrl = e.target?.result as string;
      if (rawDataUrl) {
        const dataUrl = await compressImage(rawDataUrl, 400, 0.7);
        setSubjectPhoto(dataUrl);
        try { await AsyncStorage.setItem(`case_photo_${id}`, dataUrl); } catch {}
        setShowPhotoPicker(false);
      }
    };
    reader.readAsDataURL(file);
    if (profilePhotoInputRef.current) profilePhotoInputRef.current.value = '';
  };

  // Set subject photo from an existing photo intel thumbnail
  const handleSelectPhotoFromIntel = async (thumbnailBase64: string) => {
    if (!id) return;
    setSubjectPhoto(thumbnailBase64);
    try { await AsyncStorage.setItem(`case_photo_${id}`, thumbnailBase64); } catch {}
    setShowPhotoPicker(false);
  };

  // Remove subject photo
  const handleRemovePhoto = async () => {
    if (!id) return;
    setSubjectPhoto(null);
    try { await AsyncStorage.removeItem(`case_photo_${id}`); } catch {}
    setShowPhotoPicker(false);
  };

  const sendMessage = async () => {
    if (!inputText.trim() || isSending) return;
    const userText = inputText.trim();
    const userTextLower = userText.toLowerCase();
    setChatMessages(prev => [...prev, { id: uniqueId(), role: 'user', content: userText, timestamp: new Date() }]);
    setInputText('');
    setIsSending(true);
    scrollToBottom();

    // /reanalyze - re-run analysis on all uploaded documents
    if (userTextLower === '/reanalyze' || userTextLower === '/rerun' || userTextLower === 'reanalyze') {
      // Check in-memory state first, then fall back to AsyncStorage
      let docsToAnalyze: { name: string; text: string }[] = uploadedFiles
        .filter(f => f.extractedText)
        .map(f => ({ name: f.name, text: f.extractedText! }));

      if (docsToAnalyze.length === 0) {
        try {
          const stored = await AsyncStorage.getItem(`case_docs_${id}`);
          if (stored) {
            const parsed = JSON.parse(stored) as { name: string; text: string }[];
            docsToAnalyze = parsed;
          }
        } catch (e) { console.warn('[Reanalyze] Failed to load stored docs:', e); }
      }

      if (docsToAnalyze.length === 0) {
        setChatMessages(prev => [...prev, { id: uniqueId(), role: 'agent', content: 'No documents with extracted text found. Upload files first.', timestamp: new Date() }]);
        setIsSending(false);
        return;
      }

      setChatMessages(prev => [...prev, { id: uniqueId(), role: 'agent', content: `Re-analyzing ${docsToAnalyze.length} document(s): ${docsToAnalyze.map(d => d.name).join(', ')}...`, timestamp: new Date() }]);
      scrollToBottom();

      // Combine all extracted texts
      const combinedText = docsToAnalyze
        .map(f => `\n\n=== DOCUMENT: ${f.name} ===\n\n${f.text}`)
        .join('\n');

      try {
        const result = await analyzeText(combinedText);
        if (result.success && result.data) {
          const d = result.data;
          const subject = d.subject || {};
          const addresses = d.addresses || [];
          const phones = d.phones || [];
          const relatives = d.relatives || [];
          const vehicles = d.vehicles || [];
          const employment = d.employment || [];
          const flags = d.flags || [];
          const recommendations = d.recommendations || [];
          const dAny = d as any;
          const cosigners = dAny.cosigners || [];
          const references = dAny.references || [];
          const checkIns = dAny.checkIns || [];
          const trace = dAny.traceAnalysis;

          let intelReport = `[REPORT]TRACE ANALYSIS - ${subject.fullName || 'UNKNOWN'} (CROSS-REFERENCED)**\n`;
          intelReport += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
          intelReport += `Sources: ${docsToAnalyze.map(f => f.name).join(' + ')}\n\n`;

          // Subject
          intelReport += `[PERSON]SUBJECT PROFILE**\n`;
          intelReport += `Name: ${subject.fullName || 'Unknown'}\n`;
          if (subject.dob) intelReport += `DOB: ${subject.dob}\n`;
          if (subject.partialSsn) intelReport += `SSN: XXX-XX-${subject.partialSsn}\n`;
          if (phones.length > 0) intelReport += `Phone: ${phones[0].number}\n`;
          if (subject.aliases?.length > 0) intelReport += `AKA: ${subject.aliases.join(', ')}\n`;
          intelReport += `\n`;

          // Charges
          const bondRecs = recommendations.filter((r: string) => r.includes('Bond') || r.includes('Charge'));
          if (bondRecs.length > 0) {
            intelReport += `[CHARGES]CHARGES & BOND**\n`;
            bondRecs.forEach((info: string) => { intelReport += `• ${info}\n`; });
            intelReport += `\n`;
          }

          // Employment
          if (employment.length > 0) {
            intelReport += `[EMPLOYMENT]EMPLOYMENT**\n`;
            employment.forEach((emp: any) => {
              intelReport += `• ${emp.employer}`;
              if (emp.isCurrent) intelReport += ` (CURRENT)`;
              if (emp.title) intelReport += ` - ${emp.title}`;
              intelReport += `\n`;
              if (emp.address) intelReport += `  ${emp.address}\n`;
            });
            intelReport += `\n`;
          }

          // Cosigners
          if (cosigners.length > 0) {
            intelReport += `[COSIGNER]COSIGNERS / INDEMNITORS**\n`;
            cosigners.forEach((cs: any, i: number) => {
              intelReport += `${i + 1}. ${cs.name} (${cs.relationship})\n`;
              if (cs.phone) intelReport += `   Phone: ${cs.phone}\n`;
              if (cs.address) intelReport += `   Address: ${cs.address}\n`;
            });
            intelReport += `\n`;
          }

          // References
          if (references.length > 0) {
            intelReport += `[CONTACTS]REFERENCES**\n`;
            references.forEach((ref: any, i: number) => {
              intelReport += `${i + 1}. ${ref.name} (${ref.relationship})`;
              if (ref.phone) intelReport += ` - ${ref.phone}`;
              intelReport += `\n`;
              if (ref.address) intelReport += `   ${ref.address}\n`;
            });
            intelReport += `\n`;
          }

          // Associates
          const otherContacts = relatives.filter((r: any) =>
            !r.relationship?.includes('COSIGNER') && !r.relationship?.includes('REFERENCE')
          );
          if (otherContacts.length > 0) {
            intelReport += `[CONTACTS]KNOWN ASSOCIATES (${otherContacts.length})**\n`;
            otherContacts.slice(0, 15).forEach((rel: any) => {
              intelReport += `• ${rel.name} (${rel.relationship})`;
              if (rel.phones?.[0]) intelReport += ` - ${rel.phones[0]}`;
              intelReport += `\n`;
              if (rel.currentAddress) intelReport += `  ${rel.currentAddress}\n`;
            });
            if (otherContacts.length > 15) intelReport += `  ...and ${otherContacts.length - 15} more\n`;
            intelReport += `\n`;
          }

          // Vehicles
          if (vehicles.length > 0) {
            intelReport += `[VEHICLES]VEHICLES**\n`;
            vehicles.forEach((v: any) => {
              const desc = [v.year, v.make, v.model, v.color].filter(Boolean).join(' ') || 'Unknown';
              intelReport += `• ${desc}`;
              if (v.plate) intelReport += ` | PLATE: ${v.plate}`;
              if (v.vin) intelReport += ` | VIN: ${v.vin}`;
              intelReport += `\n`;
            });
            intelReport += `\n`;
          }

          // Check-ins
          if (checkIns.length > 0) {
            intelReport += `[TIMELINE]CHECK-IN TIMELINE (${checkIns.length})**\n`;
            checkIns.slice(0, 20).forEach((ci: any) => {
              intelReport += `• ${ci.date} - ${ci.location || ci.city || 'Unknown'}`;
              if (ci.state && !ci.location?.includes(ci.state)) intelReport += `, ${ci.state}`;
              intelReport += `\n`;
            });
            if (checkIns.length > 20) intelReport += `  ...and ${checkIns.length - 20} more\n`;
            intelReport += `\n`;
          }

          // TRACE sections
          if (trace?.anchorPoints?.length > 0) {
            intelReport += `[ANCHOR]ANCHOR POINTS**\n`;
            trace.anchorPoints.forEach((ap: any, i: number) => {
              intelReport += `${i + 1}. ${ap.location}\n`;
              if (ap.type) intelReport += `   Type: ${ap.type.replace(/_/g, ' ').toUpperCase()}\n`;
              if (ap.owner) intelReport += `   Contact: ${ap.owner}\n`;
              if (ap.checkInCount) intelReport += `   Check-ins: ${ap.checkInCount}x\n`;
              if (ap.confidence) intelReport += `   Confidence: ${ap.confidence}%\n`;
              if (ap.reason) intelReport += `   → ${ap.reason}\n`;
              intelReport += `\n`;
            });
          }
          if (trace?.patternAnalysis) {
            const pa = trace.patternAnalysis;
            intelReport += `[PATTERN]PATTERN ANALYSIS**\n`;
            if (pa.isTruckDriver) intelReport += `TRUCK DRIVER - road stops are NOT residences\n`;
            if (pa.checkInFrequency) intelReport += `Frequency: ${pa.checkInFrequency}\n`;
            if (pa.typicalReturnDay) intelReport += `Returns: ${pa.typicalReturnDay}\n`;
            if (pa.homeBaseLocation) intelReport += `HOME BASE: ${pa.homeBaseLocation}\n`;
            intelReport += `\n`;
          }
          if (trace?.predictionModel) {
            const pm = trace.predictionModel;
            intelReport += `[PREDICT]PREDICTION MODEL**\n`;
            if (pm.nextLikelyLocation) intelReport += `Location: ${pm.nextLikelyLocation}\n`;
            if (pm.bestTimeWindow) intelReport += `Time: ${pm.bestTimeWindow}\n`;
            if (pm.confidence) intelReport += `Confidence: ${pm.confidence}%\n`;
            if (pm.reasoning) intelReport += `${pm.reasoning}\n`;
            intelReport += `\n`;
          }
          if (trace?.surveillanceRecommendations?.length > 0) {
            intelReport += `[SURVEILLANCE]APPREHENSION STRATEGY**\n`;
            trace.surveillanceRecommendations.forEach((rec: string, i: number) => {
              intelReport += `${i + 1}. ${rec}\n`;
            });
            intelReport += `\n`;
          }
          if (trace?.criticalObservations?.length > 0) {
            intelReport += `[CRITICAL]CRITICAL OBSERVATIONS**\n`;
            trace.criticalObservations.forEach((obs: string) => { intelReport += `• ${obs}\n`; });
          }

          // Addresses
          if (addresses.length > 0) {
            intelReport += `\n[LOCATION]ALL ADDRESSES (${addresses.length})**\n`;
            addresses.slice(0, 10).forEach((addr: any, i: number) => {
              const conf = addr.confidence ? ` (${Math.round(addr.confidence * 100)}%)` : '';
              intelReport += `${i + 1}. ${addr.fullAddress || addr.address}${conf}\n`;
            });
          }

          // Phones
          if (phones.length > 0) {
            intelReport += `\n[PHONES]PHONE INTELLIGENCE (${phones.length})**\n`;
            phones.forEach((p: any) => { intelReport += `• ${p.number} (${p.type || 'unknown'})\n`; });
          }

          // Warnings
          if (flags.length > 0) {
            intelReport += `\n[WARNING]RED FLAGS**\n`;
            flags.forEach((f: any) => { intelReport += `• ${f.message}\n`; });
          }

          setChatMessages(prev => [...prev, { id: uniqueId(), role: 'agent', content: intelReport, timestamp: new Date() }]);
          await refresh();
        } else {
          setChatMessages(prev => [...prev, { id: uniqueId(), role: 'agent', content: `[WARN]Re-analysis failed: ${result.error || 'Unknown error'}`, timestamp: new Date() }]);
        }
      } catch (err: any) {
        setChatMessages(prev => [...prev, { id: uniqueId(), role: 'agent', content: `[ERROR]${err?.message || 'Re-analysis failed'}`, timestamp: new Date() }]);
      }

      setIsSending(false);
      scrollToBottom();
      return;
    }

    // CHECK: Are we waiting for photo choice (subject replacement or associate name)?
    const waitingForPhotoChoice = await AsyncStorage.getItem(`case_waiting_photo_choice_${id}`);
    if (waitingForPhotoChoice === 'true' && userText.length > 0 && userText.length < 50 && !userText.includes(' as ')) {
      const tempPhotoData = await AsyncStorage.getItem(`case_temp_associate_photo_${id}`);
      if (tempPhotoData) {
        const { photoUrl, fileName } = JSON.parse(tempPhotoData);
        const isSubjectReplacement = userTextLower === 'subject' || userTextLower === 'replace';

        if (isSubjectReplacement) {
          // Replace the subject photo
          setSubjectPhoto(photoUrl);
          try { await AsyncStorage.setItem(`case_photo_${id}`, photoUrl); } catch {}

          // Clear temp state
          await AsyncStorage.removeItem(`case_temp_associate_photo_${id}`);
          await AsyncStorage.removeItem(`case_waiting_photo_choice_${id}`);

          setChatMessages(prev => [...prev, {
            id: uniqueId(),
            role: 'agent',
            content: `Subject photo replaced with ${fileName}.`,
            timestamp: new Date(),
          }]);

          setIsSending(false);
          scrollToBottom();
          chatInputRef.current?.focus();
          return;
        }

        // Otherwise treat as associate name
        const associateName = userText.charAt(0).toUpperCase() + userText.slice(1);

        // Save associate with photo
        const newAssociate = {
          name: associateName,
          relationship: 'unknown',
          photoUrl,
          source: 'photo_drop',
        };

        setDiscoveredAssociates(prev => [...prev, newAssociate]);

        // Save to AsyncStorage
        const existingAssocs = await AsyncStorage.getItem(`case_associates_${id}`);
        const assocList = existingAssocs ? JSON.parse(existingAssocs) : [];
        assocList.push(newAssociate);
        await AsyncStorage.setItem(`case_associates_${id}`, JSON.stringify(assocList));

        // Clear temp state
        await AsyncStorage.removeItem(`case_temp_associate_photo_${id}`);
        await AsyncStorage.removeItem(`case_waiting_photo_choice_${id}`);

        setChatMessages(prev => [...prev, {
          id: uniqueId(),
          role: 'agent',
          content: `${associateName} added with photo.\n\nRelationship to ${getSubjectName()}? (friend, brother, mother, employer, etc.)`,
          timestamp: new Date(),
        }]);

        // Now wait for relationship
        await AsyncStorage.setItem(`case_waiting_associate_rel_${id}`, associateName);

        setIsSending(false);
        scrollToBottom();
        chatInputRef.current?.focus();
        return;
      }
    }

    // CHECK: Are we waiting for a relationship after naming an associate?
    const waitingForRel = await AsyncStorage.getItem(`case_waiting_associate_rel_${id}`);
    if (waitingForRel && userTextLower.match(/^(friend|family|mother|father|sister|brother|spouse|wife|husband|girlfriend|boyfriend|employer|coworker|co-signer|cosigner|roommate|neighbor|aunt|uncle|cousin|grandma|grandmother|grandpa|grandfather|unknown|associate)$/i)) {
      const relationship = userTextLower;

      // Update the associate
      setDiscoveredAssociates(prev => {
        return prev.map(a =>
          a.name === waitingForRel ? { ...a, relationship } : a
        );
      });

      // Update in AsyncStorage
      const existingAssocs = await AsyncStorage.getItem(`case_associates_${id}`);
      if (existingAssocs) {
        const assocList = JSON.parse(existingAssocs);
        const updated = assocList.map((a: any) =>
          a.name === waitingForRel ? { ...a, relationship } : a
        );
        await AsyncStorage.setItem(`case_associates_${id}`, JSON.stringify(updated));
      }

      await AsyncStorage.removeItem(`case_waiting_associate_rel_${id}`);

      setChatMessages(prev => [...prev, {
        id: uniqueId(),
        role: 'agent',
        content: `[FOUND]${waitingForRel}** - ${relationship}\n\nAdded to Network. Drop another photo or continue investigating.`,
        timestamp: new Date(),
      }]);

      setIsSending(false);
      scrollToBottom();
      return;
    }

    // COMMAND DETECTION: Any variation of "add [name] as associate/to network/etc"
    // Catches: "add raydell", "add raydell as associate", "add raydell to the network", etc.
    const addPatterns = [
      /add\s+(.+?)\s+(?:as\s+)?(?:an?\s+)?(?:associate|relative|contact|friend|family|to\s+(?:the\s+)?(?:network|graph|associates|contacts))/i,
      /add\s+(?:associate|relative|contact)\s+(.+)/i,
      /^add\s+([a-z]+(?:\s+[a-z]+)?)\s*$/i, // Simple "add raydell" or "add raydell smith"
    ];

    let addAssociateMatch = null;
    for (const pattern of addPatterns) {
      addAssociateMatch = userTextLower.match(pattern);
      if (addAssociateMatch) break;
    }

    if (addAssociateMatch) {
      // Extract name - could be in group 1 or 2 depending on pattern
      let name = (addAssociateMatch[1] || addAssociateMatch[2] || '').trim();
      // Clean up common words
      name = name.replace(/\b(as|an?|associate|relative|contact|friend|family|to|the|network|graph)\b/gi, '').trim();

      const normalizedName = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();

      if (normalizedName.length > 1) {
        const newAssociate = {
          name: normalizedName,
          relationship: 'associate',
          source: 'manual_add',
        };

        // Actually add to state
        setDiscoveredAssociates(prev => {
          const exists = prev.some(a =>
            (a.name || '').toLowerCase() === normalizedName.toLowerCase()
          );
          if (exists) {
            return prev;
          }
          console.log('[TRACE Command] Adding associate:', normalizedName);
          return [...prev, newAssociate];
        });

        // Save to AsyncStorage immediately
        AsyncStorage.getItem(`case_associates_${id}`).then(existing => {
          const list = existing ? JSON.parse(existing) : [];
          if (!list.some((a: any) => (a.name || '').toLowerCase() === normalizedName.toLowerCase())) {
            list.push(newAssociate);
            AsyncStorage.setItem(`case_associates_${id}`, JSON.stringify(list));
            console.log('[TRACE Command] Saved to storage:', list);
          }
        });

        setChatMessages(prev => [...prev, {
          id: uniqueId(),
          role: 'agent',
          content: `[FOUND]${normalizedName}** added to Network.\n\nRelationship to ${getSubjectName()}? _(type: brother, mother, friend, employer, etc.)_`,
          timestamp: new Date(),
        }]);
        setIsSending(false);
        scrollToBottom();
        chatInputRef.current?.focus();
        return;
      }
    }

    // COMMAND: Update relationship for last added associate
    const relationshipMatch = userTextLower.match(/^(friend|family|mother|father|sister|brother|spouse|wife|husband|girlfriend|boyfriend|employer|coworker|co-signer|cosigner|roommate|neighbor|aunt|uncle|cousin|grandma|grandmother|grandpa|grandfather)$/i);
    if (relationshipMatch && discoveredAssociates.length > 0) {
      const relationship = relationshipMatch[1];
      setDiscoveredAssociates(prev => {
        const updated = [...prev];
        if (updated.length > 0) {
          updated[updated.length - 1] = { ...updated[updated.length - 1], relationship };
        }
        return updated;
      });

      // Save to AsyncStorage
      AsyncStorage.getItem(`case_associates_${id}`).then(existing => {
        const list = existing ? JSON.parse(existing) : [];
        if (list.length > 0) {
          list[list.length - 1].relationship = relationship;
          AsyncStorage.setItem(`case_associates_${id}`, JSON.stringify(list));
        }
      });

      setChatMessages(prev => [...prev, {
        id: uniqueId(),
        role: 'agent',
        content: `Updated to ${relationship}. What else did you find?`,
        timestamp: new Date(),
      }]);
      setIsSending(false);
      scrollToBottom();
      return;
    }

    // COMMAND: Log address found on social media
    const addressMatch = userText.match(/(?:found|saw|lives at|address[:\s]+)(.+(?:street|st|avenue|ave|drive|dr|road|rd|lane|ln|court|ct|way|blvd|boulevard)[^,]*,?\s*[a-z\s]*,?\s*(?:la|louisiana|tx|texas|ms|mississippi|al|alabama|fl|florida|ga|georgia)?[\s,]*\d{5})?/i);
    if (addressMatch && addressMatch[1]) {
      const foundAddress = addressMatch[1].trim();
      setChatMessages(prev => [...prev, {
        id: uniqueId(),
        role: 'agent',
        content: `Logged potential address: ${foundAddress}\n\nAdded to case. Source? (Facebook, Instagram, etc.)`,
        timestamp: new Date(),
      }]);
      setIsSending(false);
      scrollToBottom();
      return;
    }

    // INTUITIVE URL DETECTION - Auto-scrape arrest records, jail rosters, etc.
    const urlMatch = userText.match(/https?:\/\/[^\s]+/i);
    if (urlMatch) {
      const url = urlMatch[0];
      const isArrestUrl = url.includes('arrests.org') || url.includes('revize.com') ||
                          url.includes('jail') || url.includes('inmate') || url.includes('booking');

      if (isArrestUrl) {
        setChatMessages(prev => [...prev, {
          id: uniqueId(),
          role: 'agent',
          content: `Scraping arrest record from URL...`,
          timestamp: new Date(),
        }]);
        scrollToBottom();

        try {
          const BACKEND_URL = 'https://elite-recovery-osint.fly.dev';
          const res = await fetch(`${BACKEND_URL}/api/jail-roster`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
          });

          if (res.ok) {
            const data = await res.json();
            if (data.inmate) {
              const inmate = data.inmate;
              const charges = data.charges || [];

              // Build intel report from scraped data
              let report = `[REPORT]ARREST RECORD EXTRACTED**\n\n`;
              report += `[PERSON]SUBJECT**\n`;
              report += `Name: ${inmate.name || 'Unknown'}\n`;
              if (inmate.age) report += `Age: ${inmate.age}\n`;
              if (inmate.dob) report += `DOB: ${inmate.dob}\n`;
              if (inmate.race) report += `Race: ${inmate.race}\n`;
              if (inmate.sex) report += `Sex: ${inmate.sex}\n`;
              if (inmate.height) report += `Height: ${inmate.height}\n`;
              if (inmate.weight) report += `Weight: ${inmate.weight}\n`;
              if (inmate.address) report += `Address: ${inmate.address}\n`;

              if (charges.length > 0) {
                report += `\n[CHARGES]CHARGES**\n`;
                charges.forEach((c: any) => {
                  report += `• ${c.charge || c.description || 'Unknown charge'}`;
                  if (c.bond_amount) report += ` | Bond: ${c.bond_amount}`;
                  report += `\n`;
                });
              }

              if (data.photo_url) {
                report += `\n📷 Mugshot available`;
                // Set as subject photo
                setSubjectPhoto(data.photo_url);
                await AsyncStorage.setItem(`case_photo_${id}`, data.photo_url);
              }

              setChatMessages(prev => [...prev, {
                id: uniqueId(),
                role: 'agent',
                content: report,
                timestamp: new Date(),
              }]);

              // Also analyze the text data with Claude to add to case
              const textToAnalyze = `Name: ${inmate.name}\nDOB: ${inmate.dob || 'Unknown'}\nAge: ${inmate.age || 'Unknown'}\nAddress: ${inmate.address || 'Unknown'}\nCharges: ${charges.map((c: any) => c.charge || c.description).join(', ')}`;
              if (textToAnalyze.length > 50) {
                await analyzeText(textToAnalyze);
                await refresh();
              }
            } else {
              setChatMessages(prev => [...prev, {
                id: uniqueId(),
                role: 'agent',
                content: `[WARN]Could not extract data from that URL. The site may have anti-bot protection.`,
                timestamp: new Date(),
              }]);
            }
          } else {
            setChatMessages(prev => [...prev, {
              id: uniqueId(),
              role: 'agent',
              content: `[WARN]Scrape failed. Try the Import from Jail Roster feature instead.`,
              timestamp: new Date(),
            }]);
          }
        } catch (err: any) {
          setChatMessages(prev => [...prev, {
            id: uniqueId(),
            role: 'agent',
            content: `[ERROR]Error: ${err?.message || 'Failed to scrape URL'}`,
            timestamp: new Date(),
          }]);
        }

        setIsSending(false);
        scrollToBottom();
        return;
      }
    }

    // Detect OSINT commands - be aggressive about detecting search intent
    const osintKeywords = [
      'osint', 'social', 'search', 'find', 'lookup', 'locate', 'profile', 'account',
      'sherlock', 'maigret', 'python', 'test it', 'run it', 'scan', 'sweep', 'check'
    ];
    const isOsintCommand = osintKeywords.some(kw => userTextLower.includes(kw));

    // Detect if user entered a username (short, no spaces, alphanumeric)
    const looksLikeUsername = /^[a-z0-9._-]{3,30}$/i.test(userText.trim()) && !userText.includes(' ');

    if (isOsintCommand || looksLikeUsername) {
      const subjectName = parsedData?.subject?.fullName || caseData?.name;

      // If it looks like a username, search that directly
      if (looksLikeUsername) {
        setChatMessages(prev => [...prev, {
          id: uniqueId(),
          role: 'agent',
          content: `Searching username: "${userText}"...`,
          timestamp: new Date(),
        }]);
        setIsSearchingOSINT(true);

        try {
          if (pythonBackendAvailable) {
            const { searchWithSherlock } = await import('@/lib/python-osint');
            const result = await searchWithSherlock(userText.trim(), 60);
            const foundCount = result.found?.length || 0;
            setChatMessages(prev => [...prev, {
              id: uniqueId(),
              role: 'agent',
              content: foundCount > 0
                ? `[OK]Found ${foundCount} profiles for "${userText}":\n${result.found.slice(0, 10).map(p => `• ${p.platform}: ${p.url}`).join('\n')}${foundCount > 10 ? `\n+${foundCount - 10} more` : ''}`
                : `No profiles found for username "${userText}".`,
              timestamp: new Date(),
            }]);
          } else {
            setChatMessages(prev => [...prev, {
              id: uniqueId(),
              role: 'agent',
              content: `Backend offline. Try: https://whatsmyname.app/?q=${encodeURIComponent(userText)}`,
              timestamp: new Date(),
            }]);
          }
        } catch (err: any) {
          setChatMessages(prev => [...prev, {
            id: uniqueId(),
            role: 'agent',
            content: `Search error: ${err?.message || 'Unknown'}`,
            timestamp: new Date(),
          }]);
        }

        setIsSearchingOSINT(false);
        setIsSending(false);
        scrollToBottom();
        return;
      }

      // Otherwise, search the subject name
      if (subjectName) {
        setOsintSearched(false);
        await runOSINTSearch(subjectName);
        setIsSending(false);
        scrollToBottom();
        return;
      } else {
        setChatMessages(prev => [...prev, {
          id: uniqueId(),
          role: 'agent',
          content: '[WARN]No subject name found. Enter a username to search directly.',
          timestamp: new Date(),
        }]);
        setIsSending(false);
        scrollToBottom();
        return;
      }
    }

    if (userText.length > 500) {
      try {
        const result = await analyzeText(userText);
        if (result.success && result.data) {
          setChatMessages(prev => [...prev, {
            id: uniqueId(),
            role: 'agent',
            content: `Analyzed. ${result.data.addresses?.length || 0} addresses found.`,
            timestamp: new Date(),
          }]);
          await refresh();
        }
      } catch {}
      setIsSending(false);
      scrollToBottom();
      return;
    }

    try {
      // === DIRECT COMMAND PARSER ===
      // Parse user commands and apply to case intel IMMEDIATELY (don't rely on AI)
      if (id) {
        const detectedActions: import('@/lib/case-intel').IntelAction[] = [];
        const lower = userTextLower;

        // "add [address] as important" or "add [address] to the case" or "add [address]"
        // Detect address-like patterns (number + street words)
        const addressMatch = userText.match(/(?:add|save|keep|mark)\s+(.+?)(?:\s+(?:as\s+(?:important|anchor|family|work|associate)|to\s+(?:the\s+)?(?:case|report|file|important)))?$/i);
        const hasAddressKeyword = /\d+\s+\w+\s+(?:st|street|ave|avenue|rd|road|dr|drive|ln|lane|ct|court|way|blvd|boulevard|cir|circle|pl|place|hwy|highway)\b/i;

        // "add [name] as [relationship]"
        const contactMatch = userText.match(/(?:add|save)\s+(.+?)\s+as\s+(.+?)$/i);

        // "remove/take off [pattern]" or "exclude [pattern]"
        const removeMatch = userText.match(/(?:remove|take\s+off|exclude|filter\s+out|get\s+rid\s+of|drop)\s+(.+?)(?:\s+from.*)?$/i);

        // "mark [text] as important"
        const markMatch = userText.match(/(?:mark|flag)\s+(.+?)\s+(?:as\s+)?important/i);

        // "note: [text]" or "add note [text]"
        const noteMatch = userText.match(/(?:^note[:\s]+|add\s+(?:a\s+)?note[:\s]+)(.+)$/i);

        // "flag: [text]" or "add flag [text]" or "warning: [text]"
        const flagMatch = userText.match(/(?:^(?:flag|warning)[:\s]+|add\s+(?:a\s+)?(?:flag|warning)[:\s]+)(.+)$/i);

        if (markMatch) {
          detectedActions.push({ type: 'MARK_IMPORTANT', address: markMatch[1].trim() });
        } else if (flagMatch) {
          detectedActions.push({ type: 'ADD_FLAG', text: flagMatch[1].trim() });
        } else if (noteMatch) {
          detectedActions.push({ type: 'ADD_NOTE', text: noteMatch[1].trim() });
        } else if (removeMatch) {
          const pattern = removeMatch[1].trim().toLowerCase();
          // Check if it looks like removing a contact or an address pattern
          if (/gas\s*station|truck\s*stop|love'?s|pilot|flying\s*j|rest\s*area|travel\s*(center|plaza)/i.test(pattern)) {
            detectedActions.push({ type: 'EXCLUDE_PATTERN', pattern });
          } else if (hasAddressKeyword.test(removeMatch[1])) {
            detectedActions.push({ type: 'REMOVE_ADDRESS', address: removeMatch[1].trim() });
          } else {
            // Could be a contact name or a general exclusion
            detectedActions.push({ type: 'REMOVE_CONTACT', name: removeMatch[1].trim() });
            detectedActions.push({ type: 'EXCLUDE_PATTERN', pattern });
          }
        } else if (contactMatch && !hasAddressKeyword.test(contactMatch[1])) {
          // "add Shecondra as possible ex-wife" — name doesn't look like an address
          detectedActions.push({
            type: 'ADD_CONTACT',
            name: contactMatch[1].trim(),
            relationship: contactMatch[2].trim(),
          });
        } else if (addressMatch && hasAddressKeyword.test(addressMatch[1])) {
          // "add 42 Megehee Ct Westwego LA 70094"
          const addrType = lower.includes('family') ? 'family'
            : lower.includes('work') ? 'work'
            : lower.includes('anchor') ? 'anchor'
            : lower.includes('associate') ? 'associate' : 'anchor';
          detectedActions.push({
            type: 'ADD_ADDRESS',
            address: addressMatch[1].trim(),
            addressType: addrType,
            important: true,
            note: 'Added by agent',
          });
        }

        // Apply any detected actions
        if (detectedActions.length > 0) {
          const { intel: updatedIntel, descriptions } = await applyActions(id, detectedActions);
          setCaseIntel(updatedIntel);
          const confirmMsg = descriptions.map(d => `> ${d}`).join('\n');
          setChatMessages(prev => [...prev, {
            id: uniqueId(),
            role: 'system',
            content: `[CASE FILE UPDATED]\n${confirmMsg}`,
            timestamp: new Date(),
          }]);
          scrollToBottom();
        }
      }

      // Build context about the case for AI
      const contextParts: string[] = [];
      // Prioritize: parsed report name > case name > roster data name > 'Subject'
      const subjectName = (parsedData?.subject?.fullName && parsedData.subject.fullName !== 'Unknown')
        ? parsedData.subject.fullName
        : (caseData?.name || caseData?.rosterData?.inmate?.name || 'Subject');
      contextParts.push(`Case Subject: ${subjectName}`);

      if (subjectPhoto) {
        contextParts.push(`Subject photo uploaded: YES`);
      }
      if (photoIntel) {
        if (photoIntel.addresses.length > 0) {
          contextParts.push(`Photo analysis found ${photoIntel.addresses.length} address(es)`);
        }
        if (photoIntel.vehicles.length > 0) {
          contextParts.push(`Photo analysis found ${photoIntel.vehicles.length} vehicle(s)`);
        }
        if (photoIntel.exifData?.gps) {
          contextParts.push(`Photo GPS: ${photoIntel.exifData.gps.latitude}, ${photoIntel.exifData.gps.longitude}`);
        }
        contextParts.push(`Photo setting: ${photoIntel.metadata.settingType}`);
      }
      if (uploadedFiles.length > 0) {
        contextParts.push(`Files uploaded: ${uploadedFiles.map(f => f.name).join(', ')}`);
        // Include extracted document text for follow-up questions
        const docsWithText = uploadedFiles.filter(f => f.extractedText);
        if (docsWithText.length > 0) {
          contextParts.push(`\n--- DOCUMENT CONTENTS ---`);
          docsWithText.forEach(f => {
            // Include up to 15000 chars per doc for context (enough for detailed questions)
            const textPreview = f.extractedText!.slice(0, 40000);
            contextParts.push(`\n[${f.name}]:\n${textPreview}${f.extractedText!.length > 40000 ? '\n...(truncated)' : ''}`);
          });
          contextParts.push(`--- END DOCUMENTS ---\n`);
        }
      }
      if (displayAddresses.length > 0) {
        contextParts.push(`Known addresses: ${displayAddresses.slice(0, 3).map(a => a.fullAddress).join('; ')}`);
      }

      // Build TRACE detective partner prompt
      const docsWithText = uploadedFiles.filter(f => f.extractedText);
      const documentContents = docsWithText.length > 0
        ? docsWithText.map(f => `[${f.name}]:\n${f.extractedText!.slice(0, 40000)}${f.extractedText!.length > 40000 ? '\n...(truncated)' : ''}`).join('\n\n')
        : undefined;

      const photoIntelSummary = photoIntel
        ? `${photoIntel.addresses.length} addresses, ${photoIntel.vehicles.length} vehicles${photoIntel.exifData?.gps ? ', GPS coordinates found' : ''}`
        : undefined;

      const systemPrompt = buildTracePrompt({
        subjectName,
        hasPhoto: !!subjectPhoto,
        photoIntel: photoIntelSummary,
        uploadedFiles: uploadedFiles.map(f => f.name),
        knownAddresses: displayAddresses.slice(0, 5).map(a => a.fullAddress),
        documentContents,
        recentMessages: chatMessages.slice(-15).map(m => `${m.role}: ${m.content.slice(0, 800)}`).join('\n'),
        caseIntelSummary: caseIntel ? intelSummary(caseIntel) : undefined,
      });

      const response = await fetch('https://elite-recovery-osint.fly.dev/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userText },
          ],
          model: 'gpt-4o',
          max_tokens: 2500,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const aiResponse = data.choices?.[0]?.message?.content || 'No response';

        // Parse action blocks from AI response
        const { cleanText, actions } = parseActions(aiResponse);

        // Show the clean conversational text (without action blocks)
        setChatMessages(prev => [...prev, {
          id: uniqueId(),
          role: 'agent',
          content: cleanText || aiResponse,
          timestamp: new Date(),
        }]);

        // Apply any actions to case intel
        if (actions.length > 0 && id) {
          console.log('[CaseIntel] Applying', actions.length, 'actions:', actions);
          const { intel: updatedIntel, descriptions } = await applyActions(id, actions);
          setCaseIntel(updatedIntel);

          // Show confirmation of what was done
          const confirmMsg = descriptions.map(d => `> ${d}`).join('\n');
          setChatMessages(prev => [...prev, {
            id: uniqueId(),
            role: 'system',
            content: `[UPDATED CASE FILE]\n${confirmMsg}`,
            timestamp: new Date(),
          }]);
        }

        // Also extract addresses from AI response and add to locations (existing behavior)
        const addressPattern = /(\d+\s+[A-Za-z0-9\s,.]+(?:Street|St|Avenue|Ave|Drive|Dr|Road|Rd|Lane|Ln|Court|Ct|Way|Boulevard|Blvd|Circle|Cir|Place|Pl)[^,]*,?\s*[A-Za-z\s]+,?\s*(?:LA|Louisiana|TX|Texas|MS|FL|AL|GA)?[,\s]*\d{5}(?:-\d{4})?)/gi;
        const textToScan = cleanText || aiResponse;
        const foundAddresses = textToScan.match(addressPattern);
        if (foundAddresses && foundAddresses.length > 0) {
          const newLocations: RankedLocation[] = foundAddresses.map((addr: string, idx: number) => ({
            rank: idx + 1,
            address: addr.trim(),
            probability: Math.max(0.3, 0.8 - (idx * 0.15)),
            type: 'frequent_location' as const,
            reasoning: ['Mentioned by AI analyst'],
            sources: ['Chat analysis'],
          }));
          setSquadLocations(prev => {
            const existing = new Set(prev.map(l => l.address.toLowerCase()));
            const unique = newLocations.filter(l => !existing.has(l.address.toLowerCase()));
            if (unique.length > 0) {
              console.log('[Chat] Extracted addresses from AI response:', unique.map(l => l.address));
            }
            return [...prev, ...unique];
          });
        }
      } else {
        setChatMessages(prev => [...prev, {
          id: uniqueId(),
          role: 'agent',
          content: 'Backend unavailable. Try again.',
          timestamp: new Date(),
        }]);
      }
    } catch (err: any) {
      setChatMessages(prev => [...prev, { id: uniqueId(), role: 'agent', content: `Error: ${err?.message}`, timestamp: new Date() }]);
    }
    setIsSending(false);
    scrollToBottom();
    // Refocus the chat input
    setTimeout(() => chatInputRef.current?.focus(), 100);
  };

  // --- Link Analysis editing helpers ---
  const RELATIONSHIP_OPTIONS = ['associate', 'friend', 'brother', 'sister', 'mother', 'father', 'spouse', 'girlfriend', 'boyfriend', 'employer', 'coworker', 'co-signer', 'roommate', 'cousin', 'uncle', 'aunt', 'unknown'];

  const updateAssociateRelationship = async (name: string, newRel: string) => {
    setDiscoveredAssociates(prev => prev.map(a => a.name === name ? { ...a, relationship: newRel } : a));
    const stored = await AsyncStorage.getItem(`case_associates_${id}`);
    if (stored) {
      const list = JSON.parse(stored);
      const updated = list.map((a: any) => a.name === name ? { ...a, relationship: newRel } : a);
      await AsyncStorage.setItem(`case_associates_${id}`, JSON.stringify(updated));
    }
    setEditingLinkRel(null);
  };

  const removeAssociate = async (name: string) => {
    setDiscoveredAssociates(prev => prev.filter(a => a.name !== name));
    const stored = await AsyncStorage.getItem(`case_associates_${id}`);
    if (stored) {
      const list = JSON.parse(stored);
      await AsyncStorage.setItem(`case_associates_${id}`, JSON.stringify(list.filter((a: any) => a.name !== name)));
    }
    setSelectedLinkNode(null);
  };

  const addManualAssociate = async () => {
    if (!newAssocName.trim()) return;
    const name = newAssocName.trim();
    const newAssoc = { name, relationship: newAssocRel, source: 'manual' };
    setDiscoveredAssociates(prev => [...prev, newAssoc]);
    const stored = await AsyncStorage.getItem(`case_associates_${id}`);
    const list = stored ? JSON.parse(stored) : [];
    list.push(newAssoc);
    await AsyncStorage.setItem(`case_associates_${id}`, JSON.stringify(list));
    setNewAssocName('');
    setNewAssocRel('associate');
    setShowAddAssociate(false);
  };

  const updateSocialStatus = (platform: string, status: 'found' | 'not_found') => {
    setSocialProfiles(prev => prev.map(p =>
      p.platform === platform ? { ...p, status } : p
    ));
  };

  const generateFullReport = async () => {
    setIsGeneratingReport(true);

    try {
      // Open print dialog with report (no orchestrator needed)
      if (isWeb) {
        // === SUBJECT PROFILE WITH PHOTO ===
        const subject = parsedData?.subject;
        const rosterInmate = caseData?.rosterData?.inmate;
        // Calculate age from DOB
        const calcAge = (dob: string | undefined) => {
          if (!dob) return null;
          const birthDate = new Date(dob);
          if (isNaN(birthDate.getTime())) return null;
          const today = new Date();
          let age = today.getFullYear() - birthDate.getFullYear();
          const m = today.getMonth() - birthDate.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
          return age;
        };
        const subjectDob = subject?.dob || rosterInmate?.dob;
        const subjectAge = rosterInmate?.age || calcAge(subjectDob);
        const subjectHeight = rosterInmate?.height;
        const subjectWeight = rosterInmate?.weight;
        const subjectHtml = `
          <h2>Subject Profile</h2>
          <div class="profile-card-with-photo">
            ${subjectPhoto ? `<div class="subject-photo"><img src="${subjectPhoto}" alt="Subject" /></div>` : '<div class="subject-photo-placeholder">NO PHOTO</div>'}
            <div class="profile-details">
              <div class="profile-name">${subject?.fullName || caseData?.name || 'Unknown'}</div>
              ${subject?.aliases?.length ? `<div class="profile-aliases">AKA: ${subject.aliases.join(', ')}</div>` : ''}
              <div class="profile-grid-compact">
                ${subjectDob ? `<div class="profile-item"><span class="label">DOB:</span> <span class="value">${subjectDob}</span></div>` : ''}
                ${subjectAge ? `<div class="profile-item"><span class="label">Age:</span> <span class="value">${subjectAge}</span></div>` : ''}
                ${subjectHeight ? `<div class="profile-item"><span class="label">Height:</span> <span class="value">${subjectHeight}</span></div>` : ''}
                ${subjectWeight ? `<div class="profile-item"><span class="label">Weight:</span> <span class="value">${subjectWeight}</span></div>` : ''}
                ${rosterInmate?.race ? `<div class="profile-item"><span class="label">Race:</span> <span class="value">${rosterInmate.race}</span></div>` : ''}
                ${rosterInmate?.sex ? `<div class="profile-item"><span class="label">Sex:</span> <span class="value">${rosterInmate.sex}</span></div>` : ''}
              </div>
              <div class="profile-grid-compact" style="margin-top: 8px;">
                ${subject?.partialSsn ? `<div class="profile-item"><span class="label">SSN:</span> <span class="value">XXX-XX-${subject.partialSsn}</span></div>` : ''}
                ${subject?.personId ? `<div class="profile-item"><span class="label">ID:</span> <span class="value">${subject.personId}</span></div>` : ''}
              </div>
            </div>
          </div>
        `;

        // === CHARGES & BOND ===
        const chargesAndBond = parsedData?.recommendations?.filter(r =>
          r.toLowerCase().includes('bond') ||
          r.toLowerCase().includes('charge') ||
          r.toLowerCase().includes('case:')
        ) || [];
        const bondHtml = chargesAndBond.length > 0 ? `
          <h2>Charges & Bond</h2>
          <div class="section">
            ${chargesAndBond.map(item => `<div class="charge-item">${item}</div>`).join('')}
          </div>
        ` : '';

        // === PHONES ===
        const phones = parsedData?.phones || [];
        const phonesHtml = phones.length > 0 ? `
          <h2>Phone Numbers</h2>
          <div class="section">
            ${phones.map(p => `
              <div class="contact-item">
                <span class="phone-number">${p.number}</span>
                ${p.type ? `<span class="phone-type">${p.type}</span>` : ''}
                ${p.carrier ? `<span class="phone-carrier">${p.carrier}</span>` : ''}
                ${p.isActive ? `<span class="phone-active">Active</span>` : ''}
              </div>
            `).join('')}
          </div>
        ` : '';

        // === CONTACTS/RELATIVES (merged with case intel) ===
        const reportRelatives = displayRelatives;
        const contactsHtml = reportRelatives.length > 0 ? `
          <h2>Contacts & References (${reportRelatives.length})</h2>
          <div class="section">
            ${reportRelatives.map((r: any) => `
              <div class="relative-card"${r._intel ? ' style="border-left-color: #22c55e;"' : ''}>
                <div class="relative-name">${r.name} ${r.relationship ? `<span class="relationship">(${r.relationship})</span>` : ''}${r._intel ? ' <span style="background:#22c55e;color:white;padding:1px 4px;border-radius:3px;font-size:9px;">ADDED</span>' : ''}</div>
                ${r.phones?.length ? `<div class="relative-phone">${r.phones.join(', ')}</div>` : r.phone ? `<div class="relative-phone">${r.phone}</div>` : ''}
                ${r.currentAddress || r.address ? `<div class="relative-address">${r.currentAddress || r.address}</div>` : ''}
                ${r._note ? `<div style="font-size:10px;color:#6b7280;margin-top:2px;">Note: ${r._note}</div>` : ''}
              </div>
            `).join('')}
          </div>
        ` : '';

        // === VEHICLES (merged with case intel) ===
        const reportVehicles = displayVehicles;
        const vehiclesHtml = reportVehicles.length > 0 ? `
          <h2>Vehicles (${reportVehicles.length})</h2>
          <div class="section">
            ${reportVehicles.map((v: any) => `
              <div class="vehicle-card">
                <div class="vehicle-info">${v.description || [v.year, v.color, v.make, v.model].filter(Boolean).join(' ')}</div>
                ${v.plate ? `<div class="vehicle-plate">Plate: <strong>${v.plate}</strong>${v.state ? ` (${v.state})` : ''}</div>` : ''}
                ${v.vin ? `<div class="vehicle-vin">VIN: ${v.vin}</div>` : ''}
              </div>
            `).join('')}
          </div>
        ` : '';

        // === EMPLOYMENT ===
        const employment = parsedData?.employment || [];
        const employmentHtml = employment.length > 0 ? `
          <h2>Employment</h2>
          <div class="section">
            ${employment.map(e => `
              <div class="employment-card">
                <div class="employer-name">${e.employer || 'Unknown Employer'}${e.isCurrent ? ' <span class="current-tag">CURRENT</span>' : ''}</div>
                ${e.title ? `<div class="job-title">${e.title}</div>` : ''}
                ${e.address ? `<div class="employer-address">${e.address}</div>` : ''}
                ${e.phone ? `<div class="employer-phone">${e.phone}</div>` : ''}
              </div>
            `).join('')}
          </div>
        ` : '';

        // === WARNINGS/FLAGS (merged with case intel) ===
        const flags = parsedData?.flags || [];
        const intelFlags = caseIntel?.customFlags || [];
        const allFlags = [
          ...intelFlags.map(f => ({ message: f, severity: 'high' })),
          ...flags,
        ];
        const warningsHtml = allFlags.length > 0 ? `
          <h2>Warnings & Safety Notes</h2>
          <div class="section">
            ${allFlags.map((f: any) => `
              <div class="warning-item warning-${f.severity || 'medium'}">
                ${f.message}
              </div>
            `).join('')}
          </div>
        ` : '';

        // === CASE NOTES (merged with case intel) ===
        const caseNotes = parsedData?.recommendations?.filter(r =>
          !r.toLowerCase().includes('bond') &&
          !r.toLowerCase().includes('charge') &&
          !r.toLowerCase().includes('case:')
        ) || [];
        const intelNotes = caseIntel?.notes || [];
        const allNotes = [
          ...intelNotes.map(n => n.text),
          ...caseNotes,
        ];
        const notesHtml = allNotes.length > 0 ? `
          <h2>Case Notes & Investigation Intel</h2>
          <div class="section">
            ${allNotes.map(note => `<div class="case-note">${note}</div>`).join('')}
          </div>
        ` : '';

        const locationsHtml = displayAddresses.slice(0, 8).map((loc: any, i: number) => `
          <div class="location">
            <div>
              <strong style="color: #dc2626;">#${i + 1}</strong>
              <span style="margin-left: 10px;">${loc.fullAddress || loc.address}${loc.city && loc.state ? '' : ''}</span>
              ${loc.reasons?.length ? `<div class="location-reasons">${loc.reasons.slice(0, 2).join(' • ')}</div>` : ''}
            </div>
            ${loc.confidence ? `<span class="probability">${Math.round(loc.confidence * 100)}% confidence</span>` : loc.probability ? `<span class="probability">${loc.probability}% confidence</span>` : ''}
          </div>
        `).join('') || '<p style="color: #9ca3af; font-style: italic;">No locations identified yet. Upload skip trace documents or photos containing addresses.</p>';

        const socialsHtml = socialProfiles.length > 0
          ? socialProfiles.map(p => `
              <span class="social ${p.status === 'found' ? 'found' : p.status === 'not_found' ? 'not-found' : 'not-searched'}">
                ${p.platform}: ${p.status === 'found' ? '✓ Found' : p.status === 'not_found' ? '✗ Not Found' : '○ Not Searched'}
              </span>
            `).join('')
          : `<p style="color: #f59e0b;">No OSINT search performed. ${parsedData?.subject?.fullName ? 'Run search from case screen.' : 'Upload a skip trace report or enter subject name to enable OSINT.'}</p>`;

        // Build photo intel HTML - ONLY show photos that have actionable intel
        const photosWithIntel = allPhotoIntel.filter(intel =>
          intel.exifData?.gps ||
          intel.addresses.length > 0 ||
          intel.vehicles.some(v => v.licensePlate) ||
          intel.businesses.length > 0
        );

        // Generate annotation markers for a photo
        const generateMarkers = (intel: typeof allPhotoIntel[0]) => {
          const markers: string[] = [];
          let markerNum = 1;

          intel.addresses.forEach((a, i) => {
            if (a.boundingBox) {
              markers.push(`<div class="marker" style="left: ${a.boundingBox.x}%; top: ${a.boundingBox.y}%;" title="${a.text}">${markerNum}</div>`);
              markerNum++;
            }
          });

          intel.vehicles.filter(v => v.licensePlate && v.boundingBox).forEach((v) => {
            markers.push(`<div class="marker marker-plate" style="left: ${v.boundingBox!.x}%; top: ${v.boundingBox!.y}%;" title="${v.licensePlate}">${markerNum}</div>`);
            markerNum++;
          });

          intel.businesses.filter(b => b.boundingBox).forEach((b) => {
            markers.push(`<div class="marker marker-biz" style="left: ${b.boundingBox!.x}%; top: ${b.boundingBox!.y}%;" title="${b.name}">${markerNum}</div>`);
            markerNum++;
          });

          return markers.join('');
        };

        // Generate legend for markers
        const generateLegend = (intel: typeof allPhotoIntel[0]) => {
          const items: string[] = [];
          let num = 1;

          intel.addresses.forEach((a) => {
            if (a.boundingBox) {
              items.push(`<div class="legend-item"><span class="legend-num">${num}</span> ${a.text} (${a.confidence})</div>`);
              num++;
            }
          });

          intel.vehicles.filter(v => v.licensePlate && v.boundingBox).forEach((v) => {
            items.push(`<div class="legend-item"><span class="legend-num legend-plate">${num}</span> ${v.licensePlate} - ${v.color} ${v.make || ''}</div>`);
            num++;
          });

          intel.businesses.filter(b => b.boundingBox).forEach((b) => {
            items.push(`<div class="legend-item"><span class="legend-num legend-biz">${num}</span> ${b.name}</div>`);
            num++;
          });

          return items.join('');
        };

        const photoIntelHtml = photosWithIntel.length > 0 ? `
          <h2>Photo Intelligence</h2>
          <style>
            .photo-intel-card { margin-bottom: 10px; padding: 10px; background: #f3f4f6; border-radius: 6px; border-left: 3px solid #dc2626; }
            .photo-container { position: relative; display: inline-block; margin-bottom: 6px; }
            .photo-container img { max-width: 200px; max-height: 150px; border-radius: 4px; border: 1px solid #374151; }
            .marker { position: absolute; width: 18px; height: 18px; background: #dc2626; color: white; border-radius: 50%; font-size: 9px; font-weight: bold; display: flex; align-items: center; justify-content: center; border: 1px solid white; box-shadow: 0 1px 2px rgba(0,0,0,0.3); transform: translate(-50%, -50%); }
            .marker-plate { background: #2563eb; }
            .marker-biz { background: #16a34a; }
            .legend-item { font-size: 11px; margin: 2px 0; display: flex; align-items: center; gap: 6px; }
            .legend-num { width: 14px; height: 14px; background: #dc2626; color: white; border-radius: 50%; font-size: 9px; font-weight: bold; display: inline-flex; align-items: center; justify-content: center; }
            .legend-plate { background: #2563eb; }
            .legend-biz { background: #16a34a; }
            .intel-details { margin-top: 6px; padding-top: 6px; border-top: 1px solid #d1d5db; }
          </style>
          <div class="section">
            ${photosWithIntel.map((intel) => `
              <div class="photo-intel-card">
                <p style="font-weight: bold; margin-bottom: 6px; font-size: 12px;">${intel.sourceFileName || 'Unknown file'}</p>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                  ${intel.thumbnailBase64 ? `
                    <div class="photo-container">
                      <img src="${intel.thumbnailBase64}" alt="${intel.sourceFileName || 'Evidence photo'}" />
                      ${generateMarkers(intel)}
                    </div>
                  ` : ''}
                  <div style="flex: 1; min-width: 150px;">
                    ${generateLegend(intel)}
                    <div class="intel-details">
                      ${intel.exifData?.gps ? `<p style="font-size: 11px;"><strong>GPS:</strong> <a href="${intel.exifData.gps.googleMapsUrl}">${intel.exifData.gps.latitude.toFixed(6)}, ${intel.exifData.gps.longitude.toFixed(6)}</a></p>` : ''}
                      ${intel.addresses.filter(a => !a.boundingBox).length > 0 ? `<p style="font-size: 11px;"><strong>Other addresses:</strong> ${intel.addresses.filter(a => !a.boundingBox).map(a => a.text).join(', ')}</p>` : ''}
                    </div>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : '';

        // Calculate statistics
        const totalPhotos = allPhotoIntel.length;
        const photosWithData = photosWithIntel.length;
        const totalAddresses = allPhotoIntel.reduce((sum, i) => sum + i.addresses.length, 0);
        const totalPlates = allPhotoIntel.reduce((sum, i) => sum + i.vehicles.filter(v => v.licensePlate).length, 0);
        const gpsPhotos = allPhotoIntel.filter(i => i.exifData?.gps).length;
        const socialFound = socialProfiles.filter(p => p.status === 'found').length;
        const socialTotal = socialProfiles.length;

        // Generate executive summary
        const summaryItems: string[] = [];
        if (totalAddresses > 0) summaryItems.push(`${totalAddresses} address(es) identified`);
        if (totalPlates > 0) summaryItems.push(`${totalPlates} license plate(s) captured`);
        if (gpsPhotos > 0) summaryItems.push(`${gpsPhotos} photo(s) with GPS coordinates`);
        if (socialFound > 0) summaryItems.push(`${socialFound} social media profile(s) confirmed`);
        if (displayAddresses.length > 0) summaryItems.push(`${displayAddresses.length} known location(s)`);

        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Investigation Report - ${(parsedData?.subject?.fullName && parsedData.subject.fullName !== 'Unknown') ? parsedData.subject.fullName : caseData?.name}</title>
              <style>
                body { font-family: -apple-system, Arial, sans-serif; margin: 0; color: #1f2937; font-size: 12px; line-height: 1.4; }
                .header { background: linear-gradient(135deg, #18181b 0%, #27272a 100%); color: white; padding: 16px 30px; }
                .header h1 { margin: 0 0 4px 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
                .header .subtitle { color: #a1a1aa; font-size: 12px; }
                .header .case-id { color: #dc2626; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
                .content { padding: 16px 30px; max-width: 900px; }
                .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
                .meta-card { background: #f9fafb; border-radius: 6px; padding: 10px; text-align: center; border: 1px solid #e5e7eb; }
                .meta-card .value { font-size: 20px; font-weight: 700; color: #dc2626; }
                .meta-card .label { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
                h2 { color: #18181b; font-size: 14px; font-weight: 600; margin: 14px 0 8px 0; padding-bottom: 4px; border-bottom: 2px solid #dc2626; }
                .section { margin-bottom: 10px; }
                .summary-list { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px 14px; }
                .summary-list li { margin: 3px 0; color: #166534; }
                .location { padding: 8px 12px; margin: 4px 0; background: white; border-left: 3px solid #dc2626; border-radius: 0 4px 4px 0; box-shadow: 0 1px 2px rgba(0,0,0,0.08); display: flex; justify-content: space-between; align-items: center; }
                .location .probability { background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; }
                .social { display: inline-block; padding: 4px 8px; margin: 2px; border-radius: 4px; font-size: 10px; font-weight: 500; }
                .found { background: #dcfce7; color: #166534; }
                .not-found { background: #fee2e2; color: #991b1b; }
                .not-searched { background: #fef3c7; color: #92400e; }
                .confidential { background: #fef3c7; border: 1px solid #fcd34d; border-radius: 6px; padding: 10px 14px; margin-top: 16px; }
                .footer { margin-top: 20px; padding-top: 12px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 10px; text-align: center; }
                /* Profile styles with photo */
                .profile-card-with-photo { display: flex; gap: 14px; background: #f9fafb; border-radius: 6px; padding: 10px 14px; border: 1px solid #e5e7eb; }
                .subject-photo { flex-shrink: 0; }
                .subject-photo img { width: 90px; height: 112px; object-fit: cover; border-radius: 4px; border: 2px solid #dc2626; }
                .subject-photo-placeholder { width: 90px; height: 112px; background: #e5e7eb; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #6b7280; font-weight: 600; }
                .profile-details { flex: 1; }
                .profile-name { font-size: 16px; font-weight: 700; color: #18181b; margin-bottom: 2px; }
                .profile-aliases { font-size: 11px; color: #6b7280; font-style: italic; margin-bottom: 6px; }
                .profile-grid-compact { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
                .profile-card { background: #f9fafb; border-radius: 6px; padding: 10px 14px; border: 1px solid #e5e7eb; }
                .profile-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
                .profile-item { font-size: 12px; }
                .profile-item .label { color: #6b7280; }
                .profile-item .value { font-weight: 600; color: #18181b; margin-left: 4px; }
                /* Charges/Bond styles */
                .charge-item { padding: 6px 10px; margin: 3px 0; background: #fef2f2; border-left: 3px solid #dc2626; border-radius: 0 4px 4px 0; font-size: 12px; color: #991b1b; }
                /* Phone styles */
                .contact-item { padding: 6px 10px; margin: 3px 0; background: #f9fafb; border-radius: 4px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
                .phone-number { font-weight: 600; font-size: 12px; font-family: monospace; }
                .phone-type, .phone-carrier { background: #e5e7eb; color: #374151; padding: 1px 6px; border-radius: 3px; font-size: 10px; text-transform: uppercase; }
                .phone-active { background: #dcfce7; color: #166534; padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: 600; }
                /* Relative/Contact styles */
                .relative-card { padding: 8px 10px; margin: 4px 0; background: #f9fafb; border-left: 3px solid #3b82f6; border-radius: 0 4px 4px 0; }
                .relative-name { font-weight: 600; font-size: 12px; color: #18181b; }
                .relationship { font-weight: 400; color: #6b7280; font-size: 11px; }
                .relative-phone, .relative-address { font-size: 11px; color: #374151; margin-top: 2px; }
                /* Vehicle styles */
                .vehicle-card { padding: 8px 10px; margin: 4px 0; background: #f0f9ff; border-left: 3px solid #0ea5e9; border-radius: 0 4px 4px 0; }
                .vehicle-info { font-weight: 600; font-size: 12px; color: #0c4a6e; }
                .vehicle-plate { font-size: 12px; color: #18181b; margin-top: 2px; }
                .vehicle-plate strong { font-family: monospace; background: #fef3c7; padding: 1px 4px; border-radius: 3px; }
                .vehicle-vin { font-size: 10px; color: #6b7280; font-family: monospace; }
                /* Employment styles */
                .employment-card { padding: 8px 10px; margin: 4px 0; background: #f0fdf4; border-left: 3px solid #22c55e; border-radius: 0 4px 4px 0; }
                .employer-name { font-weight: 600; font-size: 12px; color: #166534; }
                .current-tag { background: #22c55e; color: white; padding: 1px 4px; border-radius: 3px; font-size: 9px; margin-left: 6px; }
                .job-title { font-size: 11px; color: #374151; font-style: italic; }
                .employer-address, .employer-phone { font-size: 11px; color: #374151; margin-top: 2px; }
                /* Warning styles */
                .warning-item { padding: 8px 10px; margin: 4px 0; border-radius: 4px; font-size: 12px; }
                .warning-high { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
                .warning-medium { background: #fef3c7; border: 1px solid #fcd34d; color: #92400e; }
                .warning-low { background: #f0f9ff; border: 1px solid #bae6fd; color: #0c4a6e; }
                /* Case notes styles */
                .case-note { padding: 6px 10px; margin: 3px 0; background: #f9fafb; border-radius: 4px; font-size: 12px; color: #374151; }
                /* Location reasons */
                .location-reasons { font-size: 10px; color: #6b7280; margin-top: 2px; }
                .print-bar { position: fixed; top: 0; left: 0; right: 0; background: #18181b; padding: 10px 30px; display: flex; gap: 10px; z-index: 100; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
                .print-bar button { padding: 8px 20px; border: none; border-radius: 6px; font-weight: 600; font-size: 13px; cursor: pointer; }
                .print-btn { background: #dc2626; color: white; }
                .print-btn:hover { background: #b91c1c; }
                .pdf-btn { background: #3b82f6; color: white; }
                .pdf-btn:hover { background: #2563eb; }
                .close-btn { background: #27272a; color: #a1a1aa; margin-left: auto; }
                .close-btn:hover { background: #3f3f46; }
                .header { margin-top: 50px; }
                @media print {
                  body { margin: 0; }
                  .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin-top: 0; }
                  .print-bar { display: none !important; }
                }
              </style>
            </head>
            <body>
              <div class="print-bar">
                <button class="print-btn" onclick="window.print()">Print / Save PDF</button>
                <button class="close-btn" onclick="window.close()">Close</button>
              </div>
              <div class="header">
                <div class="case-id">Elite Recovery System • Case File</div>
                <h1>${(parsedData?.subject?.fullName && parsedData.subject.fullName !== 'Unknown') ? parsedData.subject.fullName : caseData?.name}</h1>
                <div class="subtitle">Investigation Report • Generated ${new Date().toLocaleString()}</div>
              </div>

              <div class="content">
                <div class="meta-grid" style="grid-template-columns: repeat(3, 1fr);">
                  <div class="meta-card">
                    <div class="value">${uploadedFiles.length}</div>
                    <div class="label">Files Analyzed</div>
                  </div>
                  <div class="meta-card">
                    <div class="value">${displayAddresses.length}</div>
                    <div class="label">Locations</div>
                  </div>
                  <div class="meta-card">
                    <div class="value">${displayRelatives.length + (parsedData?.phones?.length || 0)}</div>
                    <div class="label">Contacts</div>
                  </div>
                </div>

                ${summaryItems.length > 0 ? `
                  <h2>Executive Summary</h2>
                  <div class="summary-list">
                    <ul>
                      ${summaryItems.map(item => `<li>${item}</li>`).join('')}
                    </ul>
                  </div>
                ` : ''}

                ${subjectHtml}

                ${warningsHtml}

                ${bondHtml}

                <h2>Priority Locations</h2>
                <div class="section">${locationsHtml}</div>

                ${phonesHtml}

                ${contactsHtml}

                ${vehiclesHtml}

                ${employmentHtml}

                ${photoIntelHtml}

                ${notesHtml}

                <div class="confidential">
                  <div>
                    <strong>CONFIDENTIAL</strong><br>
                    <span style="font-size: 11px; color: #92400e;">For authorized bail enforcement and fugitive recovery personnel only. Unauthorized disclosure prohibited.</span>
                  </div>
                </div>

                <div class="footer">
                  Elite Recovery System • Professional Bail Enforcement Intelligence<br>
                  Report ID: ${caseData?.id?.slice(0, 8).toUpperCase() || 'N/A'} • ${new Date().toISOString()}
                </div>
              </div>
            </body>
            </html>
          `);
          printWindow.document.close();
          printWindow.focus();
        }
      }
    } catch (err) {
      console.error('Report generation failed:', err);
    }

    setIsGeneratingReport(false);
  };

  const handleEditName = () => {
    setEditedName(getSubjectName());
    setIsEditingName(true);
  };

  const handleSaveName = async () => {
    const trimmed = editedName.trim();
    if (trimmed && trimmed !== getSubjectName() && caseData?.id) {
      try {
        await updateCase(caseData.id, { name: trimmed });
        await refresh();
      } catch (err) {
        console.error('Failed to update name:', err);
      }
    }
    setIsEditingName(false);
  };

  const handleDelete = async () => {
    const confirmed = await confirm({ title: 'Delete Case', message: `Delete "${caseData?.name}"?`, confirmText: 'Delete', destructive: true });
    if (confirmed) {
      // Navigate back IMMEDIATELY
      router.push('/(tabs)');

      // Cleanup in background (don't block UI)
      Promise.all([
        deleteCase(id!),
        deleteCaseDirectory(id!),
        AsyncStorage.multiRemove([`case_chat_${id}`, `case_photo_${id}`, `case_squad_${id}`, `case_social_${id}`, `case_all_photo_intel_${id}`, `case_face_${id}`, `case_insights_${id}`]),
      ]).catch(err => console.error('Delete error:', err));
    }
  };

  if (!caseData) {
    return <View style={styles.loading}><ActivityIndicator size="large" color={DARK.primary} /></View>;
  }

  // Merge case intel into display data
  const excludePatterns = caseIntel?.excludePatterns || [];
  const shouldExclude = (text: string) => excludePatterns.some(p => text.toLowerCase().includes(p));

  // Addresses: intel-added first, then parsed, filter exclusions
  const intelAddrs = (caseIntel?.addresses || []).map(a => ({
    fullAddress: a.address, address: a.address, confidence: a.important ? 1 : 0.7,
    reasons: [a.note || a.type].filter(Boolean), isCurrent: a.important, _intel: true,
  }));
  const mergedAddresses = [
    ...intelAddrs,
    ...addresses.filter((a: any) =>
      !shouldExclude(a.fullAddress || a.address || '') &&
      !intelAddrs.some(ia => (a.fullAddress || a.address || '').toLowerCase().includes(ia.fullAddress.toLowerCase().slice(0, 15)))
    ),
  ];
  const displayAddresses = mergedAddresses.length > 0 ? mergedAddresses : squadLocations.map(l => ({ fullAddress: l.address, probability: l.probability }));

  // Contacts: intel-added first, then parsed relatives
  const intelContacts = (caseIntel?.contacts || []).map(c => ({
    name: c.name, relationship: c.relationship, phone: c.phone,
    phones: c.phone ? [c.phone] : [], currentAddress: c.address, _intel: true,
  }));
  const displayRelatives = [
    ...intelContacts,
    ...relatives.filter((r: any) =>
      !intelContacts.some(ic => ic.name.toLowerCase() === (r.name || '').toLowerCase())
    ),
  ];

  // Vehicles: intel-added + parsed
  const intelVehicles = (caseIntel?.vehicles || []).map(v => ({
    year: '', make: '', model: '', color: '', description: v.description,
    plate: v.plate, vin: v.vin, _intel: true,
  }));
  const displayVehicles = [...intelVehicles, ...(parsedData?.vehicles || [])];

  const getPlatformColor = (platform: string) => {
    const colors: Record<string, string> = {
      Facebook: DARK.facebook,
      Instagram: DARK.instagram,
      TikTok: '#ff0050',
      'Twitter/X': DARK.twitter,
      Twitter: DARK.twitter,
      LinkedIn: DARK.linkedin,
      Snapchat: '#fffc00',
    };
    return colors[platform] || DARK.primary;
  };

  return (
    <View style={styles.container}>
      {isWeb && (
        <>
          <input ref={fileInputRef as any} type="file" accept=".pdf,.txt,.doc,.docx,image/*" multiple onChange={handleFileChange as any} style={{ display: 'none' }} />
          <input ref={profilePhotoInputRef as any} type="file" accept="image/*" onChange={handleProfilePhotoChange as any} style={{ display: 'none' }} />
        </>
      )}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)')}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={24} color={DARK.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.photoBox} onPress={() => setShowPhotoPicker(true)}>
          {subjectPhoto ? <Image source={{ uri: subjectPhoto }} style={styles.photoImg} /> : <Ionicons name="person" size={20} color={DARK.textMuted} />}
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          {isEditingName ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput
                value={editedName}
                onChangeText={setEditedName}
                onSubmitEditing={handleSaveName}
                onBlur={handleSaveName}
                autoFocus
                style={[styles.caseName, { borderBottomWidth: 1, borderBottomColor: DARK.primary, paddingBottom: 2, minWidth: 150 }]}
              />
              <TouchableOpacity onPress={handleSaveName}>
                <Ionicons name="checkmark" size={20} color={DARK.success} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setIsEditingName(false)}>
                <Ionicons name="close" size={20} color={DARK.textMuted} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={handleEditName} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.caseName} numberOfLines={1}>{getSubjectName()}</Text>
              <Ionicons name="pencil" size={14} color={DARK.textMuted} />
            </TouchableOpacity>
          )}
          <Text style={styles.caseMeta}>{displayAddresses.length} locations • {phones.length} phones • {uploadedFiles.length} files</Text>
        </View>
        <TouchableOpacity onPress={generateFullReport} disabled={isGeneratingReport} style={[styles.reportBtn, isGeneratingReport && { opacity: 0.5 }]}>
          {isGeneratingReport ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="document-text" size={18} color="#fff" />}
          <Text style={styles.reportBtnText}>Report</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push(`/case/${id}/wanted`)} style={[styles.reportBtn, { backgroundColor: '#dc2626' }]}>
          <Ionicons name="warning" size={18} color="#fff" />
          <Text style={styles.reportBtnText}>Wanted</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDelete} style={styles.headerBtn}>
          <Ionicons name="trash-outline" size={20} color={DARK.danger} />
        </TouchableOpacity>
      </View>

      {/* 3-COLUMN LAYOUT - Equal width on desktop, stacked on mobile */}
      <View style={[
        styles.columns,
        isWeb && !isMobile && { display: 'flex', flexDirection: 'row' },
        isMobile && { flexDirection: 'column' }
      ]}>

        {/* COLUMN 1: Chat (Drop Zone for files) */}
        <View
          nativeID="chat-drop-zone"
          style={[
            styles.col,
            styles.chatCol,
            isWeb && !isMobile && { flex: 1 },
            isMobile && { height: 300 },
            isDragOver && { borderColor: DARK.primary, borderWidth: 2, borderStyle: 'dashed' }
          ]}
        >
          <View style={styles.colTitleRow}>
            <View>
              <Text style={styles.colTitleText}>Agent Dialogue</Text>
              <Text style={styles.colSubtitle}>AI reasoning alongside you</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                const text = chatMessages.map(m => `[${m.role}] ${m.content}`).join('\n\n');
                if (isWeb && navigator.clipboard) {
                  navigator.clipboard.writeText(text);
                  alert('Chat copied to clipboard');
                }
              }}
              style={styles.copyBtn}
            >
              <Ionicons name="copy-outline" size={14} color={DARK.textMuted} />
            </TouchableOpacity>
          </View>
          {/* Drag-over indicator */}
          {isDragOver && (
            <View style={styles.dropOverlay}>
              <Ionicons name="cloud-upload" size={32} color={DARK.primary} />
              <Text style={styles.dropText}>Drop files here</Text>
            </View>
          )}
          <ScrollView
            ref={scrollRef}
            style={styles.chatScroll}
            contentContainerStyle={{ padding: 8 }}
          >
            {chatMessages.map((msg) => (
              <View key={msg.id} style={[styles.bubble, msg.role === 'user' ? styles.userBubble : msg.role === 'system' ? styles.systemBubble : styles.agentBubble]}>
                <Text style={[styles.bubbleText, msg.role === 'user' && { color: '#fff' }, msg.role === 'system' && { color: DARK.success, fontSize: 12 }]}>{msg.content}</Text>
              </View>
            ))}
            {(isSending || isProcessingFile) && (
              <View style={[styles.bubble, styles.agentBubble]}><ActivityIndicator size="small" color={DARK.primary} /></View>
            )}
          </ScrollView>
          <View style={styles.inputRow}>
            <TouchableOpacity onPress={() => fileInputRef.current?.click()} style={styles.attachBtn}>
              <Ionicons name="attach" size={20} color={DARK.textSecondary} />
            </TouchableOpacity>
            <TextInput
              ref={chatInputRef}
              style={styles.input}
              placeholder="Message..."
              placeholderTextColor={DARK.textMuted}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={sendMessage}
              blurOnSubmit={false}
              returnKeyType="send"
              autoFocus={true}
            />
            <TouchableOpacity onPress={sendMessage} disabled={!inputText.trim()} style={[styles.sendBtn, !inputText.trim() && { opacity: 0.4 }]}>
              <Ionicons name="send" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* COLUMN 2: Intel/Data Output */}
        <View style={[
          styles.col,
          styles.mapCol,
          isWeb && !isMobile && { flex: 1.5 },
          isMobile && { height: 400 }
        ]}>
          <Text style={styles.colTitle}>CASE INTELLIGENCE</Text>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 8 }}
            refreshControl={
              <RefreshControl
                refreshing={intelRefreshing}
                onRefresh={async () => {
                  setIntelRefreshing(true);
                  if (id) {
                    const freshIntel = await loadCaseIntel(id);
                    setCaseIntel(freshIntel);
                  }
                  await refresh();
                  setIntelRefreshing(false);
                }}
                tintColor={DARK.primary}
                colors={[DARK.primary]}
              />
            }
          >
            {/* AGENT INSIGHTS - auto-captured AI analysis */}
            {agentInsights.length > 0 && (
              <View style={styles.insightsWrapper}>
                <TouchableOpacity
                  style={styles.insightsHeader}
                  onPress={() => setInsightsExpanded(!insightsExpanded)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons
                      name={insightsExpanded ? 'chevron-down' : 'chevron-forward'}
                      size={14}
                      color="#8b5cf6"
                    />
                    <Text style={styles.insightsTitle}>AGENT INSIGHTS ({agentInsights.length})</Text>
                  </View>
                </TouchableOpacity>
                {insightsExpanded && (
                  <ScrollView
                    style={[styles.insightsContainer, isMobile && { maxHeight: 200 }]}
                    nestedScrollEnabled
                  >
                    {agentInsights.map((insight) => {
                      const isExpanded = expandedInsightId === insight.id;
                      return (
                        <View key={insight.id} style={styles.insightCard}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <Text style={styles.insightTime}>{formatInsightTime(insight.capturedAt)}</Text>
                            <TouchableOpacity
                              onPress={() => addInsightToReport(insight)}
                              disabled={insight.addedToReport}
                              style={insight.addedToReport ? styles.insightAddedBtn : styles.insightAddBtn}
                            >
                              <Ionicons
                                name={insight.addedToReport ? 'checkmark' : 'add'}
                                size={16}
                                color={insight.addedToReport ? DARK.success : '#8b5cf6'}
                              />
                            </TouchableOpacity>
                          </View>
                          <TouchableOpacity
                            onPress={() => setExpandedInsightId(isExpanded ? null : insight.id)}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={isExpanded ? styles.insightFull : styles.insightPreview}
                              numberOfLines={isExpanded ? undefined : 3}
                            >
                              {isExpanded ? insight.fullText : insight.preview}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            )}

            {/* PRIMARY TARGET Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>PRIMARY TARGET</Text>
              <View style={styles.intelCard}>
                <Text style={styles.intelName}>{getSubjectName()}</Text>
                {(parsedData?.subject?.dob || caseData?.primaryTarget?.dob || caseData?.rosterData?.inmate?.dob) && (
                  <Text style={styles.intelDetail}>DOB: {parsedData?.subject?.dob || caseData?.primaryTarget?.dob || caseData?.rosterData?.inmate?.dob}</Text>
                )}
                {(parsedData?.subject?.height || parsedData?.subject?.weight || caseData?.rosterData?.inmate?.height || caseData?.rosterData?.inmate?.weight) && (
                  <Text style={styles.intelDetail}>
                    {[
                      (parsedData?.subject?.height || caseData?.rosterData?.inmate?.height) ? `Height: ${parsedData?.subject?.height || caseData?.rosterData?.inmate?.height}` : null,
                      (parsedData?.subject?.weight || caseData?.rosterData?.inmate?.weight) ? `Weight: ${parsedData?.subject?.weight || caseData?.rosterData?.inmate?.weight}` : null,
                    ].filter(Boolean).join('  |  ')}
                  </Text>
                )}
                {(parsedData?.subject?.race || parsedData?.subject?.sex || caseData?.rosterData?.inmate?.race || caseData?.rosterData?.inmate?.sex) && (
                  <Text style={styles.intelDetail}>
                    {[
                      (parsedData?.subject?.race || caseData?.rosterData?.inmate?.race) ? `Race: ${parsedData?.subject?.race || caseData?.rosterData?.inmate?.race}` : null,
                      (parsedData?.subject?.sex || caseData?.rosterData?.inmate?.sex) ? `Sex: ${parsedData?.subject?.sex || caseData?.rosterData?.inmate?.sex}` : null,
                    ].filter(Boolean).join('  |  ')}
                  </Text>
                )}
                {(parsedData?.subject?.hairColor || parsedData?.subject?.eyeColor || caseData?.rosterData?.inmate?.hair || caseData?.rosterData?.inmate?.eyes) && (
                  <Text style={styles.intelDetail}>
                    {[
                      (parsedData?.subject?.hairColor || caseData?.rosterData?.inmate?.hair) ? `Hair: ${parsedData?.subject?.hairColor || caseData?.rosterData?.inmate?.hair}` : null,
                      (parsedData?.subject?.eyeColor || caseData?.rosterData?.inmate?.eyes) ? `Eyes: ${parsedData?.subject?.eyeColor || caseData?.rosterData?.inmate?.eyes}` : null,
                    ].filter(Boolean).join('  |  ')}
                  </Text>
                )}
                {(parsedData?.subject?.driversLicense) && (
                  <Text style={styles.intelDetail}>DL: {parsedData.subject.driversLicense}</Text>
                )}
                {parsedData?.subject?.partialSsn && <Text style={styles.intelDetail}>SSN: ***-**-{parsedData.subject.partialSsn.slice(-4)}</Text>}
                {(parsedData?.subject?.phone) && (
                  <Text style={styles.intelDetail}>Phone: {parsedData.subject.phone}</Text>
                )}
                {(parsedData?.subject?.email) && (
                  <Text style={styles.intelDetail}>Email: {parsedData.subject.email}</Text>
                )}
                {parsedData?.subject?.aliases && parsedData.subject.aliases.length > 0 && <Text style={styles.intelDetail}>AKA: {parsedData.subject.aliases.join(', ')}</Text>}
              </View>
            </View>

            {/* Locations with Map */}
            {displayAddresses.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>LOCATIONS ({displayAddresses.length})</Text>
                {/* Compact Map */}
                <TouchableOpacity onPress={() => openMaps(displayAddresses[0].fullAddress)} style={styles.compactMap}>
                  {isWeb ? (
                    <iframe
                      src={settings.googleMapsApiKey
                        ? `https://www.google.com/maps/embed/v1/place?key=${settings.googleMapsApiKey}&q=${encodeURIComponent(displayAddresses[0].fullAddress)}&zoom=14`
                        : `https://www.google.com/maps?q=${encodeURIComponent(displayAddresses[0].fullAddress)}&output=embed&z=14`}
                      style={{ width: '100%', height: '100%', border: 'none', borderRadius: 6 }}
                      loading="lazy"
                    />
                  ) : (
                    <View style={styles.mapPlaceholder}><Ionicons name="map" size={24} color={DARK.primary} /></View>
                  )}
                </TouchableOpacity>

                {/* All locations with descriptions */}
                {displayAddresses.slice(0, 8).map((addr: any, idx: number) => (
                  <TouchableOpacity key={idx} style={styles.locRowEnhanced} onPress={() => openMaps(addr.fullAddress || addr.address)}>
                    <View style={styles.rankBadge}><Text style={styles.rankText}>{idx + 1}</Text></View>
                    <View style={styles.locDetails}>
                      <Text style={styles.locAddr} numberOfLines={1}>{addr.fullAddress || addr.address}</Text>
                      <Text style={styles.locSource}>
                        {addr.reasons?.[0] || addr.type || (addr.isCurrent ? 'Current residence' : 'From case documents')}
                      </Text>
                    </View>
                    {(addr.confidence || addr.probability) && (
                      <Text style={styles.locProb}>{addr.probability || Math.round((addr.confidence || 0) * 100)}%</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* LINK ANALYSIS / RELATIONSHIP MAP */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>LINK ANALYSIS</Text>
              <View style={styles.linkMap}>
                {/* PRIMARY TARGET in center - NEVER changes */}
                <View style={styles.linkCenter}>
                  {subjectPhoto ? (
                    <Image source={{ uri: subjectPhoto }} style={styles.linkPhoto} />
                  ) : (
                    <View style={styles.linkPhotoPlaceholder}>
                      <Ionicons name="person" size={24} color={DARK.textMuted} />
                    </View>
                  )}
                  <Text style={styles.linkName} numberOfLines={1}>
                    {getSubjectName()}
                  </Text>
                  <Text style={styles.linkTargetBadge}>PRIMARY TARGET</Text>
                </View>

                {/* Connection lines container */}
                <View style={styles.linkConnections}>
                  {/* Relatives/Associates - use merged list with intel */}
                  {displayRelatives.slice(0, 6).map((rel: any, idx: number) => {
                    const nodeId = `rel-${idx}`;
                    const isSelected = selectedLinkNode === nodeId;
                    const isEditing = editingLinkRel === nodeId;
                    const displayName = normalizeName(rel.name) || 'Unknown';
                    return (
                      <TouchableOpacity
                        key={nodeId}
                        style={styles.linkNode}
                        onPress={() => {
                          if (isEditing) return;
                          if (isSelected && rel.phones?.[0]) {
                            Linking.openURL(`tel:${rel.phones[0]}`);
                          } else {
                            setSelectedLinkNode(isSelected ? null : nodeId);
                            setEditingLinkRel(null);
                          }
                        }}
                      >
                        <View style={styles.linkLine} />
                        <View style={[styles.linkBubble, { backgroundColor: '#3b82f620', borderColor: '#3b82f6' }, isSelected && styles.linkBubbleSelected]}>
                          <Ionicons name="people" size={isSelected ? 16 : 12} color="#3b82f6" />
                          <Text style={[styles.linkLabel, isSelected && styles.linkLabelSelected]} numberOfLines={isSelected ? 3 : 1}>{displayName}</Text>
                          {isEditing ? (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginTop: 4, maxWidth: 200 }}>
                              {RELATIONSHIP_OPTIONS.map(r => (
                                <TouchableOpacity
                                  key={r}
                                  onPress={() => updateAssociateRelationship(rel.name, r)}
                                  style={[styles.relOption, rel.relationship === r && styles.relOptionActive]}
                                >
                                  <Text style={[styles.relOptionText, rel.relationship === r && styles.relOptionTextActive]}>{r}</Text>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          ) : (
                            <Text style={styles.linkType}>{rel.relationship || 'associate'}</Text>
                          )}
                          {rel.phones?.[0] && <Text style={styles.linkPhone}>{rel.phones[0]}</Text>}
                          {isSelected && rel.currentAddress && <Text style={styles.linkAddress}>{rel.currentAddress}</Text>}
                          {isSelected && !isEditing && (
                            <View style={styles.linkActions}>
                              <TouchableOpacity onPress={() => setEditingLinkRel(nodeId)} style={styles.linkActionBtn}>
                                <Ionicons name="pencil" size={12} color="#3b82f6" />
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => removeAssociate(rel.name)} style={styles.linkActionBtn}>
                                <Ionicons name="close" size={12} color="#ef4444" />
                              </TouchableOpacity>
                            </View>
                          )}
                          {isSelected && !isEditing && rel.phones?.[0] && <Text style={styles.linkTapHint}>Tap to call</Text>}
                        </View>
                      </TouchableOpacity>
                    );
                  })}

                  {/* Employment */}
                  {(parsedData?.employment || []).slice(0, 2).map((emp: any, idx: number) => {
                    const nodeId = `emp-${idx}`;
                    const isSelected = selectedLinkNode === nodeId;
                    return (
                      <TouchableOpacity
                        key={nodeId}
                        style={styles.linkNode}
                        onPress={() => {
                          if (isSelected && emp.address) {
                            openMaps(emp.address);
                          } else {
                            setSelectedLinkNode(isSelected ? null : nodeId);
                          }
                        }}
                      >
                        <View style={styles.linkLine} />
                        <View style={[styles.linkBubble, { backgroundColor: '#22c55e20', borderColor: '#22c55e' }, isSelected && styles.linkBubbleSelected]}>
                          <Ionicons name="briefcase" size={isSelected ? 16 : 12} color="#22c55e" />
                          <Text style={[styles.linkLabel, isSelected && styles.linkLabelSelected]} numberOfLines={isSelected ? 3 : 1}>{emp.employer}</Text>
                          <Text style={styles.linkType}>{emp.title || 'employer'}</Text>
                          {isSelected && emp.address && <Text style={styles.linkAddress}>{emp.address}</Text>}
                          {isSelected && emp.phone && <Text style={styles.linkPhone}>{emp.phone}</Text>}
                          {isSelected && <Text style={styles.linkTapHint}>Tap for maps</Text>}
                        </View>
                      </TouchableOpacity>
                    );
                  })}

                  {/* Vehicles */}
                  {displayVehicles.slice(0, 2).map((v: any, idx: number) => {
                    const nodeId = `veh-${idx}`;
                    const isSelected = selectedLinkNode === nodeId;
                    return (
                      <TouchableOpacity
                        key={nodeId}
                        style={styles.linkNode}
                        onPress={() => setSelectedLinkNode(isSelected ? null : nodeId)}
                      >
                        <View style={styles.linkLine} />
                        <View style={[styles.linkBubble, { backgroundColor: '#f59e0b20', borderColor: '#f59e0b' }, isSelected && styles.linkBubbleSelected]}>
                          <Ionicons name="car" size={isSelected ? 16 : 12} color="#f59e0b" />
                          <Text style={[styles.linkLabel, isSelected && styles.linkLabelSelected]} numberOfLines={isSelected ? 3 : 1}>{v.description || `${v.year} ${v.make} ${v.model}`.trim()}</Text>
                          {v.plate && <Text style={[styles.linkType, { fontWeight: '700' }]}>{v.plate}</Text>}
                          {isSelected && v.color && <Text style={styles.linkPhone}>Color: {v.color}</Text>}
                          {isSelected && v.vin && <Text style={styles.linkPhone}>VIN: {v.vin}</Text>}
                        </View>
                      </TouchableOpacity>
                    );
                  })}

                  {/* Top addresses */}
                  {displayAddresses.slice(0, 3).map((addr: any, idx: number) => {
                    const nodeId = `addr-${idx}`;
                    const isSelected = selectedLinkNode === nodeId;
                    return (
                      <TouchableOpacity
                        key={nodeId}
                        style={styles.linkNode}
                        onPress={() => {
                          if (isSelected) {
                            openMaps(addr.fullAddress || addr.address);
                          } else {
                            setSelectedLinkNode(isSelected ? null : nodeId);
                          }
                        }}
                      >
                        <View style={styles.linkLine} />
                        <View style={[styles.linkBubble, { backgroundColor: '#dc262620', borderColor: '#dc2626' }, isSelected && styles.linkBubbleSelected]}>
                          <Ionicons name="location" size={isSelected ? 16 : 12} color="#dc2626" />
                          <Text style={[styles.linkLabel, isSelected && styles.linkLabelSelected]} numberOfLines={isSelected ? 3 : 1}>
                            {isSelected ? (addr.fullAddress || addr.address) : (addr.city || addr.fullAddress?.split(',')[0] || 'Location')}
                          </Text>
                          <Text style={styles.linkType}>{addr.reasons?.[0]?.slice(0, 25) || addr.type || 'address'}</Text>
                          {isSelected && <Text style={styles.linkTapHint}>Tap for maps</Text>}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {displayRelatives.length === 0 && (parsedData?.employment || []).length === 0 && displayAddresses.length === 0 && (
                  <Text style={styles.linkEmpty}>Upload documents to build relationship map</Text>
                )}

                {/* Add Associate */}
                {showAddAssociate ? (
                  <View style={styles.addAssocForm}>
                    <TextInput
                      style={styles.addAssocInput}
                      placeholder="Name"
                      placeholderTextColor={DARK.textMuted}
                      value={newAssocName}
                      onChangeText={setNewAssocName}
                      autoFocus
                    />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
                      {RELATIONSHIP_OPTIONS.slice(0, 8).map(r => (
                        <TouchableOpacity
                          key={r}
                          onPress={() => setNewAssocRel(r)}
                          style={[styles.relOption, newAssocRel === r && styles.relOptionActive]}
                        >
                          <Text style={[styles.relOptionText, newAssocRel === r && styles.relOptionTextActive]}>{r}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                      <TouchableOpacity onPress={addManualAssociate} style={styles.addAssocConfirm}>
                        <Text style={styles.addAssocConfirmText}>Add</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => { setShowAddAssociate(false); setNewAssocName(''); }} style={styles.addAssocCancel}>
                        <Text style={styles.addAssocCancelText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.addAssocBtn} onPress={() => setShowAddAssociate(true)}>
                    <Ionicons name="add-circle-outline" size={16} color={DARK.textMuted} />
                    <Text style={styles.addAssocBtnText}>Add Associate</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Phones */}
            {phones.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>PHONES ({phones.length})</Text>
                {phones.slice(0, 5).map((p: any, idx: number) => (
                  <TouchableOpacity key={idx} style={styles.phoneRow} onPress={() => Linking.openURL(`tel:${p.number}`)}>
                    <Ionicons name="call" size={14} color={DARK.success} />
                    <Text style={styles.phoneNum}>{p.number}</Text>
                    <Text style={styles.phoneType}>{p.type || 'unknown'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Emails */}
            {parsedData?.emails && parsedData.emails.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>EMAILS ({parsedData.emails.length})</Text>
                {parsedData.emails.slice(0, 5).map((email: string, idx: number) => (
                  <TouchableOpacity key={idx} style={styles.phoneRow} onPress={() => Linking.openURL(`mailto:${email}`)}>
                    <Ionicons name="mail" size={14} color={DARK.primary} />
                    <Text style={styles.phoneNum}>{email}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Vehicles */}
            {displayVehicles.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>VEHICLES ({displayVehicles.length})</Text>
                {displayVehicles.map((v: any, idx: number) => (
                  <View key={idx} style={styles.vehicleRow}>
                    <Ionicons name="car" size={14} color={DARK.warning} />
                    <Text style={styles.vehicleText}>{v.description || `${v.year} ${v.make} ${v.model}`.trim()}</Text>
                    {v.plate && <Text style={styles.plateText}>{v.plate}</Text>}
                  </View>
                ))}
              </View>
            )}

            {/* Associates */}
            {parsedData?.associates && parsedData.associates.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>ASSOCIATES ({parsedData.associates.length})</Text>
                {parsedData.associates.slice(0, 5).map((a: any, idx: number) => (
                  <View key={idx} style={styles.associateRow}>
                    <Ionicons name="person" size={14} color={DARK.textSecondary} />
                    <Text style={styles.associateName}>{a.name || a}</Text>
                    {a.relationship && <Text style={styles.associateRel}>{a.relationship}</Text>}
                  </View>
                ))}
              </View>
            )}

            {/* Investigation Notes from AI chat */}
            {(caseIntel?.notes || []).length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>NOTES ({caseIntel!.notes.length})</Text>
                {caseIntel!.notes.map((n, idx) => (
                  <View key={idx} style={styles.noteRow}>
                    <Text style={{ fontSize: 12, color: DARK.text, lineHeight: 16 }}>{n.text}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Custom Flags */}
            {(caseIntel?.customFlags || []).length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: DARK.danger }]}>FLAGS</Text>
                {caseIntel!.customFlags.map((f, idx) => (
                  <View key={idx} style={[styles.noteRow, { borderLeftWidth: 2, borderLeftColor: DARK.danger, paddingLeft: 6 }]}>
                    <Text style={{ fontSize: 12, color: DARK.danger, lineHeight: 16 }}>{f}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Files */}
            {uploadedFiles.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>FILES ({uploadedFiles.length})</Text>
                {uploadedFiles.map((f) => (
                  <View key={f.id} style={styles.fileRow}>
                    <Ionicons name={f.type === 'image' ? 'image' : 'document'} size={14} color={DARK.primary} />
                    <Text style={styles.fileName} numberOfLines={1}>{f.name}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Empty state */}
            {displayAddresses.length === 0 && phones.length === 0 && uploadedFiles.length === 0 && (
              <View style={styles.emptyIntel}>
                <Ionicons name="document-text-outline" size={32} color={DARK.textMuted} />
                <Text style={styles.emptyIntelText}>Upload files or paste data to extract intel</Text>
              </View>
            )}
          </ScrollView>
        </View>

        {/* COLUMN 3: Quick Links */}
        <View style={[
          styles.col,
          styles.socialCol,
          isWeb && !isMobile && { flex: 1 },
          isMobile && { flex: 1 }
        ]}>
          <Text style={styles.colTitle}>OSINT TOOLS</Text>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 8 }}>
            {/* Subject Photo - PRIMARY TARGET */}
            {subjectPhoto && (
              <View style={styles.subjectSection}>
                <Image source={{ uri: subjectPhoto }} style={styles.subjectImg} />
                <Text style={styles.subjectName}>{getSubjectName()}</Text>
                {facialFeatures && (
                  <Text style={styles.faceReadyBadge}>✓ Face ready for matching</Text>
                )}
                {/* Subject ID Analysis Button */}
                <TouchableOpacity
                  style={[styles.subjectAnalysisBtn, isAnalyzingSubject && styles.btnDisabled]}
                  onPress={runSubjectAnalysis}
                  disabled={isAnalyzingSubject}
                >
                  {isAnalyzingSubject ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="body" size={14} color="#fff" />
                      <Text style={styles.subjectAnalysisBtnText}>
                        {subjectAnalysisResult ? 'Re-Analyze ID' : 'Analyze Tattoos/Scars'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
                {subjectAnalysisResult && (
                  <Text style={styles.analysisCompleteBadge}>✓ ID Analysis Complete</Text>
                )}
              </View>
            )}

            {/* OSINT Status */}
            {isSearchingOSINT && (
              <View style={styles.osintSearching}>
                <ActivityIndicator size="small" color={DARK.warning} />
                <Text style={styles.osintSearchingText}>Searching...</Text>
              </View>
            )}

            {/* Run OSINT Button */}
            {!isSearchingOSINT && (
              <TouchableOpacity
                style={styles.osintRunBtn}
                onPress={() => {
                  // Use getSubjectName() and normalize for OSINT
                  const rawName = getSubjectName();
                  const name = normalizeName(rawName);
                  if (name) {
                    setOsintSearched(false);
                    runOSINTSearch(name);
                  }
                }}
              >
                <Ionicons name="search" size={16} color="#fff" />
                <Text style={styles.osintRunBtnText}>
                  {osintResults.filter(r => r.exists === true).length > 0
                    ? `Found ${osintResults.filter(r => r.exists === true).length} profiles`
                    : 'Run OSINT Search'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Social Media - Simple Links */}
            <Text style={styles.osintSectionTitle}>Social</Text>
            <View style={styles.quickLinks}>
              {socialProfiles.filter(p => ['Facebook', 'Instagram', 'TikTok', 'Twitter/X', 'LinkedIn'].includes(p.platform)).map((profile, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.quickLink, profile.status === 'found' && styles.quickLinkFound]}
                  onPress={() => openUrl(profile.url)}
                >
                  <Ionicons
                    name={profile.platform === 'Facebook' ? 'logo-facebook' :
                          profile.platform === 'Instagram' ? 'logo-instagram' :
                          profile.platform === 'TikTok' ? 'logo-tiktok' :
                          profile.platform.includes('Twitter') ? 'logo-twitter' : 'logo-linkedin'}
                    size={18}
                    color={profile.status === 'found' ? DARK.success : DARK.textSecondary}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* People Search - Simple Links */}
            <Text style={styles.osintSectionTitle}>Records</Text>
            {socialProfiles.filter(p => ['TruePeopleSearch', 'FastPeopleSearch', 'Whitepages', 'Spokeo'].includes(p.platform)).map((profile, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.recordLink}
                onPress={() => openUrl(profile.url)}
              >
                <Text style={styles.recordLinkText}>{profile.platform}</Text>
                <Ionicons name="open-outline" size={14} color={DARK.textMuted} />
              </TouchableOpacity>
            ))}

            {/* Network - Associates with clickable social search */}
            {relatives.length > 0 && (
              <>
                <Text style={styles.osintSectionTitle}>Network ({relatives.length})</Text>
                {relatives.slice(0, 5).map((r: any, idx: number) => {
                  // Normalize name for OSINT (convert "LAST, First" to "First Last")
                  const displayName = normalizeName(r.name) || 'Unknown';
                  const searchName = displayName.toLowerCase().replace(/\s+/g, '');

                  return (
                    <View key={idx} style={styles.networkCard}>
                      <View style={styles.networkHeader}>
                        <Ionicons name="person" size={14} color={DARK.textSecondary} />
                        <Text style={styles.relName}>{displayName}</Text>
                        <Text style={styles.relRel}>{r.relationship || 'associate'}</Text>
                      </View>
                      {/* Social search links for this associate */}
                      <View style={styles.networkSocials}>
                        <TouchableOpacity
                          style={styles.networkSocialBtn}
                          onPress={() => openUrl(`https://www.facebook.com/search/people/?q=${encodeURIComponent(displayName)}`)}
                        >
                          <Ionicons name="logo-facebook" size={14} color="#1877f2" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.networkSocialBtn}
                          onPress={() => openUrl(`https://www.instagram.com/${searchName}`)}
                        >
                          <Ionicons name="logo-instagram" size={14} color="#e4405f" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.networkSocialBtn}
                          onPress={() => openUrl(`https://www.tiktok.com/@${searchName}`)}
                        >
                          <Ionicons name="logo-tiktok" size={14} color={DARK.text} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.networkSocialBtn}
                          onPress={() => openUrl(`https://www.truepeoplesearch.com/results?name=${encodeURIComponent(displayName)}`)}
                        >
                          <Ionicons name="search" size={14} color={DARK.primary} />
                        </TouchableOpacity>
                      </View>
                      {r.phones?.[0] && (
                        <TouchableOpacity onPress={() => Linking.openURL(`tel:${r.phones[0]}`)}>
                          <Text style={styles.networkPhone}>{r.phones[0]}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </>
            )}
          </ScrollView>
        </View>
      </View>

      {/* Photo Picker Modal */}
      <Modal
        visible={showPhotoPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPhotoPicker(false)}
      >
        <TouchableOpacity
          style={ppStyles.overlay}
          activeOpacity={1}
          onPress={() => setShowPhotoPicker(false)}
        >
          <View style={ppStyles.modal} onStartShouldSetResponder={() => true}>
            <View style={ppStyles.header}>
              <Text style={ppStyles.title}>Subject Photo</Text>
              <TouchableOpacity onPress={() => setShowPhotoPicker(false)}>
                <Ionicons name="close" size={22} color={DARK.text} />
              </TouchableOpacity>
            </View>

            {/* Current photo */}
            {subjectPhoto && (
              <View style={ppStyles.currentSection}>
                <Image source={{ uri: subjectPhoto }} style={ppStyles.currentPhoto} />
                <TouchableOpacity style={ppStyles.removeBtn} onPress={handleRemovePhoto}>
                  <Ionicons name="trash-outline" size={16} color="#fff" />
                  <Text style={ppStyles.removeBtnText}>Remove</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Photos from case */}
            {allPhotoIntel.filter(p => p.thumbnailBase64).length > 0 && (
              <View style={ppStyles.section}>
                <Text style={ppStyles.sectionLabel}>CASE PHOTOS</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ppStyles.photoRow}>
                  {allPhotoIntel.filter(p => p.thumbnailBase64).map((intel, idx) => (
                    <TouchableOpacity
                      key={intel.imageId || idx}
                      style={[
                        ppStyles.thumbWrap,
                        subjectPhoto === intel.thumbnailBase64 && ppStyles.thumbSelected,
                      ]}
                      onPress={() => handleSelectPhotoFromIntel(intel.thumbnailBase64!)}
                    >
                      <Image source={{ uri: intel.thumbnailBase64 }} style={ppStyles.thumb} />
                      {intel.sourceFileName && (
                        <Text style={ppStyles.thumbLabel} numberOfLines={1}>{intel.sourceFileName}</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Mugshot URL fallback */}
            {caseData?.mugshotUrl && caseData.mugshotUrl !== subjectPhoto && (
              <View style={ppStyles.section}>
                <Text style={ppStyles.sectionLabel}>MUGSHOT</Text>
                <TouchableOpacity
                  style={ppStyles.thumbWrap}
                  onPress={() => handleSelectPhotoFromIntel(caseData.mugshotUrl!)}
                >
                  <Image source={{ uri: caseData.mugshotUrl }} style={ppStyles.thumb} />
                  <Text style={ppStyles.thumbLabel}>Jail mugshot</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Choose from device */}
            <TouchableOpacity
              style={ppStyles.deviceBtn}
              onPress={() => {
                if (isWeb) {
                  profilePhotoInputRef.current?.click();
                } else {
                  // Native: use expo-image-picker
                  (async () => {
                    try {
                      const ImagePicker = await import('expo-image-picker');
                      const result = await ImagePicker.launchImageLibraryAsync({
                        mediaTypes: ['images'],
                        quality: 0.7,
                        base64: true,
                      });
                      if (!result.canceled && result.assets?.[0]) {
                        const asset = result.assets[0];
                        const dataUrl = asset.base64
                          ? `data:image/jpeg;base64,${asset.base64}`
                          : asset.uri;
                        setSubjectPhoto(dataUrl);
                        if (id) {
                          try { await AsyncStorage.setItem(`case_photo_${id}`, dataUrl); } catch {}
                        }
                        setShowPhotoPicker(false);
                      }
                    } catch (err) {
                      console.log('Image picker error:', err);
                    }
                  })();
                }
              }}
            >
              <Ionicons name="images-outline" size={20} color={DARK.primary} />
              <Text style={ppStyles.deviceBtnText}>Choose from device</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const ppStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: DARK.surface,
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: DARK.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: DARK.text,
  },
  currentSection: {
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  currentPhoto: {
    width: 100,
    height: 120,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: DARK.primary,
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: DARK.danger,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  removeBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: DARK.primary,
    letterSpacing: 1,
    marginBottom: 8,
  },
  photoRow: {
    flexDirection: 'row',
  },
  thumbWrap: {
    marginRight: 10,
    alignItems: 'center',
    borderRadius: 6,
    padding: 3,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbSelected: {
    borderColor: DARK.primary,
  },
  thumb: {
    width: 70,
    height: 84,
    borderRadius: 4,
  },
  thumbLabel: {
    fontSize: 9,
    color: DARK.textMuted,
    marginTop: 3,
    maxWidth: 70,
    textAlign: 'center',
  },
  deviceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: DARK.border,
    backgroundColor: DARK.surfaceHover,
  },
  deviceBtnText: {
    color: DARK.text,
    fontSize: 14,
    fontWeight: '600',
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK.bg },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: DARK.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DARK.surface,
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: DARK.border,
    gap: 10,
  },
  photoBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: DARK.surfaceHover, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoImg: { width: '100%', height: '100%' },
  caseName: { fontSize: 15, fontWeight: '700', color: DARK.text },
  caseMeta: { fontSize: 11, color: DARK.textSecondary },
  headerBtn: { padding: 8 },
  backBtn: { padding: 8, marginLeft: -4 },
  reportBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: DARK.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, gap: 6 },
  reportBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // 3-Column Layout
  columns: { flex: 1, flexDirection: 'row' },
  col: { borderRightWidth: 1, borderRightColor: DARK.border },
  colTitle: { fontSize: 10, fontWeight: '700', color: DARK.textMuted, letterSpacing: 1, padding: 8, backgroundColor: DARK.surface, borderBottomWidth: 1, borderBottomColor: DARK.border },
  colTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: DARK.surface, borderBottomWidth: 1, borderBottomColor: DARK.border, paddingHorizontal: 8, paddingVertical: 6 },
  colTitleText: { fontSize: 11, fontWeight: '800', color: DARK.primary, letterSpacing: 1 },
  colSubtitle: { fontSize: 8, color: DARK.textMuted, letterSpacing: 0.5, marginTop: 1 },
  copyBtn: { padding: 6 },

  // Chat Column
  chatCol: { backgroundColor: DARK.bg, position: 'relative' },
  chatScroll: { flex: 1 },
  dropOverlay: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderRadius: 8,
  },
  dropText: {
    color: DARK.primary,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  bubble: { padding: 10, borderRadius: 10, marginBottom: 6, maxWidth: '90%' },
  userBubble: { backgroundColor: DARK.primary, alignSelf: 'flex-end' },
  agentBubble: { backgroundColor: DARK.surface, alignSelf: 'flex-start', borderWidth: 1, borderColor: DARK.border },
  systemBubble: { backgroundColor: '#0a1a0a', alignSelf: 'center', borderWidth: 1, borderColor: '#1a3a1a', maxWidth: '90%' },
  bubbleText: { fontSize: 14, color: DARK.text, lineHeight: 20 },
  inputRow: { flexDirection: 'row', alignItems: 'center', padding: 8, borderTopWidth: 1, borderTopColor: DARK.border, gap: 6 },
  attachBtn: { padding: 4 },
  input: { flex: 1, backgroundColor: DARK.surface, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, color: DARK.text, borderWidth: 1, borderColor: DARK.border },
  sendBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: DARK.primary, alignItems: 'center', justifyContent: 'center' },

  // Map Column
  mapCol: { backgroundColor: DARK.surface },
  mainMap: { width: '100%', height: 180, borderRadius: 8, overflow: 'hidden', backgroundColor: DARK.surfaceHover, marginBottom: 8 },
  compactMap: { width: '100%', height: 120, borderRadius: 6, overflow: 'hidden', backgroundColor: DARK.surfaceHover, marginBottom: 10 },
  mapPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topAddr: { fontSize: 15, fontWeight: '600', color: DARK.text },
  topProb: { fontSize: 14, color: DARK.success, fontWeight: '600', marginBottom: 12 },
  locRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: DARK.border, gap: 8 },
  locRowEnhanced: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: DARK.border, gap: 8, backgroundColor: DARK.bg, borderRadius: 6, marginBottom: 4 },
  locDetails: { flex: 1 },
  locSource: { fontSize: 11, color: DARK.textMuted, marginTop: 2 },
  rankBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: DARK.primary, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  locAddr: { fontSize: 13, color: DARK.text, fontWeight: '500' },
  locProb: { fontSize: 12, color: DARK.success, fontWeight: '600' },

  // Link Analysis / Relationship Map
  linkMap: { backgroundColor: DARK.bg, borderRadius: 10, padding: 16, borderWidth: 1, borderColor: DARK.border, minHeight: 200 },
  linkCenter: { alignItems: 'center', marginBottom: 16 },
  linkPhoto: { width: 60, height: 72, borderRadius: 6, borderWidth: 2, borderColor: DARK.primary },
  linkPhotoPlaceholder: { width: 60, height: 72, borderRadius: 6, backgroundColor: DARK.surfaceHover, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: DARK.border },
  linkName: { fontSize: 14, fontWeight: '700', color: DARK.text, marginTop: 6, maxWidth: 120, textAlign: 'center' },
  linkTargetBadge: { fontSize: 9, fontWeight: '700', color: DARK.primary, letterSpacing: 1, marginTop: 2 },
  linkConnections: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  linkNode: { alignItems: 'center', marginBottom: 8 },
  linkLine: { width: 2, height: 12, backgroundColor: DARK.border, marginBottom: 4 },
  linkBubble: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: 'center', minWidth: 80, maxWidth: 110 },
  linkLabel: { fontSize: 11, fontWeight: '600', color: DARK.text, marginTop: 4, textAlign: 'center' },
  linkType: { fontSize: 9, color: DARK.textMuted, textTransform: 'uppercase', marginTop: 2 },
  linkPhone: { fontSize: 10, color: DARK.textSecondary, marginTop: 2 },
  linkEmpty: { fontSize: 12, color: DARK.textMuted, textAlign: 'center', fontStyle: 'italic', paddingVertical: 20 },
  linkBubbleSelected: { transform: [{ scale: 1.15 }], maxWidth: 150, minWidth: 120, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 8, borderWidth: 2 },
  linkLabelSelected: { fontSize: 12, fontWeight: '700' },
  linkAddress: { fontSize: 9, color: DARK.textSecondary, marginTop: 4, textAlign: 'center' },
  linkTapHint: { fontSize: 8, color: DARK.primary, marginTop: 4, fontWeight: '600', textTransform: 'uppercase' },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: DARK.textMuted, marginBottom: 8 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  phoneNum: { fontSize: 14, color: DARK.text },
  phoneType: { fontSize: 12, color: DARK.textMuted },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  noteRow: { paddingVertical: 4, paddingHorizontal: 6, backgroundColor: DARK.surface, borderRadius: 4, marginBottom: 3 },
  fileName: { fontSize: 13, color: DARK.text, flex: 1 },

  // Intel Card
  intelCard: { backgroundColor: DARK.surface, borderRadius: 8, padding: 12, borderLeftWidth: 3, borderLeftColor: DARK.primary },
  intelName: { fontSize: 18, fontWeight: '700', color: DARK.text, marginBottom: 4 },
  intelDetail: { fontSize: 14, color: DARK.textSecondary },
  vehicleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, backgroundColor: DARK.surface, borderRadius: 6, paddingHorizontal: 8, marginBottom: 4 },
  vehicleText: { fontSize: 14, color: DARK.text, flex: 1 },
  plateText: { fontSize: 13, color: DARK.warning, fontWeight: '600' },
  associateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  associateName: { fontSize: 14, color: DARK.text, flex: 1 },
  associateRel: { fontSize: 12, color: DARK.textMuted },
  emptyIntel: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyIntelText: { fontSize: 14, color: DARK.textMuted, marginTop: 12, textAlign: 'center' },

  // Social Column
  socialCol: { backgroundColor: DARK.bg, borderRightWidth: 0 },
  subjectSection: { alignItems: 'center', marginBottom: 16 },
  subjectImg: { width: 80, height: 80, borderRadius: 40, marginBottom: 8 },
  subjectName: { fontSize: 15, fontWeight: '600', color: DARK.text, marginBottom: 12 },
  faceAnalyzing: { flexDirection: 'row', alignItems: 'center', backgroundColor: DARK.surface, padding: 10, borderRadius: 8, gap: 8, marginTop: 8 },
  faceAnalyzingText: { fontSize: 13, color: DARK.warning },
  faceBiometrics: { backgroundColor: DARK.surface, borderRadius: 8, padding: 10, marginTop: 8, borderWidth: 1, borderColor: DARK.success + '40' },
  faceBioTitle: { fontSize: 12, fontWeight: '700', color: DARK.success, marginBottom: 8 },
  faceBioRow: { flexDirection: 'row', marginBottom: 4 },
  faceBioLabel: { fontSize: 12, color: DARK.textMuted, width: 55 },
  faceBioValue: { fontSize: 12, color: DARK.text, flex: 1 },
  faceBioNote: { fontSize: 11, color: DARK.success, marginTop: 8, fontStyle: 'italic' },
  usernameSearchBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: DARK.primary, padding: 12, borderRadius: 8, gap: 8, marginBottom: 12 },
  usernameSearchText: { fontSize: 13, fontWeight: '600', color: '#fff', flex: 1 },
  osintSectionTitle: { fontSize: 12, fontWeight: '700', color: DARK.textMuted, marginTop: 12, marginBottom: 8 },
  osintSearching: { flexDirection: 'row', alignItems: 'center', backgroundColor: DARK.warning + '20', padding: 10, borderRadius: 8, gap: 8, marginBottom: 8 },
  osintSearchingText: { fontSize: 13, color: DARK.warning, fontWeight: '500' },
  osintRunBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: DARK.success, padding: 10, borderRadius: 6, gap: 6, marginBottom: 8 },
  osintRunBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  peopleSearchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: DARK.surface, padding: 10, borderRadius: 6, marginBottom: 4, gap: 8 },
  peopleSearchName: { flex: 1, fontSize: 13, color: DARK.text },
  miniBtn: { padding: 4 },
  miniBtnText: { fontSize: 14, fontWeight: '700' },
  socialCard: { backgroundColor: DARK.surface, borderRadius: 8, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: DARK.border },
  socialHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  socialIcon: { width: 26, height: 26, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  socialPlatform: { flex: 1, fontSize: 14, fontWeight: '600', color: DARK.text },
  statusBadge: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  statusFound: { backgroundColor: DARK.success },
  statusNotFound: { backgroundColor: DARK.danger },
  statusSearching: { backgroundColor: DARK.textMuted },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  socialUsername: { fontSize: 13, color: DARK.textSecondary, marginBottom: 8 },
  socialActions: { flexDirection: 'row', gap: 6 },
  socialBtn: { flex: 1, backgroundColor: DARK.surfaceHover, paddingVertical: 8, borderRadius: 4, alignItems: 'center' },
  foundBtn: { backgroundColor: DARK.success + '30' },
  notFoundBtn: { backgroundColor: DARK.danger + '30' },
  socialBtnText: { fontSize: 12, fontWeight: '600', color: DARK.text },
  relRow: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: DARK.border },
  relName: { fontSize: 13, color: DARK.text, flex: 1 },
  relRel: { fontSize: 11, color: DARK.textMuted, marginLeft: 4 },
  networkCard: { backgroundColor: DARK.surfaceHover, borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: DARK.border },
  networkHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  networkSocials: { flexDirection: 'row', gap: 8, marginTop: 4 },
  networkSocialBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: DARK.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: DARK.border },
  networkPhone: { fontSize: 12, color: DARK.success, marginTop: 6 },
  // Simplified styles
  faceReadyBadge: { fontSize: 12, color: DARK.success, backgroundColor: DARK.success + '20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  subjectAnalysisBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: DARK.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, gap: 6, marginTop: 8, width: '100%', justifyContent: 'center' },
  subjectAnalysisBtnText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  analysisCompleteBadge: { fontSize: 11, color: DARK.success, marginTop: 6 },
  btnDisabled: { opacity: 0.6 },
  quickLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  quickLink: { width: 44, height: 44, borderRadius: 8, backgroundColor: DARK.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: DARK.border },
  quickLinkFound: { borderColor: DARK.success, backgroundColor: DARK.success + '15' },
  recordLink: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, backgroundColor: DARK.surface, borderRadius: 6, marginBottom: 4, gap: 8 },
  recordLinkText: { flex: 1, fontSize: 14, color: DARK.text },

  // Agent Insights
  // Link Analysis editing
  linkActions: { flexDirection: 'row', gap: 6, marginTop: 6 },
  linkActionBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: DARK.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: DARK.border },
  relOption: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: DARK.bg, borderWidth: 1, borderColor: DARK.border, marginRight: 4 },
  relOptionActive: { borderColor: '#3b82f6', backgroundColor: '#3b82f620' },
  relOptionText: { fontSize: 10, color: DARK.textMuted },
  relOptionTextActive: { color: '#3b82f6', fontWeight: '600' },
  addAssocBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, marginTop: 8 },
  addAssocBtnText: { fontSize: 12, color: DARK.textMuted },
  addAssocForm: { backgroundColor: DARK.surface, borderRadius: 8, padding: 10, marginTop: 8, borderWidth: 1, borderColor: DARK.border },
  addAssocInput: { backgroundColor: DARK.bg, color: DARK.text, fontSize: 13, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: DARK.border },
  addAssocConfirm: { backgroundColor: '#3b82f6', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 6 },
  addAssocConfirmText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  addAssocCancel: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: DARK.border },
  addAssocCancelText: { color: DARK.textMuted, fontSize: 12 },

  insightsWrapper: { marginBottom: 8, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#8b5cf630' },
  insightsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#8b5cf610', paddingHorizontal: 10, paddingVertical: 8 },
  insightsTitle: { fontSize: 11, fontWeight: '700', color: '#8b5cf6', letterSpacing: 1 },
  insightsContainer: { maxHeight: 250 },
  insightCard: { backgroundColor: DARK.surface, borderLeftWidth: 3, borderLeftColor: '#8b5cf6', padding: 10, marginHorizontal: 6, marginVertical: 3, borderRadius: 6 },
  insightPreview: { fontSize: 12, color: DARK.textSecondary, lineHeight: 17 },
  insightFull: { fontSize: 12, color: DARK.text, lineHeight: 17 },
  insightTime: { fontSize: 10, color: DARK.textMuted },
  insightAddBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#8b5cf615', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#8b5cf640' },
  insightAddedBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: DARK.success + '20', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: DARK.success + '40' },
});
