/**
 * Multi-File Upload Component
 * Supports drag-and-drop, PDF/text files, batch processing
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { processUploadedFile, ExtractResult } from '@/lib/pdf-extract';

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

export interface UploadedFile {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  text?: string;
  pageCount?: number;
  charCount?: number;
  error?: string;
  relationship?: string;
}

interface MultiFileUploadProps {
  onFilesReady: (files: UploadedFile[]) => void;
  maxFiles?: number;
  showRelationshipField?: boolean;
}

const isWeb = Platform.OS === 'web';

export function MultiFileUpload({
  onFilesReady,
  maxFiles = 10,
  showRelationshipField = false,
}: MultiFileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File): Promise<UploadedFile> => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const uploadedFile: UploadedFile = {
      id,
      name: file.name,
      status: 'processing',
    };

    try {
      const result = await processUploadedFile(file);

      if (result.success && result.text) {
        return {
          ...uploadedFile,
          status: 'done',
          text: result.text,
          pageCount: result.pageCount,
          charCount: result.text.length,
        };
      } else {
        return {
          ...uploadedFile,
          status: 'error',
          error: result.error || 'Failed to process file',
        };
      }
    } catch (error) {
      return {
        ...uploadedFile,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }, []);

  const handleFiles = useCallback(async (fileList: FileList | File[]) => {
    const filesToProcess = Array.from(fileList).slice(0, maxFiles - files.length);

    if (filesToProcess.length === 0) return;

    // Add files as pending
    const pendingFiles: UploadedFile[] = filesToProcess.map((file, idx) => ({
      id: Date.now().toString() + idx,
      name: file.name,
      status: 'pending' as const,
    }));

    setFiles(prev => [...prev, ...pendingFiles]);

    // Process each file
    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      const pendingId = pendingFiles[i].id;

      // Mark as processing
      setFiles(prev =>
        prev.map(f => (f.id === pendingId ? { ...f, status: 'processing' as const } : f))
      );

      const processed = await processFile(file);

      // Update with result
      setFiles(prev =>
        prev.map(f => (f.id === pendingId ? { ...processed, id: pendingId } : f))
      );
    }
  }, [files.length, maxFiles, processFile]);

  // Web drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleWebFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Mobile document picker
  const handleMobilePick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'application/pdf'],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets) return;

      for (const asset of result.assets.slice(0, maxFiles - files.length)) {
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);

        // Add as processing
        setFiles(prev => [
          ...prev,
          { id, name: asset.name, status: 'processing' },
        ]);

        try {
          // Read file content
          let text: string;

          if (asset.mimeType === 'application/pdf') {
            // For mobile PDF, we'll need to read as base64 and process
            // For now, show error and suggest text paste
            setFiles(prev =>
              prev.map(f =>
                f.id === id
                  ? {
                      ...f,
                      status: 'error',
                      error: 'PDF parsing on mobile coming soon. Please paste the text directly for now.',
                    }
                  : f
              )
            );
            continue;
          }

          // Read text file
          text = await FileSystem.readAsStringAsync(asset.uri);

          setFiles(prev =>
            prev.map(f =>
              f.id === id
                ? {
                    ...f,
                    status: 'done',
                    text,
                    charCount: text.length,
                    pageCount: 1,
                  }
                : f
            )
          );
        } catch (error) {
          setFiles(prev =>
            prev.map(f =>
              f.id === id
                ? {
                    ...f,
                    status: 'error',
                    error: error instanceof Error ? error.message : 'Failed to read file',
                  }
                : f
            )
          );
        }
      }
    } catch (error) {
      console.error('Document picker error:', error);
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const updateRelationship = (id: string, relationship: string) => {
    setFiles(prev =>
      prev.map(f => (f.id === id ? { ...f, relationship } : f))
    );
  };

  const readyFiles = files.filter(f => f.status === 'done' && f.text);
  const hasProcessing = files.some(f => f.status === 'processing' || f.status === 'pending');

  const handleSubmit = () => {
    if (readyFiles.length > 0) {
      onFilesReady(readyFiles);
    }
  };

  return (
    <View style={styles.container}>
      {/* Drop zone */}
      {isWeb ? (
        <div
          style={{
            ...dropZoneStyle,
            border: isDragging ? `2px dashed ${DARK.primary}` : `2px dashed ${DARK.border}`,
            backgroundColor: isDragging ? DARK.surfaceHover : DARK.surface,
          }}
          onDragEnter={handleDragEnter as any}
          onDragLeave={handleDragLeave as any}
          onDragOver={handleDragOver as any}
          onDrop={handleDrop as any}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef as any}
            type="file"
            accept=".pdf,.txt,.text,.png,.jpg,.jpeg,.gif,.webp,text/plain,application/pdf,image/*"
            multiple
            onChange={handleWebFileSelect as any}
            style={{ display: 'none' }}
          />
          <Ionicons name="cloud-upload-outline" size={48} color={DARK.primary} />
          <Text style={styles.dropText}>
            Drop files here
          </Text>
          <Text style={styles.dropSubtext}>
            PDF, text, or images ({maxFiles - files.length} remaining)
          </Text>
        </div>
      ) : (
        <TouchableOpacity style={styles.dropZone} onPress={handleMobilePick}>
          <Ionicons name="document-attach-outline" size={48} color={DARK.primary} />
          <Text style={styles.dropText}>Tap to select files</Text>
          <Text style={styles.dropSubtext}>PDF or text files</Text>
        </TouchableOpacity>
      )}

      {/* File list */}
      {files.length > 0 && (
        <View style={styles.fileList}>
          <Text style={styles.listTitle}>FILES ({files.length})</Text>
          <ScrollView style={styles.scrollArea}>
            {files.map(file => (
              <View key={file.id} style={styles.fileItem}>
                <View style={styles.fileIcon}>
                  {file.status === 'processing' || file.status === 'pending' ? (
                    <ActivityIndicator size="small" color={DARK.primary} />
                  ) : file.status === 'done' ? (
                    <Ionicons name="checkmark-circle" size={24} color={DARK.success} />
                  ) : (
                    <Ionicons name="alert-circle" size={24} color={DARK.danger} />
                  )}
                </View>

                <View style={styles.fileInfo}>
                  <Text style={styles.fileName} numberOfLines={1}>
                    {file.name}
                  </Text>
                  {file.status === 'done' && (
                    <Text style={styles.fileStats}>
                      {file.charCount?.toLocaleString()} chars
                      {file.pageCount && file.pageCount > 1 && ` • ${file.pageCount} pages`}
                    </Text>
                  )}
                  {file.status === 'error' && (
                    <Text style={styles.fileError}>{file.error}</Text>
                  )}
                  {file.status === 'processing' && (
                    <Text style={styles.fileProcessing}>Processing...</Text>
                  )}
                </View>

                {showRelationshipField && file.status === 'done' && (
                  <View style={styles.relationshipPicker}>
                    <TouchableOpacity
                      style={[
                        styles.relationshipBtn,
                        file.relationship === 'subject' && styles.relationshipActive,
                      ]}
                      onPress={() => updateRelationship(file.id, 'subject')}
                    >
                      <Text
                        style={[
                          styles.relationshipText,
                          file.relationship === 'subject' && styles.relationshipTextActive,
                        ]}
                      >
                        Subject
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.relationshipBtn,
                        file.relationship === 'family' && styles.relationshipActive,
                      ]}
                      onPress={() => updateRelationship(file.id, 'family')}
                    >
                      <Text
                        style={[
                          styles.relationshipText,
                          file.relationship === 'family' && styles.relationshipTextActive,
                        ]}
                      >
                        Family
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => removeFile(file.id)}
                >
                  <Ionicons name="close" size={20} color={DARK.textMuted} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Submit button */}
      {readyFiles.length > 0 && (
        <TouchableOpacity
          style={[styles.submitBtn, hasProcessing && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={hasProcessing}
        >
          {hasProcessing ? (
            <ActivityIndicator size="small" color={DARK.text} />
          ) : (
            <Ionicons name="analytics" size={20} color={DARK.text} />
          )}
          <Text style={styles.submitText}>
            {hasProcessing
              ? 'Processing...'
              : `Analyze ${readyFiles.length} file${readyFiles.length > 1 ? 's' : ''}`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const dropZoneStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 32,
  borderRadius: 12,
  border: '2px dashed #30363d',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  dropZone: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: DARK.border,
    backgroundColor: DARK.surface,
  },
  dropText: {
    fontSize: 16,
    fontWeight: '600',
    color: DARK.text,
    marginTop: 12,
  },
  dropSubtext: {
    fontSize: 13,
    color: DARK.textSecondary,
    marginTop: 4,
  },
  fileList: {
    backgroundColor: DARK.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: DARK.border,
    maxHeight: 300,
  },
  listTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: DARK.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  scrollArea: {
    maxHeight: 250,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: DARK.border,
    gap: 10,
  },
  fileIcon: {
    width: 32,
    alignItems: 'center',
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    color: DARK.text,
  },
  fileStats: {
    fontSize: 12,
    color: DARK.success,
    marginTop: 2,
  },
  fileError: {
    fontSize: 12,
    color: DARK.danger,
    marginTop: 2,
  },
  fileProcessing: {
    fontSize: 12,
    color: DARK.primary,
    marginTop: 2,
  },
  relationshipPicker: {
    flexDirection: 'row',
    gap: 4,
  },
  relationshipBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: DARK.bg,
    borderWidth: 1,
    borderColor: DARK.border,
  },
  relationshipActive: {
    backgroundColor: DARK.primary,
    borderColor: DARK.primary,
  },
  relationshipText: {
    fontSize: 11,
    color: DARK.textSecondary,
  },
  relationshipTextActive: {
    color: '#fff',
  },
  removeBtn: {
    padding: 4,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: DARK.primary,
    paddingVertical: 16,
    borderRadius: 12,
  },
  submitBtnDisabled: {
    backgroundColor: DARK.surfaceHover,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '600',
    color: DARK.text,
  },
});
