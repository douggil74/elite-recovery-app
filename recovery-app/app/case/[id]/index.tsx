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
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCase } from '@/hooks/useCase';
import { deleteCase } from '@/lib/database';
import { deleteCaseDirectory, getSettings } from '@/lib/storage';
import { confirm } from '@/lib/confirm';
import { syncChat, syncPhoto, fetchSyncedChat, fetchSyncedPhoto, isSyncEnabled, deleteSyncedCase } from '@/lib/sync';
import {
  AISquadOrchestrator,
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
  smartOsintSearch,
  checkBackendHealth,
} from '@/lib/python-osint';

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
}

interface SocialProfile {
  platform: string;
  username: string;
  url: string;
  status: 'found' | 'searching' | 'not_found';
}

interface ReverseImageSearch {
  name: string;
  url: string;
  note: string;
}

// Generate reverse image search URLs
const generateReverseImageSearchUrls = (imageBase64: string): ReverseImageSearch[] => {
  // Note: For client-side, we generate URLs that prompt the user to upload
  // A backend would be needed for automatic searching
  return [
    { name: 'Google Images', url: 'https://images.google.com/', note: 'Click camera icon' },
    { name: 'Yandex (Best for faces)', url: 'https://yandex.com/images/', note: 'Click camera icon' },
    { name: 'TinEye', url: 'https://tineye.com/', note: 'Upload image' },
    { name: 'PimEyes (Face)', url: 'https://pimeyes.com/', note: 'Face recognition' },
    { name: 'FaceCheck.ID', url: 'https://facecheck.id/', note: 'Face search' },
  ];
};

// Generate comprehensive social search profiles
const generateSocialProfiles = (fullName: string): SocialProfile[] => {
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
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [orchestrator, setOrchestrator] = useState<AISquadOrchestrator | null>(null);
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
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const [tacticalAdvice, setTacticalAdvice] = useState<string[]>([]);
  const [pythonBackendAvailable, setPythonBackendAvailable] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const latestReport = reports[0];
  const parsedData = latestReport?.parsedData;
  const addresses = parsedData?.addresses || [];
  const phones = parsedData?.phones || [];
  const relatives = parsedData?.relatives || [];

  // Load saved data
  useEffect(() => {
    if (id) {
      const loadData = async () => {
        const localPhoto = await AsyncStorage.getItem(`case_photo_${id}`);
        if (localPhoto) setSubjectPhoto(localPhoto);

        const localChat = await AsyncStorage.getItem(`case_chat_${id}`);
        if (localChat) {
          try {
            const parsed = JSON.parse(localChat);
            setChatMessages(parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })));
          } catch (e) {}
        }

        // Load social profiles
        const localSocial = await AsyncStorage.getItem(`case_social_${id}`);
        if (localSocial) {
          try {
            setSocialProfiles(JSON.parse(localSocial));
          } catch (e) {}
        }

        const cloudEnabled = await isSyncEnabled();
        if (cloudEnabled) {
          const cloudChat = await fetchSyncedChat(id);
          if (cloudChat && cloudChat.length > 0) {
            const localMsgs = localChat ? JSON.parse(localChat) : [];
            if (cloudChat.length > localMsgs.length) {
              setChatMessages(cloudChat.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })));
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

  // Save chat
  useEffect(() => {
    if (id && chatLoaded && chatMessages.length > 0) {
      AsyncStorage.setItem(`case_chat_${id}`, JSON.stringify(chatMessages));
      isSyncEnabled().then((enabled) => {
        if (enabled) syncChat(id, chatMessages);
      });
    }
  }, [id, chatMessages, chatLoaded]);

  // Save social profiles
  useEffect(() => {
    if (id && socialProfiles.length > 0) {
      AsyncStorage.setItem(`case_social_${id}`, JSON.stringify(socialProfiles));
    }
  }, [id, socialProfiles]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  // Initialize Face Matching Service
  useEffect(() => {
    const initFaceMatch = async () => {
      const settings = await getSettings();
      if (settings.openaiApiKey) {
        setFaceMatchService(new FaceMatchingService(settings.openaiApiKey));
      }
    };
    initFaceMatch();
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
          id: Date.now().toString(),
          role: 'agent',
          content: '🔬 **FACE ANALYSIS**: Extracting facial biometrics for matching...',
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
              id: Date.now().toString(),
              role: 'agent',
              content: `✅ **FACE BIOMETRICS EXTRACTED**

**Bone Structure:**
- Face: ${result.features.faceShape}, ${result.features.jawline} jaw
- Cheekbones: ${result.features.cheekbones}

**Eyes:**
- Shape: ${result.features.eyeShape}, ${result.features.eyeSpacing} spacing
- Color: ${result.features.eyeColor}

**Nose:**
- ${result.features.noseShape}, ${result.features.noseWidth} width

**Distinctive:**
${result.features.distinctiveFeatures?.length > 0 ? result.features.distinctiveFeatures.map(f => `- ${f}`).join('\n') : '- None noted'}

*Use this profile to match against any photo.*`,
              timestamp: new Date(),
            }]);
          } else {
            setChatMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: 'agent',
              content: `⚠️ Face extraction: ${result.error || 'Could not detect face'}`,
              timestamp: new Date(),
            }]);
          }
        } catch (err: any) {
          console.error('Face extraction error:', err);
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

  // Initialize AI Squad
  useEffect(() => {
    const initSquad = async () => {
      if (!id || !caseData) return;
      const settings = await getSettings();
      if (!settings.openaiApiKey) return;

      const squad = new AISquadOrchestrator(
        { openaiKey: settings.openaiApiKey },
        {
          onAgentActivity: () => {},
          onMessage: (msg: AgentMessage) => {
            setChatMessages(prev => [...prev, {
              id: msg.id,
              role: 'agent',
              content: msg.content,
              timestamp: msg.timestamp,
            }]);
            scrollToBottom();
          },
          onLocationUpdate: (locations) => {
            setSquadLocations(locations);
            const context = squad.getContext();
            AsyncStorage.setItem(`case_squad_${id}`, JSON.stringify({
              topLocations: locations,
              confidence: context.confidence,
              crossReferences: context.crossReferences,
            }));
          },
          onConfidenceUpdate: () => {},
          onQuestion: () => {},
          onError: (agent, error) => {
            setChatMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: 'agent',
              content: `⚠️ ${agent}: ${error}`,
              timestamp: new Date(),
            }]);
          },
        }
      );
      squad.initCase(id, caseData.name);
      setOrchestrator(squad);
    };
    initSquad();
  }, [id, caseData?.name]);

  // Auto-run OSINT search when we have a target name
  useEffect(() => {
    if (parsedData?.subject?.fullName && !osintSearched && !isSearchingOSINT) {
      runOSINTSearch(parsedData.subject.fullName);
    }
  }, [parsedData?.subject?.fullName, osintSearched]);

  const runOSINTSearch = async (fullName: string) => {
    setIsSearchingOSINT(true);
    setOsintSearched(true);

    // Add searching message to chat
    const toolsMessage = pythonBackendAvailable
      ? '🐍 **Sherlock + Maigret + holehe** (Python backend active)'
      : '📡 **JavaScript OSINT Engine**';

    setChatMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'agent',
      content: `🔍 **AUTO-OSINT**: Searching for "${fullName}"\n${toolsMessage}\nSearching 400+ platforms...`,
      timestamp: new Date(),
    }]);
    scrollToBottom();

    try {
      // Use the full OSINT API sweep
      const results = await fullOSINTSweep(
        { name: fullName },
        (step, result) => {
          if (step && !result) {
            setChatMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: 'agent',
              content: `⏳ ${step}`,
              timestamp: new Date(),
            }]);
            scrollToBottom();
          }
        }
      );

      // Update social profiles with API results
      if (results.username) {
        const updatedProfiles = generateSocialProfiles(fullName).map(profile => {
          const foundMatch = results.username?.found.find(f =>
            f.platform.toLowerCase().includes(profile.platform.toLowerCase().split('/')[0])
          );
          const notFoundMatch = results.username?.notFound.find(p =>
            p.toLowerCase().includes(profile.platform.toLowerCase().split('/')[0])
          );

          if (foundMatch) {
            return { ...profile, status: 'found' as const, url: foundMatch.url };
          } else if (notFoundMatch) {
            return { ...profile, status: 'not_found' as const };
          }
          return profile;
        });
        setSocialProfiles(updatedProfiles);

        // Store the results
        setOsintResults(results.username.found.map(f => ({
          platform: f.platform,
          username: results.username?.username || '',
          exists: true,
          profileUrl: f.url,
          confidence: 90,
        })));
      }

      // Generate people search results from person search
      if (results.person) {
        setPeopleSearchResults(
          results.person.searchLinks
            .filter(l => l.category === 'People Search')
            .map(l => ({
              source: l.name,
              url: l.url,
              status: 'unknown' as const,
            }))
        );
      }

      // Build summary
      let summary = `✅ **OSINT SWEEP COMPLETE**\n\n`;

      if (results.username) {
        summary += `**Social Media (${results.username.summary.total} platforms):**\n`;
        if (results.username.found.length > 0) {
          summary += `🟢 Found: ${results.username.found.map(f => f.platform).join(', ')}\n`;
        }
        if (results.username.summary.notFound > 0) {
          summary += `🔴 Not found: ${results.username.summary.notFound} platforms\n`;
        }
        summary += '\n';
      }

      if (results.person) {
        summary += `**Search Links Generated:** ${results.person.searchLinks.length}\n`;
        summary += `• People Search: ${results.person.searchLinks.filter(l => l.category === 'People Search').length}\n`;
        summary += `• Court Records: ${results.person.searchLinks.filter(l => l.category === 'Court Records').length}\n`;
        summary += `• Criminal: ${results.person.searchLinks.filter(l => l.category === 'Criminal Records').length}\n`;
        summary += '\n';
      }

      summary += `💡 **Tips:**\n${results.person?.tips.slice(0, 3).join('\n') || 'Check each link systematically'}`;

      setChatMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'agent',
        content: summary,
        timestamp: new Date(),
      }]);

    } catch (error: any) {
      console.error('OSINT sweep error:', error);

      // Fallback to local search
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
          id: Date.now().toString(),
          role: 'agent',
          content: `✅ Local OSINT complete. Found ${localResults.profiles.filter(p => p.exists === true).length} profiles.`,
          timestamp: new Date(),
        }]);
      } catch (localError) {
        setChatMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'agent',
          content: `⚠️ OSINT search error: ${error?.message || 'Unknown error'}. Try manual search links.`,
          timestamp: new Date(),
        }]);
      }
    }

    setIsSearchingOSINT(false);
    scrollToBottom();
  };

  // Init greeting
  useEffect(() => {
    if (caseData && chatLoaded && chatMessages.length === 0) {
      setChatMessages([{
        id: 'greeting',
        role: 'agent',
        content: latestReport
          ? `🎯 **${parsedData?.subject?.fullName || caseData.name}** - ${addresses.length} addresses, ${phones.length} phones.`
          : `🔍 **${caseData.name}** - Drop files or paste report data.`,
        timestamp: new Date(),
      }]);
    }
  }, [caseData, latestReport, chatLoaded, chatMessages.length]);

  const scrollToBottom = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

  const openMaps = (address: string) => {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`);
  };

  const openUrl = (url: string) => {
    Linking.openURL(url);
  };

  // Analyze photo for investigative intelligence
  const analyzePhotoForIntel = async (imageData: string) => {
    setIsAnalyzingPhoto(true);
    try {
      const intel = await photoIntelligence.analyzePhoto(imageData);
      if (intel) {
        setPhotoIntel(intel);
        const advice = photoIntelligence.generateTacticalAdvice(intel);
        setTacticalAdvice(advice);

        // Build detailed message for chat
        const parts: string[] = ['📷 **PHOTO INTELLIGENCE REPORT**\n'];

        if (intel.addresses.length > 0) {
          parts.push(`\n🏠 **ADDRESSES DETECTED (${intel.addresses.length}):**`);
          intel.addresses.forEach(a => {
            parts.push(`• "${a.text}" (${a.confidence} confidence) - ${a.context}`);
          });
        }

        if (intel.vehicles.length > 0) {
          parts.push(`\n🚗 **VEHICLES DETECTED (${intel.vehicles.length}):**`);
          intel.vehicles.forEach(v => {
            const plateInfo = v.licensePlate ? ` - PLATE: ${v.licensePlate}${v.plateState ? ` (${v.plateState})` : ''}` : '';
            parts.push(`• ${v.color} ${v.make || ''} ${v.model || ''} ${v.type}${plateInfo}`);
          });
        }

        if (intel.businesses.length > 0) {
          parts.push(`\n🏪 **BUSINESSES/LANDMARKS (${intel.businesses.length}):**`);
          intel.businesses.forEach(b => {
            parts.push(`• ${b.name} (${b.type})`);
          });
        }

        if (intel.people.length > 0) {
          parts.push(`\n👥 **PEOPLE IN PHOTO (${intel.people.length}):**`);
          intel.people.forEach(p => {
            parts.push(`• ${p.description} - ${p.clothing}`);
            if (p.distinguishingFeatures?.length > 0) {
              parts.push(`  Features: ${p.distinguishingFeatures.join(', ')}`);
            }
          });
        }

        if (intel.geography.length > 0) {
          parts.push(`\n🌍 **GEOGRAPHIC INDICATORS:**`);
          intel.geography.forEach(g => {
            parts.push(`• ${g.indicator}${g.possibleRegion ? ` → Possible: ${g.possibleRegion}` : ''}`);
          });
        }

        if (intel.leads.length > 0) {
          const highPriority = intel.leads.filter(l => l.priority === 'high');
          if (highPriority.length > 0) {
            parts.push(`\n⚠️ **HIGH PRIORITY LEADS (${highPriority.length}):**`);
            highPriority.forEach(l => {
              parts.push(`• ${l.description}`);
              parts.push(`  Action: ${l.actionItem}`);
            });
          }
        }

        parts.push(`\n📍 **SETTING:** ${intel.metadata.settingType} (${intel.metadata.indoorOutdoor})`);
        parts.push(`⏰ **TIME:** ${intel.metadata.estimatedTimeOfDay}, ${intel.metadata.estimatedSeason}`);

        setChatMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'agent',
          content: parts.join('\n'),
          timestamp: new Date(),
        }]);

        // Add tactical advice
        if (advice.length > 0) {
          setChatMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'agent',
            content: `💡 **TACTICAL RECOMMENDATIONS:**\n\n${advice.map(a => `• ${a}`).join('\n')}`,
            timestamp: new Date(),
          }]);
        }

        scrollToBottom();
      } else {
        setChatMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'agent',
          content: '⚠️ Could not analyze photo. Make sure OpenAI API key is configured in Settings.',
          timestamp: new Date(),
        }]);
      }
    } catch (error: any) {
      setChatMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'agent',
        content: `❌ Photo analysis error: ${error?.message || 'Unknown error'}`,
        timestamp: new Date(),
      }]);
    }
    setIsAnalyzingPhoto(false);
    scrollToBottom();
  };

  // Handle file upload
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
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
              setUploadedFiles(prev => [...prev, { id: Date.now().toString(), name: currentFileName, type: 'image', uploadedAt: new Date() }]);
              setChatMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'user',
                content: `📸 Compare face: ${currentFileName}`,
                timestamp: new Date(),
              }]);
              scrollToBottom();

              setChatMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'agent',
                content: `🔬 **COMPARING FACES** - Analyzing bone structure...`,
                timestamp: new Date(),
              }]);

              try {
                const result = await matchService.compareFaces(dataUrl, facialFeatures);

                const emoji = result.verdict === 'LIKELY_MATCH' ? '🟢' :
                              result.verdict === 'POSSIBLE_MATCH' ? '🟡' :
                              result.verdict === 'UNLIKELY_MATCH' ? '🟠' : '🔴';

                setChatMessages(prev => [...prev, {
                  id: Date.now().toString(),
                  role: 'agent',
                  content: `${emoji} **FACE MATCH RESULT: ${result.verdict}**

**Score:** ${result.matchScore}% (Confidence: ${result.confidence}%)

**Matching Features:**
${result.matchingFeatures.length > 0 ? result.matchingFeatures.map(f => `✓ ${f}`).join('\n') : '- None significant'}

**Differences:**
${result.differingFeatures.length > 0 ? result.differingFeatures.map(f => `✗ ${f}`).join('\n') : '- None noted'}

**Analysis:**
${result.explanation}`,
                  timestamp: new Date(),
                }]);

              } catch (err: any) {
                setChatMessages(prev => [...prev, {
                  id: Date.now().toString(),
                  role: 'agent',
                  content: `⚠️ Face comparison failed: ${err?.message || 'Unknown error'}`,
                  timestamp: new Date(),
                }]);
              }

              scrollToBottom();
              return; // Don't save as subject photo
            }

            // Otherwise, save as subject photo
            setSubjectPhoto(dataUrl);
            try { await AsyncStorage.setItem(`case_photo_${id}`, dataUrl); } catch {}
            setUploadedFiles(prev => [...prev, { id: Date.now().toString(), name: currentFileName, type: 'image', uploadedAt: new Date() }]);
            setChatMessages(prev => [...prev, { id: Date.now().toString(), role: 'agent', content: `📸 Subject photo set: ${currentFileName}\n\n🔍 Analyzing photo for investigative leads...`, timestamp: new Date() }]);
            scrollToBottom();

            // Run photo intelligence analysis
            analyzePhotoForIntel(dataUrl);
          }
        };
        reader.readAsDataURL(file);
        continue;
      }

      const docType: 'pdf' | 'doc' | 'text' = fileName.endsWith('.pdf') ? 'pdf' : fileName.endsWith('.doc') ? 'doc' : 'text';
      setUploadedFiles(prev => [...prev, { id: Date.now().toString() + i, name: file.name, type: docType, uploadedAt: new Date() }]);
      setChatMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: `📄 ${file.name}`, timestamp: new Date() }]);
      scrollToBottom();

      try {
        const extractResult = await processUploadedFile(file);
        if (!extractResult.success || !extractResult.text) {
          setChatMessages(prev => [...prev, { id: Date.now().toString(), role: 'agent', content: extractResult.error || 'Could not read file.', timestamp: new Date() }]);
          continue;
        }

        if (orchestrator) {
          await orchestrator.processDocument(extractResult.text, file.name);
        }
        const result = await analyzeText(extractResult.text);
        if (result.success && result.data) {
          setChatMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'agent',
            content: `✅ ${result.data.addresses?.length || 0} addresses, ${result.data.phones?.length || 0} phones. Top: ${result.data.addresses?.[0]?.fullAddress || 'unknown'}`,
            timestamp: new Date(),
          }]);
          await refresh();
        }
      } catch (err: any) {
        setChatMessages(prev => [...prev, { id: Date.now().toString(), role: 'agent', content: `Error: ${err?.message || 'Unknown'}`, timestamp: new Date() }]);
      }
    }

    setIsProcessingFile(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const sendMessage = async () => {
    if (!inputText.trim() || isSending) return;
    const userText = inputText.trim();
    setChatMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: userText, timestamp: new Date() }]);
    setInputText('');
    setIsSending(true);
    scrollToBottom();

    if (userText.length > 500) {
      try {
        const result = await analyzeText(userText);
        if (result.success && result.data) {
          setChatMessages(prev => [...prev, {
            id: Date.now().toString(),
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
      if (orchestrator) {
        await orchestrator.chat(userText);
      } else {
        setChatMessages(prev => [...prev, { id: Date.now().toString(), role: 'agent', content: 'API not ready. Check Settings.', timestamp: new Date() }]);
      }
    } catch (err: any) {
      setChatMessages(prev => [...prev, { id: Date.now().toString(), role: 'agent', content: `Error: ${err?.message}`, timestamp: new Date() }]);
    }
    setIsSending(false);
    scrollToBottom();
  };

  const updateSocialStatus = (platform: string, status: 'found' | 'not_found') => {
    setSocialProfiles(prev => prev.map(p =>
      p.platform === platform ? { ...p, status } : p
    ));
  };

  const generateFullReport = async () => {
    setIsGeneratingReport(true);

    try {
      if (orchestrator) {
        const report = await orchestrator.generateReport();

        // Open print dialog with report
        if (isWeb) {
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write(`
              <!DOCTYPE html>
              <html>
              <head>
                <title>Investigation Report - ${parsedData?.subject?.fullName || caseData?.name}</title>
                <style>
                  body { font-family: -apple-system, Arial, sans-serif; margin: 40px; color: #333; max-width: 800px; }
                  h1 { color: #dc2626; border-bottom: 3px solid #dc2626; padding-bottom: 10px; }
                  h2 { color: #374151; margin-top: 30px; }
                  .meta { color: #6b7280; font-size: 12px; margin-bottom: 20px; }
                  .section { margin-bottom: 25px; padding: 15px; background: #f9fafb; border-radius: 8px; }
                  .location { padding: 10px; margin: 5px 0; background: white; border-left: 4px solid #dc2626; }
                  .social { display: inline-block; padding: 5px 10px; margin: 3px; border-radius: 4px; font-size: 12px; }
                  .found { background: #dcfce7; color: #166534; }
                  .not-found { background: #fee2e2; color: #991b1b; }
                  .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 15px 0; }
                  pre { white-space: pre-wrap; font-family: inherit; }
                  @media print { body { margin: 20px; } }
                </style>
              </head>
              <body>
                <h1>🎯 INVESTIGATION REPORT</h1>
                <div class="meta">
                  Subject: ${parsedData?.subject?.fullName || caseData?.name}<br>
                  Generated: ${new Date().toLocaleString()}<br>
                  Files Analyzed: ${uploadedFiles.length}
                </div>

                <h2>📍 Top Locations</h2>
                <div class="section">
                  ${(squadLocations.length > 0 ? squadLocations : addresses).slice(0, 5).map((loc: any, i: number) => `
                    <div class="location">
                      <strong>#${i + 1}</strong> ${loc.address || loc.fullAddress}
                      ${loc.probability ? `<span style="color: #22c55e; float: right;">${loc.probability}%</span>` : ''}
                    </div>
                  `).join('')}
                </div>

                <h2>📱 Social Media</h2>
                <div class="section">
                  ${socialProfiles.map(p => `
                    <span class="social ${p.status === 'found' ? 'found' : 'not-found'}">
                      ${p.platform}: ${p.status === 'found' ? '✓ Found' : p.status === 'not_found' ? '✗ Not Found' : '? Unknown'}
                    </span>
                  `).join('')}
                </div>

                <h2>📋 AI Analysis</h2>
                <div class="section">
                  <pre>${report}</pre>
                </div>

                <div class="warning">
                  <strong>⚠️ Confidential</strong> - For authorized fugitive recovery use only.
                </div>
              </body>
              </html>
            `);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => printWindow.print(), 300);
          }
        }
      }
    } catch (err) {
      console.error('Report generation failed:', err);
    }

    setIsGeneratingReport(false);
  };

  const handleDelete = async () => {
    const confirmed = await confirm({ title: 'Delete Case', message: `Delete "${caseData?.name}"?`, confirmText: 'Delete', destructive: true });
    if (confirmed) {
      await deleteCase(id!);
      await deleteCaseDirectory(id!);
      await AsyncStorage.multiRemove([`case_chat_${id}`, `case_photo_${id}`, `case_squad_${id}`, `case_social_${id}`]);
      if (await isSyncEnabled()) await deleteSyncedCase(id!);
      router.back();
    }
  };

  if (!caseData) {
    return <View style={styles.loading}><ActivityIndicator size="large" color={DARK.primary} /></View>;
  }

  const displayAddresses = addresses.length > 0 ? addresses : squadLocations.map(l => ({ fullAddress: l.address, probability: l.probability }));

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
        <input ref={fileInputRef as any} type="file" accept=".pdf,.txt,.doc,.docx,image/*" multiple onChange={handleFileChange as any} style={{ display: 'none' }} />
      )}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            // Try to go back, fallback to home if no history
            if (typeof window !== 'undefined' && window.history.length > 1) {
              router.back();
            } else {
              router.replace('/');
            }
          }}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={24} color={DARK.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.photoBox} onPress={() => fileInputRef.current?.click()}>
          {subjectPhoto ? <Image source={{ uri: subjectPhoto }} style={styles.photoImg} /> : <Ionicons name="person" size={20} color={DARK.textMuted} />}
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.caseName} numberOfLines={1}>{parsedData?.subject?.fullName || caseData.name}</Text>
          <Text style={styles.caseMeta}>{displayAddresses.length} locations • {phones.length} phones • {uploadedFiles.length} files</Text>
        </View>
        <TouchableOpacity onPress={generateFullReport} disabled={isGeneratingReport} style={[styles.reportBtn, isGeneratingReport && { opacity: 0.5 }]}>
          {isGeneratingReport ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="document-text" size={18} color="#fff" />}
          <Text style={styles.reportBtnText}>Report</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDelete} style={styles.headerBtn}>
          <Ionicons name="trash-outline" size={20} color={DARK.danger} />
        </TouchableOpacity>
      </View>

      {/* 3-COLUMN LAYOUT */}
      <View style={[styles.columns, isWeb && { display: 'flex', flexDirection: 'row' }]}>

        {/* COLUMN 1: Chat */}
        <View style={[styles.col, styles.chatCol, isWeb && { width: 320, minWidth: 280 }]}>
          <Text style={styles.colTitle}>💬 CHAT</Text>
          <ScrollView ref={scrollRef} style={styles.chatScroll} contentContainerStyle={{ padding: 8 }}>
            {chatMessages.map((msg) => (
              <View key={msg.id} style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.agentBubble]}>
                <Text style={[styles.bubbleText, msg.role === 'user' && { color: '#fff' }]}>{msg.content}</Text>
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
              style={styles.input}
              placeholder="Message..."
              placeholderTextColor={DARK.textMuted}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={sendMessage}
            />
            <TouchableOpacity onPress={sendMessage} disabled={!inputText.trim()} style={[styles.sendBtn, !inputText.trim() && { opacity: 0.4 }]}>
              <Ionicons name="send" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* COLUMN 2: Maps/Locations */}
        <View style={[styles.col, styles.mapCol, isWeb && { flex: 1, minWidth: 300 }]}>
          <Text style={styles.colTitle}>📍 LOCATIONS</Text>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 8 }}>
            {displayAddresses.length > 0 && (
              <>
                {/* Main Map */}
                <TouchableOpacity onPress={() => openMaps(displayAddresses[0].fullAddress)} style={styles.mainMap}>
                  {isWeb ? (
                    <iframe
                      src={`https://www.google.com/maps?q=${encodeURIComponent(displayAddresses[0].fullAddress)}&output=embed&z=16`}
                      style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8 }}
                      loading="lazy"
                    />
                  ) : (
                    <View style={styles.mapPlaceholder}><Ionicons name="map" size={40} color={DARK.primary} /></View>
                  )}
                </TouchableOpacity>
                <Text style={styles.topAddr}>{displayAddresses[0].fullAddress}</Text>
                {displayAddresses[0].probability && <Text style={styles.topProb}>{displayAddresses[0].probability}% match</Text>}

                {/* Other locations */}
                {displayAddresses.slice(1, 6).map((addr: any, idx: number) => (
                  <TouchableOpacity key={idx} style={styles.locRow} onPress={() => openMaps(addr.fullAddress)}>
                    <View style={styles.rankBadge}><Text style={styles.rankText}>{idx + 2}</Text></View>
                    <Text style={styles.locAddr} numberOfLines={1}>{addr.fullAddress}</Text>
                    {addr.probability && <Text style={styles.locProb}>{addr.probability}%</Text>}
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* Phones */}
            {phones.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📱 PHONES</Text>
                {phones.slice(0, 5).map((p: any, idx: number) => (
                  <TouchableOpacity key={idx} style={styles.phoneRow} onPress={() => Linking.openURL(`tel:${p.number}`)}>
                    <Ionicons name="call" size={14} color={DARK.success} />
                    <Text style={styles.phoneNum}>{p.number}</Text>
                    <Text style={styles.phoneType}>{p.type || 'unknown'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Files */}
            {uploadedFiles.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📁 FILES ({uploadedFiles.length})</Text>
                {uploadedFiles.map((f) => (
                  <View key={f.id} style={styles.fileRow}>
                    <Ionicons name={f.type === 'image' ? 'image' : 'document'} size={14} color={DARK.primary} />
                    <Text style={styles.fileName} numberOfLines={1}>{f.name}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>

        {/* COLUMN 3: Social Media */}
        <View style={[styles.col, styles.socialCol, isWeb && { width: 320, minWidth: 280 }]}>
          <Text style={styles.colTitle}>🔍 OSINT & SOCIAL</Text>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 8 }}>
            {/* Subject Photo + Reverse Image Search */}
            {subjectPhoto && (
              <View style={styles.subjectSection}>
                <Image source={{ uri: subjectPhoto }} style={styles.subjectImg} />
                <Text style={styles.subjectName}>{parsedData?.subject?.fullName || caseData.name}</Text>

                {/* Face Biometrics */}
                {isExtractingFace ? (
                  <View style={styles.faceAnalyzing}>
                    <ActivityIndicator size="small" color={DARK.warning} />
                    <Text style={styles.faceAnalyzingText}>Analyzing facial structure...</Text>
                  </View>
                ) : facialFeatures ? (
                  <View style={styles.faceBiometrics}>
                    <Text style={styles.faceBioTitle}>🧬 FACIAL BIOMETRICS</Text>
                    <View style={styles.faceBioRow}>
                      <Text style={styles.faceBioLabel}>Face:</Text>
                      <Text style={styles.faceBioValue}>{facialFeatures.faceShape}, {facialFeatures.jawline} jaw</Text>
                    </View>
                    <View style={styles.faceBioRow}>
                      <Text style={styles.faceBioLabel}>Eyes:</Text>
                      <Text style={styles.faceBioValue}>{facialFeatures.eyeShape}, {facialFeatures.eyeSpacing}</Text>
                    </View>
                    <View style={styles.faceBioRow}>
                      <Text style={styles.faceBioLabel}>Nose:</Text>
                      <Text style={styles.faceBioValue}>{facialFeatures.noseShape}</Text>
                    </View>
                    {facialFeatures.distinctiveFeatures?.length > 0 && (
                      <View style={styles.faceBioRow}>
                        <Text style={styles.faceBioLabel}>Marks:</Text>
                        <Text style={styles.faceBioValue}>{facialFeatures.distinctiveFeatures.join(', ')}</Text>
                      </View>
                    )}
                    <Text style={styles.faceBioNote}>
                      ✓ Face signature ready for matching
                    </Text>
                  </View>
                ) : null}

                {/* Reverse Image Search */}
                <View style={styles.reverseSearchSection}>
                  <Text style={styles.reverseSearchTitle}>🔎 REVERSE IMAGE SEARCH</Text>
                  {generateReverseImageSearchUrls(subjectPhoto).map((search, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.reverseSearchRow}
                      onPress={() => openUrl(search.url)}
                    >
                      <Text style={styles.reverseSearchName}>{search.name}</Text>
                      <Text style={styles.reverseSearchNote}>{search.note}</Text>
                      <Ionicons name="open-outline" size={14} color={DARK.primary} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* OSINT Status */}
            {isSearchingOSINT && (
              <View style={styles.osintSearching}>
                <ActivityIndicator size="small" color={DARK.warning} />
                <Text style={styles.osintSearchingText}>Searching profiles automatically...</Text>
              </View>
            )}

            {/* Re-run OSINT Button */}
            {parsedData?.subject?.fullName && !isSearchingOSINT && (
              <TouchableOpacity
                style={styles.osintRunBtn}
                onPress={() => {
                  setOsintSearched(false);
                  runOSINTSearch(parsedData.subject.fullName);
                }}
              >
                <Ionicons name="refresh" size={14} color="#fff" />
                <Text style={styles.osintRunBtnText}>Re-scan OSINT ({osintResults.filter(r => r.exists === true).length} found)</Text>
              </TouchableOpacity>
            )}

            {/* Username Search Tool */}
            {parsedData?.subject?.fullName && (
              <TouchableOpacity
                style={styles.usernameSearchBtn}
                onPress={() => openUrl(generateUsernameSearchUrl(parsedData.subject.fullName.toLowerCase().replace(/ /g, '')))}
              >
                <Ionicons name="search" size={14} color="#fff" />
                <Text style={styles.usernameSearchText}>WhatsMyName (400+ sites)</Text>
              </TouchableOpacity>
            )}

            {/* Social Media Section */}
            <Text style={styles.osintSectionTitle}>📱 SOCIAL MEDIA</Text>
            {socialProfiles.filter(p => ['Facebook', 'Instagram', 'TikTok', 'Twitter/X', 'LinkedIn', 'Snapchat'].includes(p.platform)).map((profile, idx) => (
              <View key={idx} style={styles.socialCard}>
                <View style={styles.socialHeader}>
                  <View style={[styles.socialIcon, { backgroundColor: getPlatformColor(profile.platform) }]}>
                    <Ionicons
                      name={profile.platform === 'Facebook' ? 'logo-facebook' :
                            profile.platform === 'Instagram' ? 'logo-instagram' :
                            profile.platform === 'TikTok' ? 'logo-tiktok' :
                            profile.platform.includes('Twitter') ? 'logo-twitter' :
                            profile.platform === 'LinkedIn' ? 'logo-linkedin' :
                            profile.platform === 'Snapchat' ? 'logo-snapchat' : 'globe'}
                      size={16}
                      color="#fff"
                    />
                  </View>
                  <Text style={styles.socialPlatform}>{profile.platform}</Text>
                  <View style={[styles.statusBadge,
                    profile.status === 'found' ? styles.statusFound :
                    profile.status === 'not_found' ? styles.statusNotFound : styles.statusSearching
                  ]}>
                    <Text style={styles.statusText}>
                      {profile.status === 'found' ? '✓' : profile.status === 'not_found' ? '✗' : '?'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.socialUsername}>@{profile.username}</Text>
                <View style={styles.socialActions}>
                  <TouchableOpacity style={styles.socialBtn} onPress={() => openUrl(profile.url)}>
                    <Text style={styles.socialBtnText}>Search</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.socialBtn, styles.foundBtn]}
                    onPress={() => updateSocialStatus(profile.platform, 'found')}
                  >
                    <Text style={styles.socialBtnText}>✓</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.socialBtn, styles.notFoundBtn]}
                    onPress={() => updateSocialStatus(profile.platform, 'not_found')}
                  >
                    <Text style={styles.socialBtnText}>✗</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {/* People Search / Public Records Section */}
            <Text style={styles.osintSectionTitle}>🔍 PEOPLE SEARCH</Text>
            {socialProfiles.filter(p => ['TruePeopleSearch', 'FastPeopleSearch', 'Whitepages', 'Spokeo', 'CourtListener'].includes(p.platform)).map((profile, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.peopleSearchRow}
                onPress={() => openUrl(profile.url)}
              >
                <Ionicons name="person-circle-outline" size={16} color={DARK.primary} />
                <Text style={styles.peopleSearchName}>{profile.platform}</Text>
                <View style={[styles.statusBadge,
                  profile.status === 'found' ? styles.statusFound :
                  profile.status === 'not_found' ? styles.statusNotFound : styles.statusSearching
                ]}>
                  <Text style={styles.statusText}>
                    {profile.status === 'found' ? '✓' : profile.status === 'not_found' ? '✗' : '?'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => updateSocialStatus(profile.platform, 'found')} style={styles.miniBtn}>
                  <Text style={[styles.miniBtnText, { color: DARK.success }]}>✓</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => updateSocialStatus(profile.platform, 'not_found')} style={styles.miniBtn}>
                  <Text style={[styles.miniBtnText, { color: DARK.danger }]}>✗</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}

            {/* Relatives for network */}
            {relatives.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>👥 NETWORK</Text>
                {relatives.slice(0, 5).map((r: any, idx: number) => (
                  <View key={idx} style={styles.relRow}>
                    <Text style={styles.relName}>{r.name}</Text>
                    <Text style={styles.relRel}>{r.relationship}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

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

  // Chat Column
  chatCol: { backgroundColor: DARK.bg },
  chatScroll: { flex: 1 },
  bubble: { padding: 8, borderRadius: 10, marginBottom: 6, maxWidth: '90%' },
  userBubble: { backgroundColor: DARK.primary, alignSelf: 'flex-end' },
  agentBubble: { backgroundColor: DARK.surface, alignSelf: 'flex-start', borderWidth: 1, borderColor: DARK.border },
  bubbleText: { fontSize: 12, color: DARK.text, lineHeight: 16 },
  inputRow: { flexDirection: 'row', alignItems: 'center', padding: 8, borderTopWidth: 1, borderTopColor: DARK.border, gap: 6 },
  attachBtn: { padding: 4 },
  input: { flex: 1, backgroundColor: DARK.surface, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, fontSize: 13, color: DARK.text, borderWidth: 1, borderColor: DARK.border },
  sendBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: DARK.primary, alignItems: 'center', justifyContent: 'center' },

  // Map Column
  mapCol: { backgroundColor: DARK.surface },
  mainMap: { width: '100%', height: 180, borderRadius: 8, overflow: 'hidden', backgroundColor: DARK.surfaceHover, marginBottom: 8 },
  mapPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topAddr: { fontSize: 13, fontWeight: '600', color: DARK.text },
  topProb: { fontSize: 12, color: DARK.success, fontWeight: '600', marginBottom: 12 },
  locRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: DARK.border, gap: 8 },
  rankBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: DARK.surfaceHover, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: 10, fontWeight: '700', color: DARK.text },
  locAddr: { flex: 1, fontSize: 11, color: DARK.text },
  locProb: { fontSize: 10, color: DARK.success },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 10, fontWeight: '600', color: DARK.textMuted, marginBottom: 8 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  phoneNum: { fontSize: 12, color: DARK.text },
  phoneType: { fontSize: 10, color: DARK.textMuted },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  fileName: { fontSize: 11, color: DARK.text, flex: 1 },

  // Social Column
  socialCol: { backgroundColor: DARK.bg, borderRightWidth: 0 },
  subjectSection: { alignItems: 'center', marginBottom: 16 },
  subjectImg: { width: 80, height: 80, borderRadius: 40, marginBottom: 8 },
  subjectName: { fontSize: 13, fontWeight: '600', color: DARK.text, marginBottom: 12 },
  faceAnalyzing: { flexDirection: 'row', alignItems: 'center', backgroundColor: DARK.surface, padding: 10, borderRadius: 8, gap: 8, marginTop: 8 },
  faceAnalyzingText: { fontSize: 11, color: DARK.warning },
  faceBiometrics: { backgroundColor: DARK.surface, borderRadius: 8, padding: 10, marginTop: 8, borderWidth: 1, borderColor: DARK.success + '40' },
  faceBioTitle: { fontSize: 10, fontWeight: '700', color: DARK.success, marginBottom: 8 },
  faceBioRow: { flexDirection: 'row', marginBottom: 4 },
  faceBioLabel: { fontSize: 10, color: DARK.textMuted, width: 50 },
  faceBioValue: { fontSize: 10, color: DARK.text, flex: 1 },
  faceBioNote: { fontSize: 9, color: DARK.success, marginTop: 8, fontStyle: 'italic' },
  reverseSearchSection: { width: '100%', marginTop: 8 },
  reverseSearchTitle: { fontSize: 10, fontWeight: '700', color: DARK.warning, marginBottom: 8, textAlign: 'center' },
  reverseSearchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: DARK.surface, padding: 8, borderRadius: 6, marginBottom: 4, gap: 8 },
  reverseSearchName: { flex: 1, fontSize: 11, fontWeight: '600', color: DARK.text },
  reverseSearchNote: { fontSize: 9, color: DARK.textMuted },
  reverseSearchTip: { fontSize: 9, color: DARK.textMuted, marginTop: 8, textAlign: 'center', fontStyle: 'italic' },
  usernameSearchBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: DARK.primary, padding: 10, borderRadius: 8, gap: 8, marginBottom: 12 },
  usernameSearchText: { fontSize: 11, fontWeight: '600', color: '#fff', flex: 1 },
  osintSectionTitle: { fontSize: 10, fontWeight: '700', color: DARK.textMuted, marginTop: 12, marginBottom: 8 },
  osintSearching: { flexDirection: 'row', alignItems: 'center', backgroundColor: DARK.warning + '20', padding: 10, borderRadius: 8, gap: 8, marginBottom: 8 },
  osintSearchingText: { fontSize: 11, color: DARK.warning, fontWeight: '500' },
  osintRunBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: DARK.success, padding: 8, borderRadius: 6, gap: 6, marginBottom: 8 },
  osintRunBtnText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  peopleSearchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: DARK.surface, padding: 8, borderRadius: 6, marginBottom: 4, gap: 8 },
  peopleSearchName: { flex: 1, fontSize: 11, color: DARK.text },
  miniBtn: { padding: 4 },
  miniBtnText: { fontSize: 12, fontWeight: '700' },
  socialCard: { backgroundColor: DARK.surface, borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: DARK.border },
  socialHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  socialIcon: { width: 24, height: 24, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  socialPlatform: { flex: 1, fontSize: 12, fontWeight: '600', color: DARK.text },
  statusBadge: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statusFound: { backgroundColor: DARK.success },
  statusNotFound: { backgroundColor: DARK.danger },
  statusSearching: { backgroundColor: DARK.textMuted },
  statusText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  socialUsername: { fontSize: 11, color: DARK.textSecondary, marginBottom: 8 },
  socialActions: { flexDirection: 'row', gap: 6 },
  socialBtn: { flex: 1, backgroundColor: DARK.surfaceHover, paddingVertical: 6, borderRadius: 4, alignItems: 'center' },
  foundBtn: { backgroundColor: DARK.success + '30' },
  notFoundBtn: { backgroundColor: DARK.danger + '30' },
  socialBtnText: { fontSize: 10, fontWeight: '600', color: DARK.text },
  relRow: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: DARK.border },
  relName: { fontSize: 12, color: DARK.text },
  relRel: { fontSize: 10, color: DARK.textMuted },
});
