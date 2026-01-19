/**
 * PDF Text Extraction using pdf.js
 * Extracts text content from PDF files for analysis
 */

import { Platform } from 'react-native';

// Type definitions for pdf.js
interface PDFDocumentProxy {
  numPages: number;
  getPage(pageNum: number): Promise<PDFPageProxy>;
}

interface PDFPageProxy {
  getTextContent(): Promise<TextContent>;
}

interface TextContent {
  items: TextItem[];
}

interface TextItem {
  str: string;
  transform?: number[];
}

// pdf.js is loaded via CDN script tag on web to avoid bundler issues
let pdfjsLib: any = null;
let loadPromise: Promise<any> | null = null;

async function loadPdfJs() {
  if (Platform.OS !== 'web') {
    return null;
  }

  if (pdfjsLib) {
    return pdfjsLib;
  }

  // Check if already loaded via script tag
  if (typeof window !== 'undefined' && (window as any).pdfjsLib) {
    pdfjsLib = (window as any).pdfjsLib;
    return pdfjsLib;
  }

  // Prevent multiple simultaneous loads
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    try {
      // Load pdf.js from CDN - use legacy build for better window.pdfjsLib support
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        // Use legacy build which properly exposes window.pdfjsLib
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = () => {
          // Small delay to ensure script fully initializes
          setTimeout(() => {
            pdfjsLib = (window as any).pdfjsLib;
            if (pdfjsLib) {
              pdfjsLib.GlobalWorkerOptions.workerSrc =
                'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
              resolve();
            } else {
              reject(new Error('pdf.js loaded but pdfjsLib not available on window'));
            }
          }, 100);
        };
        script.onerror = () => reject(new Error('Failed to load pdf.js script'));
        document.head.appendChild(script);
      });

      return pdfjsLib;
    } catch (error) {
      console.error('Failed to load pdf.js:', error);
      loadPromise = null; // Allow retry on failure
      return null;
    }
  })();

  return loadPromise;
}

export interface ExtractResult {
  success: boolean;
  text?: string;
  pageCount?: number;
  error?: string;
}

/**
 * Extract text from a PDF file (web only)
 * @param data - ArrayBuffer or Uint8Array of PDF data
 */
export async function extractTextFromPdf(data: ArrayBuffer | Uint8Array): Promise<ExtractResult> {
  if (Platform.OS !== 'web') {
    return {
      success: false,
      error: 'PDF extraction not supported on mobile yet. Please paste the text directly.',
    };
  }

  try {
    const pdfjs = await loadPdfJs();
    if (!pdfjs) {
      return {
        success: false,
        error: 'PDF library failed to load',
      };
    }

    const loadingTask = pdfjs.getDocument({ data });
    const pdf: PDFDocumentProxy = await loadingTask.promise;

    const textParts: string[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();

      // Extract text with proper spacing
      const pageText = content.items
        .map((item: TextItem) => item.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (pageText) {
        textParts.push(pageText);
      }
    }

    const fullText = textParts.join('\n\n');

    if (fullText.length < 50) {
      return {
        success: false,
        error: 'PDF appears to be empty or contains only images. Try pasting the text directly.',
        pageCount: pdf.numPages,
      };
    }

    return {
      success: true,
      text: fullText,
      pageCount: pdf.numPages,
    };
  } catch (error) {
    console.error('PDF extraction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extract text from PDF',
    };
  }
}

/**
 * Extract text from a File object (web only)
 */
export async function extractTextFromPdfFile(file: File): Promise<ExtractResult> {
  if (Platform.OS !== 'web') {
    return {
      success: false,
      error: 'PDF extraction not supported on mobile yet.',
    };
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    return extractTextFromPdf(arrayBuffer);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to read PDF file',
    };
  }
}

/**
 * Read a text file
 */
export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') {
        resolve(text);
      } else {
        reject(new Error('Failed to read file as text'));
      }
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsText(file);
  });
}

/**
 * Process any uploaded file (PDF, text, or image)
 */
export async function processUploadedFile(file: File): Promise<ExtractResult> {
  const fileName = file.name.toLowerCase();
  const fileType = file.type.toLowerCase();

  // PDF files
  if (fileName.endsWith('.pdf') || fileType === 'application/pdf') {
    return extractTextFromPdfFile(file);
  }

  // Text files
  if (
    fileName.endsWith('.txt') ||
    fileName.endsWith('.text') ||
    fileType.startsWith('text/')
  ) {
    try {
      const text = await readTextFile(file);
      return {
        success: true,
        text,
        pageCount: 1,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read text file',
      };
    }
  }

  // Image files - show helpful message
  if (
    fileType.startsWith('image/') ||
    fileName.endsWith('.png') ||
    fileName.endsWith('.jpg') ||
    fileName.endsWith('.jpeg') ||
    fileName.endsWith('.gif') ||
    fileName.endsWith('.webp')
  ) {
    return {
      success: false,
      error: 'Image files require OCR. Copy the text from the image and paste it, or use a PDF version.',
    };
  }

  // Try to read as text anyway
  try {
    const text = await readTextFile(file);
    if (text && text.length > 50) {
      return {
        success: true,
        text,
        pageCount: 1,
      };
    }
  } catch {
    // Not readable as text
  }

  return {
    success: false,
    error: `Cannot read ${file.type || 'this file type'}. Use PDF, TXT, or paste text directly.`,
  };
}
