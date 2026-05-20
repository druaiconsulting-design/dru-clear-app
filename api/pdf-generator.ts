// api/pdf-generator.ts
// Vercel Node.js serverless function
// Generates a branded DRU AI Consulting PDF from approval card output
// Called by AdminApprovals when DeAnna approves a Client Delivery card

import type { VercelRequest, VercelResponse } from "@vercel/node";

export const config = { maxDuration: 30 };

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const { output, agent_name, task_brief, division, category } = req.body ?? {};
  if (!output) { res.status(400).json({ error: "output is required" }); return; }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PDFDocument = require("pdfkit");

    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: "LETTER", margin: 50, bufferPages: true });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // ── Brand constants ──────────────────────────────────────
      const NAVY    = "#0A2342";
      const GOLD    = "#D4AF37";
      const MAGENTA = "#C2185B";
      const WHITE   = "#FFFFFF";
      const DARK    = "#1A1A1A";
      const MID     = "#444444";
      const LIGHT   = "#888888";

      const PAGE_W  = 612;
      const MARGIN  = 50;
      const CONTENT_W = PAGE_W - MARGIN * 2;

      // ── Header bar ────────────────────────────────────────────
      doc.rect(0, 0, PAGE_W, 80).fill(NAVY);

      doc.fillColor(GOLD)
         .fontSize(20)
         .font("Times-Bold")
         .text("DRU AI Consulting", MARGIN, 16, { lineBreak: false });

      doc.fillColor(WHITE)
         .fontSize(8)
         .font("Helvetica")
         .text("AI Mastery. Leadership Clarity. Measurable Results.", MARGIN, 42, { lineBreak: false });

      // Gold accent bar
      doc.rect(0, 80, PAGE_W, 3).fill(GOLD);

      // ── Metadata section ─────────────────────────────────────
      doc.fillColor(NAVY)
         .fontSize(15)
         .font("Times-Bold")
         .text(agent_name ?? "DRU AI Agent", MARGIN, 100);

      if (division) {
        doc.fillColor(MAGENTA)
           .fontSize(9)
           .font("Helvetica-Bold")
           .text(division.toUpperCase(), MARGIN, 121, { characterSpacing: 0.5 });
      }

      if (task_brief) {
        doc.fillColor(MID)
           .fontSize(9)
           .font("Helvetica")
           .text(task_brief, MARGIN, 136, { width: 380 });
      }

      // Date — right aligned
      const dateStr = new Date().toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      });
      doc.fillColor(LIGHT)
         .fontSize(8)
         .font("Helvetica")
         .text(dateStr, 380, 100, { width: 182, align: "right" });

      // Divider
      doc.moveTo(MARGIN, 165)
         .lineTo(PAGE_W - MARGIN, 165)
         .strokeColor(GOLD)
         .lineWidth(0.75)
         .stroke();

      // ── Content ───────────────────────────────────────────────
      let curY = 180;
      const FOOTER_RESERVE = 55;

      const addPageIfNeeded = (neededHeight: number) => {
        if (curY + neededHeight > doc.page.height - FOOTER_RESERVE) {
          doc.addPage();
          curY = 50;
        }
      };

      // Strip and parse content
      const paragraphs = output.split(/\n\n+/).map((p: string) => p.trim()).filter(Boolean);

      for (const para of paragraphs) {
        // Section heading (## Heading)
        if (/^#{1,3}\s/.test(para)) {
          const headingText = para.replace(/^#{1,3}\s*/, "").replace(/\*\*/g, "");
          doc.fontSize(12).font("Times-Bold");
          const h = doc.heightOfString(headingText, { width: CONTENT_W });
          addPageIfNeeded(h + 16);
          doc.fillColor(NAVY).text(headingText, MARGIN, curY, { width: CONTENT_W });
          curY += h + 4;
          doc.moveTo(MARGIN, curY)
             .lineTo(PAGE_W - MARGIN, curY)
             .strokeColor(GOLD)
             .lineWidth(0.3)
             .stroke();
          curY += 10;
          continue;
        }

        // Bold line (**text**)
        if (/^\*\*.*\*\*$/.test(para)) {
          const boldText = para.replace(/^\*\*|\*\*$/g, "");
          doc.fontSize(10).font("Helvetica-Bold");
          const h = doc.heightOfString(boldText, { width: CONTENT_W });
          addPageIfNeeded(h + 8);
          doc.fillColor(DARK).text(boldText, MARGIN, curY, { width: CONTENT_W });
          curY += h + 8;
          continue;
        }

        // Bullet list line
        if (/^[*\-•]\s/.test(para)) {
          const lines = para.split("\n").filter(Boolean);
          for (const line of lines) {
            const bulletText = "•  " + line.replace(/^[*\-•]\s*/, "").replace(/\*\*(.*?)\*\*/g, "$1");
            doc.fontSize(10).font("Helvetica");
            const h = doc.heightOfString(bulletText, { width: CONTENT_W - 12 });
            addPageIfNeeded(h + 6);
            doc.fillColor(DARK).text(bulletText, MARGIN + 8, curY, { width: CONTENT_W - 12 });
            curY += h + 6;
          }
          curY += 4;
          continue;
        }

        // Regular paragraph — strip markdown
        const clean = para
          .replace(/\*\*(.*?)\*\*/g, "$1")
          .replace(/\*(.*?)\*/g, "$1")
          .replace(/\n/g, " ")
          .trim();

        doc.fontSize(10).font("Helvetica");
        const h = doc.heightOfString(clean, { width: CONTENT_W, lineGap: 2 });
        addPageIfNeeded(h + 12);
        doc.fillColor(DARK).text(clean, MARGIN, curY, { width: CONTENT_W, lineGap: 2 });
        curY += h + 12;
      }

      // ── Footer on every page ─────────────────────────────────
      const pageRange = doc.bufferedPageRange();
      const totalPages = pageRange.count;

      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(pageRange.start + i);
        const pH = doc.page.height;

        doc.rect(0, pH - 48, PAGE_W, 48).fill(NAVY);

        doc.fillColor(GOLD)
           .fontSize(8)
           .font("Helvetica-Bold")
           .text("assessment.druaiconsulting.com", MARGIN, pH - 34, {
             align: "center", width: CONTENT_W, characterSpacing: 0.3,
           });

        doc.fillColor(WHITE)
           .fontSize(6.5)
           .font("Helvetica")
           .text(
             `© 2026 DRU AI Consulting · DRU CLEAR™ · All Rights Reserved · Page ${i + 1} of ${totalPages}`,
             MARGIN, pH - 20, { align: "center", width: CONTENT_W }
           );
      }

      doc.end();
    });

    const safeCat = (category ?? "briefing").replace(/_/g, "-");
    const filename = `dru-ai-${safeCat}-${Date.now()}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(pdfBuffer);

  } catch (err: unknown) {
    console.error("[pdf-generator] Error:", err);
    res.status(500).json({ error: String(err) });
  }
}
