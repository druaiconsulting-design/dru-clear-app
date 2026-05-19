// api/extract-docx.ts
// Extracts plain text from a .docx file using only Node.js built-ins
// No external dependencies — uses zlib.inflateRawSync + Buffer ZIP parsing

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { inflateRawSync } from "zlib";

export const config = { maxDuration: 15 };

function extractFileFromZip(buffer: Buffer, targetFile: string): Buffer | null {
  const PK_LOCAL = 0x04034b50;
  let offset = 0;
  while (offset < buffer.length - 30) {
    if (buffer.readUInt32LE(offset) !== PK_LOCAL) { offset++; continue; }
    const compressionMethod = buffer.readUInt16LE(offset + 8);
    const compressedSize    = buffer.readUInt32LE(offset + 18);
    const fileNameLength    = buffer.readUInt16LE(offset + 26);
    const extraFieldLength  = buffer.readUInt16LE(offset + 28);
    const fileName          = buffer.slice(offset + 30, offset + 30 + fileNameLength).toString("utf8");
    const dataStart         = offset + 30 + fileNameLength + extraFieldLength;
    if (fileName === targetFile) {
      const compressed = buffer.slice(dataStart, dataStart + compressedSize);
      if (compressionMethod === 0) return compressed;
      if (compressionMethod === 8) return inflateRawSync(compressed);
      return null;
    }
    offset = dataStart + compressedSize;
  }
  return null;
}

function extractTextFromDocx(buffer: Buffer): string {
  const xmlBuffer = extractFileFromZip(buffer, "word/document.xml");
  if (!xmlBuffer) throw new Error("Not a valid .docx file — word/document.xml not found");
  return xmlBuffer.toString("utf8")
    .replace(/<w:p[ >][^>]*>/g, "\n")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<w:tab[^>]*\/>/g, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST")   { res.status(405).json({ error: "Method not allowed" }); return; }
  const { data, filename } = req.body ?? {};
  if (!data) { res.status(400).json({ error: "data (base64) is required" }); return; }
  try {
    const buffer = Buffer.from(data, "base64");
    const text   = extractTextFromDocx(buffer);
    if (!text || text.length < 10) { res.status(422).json({ error: "Could not extract readable text." }); return; }
    console.log(`[extract-docx] Extracted ${text.length} chars from ${filename ?? "unknown.docx"}`);
    res.status(200).json({ text, charCount: text.length });
  } catch (err: unknown) {
    console.error("[extract-docx] Error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

