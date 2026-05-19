// api/extract-docx.ts
// Serverless function — extracts plain text from a .docx file (base64 encoded)
// Called by Twin.tsx when a Word document is attached

import type { VercelRequest, VercelResponse } from "@vercel/node";
export const config = { maxDuration: 15 };

async function extractTextFromDocx(base64Data: string): Promise<string> {
  const buffer = Buffer.from(base64Data, "base64");

  let AdmZip: any;
  try {
    AdmZip = require("adm-zip");
  } catch {
    throw new Error("adm-zip not installed. Run: npm install adm-zip");
  }

  const zip = new AdmZip(buffer);
  const docXmlEntry = zip.getEntry("word/document.xml");
  if (!docXmlEntry) throw new Error("Not a valid .docx file — word/document.xml not found");

  const xmlContent = docXmlEntry.getData().toString("utf8");

  const text = xmlContent
    .replace(/<w:p[ >][^>]*>/g, "\n")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<w:tab[^>]*\/>/g, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x[0-9A-Fa-f]+;/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const { data, filename } = req.body ?? {};
  if (!data) { res.status(400).json({ error: "data (base64) is required" }); return; }

  try {
    const text = await extractTextFromDocx(data);
    if (!text || text.length < 10) {
      res.status(422).json({ error: "Could not extract readable text from this document." });
      return;
    }
    console.log(`[extract-docx] Extracted ${text.length} chars from ${filename ?? "unknown.docx"}`);
    res.status(200).json({ text, charCount: text.length });
  } catch (err: unknown) {
    console.error("[extract-docx] Error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
