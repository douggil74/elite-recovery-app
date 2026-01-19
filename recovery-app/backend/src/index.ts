import express from 'express';
import cors from 'cors';
import multer from 'multer';
import pdf from 'pdf-parse';
import Anthropic from '@anthropic-ai/sdk';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Extract text from PDF
app.post('/api/extract-text', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file provided' });
    }

    const pdfData = await pdf(req.file.buffer);

    res.json({
      success: true,
      text: pdfData.text,
      pages: pdfData.numpages,
      info: pdfData.info,
    });
  } catch (error) {
    console.error('PDF extraction error:', error);
    res.status(500).json({
      error: 'Failed to extract text from PDF',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Extract text from base64 PDF
app.post('/api/extract-text-base64', async (req, res) => {
  try {
    const { pdf: pdfBase64 } = req.body;

    if (!pdfBase64) {
      return res.status(400).json({ error: 'No PDF data provided' });
    }

    const buffer = Buffer.from(pdfBase64, 'base64');
    const pdfData = await pdf(buffer);

    res.json({
      success: true,
      text: pdfData.text,
      pages: pdfData.numpages,
    });
  } catch (error) {
    console.error('PDF extraction error:', error);
    res.status(500).json({
      error: 'Failed to extract text from PDF',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Analyze text with Claude AI
app.post('/api/analyze', async (req, res) => {
  try {
    const { text, apiKey } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'No text provided for analysis' });
    }

    if (!apiKey) {
      return res.status(400).json({ error: 'API key required for AI analysis' });
    }

    const client = new Anthropic({ apiKey });

    const ANALYSIS_SCHEMA = `{
      "subject": {
        "fullName": "string",
        "aliases": ["string"],
        "dob": "string (MM/DD/YYYY)",
        "partialSsn": "string (last 4 only)",
        "personId": "string",
        "deceasedIndicator": boolean
      },
      "addresses": [{
        "address": "string",
        "city": "string",
        "state": "string",
        "zip": "string",
        "fullAddress": "string",
        "fromDate": "string",
        "toDate": "string or 'Current'",
        "confidence": number 0-1,
        "reasons": ["string"],
        "isCurrent": boolean
      }],
      "phones": [{
        "number": "string (XXX) XXX-XXXX format",
        "type": "mobile|landline|voip|unknown",
        "carrier": "string",
        "firstSeen": "string",
        "lastSeen": "string",
        "confidence": number 0-1,
        "isActive": boolean
      }],
      "relatives": [{
        "name": "string",
        "relationship": "string",
        "age": number,
        "currentAddress": "string",
        "phones": ["string"],
        "confidence": number 0-1
      }],
      "vehicles": [{
        "year": "string",
        "make": "string",
        "model": "string",
        "color": "string",
        "vin": "string",
        "plate": "string",
        "state": "string"
      }],
      "employment": [{
        "employer": "string",
        "title": "string",
        "address": "string",
        "phone": "string",
        "fromDate": "string",
        "toDate": "string",
        "isCurrent": boolean
      }],
      "flags": [{
        "type": "deceased|high_risk|fraud_alert|address_mismatch|info",
        "message": "string",
        "severity": "low|medium|high"
      }],
      "recommendations": ["string"]
    }`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: `You are a data extraction specialist. Extract structured information from person/skip trace reports.

IMPORTANT RULES:
1. Extract ONLY information explicitly stated in the text
2. Do NOT invent or assume data not present
3. Mask SSN to show only last 4 digits (format: ***-**-XXXX)
4. Rank addresses by recency - most recent first
5. Flag any deceased indicators or risk warnings
6. Set confidence scores based on data quality and recency
7. Format phone numbers as (XXX) XXX-XXXX

Output ONLY valid JSON matching this schema:
${ANALYSIS_SCHEMA}`,
      messages: [
        {
          role: 'user',
          content: `Extract and structure the following person report data. Return ONLY valid JSON, no explanation.\n\nREPORT TEXT:\n${text}`,
        },
      ],
    });

    // Extract text content from response
    const responseText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    parsed.parseMethod = 'ai';
    parsed.parseConfidence = 0.85;

    res.json({
      success: true,
      data: parsed,
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({
      error: 'Failed to analyze report',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Bail Recovery Backend running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
