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
  useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCase } from '@/hooks/useCase';
import { deleteCase } from '@/lib/database';
import { deleteCaseDirectory } from '@/lib/storage';
import { confirm } from '@/lib/confirm';
import { syncChat, syncPhoto, fetchSyncedChat, fetchSyncedPhoto, isSyncEnabled, deleteSyncedCase } from '@/lib/sync';
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
  smartOsintSearch,
  checkBackendHealth,
  investigatePerson,
  type InvestigationResult,
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

export default function CaseDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width: screenWidth } = useWindowDimensions();
  const isMobile = screenWidth < 768;
  const { caseData, reports, refresh, analyzeText } = useCase(id!);
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
  const [tacticalAdvice, setTacticalAdvice] = useState<string[]>([]);
  const [pythonBackendAvailable, setPythonBackendAvailable] = useState(false);
  const [imageSearchUrls, setImageSearchUrls] = useState<{
    google_lens?: string;
    yandex?: string;
    tineye?: string;
    bing?: string;
  } | null>(null);
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

        // Load all photo intelligence results
        const localPhotoIntel = await AsyncStorage.getItem(`case_all_photo_intel_${id}`);
        if (localPhotoIntel) {
          try {
            setAllPhotoIntel(JSON.parse(localPhotoIntel));
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

  // Save all photo intel results
  useEffect(() => {
    if (id && allPhotoIntel.length > 0) {
      AsyncStorage.setItem(`case_all_photo_intel_${id}`, JSON.stringify(allPhotoIntel));
    }
  }, [id, allPhotoIntel]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

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

  // Upload image for reverse image search when subject photo is set
  useEffect(() => {
    if (subjectPhoto) {
      uploadImageForSearch(subjectPhoto);
    }
  }, [subjectPhoto]);

  // Extract facial features when photo is set
  useEffect(() => {
    const extractFacialFeatures = async () => {
      if (subjectPhoto && faceMatchService && !facialFeatures && !isExtractingFace) {
        setIsExtractingFace(true);

        setChatMessages(prev => [...prev, {
          id: uniqueId(),
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
              id: uniqueId(),
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
              id: uniqueId(),
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

  // AI Squad Orchestrator disabled - using backend proxy for chat instead
  // This eliminates duplicate "Investigation initialized" messages and removes API key requirement

  // Auto-run OSINT search when we have a valid target name (not "Unknown")
  useEffect(() => {
    const subjectName = parsedData?.subject?.fullName;
    const validName = subjectName && subjectName !== 'Unknown' && subjectName !== 'unknown' ? subjectName : caseData?.name;
    if (validName && validName !== 'Unknown' && !osintSearched && !isSearchingOSINT) {
      runOSINTSearch(validName);
    }
  }, [parsedData?.subject?.fullName, caseData?.name, osintSearched]);

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

        // Single summary message with photo verification warning
        const found = investigation.confirmed_profiles.length;
        let resultMessage = found > 0
          ? `✅ Found ${found} profiles for "${fullName}" in ${investigation.execution_time.toFixed(1)}s.\n\n${investigation.confirmed_profiles.slice(0, 5).map(p => `• ${p.platform}: ${p.url}`).join('\n')}${found > 5 ? `\n• +${found - 5} more` : ''}`
          : `No profiles found for "${fullName}". Try the search links in the right panel.`;

        // Add photo verification warning if we have mugshot
        if (found > 0 && hasMugshot) {
          const demographicInfo = demographics
            ? `\n\n📋 **Subject Demographics:** ${demographics.race || 'Unknown'} ${demographics.sex || 'Unknown'}, Age ${demographics.age || 'Unknown'}`
            : '';
          resultMessage += `${demographicInfo}\n\n⚠️ **VERIFY PHOTOS MANUALLY:** Compare each social profile photo to the mugshot. Names can match but people may differ in race, gender, or age. Only pursue profiles where the photo matches the subject.`;
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
        content: `✅ Local OSINT complete. Found ${localResults.profiles.filter(p => p.exists === true).length} profiles.`,
        timestamp: new Date(),
      }]);
    } catch (localError: any) {
      setChatMessages(prev => [...prev, {
        id: uniqueId(),
        role: 'agent',
        content: `⚠️ OSINT search error: ${localError?.message || 'Unknown error'}. Try manual search links.`,
        timestamp: new Date(),
      }]);
    }
  };

  // Get the best available subject name (used throughout the component)
  const getSubjectName = useCallback(() => {
    // Priority: parsed report > case name > roster data > 'Subject'
    if (parsedData?.subject?.fullName && parsedData.subject.fullName !== 'Unknown') {
      return parsedData.subject.fullName;
    }
    if (caseData?.name) {
      return caseData.name;
    }
    if (caseData?.rosterData?.inmate?.name) {
      return caseData.rosterData.inmate.name;
    }
    return 'Subject';
  }, [parsedData, caseData]);

  // Init greeting
  useEffect(() => {
    if (caseData && chatLoaded && chatMessages.length === 0) {
      const subjectName = getSubjectName();
      setChatMessages([{
        id: 'greeting',
        role: 'agent',
        content: latestReport
          ? `🎯 **${subjectName}** - ${addresses.length} addresses, ${phones.length} phones.`
          : `🔍 **${subjectName}** - Drop files or paste report data.`,
        timestamp: new Date(),
      }]);
    }
  }, [caseData, latestReport, chatLoaded, chatMessages.length, getSubjectName]);

  const scrollToBottom = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

  const openMaps = (address: string) => {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`);
  };

  const openUrl = (url: string) => {
    Linking.openURL(url);
  };

  // Upload image to backend for reverse image search
  const uploadImageForSearch = async (imageBase64: string) => {
    try {
      const response = await fetch('https://elite-recovery-osint.onrender.com/api/image/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: imageBase64 }),
      });
      if (response.ok) {
        const data = await response.json();
        setImageSearchUrls(data.search_urls);
      }
    } catch (error) {
      console.error('Failed to upload image for search:', error);
    }
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
        const parts: string[] = [`📷 **PHOTO INTELLIGENCE REPORT**${intel.sourceFileName ? ` - ${intel.sourceFileName}` : ''}\n`];

        // EXIF METADATA - Display first as it's highest priority
        if (intel.exifData) {
          if (intel.exifData.gps) {
            parts.push(`\n🎯 **CRITICAL: GPS LOCATION FOUND!**`);
            parts.push(`📍 Coordinates: ${intel.exifData.gps.latitude.toFixed(6)}, ${intel.exifData.gps.longitude.toFixed(6)}`);
            parts.push(`🗺️ [Open in Google Maps](${intel.exifData.gps.googleMapsUrl})`);
          }
          if (intel.exifData.dateTime?.original) {
            parts.push(`\n📅 **Photo Taken:** ${intel.exifData.dateTime.original}`);
          }
          if (intel.exifData.device) {
            const device = [intel.exifData.device.make, intel.exifData.device.model].filter(Boolean).join(' ');
            if (device) {
              parts.push(`📱 **Device:** ${device}`);
            }
          }
          if (intel.exifData.gps || intel.exifData.dateTime?.original) {
            parts.push(''); // Empty line after EXIF section
          }
        }

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
          content: '⚠️ Could not analyze photo. Backend may be unavailable - try again in a moment.',
          timestamp: new Date(),
        }]);
      }
    } catch (error: any) {
      setChatMessages(prev => [...prev, {
        id: uniqueId(),
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
              setUploadedFiles(prev => [...prev, { id: uniqueId(), name: currentFileName, type: 'image', uploadedAt: new Date() }]);
              setChatMessages(prev => [...prev, {
                id: uniqueId(),
                role: 'user',
                content: `📸 Compare face: ${currentFileName}`,
                timestamp: new Date(),
              }]);
              scrollToBottom();

              setChatMessages(prev => [...prev, {
                id: uniqueId(),
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
                  id: uniqueId(),
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
                  id: uniqueId(),
                  role: 'agent',
                  content: `⚠️ Face comparison failed: ${err?.message || 'Unknown error'}`,
                  timestamp: new Date(),
                }]);
              }

              scrollToBottom();
              return; // Don't save as subject photo
            }

            // Otherwise, save as subject photo
            console.log('[PhotoUpload] Saving subject photo:', currentFileName);
            setSubjectPhoto(dataUrl);
            try { await AsyncStorage.setItem(`case_photo_${id}`, dataUrl); } catch {}
            setUploadedFiles(prev => [...prev, { id: uniqueId(), name: currentFileName, type: 'image', uploadedAt: new Date() }]);
            setChatMessages(prev => [...prev, { id: uniqueId(), role: 'agent', content: `📸 Subject photo set: ${currentFileName}\n\n🔍 Analyzing photo for investigative leads...`, timestamp: new Date() }]);
            scrollToBottom();

            // Run photo intelligence analysis with filename
            console.log('[PhotoUpload] Running photo intelligence for:', currentFileName);
            analyzePhotoForIntel(dataUrl, currentFileName);
          }
        };
        reader.readAsDataURL(file);
        continue;
      }

      const docType: 'pdf' | 'doc' | 'text' = fileName.endsWith('.pdf') ? 'pdf' : fileName.endsWith('.doc') ? 'doc' : 'text';
      setUploadedFiles(prev => [...prev, { id: uniqueId() + i, name: file.name, type: docType, uploadedAt: new Date() }]);
      setChatMessages(prev => [...prev, { id: uniqueId(), role: 'user', content: `📄 ${file.name}`, timestamp: new Date() }]);
      scrollToBottom();

      try {
        const extractResult = await processUploadedFile(file);
        if (!extractResult.success || !extractResult.text) {
          setChatMessages(prev => [...prev, { id: uniqueId(), role: 'agent', content: extractResult.error || 'Could not read file.', timestamp: new Date() }]);
          continue;
        }

        // Analyze document text directly
        const result = await analyzeText(extractResult.text);
        if (result.success && result.data) {
          setChatMessages(prev => [...prev, {
            id: uniqueId(),
            role: 'agent',
            content: `✅ ${result.data.addresses?.length || 0} addresses, ${result.data.phones?.length || 0} phones. Top: ${result.data.addresses?.[0]?.fullAddress || 'unknown'}`,
            timestamp: new Date(),
          }]);
          await refresh();
        }
      } catch (err: any) {
        setChatMessages(prev => [...prev, { id: uniqueId(), role: 'agent', content: `Error: ${err?.message || 'Unknown'}`, timestamp: new Date() }]);
      }
    }

    setIsProcessingFile(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const sendMessage = async () => {
    if (!inputText.trim() || isSending) return;
    const userText = inputText.trim();
    const userTextLower = userText.toLowerCase();
    setChatMessages(prev => [...prev, { id: uniqueId(), role: 'user', content: userText, timestamp: new Date() }]);
    setInputText('');
    setIsSending(true);
    scrollToBottom();

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
          content: `🔍 Searching username: "${userText}"...`,
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
                ? `✅ Found ${foundCount} profiles for "${userText}":\n${result.found.slice(0, 10).map(p => `• ${p.platform}: ${p.url}`).join('\n')}${foundCount > 10 ? `\n+${foundCount - 10} more` : ''}`
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
          content: '⚠️ No subject name found. Enter a username to search directly.',
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
      }
      if (displayAddresses.length > 0) {
        contextParts.push(`Known addresses: ${displayAddresses.slice(0, 3).map(a => a.fullAddress).join('; ')}`);
      }

      // Use backend proxy for chat
      const systemPrompt = `You are an AI assistant for a bail recovery (fugitive recovery) investigation system. Help the agent locate the subject.

CURRENT CASE CONTEXT:
${contextParts.join('\n')}

Recent chat messages the user can see:
${chatMessages.slice(-5).map(m => `${m.role}: ${m.content.slice(0, 200)}`).join('\n')}

IMPORTANT: The user CAN see photos and analysis results in the chat. If they mention a photo, acknowledge that you can see the analysis results. Be helpful and specific to their case.`;

      const response = await fetch('https://elite-recovery-osint.onrender.com/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userText },
          ],
          model: 'gpt-4o-mini',
          max_tokens: 1000,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const aiResponse = data.choices?.[0]?.message?.content || 'No response';
        setChatMessages(prev => [...prev, {
          id: uniqueId(),
          role: 'agent',
          content: aiResponse,
          timestamp: new Date(),
        }]);
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
        const locationsHtml = displayAddresses.slice(0, 8).map((loc: any, i: number) => `
          <div class="location">
            <div>
              <strong style="color: #dc2626;">#${i + 1}</strong>
              <span style="margin-left: 10px;">${loc.address || loc.fullAddress}</span>
            </div>
            ${loc.probability ? `<span class="probability">${loc.probability}% confidence</span>` : ''}
          </div>
        `).join('') || '<p style="color: #9ca3af; font-style: italic;">No locations identified yet. Upload skip trace documents or photos containing addresses.</p>';

        const socialsHtml = socialProfiles.length > 0
          ? socialProfiles.map(p => `
              <span class="social ${p.status === 'found' ? 'found' : p.status === 'not_found' ? 'not-found' : 'not-searched'}">
                ${p.platform}: ${p.status === 'found' ? '✓ Found' : p.status === 'not_found' ? '✗ Not Found' : '○ Not Searched'}
              </span>
            `).join('')
          : `<p style="color: #f59e0b;">⚠️ No OSINT search performed. ${parsedData?.subject?.fullName ? 'Run search from case screen.' : 'Upload a skip trace report or enter subject name to enable OSINT.'}</p>`;

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
              items.push(`<div class="legend-item"><span class="legend-num">${num}</span> 🏠 ${a.text} (${a.confidence})</div>`);
              num++;
            }
          });

          intel.vehicles.filter(v => v.licensePlate && v.boundingBox).forEach((v) => {
            items.push(`<div class="legend-item"><span class="legend-num legend-plate">${num}</span> 🚗 ${v.licensePlate} - ${v.color} ${v.make || ''}</div>`);
            num++;
          });

          intel.businesses.filter(b => b.boundingBox).forEach((b) => {
            items.push(`<div class="legend-item"><span class="legend-num legend-biz">${num}</span> 🏪 ${b.name}</div>`);
            num++;
          });

          return items.join('');
        };

        const photoIntelHtml = photosWithIntel.length > 0 ? `
          <h2>📷 Photo Intelligence</h2>
          <style>
            .photo-intel-card { margin-bottom: 20px; padding: 15px; background: #f3f4f6; border-radius: 8px; border-left: 4px solid #dc2626; }
            .photo-container { position: relative; display: inline-block; margin-bottom: 10px; }
            .photo-container img { max-width: 280px; max-height: 200px; border-radius: 6px; border: 2px solid #374151; }
            .marker { position: absolute; width: 22px; height: 22px; background: #dc2626; color: white; border-radius: 50%; font-size: 11px; font-weight: bold; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); transform: translate(-50%, -50%); }
            .marker-plate { background: #2563eb; }
            .marker-biz { background: #16a34a; }
            .legend-item { font-size: 12px; margin: 4px 0; display: flex; align-items: center; gap: 8px; }
            .legend-num { width: 18px; height: 18px; background: #dc2626; color: white; border-radius: 50%; font-size: 10px; font-weight: bold; display: inline-flex; align-items: center; justify-content: center; }
            .legend-plate { background: #2563eb; }
            .legend-biz { background: #16a34a; }
            .intel-details { margin-top: 10px; padding-top: 10px; border-top: 1px solid #d1d5db; }
          </style>
          <div class="section">
            ${photosWithIntel.map((intel) => `
              <div class="photo-intel-card">
                <p style="font-weight: bold; margin-bottom: 10px; font-size: 14px;">📸 ${intel.sourceFileName || 'Unknown file'}</p>
                <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                  ${intel.thumbnailBase64 ? `
                    <div class="photo-container">
                      <img src="${intel.thumbnailBase64}" alt="${intel.sourceFileName || 'Evidence photo'}" />
                      ${generateMarkers(intel)}
                    </div>
                  ` : ''}
                  <div style="flex: 1; min-width: 200px;">
                    ${generateLegend(intel)}
                    <div class="intel-details">
                      ${intel.exifData?.gps ? `<p style="font-size: 12px;"><strong>📍 GPS:</strong> <a href="${intel.exifData.gps.googleMapsUrl}">${intel.exifData.gps.latitude.toFixed(6)}, ${intel.exifData.gps.longitude.toFixed(6)}</a></p>` : ''}
                      ${intel.addresses.filter(a => !a.boundingBox).length > 0 ? `<p style="font-size: 12px;"><strong>🏠 Other addresses:</strong> ${intel.addresses.filter(a => !a.boundingBox).map(a => a.text).join(', ')}</p>` : ''}
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
                body { font-family: -apple-system, Arial, sans-serif; margin: 0; color: #1f2937; font-size: 13px; line-height: 1.5; }
                .header { background: linear-gradient(135deg, #18181b 0%, #27272a 100%); color: white; padding: 30px 40px; }
                .header h1 { margin: 0 0 8px 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px; }
                .header .subtitle { color: #a1a1aa; font-size: 14px; }
                .header .case-id { color: #dc2626; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
                .content { padding: 30px 40px; max-width: 900px; }
                .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
                .meta-card { background: #f9fafb; border-radius: 8px; padding: 15px; text-align: center; border: 1px solid #e5e7eb; }
                .meta-card .value { font-size: 24px; font-weight: 700; color: #dc2626; }
                .meta-card .label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
                h2 { color: #18181b; font-size: 16px; font-weight: 600; margin: 25px 0 12px 0; padding-bottom: 8px; border-bottom: 2px solid #dc2626; display: flex; align-items: center; gap: 8px; }
                .section { margin-bottom: 20px; }
                .summary-list { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 15px 20px; }
                .summary-list li { margin: 6px 0; color: #166534; }
                .location { padding: 12px 15px; margin: 8px 0; background: white; border-left: 4px solid #dc2626; border-radius: 0 6px 6px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: center; }
                .location .probability { background: #dcfce7; color: #166534; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
                .social { display: inline-block; padding: 6px 12px; margin: 4px; border-radius: 6px; font-size: 11px; font-weight: 500; }
                .found { background: #dcfce7; color: #166534; }
                .not-found { background: #fee2e2; color: #991b1b; }
                .not-searched { background: #fef3c7; color: #92400e; }
                .confidential { background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 15px 20px; margin-top: 30px; display: flex; align-items: center; gap: 12px; }
                .confidential-icon { font-size: 20px; }
                .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 11px; text-align: center; }
                @media print {
                  body { margin: 0; }
                  .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
              </style>
            </head>
            <body>
              <div class="header">
                <div class="case-id">Elite Recovery Systems • Case File</div>
                <h1>${(parsedData?.subject?.fullName && parsedData.subject.fullName !== 'Unknown') ? parsedData.subject.fullName : caseData?.name}</h1>
                <div class="subtitle">Investigation Report • Generated ${new Date().toLocaleString()}</div>
              </div>

              <div class="content">
                <div class="meta-grid">
                  <div class="meta-card">
                    <div class="value">${uploadedFiles.length}</div>
                    <div class="label">Files Analyzed</div>
                  </div>
                  <div class="meta-card">
                    <div class="value">${photosWithData}/${totalPhotos}</div>
                    <div class="label">Photos w/ Intel</div>
                  </div>
                  <div class="meta-card">
                    <div class="value">${displayAddresses.length}</div>
                    <div class="label">Locations</div>
                  </div>
                  <div class="meta-card">
                    <div class="value">${socialFound}/${socialTotal}</div>
                    <div class="label">Profiles Found</div>
                  </div>
                </div>

                ${summaryItems.length > 0 ? `
                  <h2>📊 Executive Summary</h2>
                  <div class="summary-list">
                    <ul>
                      ${summaryItems.map(item => `<li>${item}</li>`).join('')}
                    </ul>
                  </div>
                ` : ''}

                <h2>📍 Priority Locations</h2>
                <div class="section">${locationsHtml}</div>

                <h2>📱 Digital Footprint</h2>
                <div class="section">${socialsHtml}</div>

                ${photoIntelHtml}

                <div class="confidential">
                  <span class="confidential-icon">⚠️</span>
                  <div>
                    <strong>CONFIDENTIAL</strong><br>
                    <span style="font-size: 11px; color: #92400e;">For authorized bail enforcement and fugitive recovery personnel only. Unauthorized disclosure prohibited.</span>
                  </div>
                </div>

                <div class="footer">
                  Elite Recovery Systems • Professional Bail Enforcement Intelligence<br>
                  Report ID: ${caseData?.id?.slice(0, 8).toUpperCase() || 'N/A'} • ${new Date().toISOString()}
                </div>
              </div>
            </body>
            </html>
          `);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => printWindow.print(), 300);
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
      // Navigate back IMMEDIATELY
      router.push('/(tabs)');

      // Cleanup in background (don't block UI)
      Promise.all([
        deleteCase(id!),
        deleteCaseDirectory(id!),
        AsyncStorage.multiRemove([`case_chat_${id}`, `case_photo_${id}`, `case_squad_${id}`, `case_social_${id}`, `case_all_photo_intel_${id}`, `case_face_${id}`]),
      ]).catch(err => console.error('Delete error:', err));

      isSyncEnabled().then(enabled => {
        if (enabled) deleteSyncedCase(id!).catch(() => {});
      });
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
          onPress={() => router.push('/(tabs)')}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={24} color={DARK.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.photoBox} onPress={() => fileInputRef.current?.click()}>
          {subjectPhoto ? <Image source={{ uri: subjectPhoto }} style={styles.photoImg} /> : <Ionicons name="person" size={20} color={DARK.textMuted} />}
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.caseName} numberOfLines={1}>{(parsedData?.subject?.fullName && parsedData.subject.fullName !== 'Unknown') ? parsedData.subject.fullName : (caseData.name || 'Unnamed Subject')}</Text>
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

      {/* 3-COLUMN LAYOUT - Equal width on desktop, stacked on mobile */}
      <View style={[
        styles.columns,
        isWeb && !isMobile && { display: 'flex', flexDirection: 'row' },
        isMobile && { flexDirection: 'column' }
      ]}>

        {/* COLUMN 1: Chat */}
        <View style={[
          styles.col,
          styles.chatCol,
          isWeb && !isMobile && { flex: 1 },
          isMobile && { height: 300 }
        ]}>
          <View style={styles.colTitleRow}>
            <Text style={styles.colTitleText}>💬 CHAT</Text>
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

        {/* COLUMN 2: Intel/Data Output */}
        <View style={[
          styles.col,
          styles.mapCol,
          isWeb && !isMobile && { flex: 1.5 },
          isMobile && { height: 400 }
        ]}>
          <Text style={styles.colTitle}>🎯 INTEL</Text>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 8 }}>
            {/* Subject Info */}
            {parsedData?.subject && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>👤 SUBJECT</Text>
                <View style={styles.intelCard}>
                  <Text style={styles.intelName}>{(parsedData.subject.fullName && parsedData.subject.fullName !== 'Unknown') ? parsedData.subject.fullName : caseData?.name}</Text>
                  {parsedData.subject.dateOfBirth && <Text style={styles.intelDetail}>DOB: {parsedData.subject.dateOfBirth}</Text>}
                  {parsedData.subject.ssn && <Text style={styles.intelDetail}>SSN: ***-**-{parsedData.subject.ssn.slice(-4)}</Text>}
                </View>
              </View>
            )}

            {/* Locations with Map */}
            {displayAddresses.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📍 LOCATIONS ({displayAddresses.length})</Text>
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
                {displayAddresses[0].probability && <Text style={styles.topProb}>{displayAddresses[0].probability}% confidence</Text>}

                {/* Other locations */}
                {displayAddresses.slice(1, 6).map((addr: any, idx: number) => (
                  <TouchableOpacity key={idx} style={styles.locRow} onPress={() => openMaps(addr.fullAddress)}>
                    <View style={styles.rankBadge}><Text style={styles.rankText}>{idx + 2}</Text></View>
                    <Text style={styles.locAddr} numberOfLines={1}>{addr.fullAddress}</Text>
                    {addr.probability && <Text style={styles.locProb}>{addr.probability}%</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Phones */}
            {phones.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📱 PHONES ({phones.length})</Text>
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
                <Text style={styles.sectionTitle}>📧 EMAILS ({parsedData.emails.length})</Text>
                {parsedData.emails.slice(0, 5).map((email: string, idx: number) => (
                  <TouchableOpacity key={idx} style={styles.phoneRow} onPress={() => Linking.openURL(`mailto:${email}`)}>
                    <Ionicons name="mail" size={14} color={DARK.primary} />
                    <Text style={styles.phoneNum}>{email}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Vehicles */}
            {parsedData?.vehicles && parsedData.vehicles.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🚗 VEHICLES ({parsedData.vehicles.length})</Text>
                {parsedData.vehicles.map((v: any, idx: number) => (
                  <View key={idx} style={styles.vehicleRow}>
                    <Ionicons name="car" size={14} color={DARK.warning} />
                    <Text style={styles.vehicleText}>{v.year} {v.make} {v.model}</Text>
                    {v.plate && <Text style={styles.plateText}>{v.plate}</Text>}
                  </View>
                ))}
              </View>
            )}

            {/* Associates */}
            {parsedData?.associates && parsedData.associates.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>👥 ASSOCIATES ({parsedData.associates.length})</Text>
                {parsedData.associates.slice(0, 5).map((a: any, idx: number) => (
                  <View key={idx} style={styles.associateRow}>
                    <Ionicons name="person" size={14} color={DARK.textSecondary} />
                    <Text style={styles.associateName}>{a.name || a}</Text>
                    {a.relationship && <Text style={styles.associateRel}>{a.relationship}</Text>}
                  </View>
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
          <Text style={styles.colTitle}>🔍 SEARCH</Text>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 8 }}>
            {/* Subject Photo */}
            {subjectPhoto && (
              <View style={styles.subjectSection}>
                <Image source={{ uri: subjectPhoto }} style={styles.subjectImg} />
                <Text style={styles.subjectName}>{parsedData?.subject?.fullName || caseData.name}</Text>
                {facialFeatures && (
                  <Text style={styles.faceReadyBadge}>✓ Face ready for matching</Text>
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
                  const name = (parsedData?.subject?.fullName && parsedData.subject.fullName !== 'Unknown')
                    ? parsedData.subject.fullName
                    : caseData?.name;
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

            {/* Reverse Image Search - Auto-populated with subject photo */}
            {subjectPhoto && (
              <>
                <Text style={styles.osintSectionTitle}>Image Search</Text>
                {imageSearchUrls ? (
                  <>
                    <TouchableOpacity style={styles.recordLink} onPress={() => openUrl(imageSearchUrls.google_lens!)}>
                      <Text style={styles.recordLinkText}>Google Lens</Text>
                      <Ionicons name="search" size={14} color={DARK.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.recordLink} onPress={() => openUrl(imageSearchUrls.yandex!)}>
                      <Text style={styles.recordLinkText}>Yandex (Faces)</Text>
                      <Ionicons name="search" size={14} color={DARK.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.recordLink} onPress={() => openUrl(imageSearchUrls.tineye!)}>
                      <Text style={styles.recordLinkText}>TinEye</Text>
                      <Ionicons name="search" size={14} color={DARK.primary} />
                    </TouchableOpacity>
                  </>
                ) : (
                  <Text style={{ color: DARK.textMuted, fontSize: 11, padding: 4 }}>Loading search links...</Text>
                )}
              </>
            )}

            {/* Network */}
            {relatives.length > 0 && (
              <>
                <Text style={styles.osintSectionTitle}>Network</Text>
                {relatives.slice(0, 3).map((r: any, idx: number) => (
                  <View key={idx} style={styles.relRow}>
                    <Text style={styles.relName}>{r.name}</Text>
                    <Text style={styles.relRel}>{r.relationship}</Text>
                  </View>
                ))}
              </>
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
  colTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: DARK.surface, borderBottomWidth: 1, borderBottomColor: DARK.border, paddingHorizontal: 8, paddingVertical: 6 },
  colTitleText: { fontSize: 10, fontWeight: '700', color: DARK.textMuted, letterSpacing: 1 },
  copyBtn: { padding: 6 },

  // Chat Column
  chatCol: { backgroundColor: DARK.bg },
  chatScroll: { flex: 1 },
  bubble: { padding: 10, borderRadius: 10, marginBottom: 6, maxWidth: '90%' },
  userBubble: { backgroundColor: DARK.primary, alignSelf: 'flex-end' },
  agentBubble: { backgroundColor: DARK.surface, alignSelf: 'flex-start', borderWidth: 1, borderColor: DARK.border },
  bubbleText: { fontSize: 14, color: DARK.text, lineHeight: 20 },
  inputRow: { flexDirection: 'row', alignItems: 'center', padding: 8, borderTopWidth: 1, borderTopColor: DARK.border, gap: 6 },
  attachBtn: { padding: 4 },
  input: { flex: 1, backgroundColor: DARK.surface, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, color: DARK.text, borderWidth: 1, borderColor: DARK.border },
  sendBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: DARK.primary, alignItems: 'center', justifyContent: 'center' },

  // Map Column
  mapCol: { backgroundColor: DARK.surface },
  mainMap: { width: '100%', height: 180, borderRadius: 8, overflow: 'hidden', backgroundColor: DARK.surfaceHover, marginBottom: 8 },
  mapPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topAddr: { fontSize: 15, fontWeight: '600', color: DARK.text },
  topProb: { fontSize: 14, color: DARK.success, fontWeight: '600', marginBottom: 12 },
  locRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: DARK.border, gap: 8 },
  rankBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: DARK.surfaceHover, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: 12, fontWeight: '700', color: DARK.text },
  locAddr: { flex: 1, fontSize: 13, color: DARK.text },
  locProb: { fontSize: 12, color: DARK.success },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: DARK.textMuted, marginBottom: 8 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  phoneNum: { fontSize: 14, color: DARK.text },
  phoneType: { fontSize: 12, color: DARK.textMuted },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
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
  reverseSearchSection: { width: '100%', marginTop: 8 },
  reverseSearchTitle: { fontSize: 12, fontWeight: '700', color: DARK.warning, marginBottom: 8, textAlign: 'center' },
  reverseSearchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: DARK.surface, padding: 8, borderRadius: 6, marginBottom: 4, gap: 8 },
  reverseSearchName: { flex: 1, fontSize: 13, fontWeight: '600', color: DARK.text },
  reverseSearchNote: { fontSize: 11, color: DARK.textMuted },
  reverseSearchTip: { fontSize: 11, color: DARK.textMuted, marginTop: 8, textAlign: 'center', fontStyle: 'italic' },
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
  relName: { fontSize: 14, color: DARK.text },
  relRel: { fontSize: 12, color: DARK.textMuted },
  // Simplified styles
  faceReadyBadge: { fontSize: 12, color: DARK.success, backgroundColor: DARK.success + '20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  quickLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  quickLink: { width: 44, height: 44, borderRadius: 8, backgroundColor: DARK.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: DARK.border },
  quickLinkFound: { borderColor: DARK.success, backgroundColor: DARK.success + '15' },
  recordLink: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, backgroundColor: DARK.surface, borderRadius: 6, marginBottom: 4, gap: 8 },
  recordLinkText: { flex: 1, fontSize: 14, color: DARK.text },
});
