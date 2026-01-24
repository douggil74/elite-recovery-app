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
  usedOcr?: boolean;
}

// OCR using OpenAI Vision API for scanned PDFs
async function ocrWithOpenAI(imageBase64: string, pageNum: number): Promise<string> {
  const apiKey = await getOpenAIKey();
  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Go to Settings to add it.');
  }

  // Clean the API key - remove any whitespace or non-ASCII characters
  const cleanKey = apiKey.trim().replace(/[^\x20-\x7E]/g, '');

  // Ensure image data is proper base64 data URL
  let imageUrl = imageBase64;
  if (!imageBase64.startsWith('data:')) {
    // Clean base64 string - remove any whitespace
    const cleanBase64 = imageBase64.replace(/\s/g, '');
    imageUrl = `data:image/png;base64,${cleanBase64}`;
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cleanKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract ALL text from this document image. Return ONLY the extracted text, preserving the layout as much as possible. Include all names, addresses, phone numbers, dates, and any other information visible.',
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
              },
            },
          ],
        },
      ],
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// Get OpenAI API key from settings
async function getOpenAIKey(): Promise<string | null> {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const settings = await AsyncStorage.getItem('app_settings');
    if (settings) {
      const parsed = JSON.parse(settings);
      return parsed.openaiApiKey || null;
    }
  } catch (e) {
    console.error('Failed to get OpenAI key:', e);
  }
  return null;
}

// Render PDF page to image for OCR
async function renderPageToImage(pdfjs: any, pdf: PDFDocumentProxy, pageNum: number): Promise<string> {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.height = viewport.height;
  canvas.width = viewport.width;

  await page.render({
    canvasContext: context,
    viewport: viewport,
  }).promise;

  return canvas.toDataURL('image/png');
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
      // PDF has no text - try OCR
      console.log('PDF has no text content, attempting OCR...');

      try {
        const ocrTexts: string[] = [];
        const maxPages = Math.min(pdf.numPages, 5); // Limit to 5 pages for speed

        // Process pages in parallel (2 at a time) for speed
        for (let i = 1; i <= maxPages; i += 2) {
          const promises = [];

          for (let j = i; j <= Math.min(i + 1, maxPages); j++) {
            console.log(`OCR processing page ${j}/${maxPages}...`);
            promises.push(
              (async () => {
                try {
                  const imageData = await renderPageToImage(pdfjs, pdf, j);
                  const pageText = await ocrWithOpenAI(imageData, j);
                  return { page: j, text: pageText };
                } catch (e) {
                  console.error(`OCR failed for page ${j}:`, e);
                  return { page: j, text: '' };
                }
              })()
            );
          }

          const results = await Promise.all(promises);
          results.forEach(r => {
            if (r.text.trim()) {
              ocrTexts.push(`--- Page ${r.page} ---\n${r.text}`);
            }
          });
        }

        const ocrFullText = ocrTexts.join('\n\n');
        console.log(`OCR complete: ${ocrFullText.length} characters extracted`);

        if (ocrFullText.length > 50) {
          return {
            success: true,
            text: ocrFullText,
            pageCount: pdf.numPages,
            usedOcr: true,
          };
        }
      } catch (ocrError) {
        console.error('OCR failed:', ocrError);
        return {
          success: false,
          error: `PDF is scanned/image-based. OCR failed: ${ocrError instanceof Error ? ocrError.message : 'Unknown error'}`,
          pageCount: pdf.numPages,
        };
      }

      return {
        success: false,
        error: 'PDF appears to be empty or OCR could not extract text.',
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
