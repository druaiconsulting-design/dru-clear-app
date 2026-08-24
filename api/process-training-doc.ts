// ================================================================
// DRU AI Leadership Ecosystem™ — Training Material Extraction
// File: api/process-training-doc.ts
// Runtime: Vercel Node.js Serverless
//
// Fires automatically the moment DeAnna uploads a PDF or Word doc to the
// `training-materials` Supabase storage bucket (see the
// on_training_material_upload trigger in the database). Pulls the file
// down, extracts the plain text, and saves it to the training_materials
// table -- that's what Tariq and Sasha's prompts read from on every run.
//
// PowerPoint is out of scope here: DeAnna converts decks to PDF herself
// before uploading, so only PDF and Word (.docx) need handling.
// ================================================================

import mammoth from 'mammoth';
// pdf-parse's default export reads the file straight from a Buffer.
import pdfParse from 'pdf-parse';

export const config = { maxDuration: 60 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const incomingSecret = req.headers['x-cron-secret'];
  if (incomingSecret !== undefined && incomingSecret !== process.env.CRON_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { storage_path } = req.body;
  if (!storage_path) { res.status(400).json({ error: 'storage_path is required' }); return; }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) { res.status(500).json({ error: 'Supabase env vars not set' }); return; }

  const originalFilename = storage_path.split('/').pop() ?? storage_path;
  const extension = (originalFilename.split('.').pop() ?? '').toLowerCase();

  async function upsertResult(fields: Record<string, unknown>): Promise<void> {
    await fetch(`${supabaseUrl}/rest/v1/training_materials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey as string,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({ storage_path, original_filename: originalFilename, file_type: extension, ...fields }),
    });
  }

  if (extension !== 'pdf' && extension !== 'docx') {
    console.warn(`[process-training-doc] Unsupported file type: ${extension} (${storage_path})`);
    await upsertResult({ status: 'failed', error: `Unsupported file type: .${extension}. Only PDF and .docx are handled -- convert slide decks to PDF before uploading.` });
    res.status(200).json({ ok: true, skipped: true, reason: 'unsupported_file_type' });
    return;
  }

  try {
    // Download the raw file bytes from Supabase Storage.
    const fileRes = await fetch(
      `${supabaseUrl}/storage/v1/object/training-materials/${storage_path}`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    if (!fileRes.ok) throw new Error(`Storage download failed: ${fileRes.status}`);
    const buffer = Buffer.from(await fileRes.arrayBuffer());

    let extractedText = '';
    if (extension === 'pdf') {
      const parsed = await pdfParse(buffer);
      extractedText = parsed.text;
    } else {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    }

    extractedText = extractedText.trim();
    if (!extractedText) throw new Error('No text extracted -- file may be scanned/image-based or empty.');

    await upsertResult({ status: 'processed', extracted_text: extractedText, error: null, processed_at: new Date().toISOString() });
    console.log(`[process-training-doc] ✅ Extracted ${extractedText.length} chars from ${originalFilename}`);
    res.status(200).json({ ok: true, chars_extracted: extractedText.length });

  } catch (error) {
    console.error(`[process-training-doc] Failed for ${storage_path}:`, error);
    await upsertResult({ status: 'failed', error: String(error), processed_at: new Date().toISOString() });
    res.status(200).json({ ok: false, error: String(error) });
  }
}
