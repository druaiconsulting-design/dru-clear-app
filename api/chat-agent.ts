// DRU AI Leadership Ecosystem — api/chat-agent.ts
// Website live chat agent — Priscilla Okonkwo (English) · Yara Mansour (Spanish, French, Arabic)
// Called from the chat widget embedded on druaiconsulting.com (index.html in druaiconsulting-website).
// Actions:
//   check_email  — the assessment's four email checks, so the chat box can show the green check
//   register     — creates the GHL contact for a new visitor
//   message      — the agent's answer; when the visitor needs the support team, the answer carries offer_ticket
//   open_ticket  — saves the visitor's help desk ticket (subject "Support Website Chat") straight into support_requests,
//                  the same table the Support Hub form and support emails use. Isaiah (English) or Yara (other languages)
//                  then sends the instant reply and drafts the full reply for DeAnna's Support Tickets page.

import { waitUntil } from '@vercel/functions';
import { createHash } from 'node:crypto';
import { sb, handleTicket } from './_lib/supportIsaiah.js';
import { checkEmail } from './_lib/emailCheck.js';
import { isSupportLanguage } from './_lib/yaraEmailReply.js';

export const config = { maxDuration: 300 };

const SUPPORT_ADDRESS = 'support@support.druaiconsulting.com';
const CHAT_TICKET_SUBJECT = 'Support Website Chat';
const MAX_CHAT_TICKETS_PER_EMAIL_PER_HOUR = 3;
const MAX_TICKET_TEXT_CHARS = 5000;

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_LOCATION_ID = 'gl07I4JnbkGgW8zJprSz';

// Logs every real API call's actual token usage and cost to Supabase so spend
// is visible in the Intelligence Hub instead of estimated by hand.
async function logModelUsage(model: string, inputTokens: number, outputTokens: number): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const rate = model.startsWith('claude-sonnet-5') ? { in: 2, out: 10 } : model.startsWith('claude-sonnet') ? { in: 3, out: 15 } : { in: 1, out: 5 };
  const cost_usd = (inputTokens / 1_000_000) * rate.in + (outputTokens / 1_000_000) * rate.out;
  await fetch(`${url}/rest/v1/model_usage_log`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` }, body: JSON.stringify({ source_file: 'chat-agent', model, input_tokens: inputTokens, output_tokens: outputTokens, cost_usd }) });
}

const PERSONAS: Record<string, string> = {
  en: `You are Priscilla Okonkwo, the DRU AI Consulting website chat assistant. You represent DeAnna R. Upshaw, AI Authority and CEO/Founder of DRU AI Consulting.

BRAND: "AI Mastery. Leadership Clarity. Measurable Results."

YOUR NAME: Priscilla
When introducing yourself always say your name — 'I'm Priscilla, the DRU AI Consulting chat assistant.'

YOUR ROLE:
- Answer questions about DRU AI Consulting, DeAnna's services, and frameworks warmly and professionally
- Respond warmly, professionally and consistently with the brand
- Always direct to assessment.druaiconsulting.com as the primary entry point
- Keep responses concise — 2-4 sentences maximum

SERVICES:
- DRU CLEAR™ AI Readiness Assessment — Free at assessment.druaiconsulting.com (START HERE)
- Strategic Diagnostic — $3,497
- Executive Diagnostic — $4,997 (BEST VALUE)
- 90-Day AI Transformation Journey — $20K–$25K+
- From Confusion to Confidence with AI Course — from $1,497
- Daily Connections — Free / Navigator $97/month or $970/year (2 months free) / Accelerator $197/month or $1,970/year (2 months free)

FRAMEWORKS (™ on DRU CLEAR only):
DRU CLEAR™ · DRU AI Leadership Ecosystem · DRU AI Transformation Pathway · 5C Cultural DNA · 5D Leadership · AI Sales Mastery · From Confusion to Confidence with AI

DEANNA'S BACKGROUND:
25+ years in IT, 10+ years leadership development. International facilitator. AI Authority. Maxwell Leadership certified.

RULES:
- 2-4 sentences max per response
- Always end with assessment.druaiconsulting.com CTA when relevant
- Never discuss competitors
- For anything you can't answer: "Great question — our team will follow up with you directly."
- DRU AI Consulting is the business name, no ™ needed`,

  es: `Eres la asistente de chat del sitio web de DRU AI Consulting — representas a Yara Mansour, Especialista en Traducción y Localización, hablando en nombre de DeAnna R. Upshaw, Autoridad en IA y CEO/Fundadora.

MARCA: "Dominio de IA. Claridad de Liderazgo. Resultados Medibles."

TU NOMBRE: Yara
Cuando te presentes, di siempre tu nombre — 'Soy Yara, la asistente de chat de DRU AI Consulting.'

TU ROL:
- Responde preguntas sobre DRU AI Consulting, los servicios y marcos de DeAnna de manera cálida y profesional
- Responde siempre en español
- Dirige siempre a assessment.druaiconsulting.com como punto de entrada principal
- Respuestas concisas — máximo 2-4 oraciones

SERVICIOS:
- DRU CLEAR™ AI Readiness Assessment — Gratis en assessment.druaiconsulting.com (EMPIEZA AQUÍ)
- Diagnóstico Estratégico — $3,497
- Diagnóstico Ejecutivo — $4,997 (MEJOR VALOR)
- Viaje de Transformación IA de 90 Días — $20K–$25K+

MARCOS (™ solo en DRU CLEAR):
DRU CLEAR™ · DRU AI Leadership Ecosystem · DRU AI Transformation Pathway · 5C Cultural DNA · 5D Leadership · AI Sales Mastery · From Confusion to Confidence with AI

REGLAS:
- Máximo 2-4 oraciones por respuesta
- Siempre termina con el enlace assessment.druaiconsulting.com
- Para lo que no puedas responder: "Excelente pregunta — nuestro equipo te contactará directamente."`,

  fr: `Vous êtes l'assistante de chat du site web de DRU AI Consulting — vous représentez Yara Mansour, Spécialiste en Traduction et Localisation, au nom de DeAnna R. Upshaw, Autorité en IA et PDG/Fondatrice.

MARQUE: "Maîtrise de l'IA. Clarté du Leadership. Résultats Mesurables."

VOTRE NOM: Yara
Lorsque vous vous présentez, dites toujours votre nom — 'Je suis Yara, l\'assistante chat de DRU AI Consulting.'

VOTRE RÔLE:
- Répondez aux questions sur DRU AI Consulting, les services et cadres de DeAnna chaleureusement et professionnellement
- Répondez toujours en français
- Dirigez toujours vers assessment.druaiconsulting.com comme point d'entrée principal
- Réponses concises — 2-4 phrases maximum

SERVICES:
- DRU CLEAR™ AI Readiness Assessment — Gratuit sur assessment.druaiconsulting.com (COMMENCEZ ICI)
- Diagnostic Stratégique — $3,497
- Diagnostic Exécutif — $4,997 (MEILLEURE VALEUR)

CADRES (™ seulement sur DRU CLEAR):
DRU CLEAR™ · DRU AI Leadership Ecosystem · DRU AI Transformation Pathway · 5C Cultural DNA · 5D Leadership · AI Sales Mastery · From Confusion to Confidence with AI

RÈGLES:
- Maximum 2-4 phrases par réponse
- Terminez toujours avec le lien assessment.druaiconsulting.com
- Pour ce que vous ne pouvez pas répondre: "Excellente question — notre équipe vous contactera directement."`,

  ar: `أنتِ مساعدة الدردشة لموقع DRU AI Consulting — تمثلين يارا منصور، متخصصة الترجمة والتوطين، نيابةً عن ديانا أوبشو، سلطة الذكاء الاصطناعي والمديرة التنفيذية/المؤسسة.

العلامة التجارية: "إتقان الذكاء الاصطناعي. وضوح القيادة. نتائج قابلة للقياس."

اسمك: يارا
عند تقديم نفسك، قولي دائماً اسمك — 'أنا يارا، مساعدة الدردشة لـ DRU AI Consulting.'

دورك:
- أجيبي على الأسئلة المتعلقة بـ DRU AI Consulting وخدمات وأطر ديانا بدفء واحترافية
- أجيبي دائماً باللغة العربية
- وجّهي دائماً إلى assessment.druaiconsulting.com كنقطة دخول رئيسية
- ردود موجزة — 2-4 جمل كحد أقصى

الخدمات:
- DRU CLEAR™ AI Readiness Assessment — مجاني على assessment.druaiconsulting.com (ابدأي هنا)
- التشخيص الاستراتيجي — $3,497
- التشخيص التنفيذي — $4,997 (أفضل قيمة)

الأطر (™ على DRU CLEAR فقط):
DRU CLEAR™ · DRU AI Leadership Ecosystem · DRU AI Transformation Pathway · 5C Cultural DNA · 5D Leadership · AI Sales Mastery · From Confusion to Confidence with AI

القواعد:
- 2-4 جمل كحد أقصى لكل رد
- انتهي دائماً برابط assessment.druaiconsulting.com
- لما لا يمكنك الإجابة عنه: "سؤال ممتاز — سيتواصل معك فريقنا مباشرة."`,
};

// The help desk ticket offer. The agent adds the marker [[TICKET]] when the visitor needs the support team.
// The chat widget shows the visitor their own words and asks yes or no. The marker never reaches the visitor.
// A visitor who has reached the hourly ticket limit gets no ticket offer, and no line about the limit.
const TICKET_MARKER = '[[TICKET]]';
const TICKET_RULE = `

Help desk tickets:
- You can open a help desk ticket for the visitor, and the support team follows up by email.
- When the visitor asks about something the support team handles, such as access to an account or a course, billing, a technical problem, or anything you cannot answer in the chat, tell the visitor in your language that you can open a help desk ticket on their behalf, and end your reply with the marker ${TICKET_MARKER} on its own line.
- When the visitor asks you to open a ticket or asks to reach the support team, include the marker.
- Write the marker exactly as shown.`;

async function recentChatTicketCount(email: string): Promise<number> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  try {
    const res = await sb(`support_requests?member_email=eq.${encodeURIComponent(email.toLowerCase())}&created_at=gte.${since}&select=id`);
    if (!res.ok) return 0;
    const rows = await res.json();
    return Array.isArray(rows) ? rows.length : 0;
  } catch { return 0; }
}

async function createGHLContact(name: string, email: string, phone: string): Promise<string | null> {
  const ghlApiKey = process.env.GHL_API_KEY;
  if (!ghlApiKey) return null;
  try {
    const res = await fetch(`${GHL_API_BASE}/contacts/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ghlApiKey}`,
        'Version': '2021-07-28',
      },
      body: JSON.stringify({
        locationId: GHL_LOCATION_ID,
        firstName: name ? name.split(' ')[0] : undefined,
        lastName: name && name.includes(' ') ? name.split(' ').slice(1).join(' ') : undefined,
        email,
        phone,
        source: 'Website Chat Widget',
        tags: ['website-chat', 'ai-chat-lead'],
      }),
    });
    if (!res.ok) {
      console.error(`[chat-agent] GHL contact creation failed: ${res.status}`);
      return null;
    }
    const data = await res.json();
    return data?.contact?.id ?? null;
  } catch (err) {
    console.error('[chat-agent] GHL contact error:', err);
    return null;
  }
}

// Saves each visitor question and the answer given, so Camila Flores can read what visitors
// really ask. Name, email and phone stay out of this table on purpose (they go to the contact
// system). A failed save never blocks the chat reply.
async function saveChatQuestion(question: string, answer: string, language: string): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    const res = await fetch(`${url}/rest/v1/website_chat_questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}`, Prefer: 'return=minimal' },
      body: JSON.stringify({ question: String(question).slice(0, 2000), answer: String(answer).slice(0, 2000), language }),
    });
    if (!res.ok) console.error(`[chat-agent] Saving the question failed: ${res.status} ${await res.text()}`);
  } catch (err) {
    console.error('[chat-agent] Saving the question failed:', err);
  }
}

async function getAIResponse(message: string, language: string, name: string, history: {role: string; content: string}[], mayOfferTicket: boolean): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const systemPrompt = (PERSONAS[language] ?? PERSONAS['en']) + (mayOfferTicket ? TICKET_RULE : '');
  const nameContext = name ? `The visitor's name is ${name}. Address them by first name when natural.\n\n` : '';
  const messages = [
    ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
    { role: 'user' as const, content: `${nameContext}${message}` },
  ];

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: systemPrompt,
      messages,
    }),
  });

  if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
  const data = await res.json();
  await logModelUsage('claude-haiku-4-5-20251001', data.usage?.input_tokens ?? 0, data.usage?.output_tokens ?? 0).catch(() => {});
  return data.content?.[0]?.text ?? "Thank you for your message! Please visit assessment.druaiconsulting.com to get started.";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-chat-key');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const chatKey = req.headers['x-chat-key'];
  if (process.env.CHAT_API_KEY && chatKey !== process.env.CHAT_API_KEY) {
    res.status(401).json({ error: 'Unauthorized' }); return;
  }

  const { action, name = '', email, phone, message, language = 'en', history = [], contact_id: contactIdIn, text } = req.body;

  if (!action) { res.status(400).json({ error: 'action is required' }); return; }

  // The assessment's four email checks, for the green check in the chat's email box.
  if (action === 'check_email') {
    const result = await checkEmail(String(email ?? ''));
    res.status(200).json({ success: true, ...result });
    return;
  }

  // Register new chat visitor — create GHL contact
  if (action === 'register') {
    if (!email || !phone) { res.status(400).json({ error: 'email and phone required' }); return; }
    const check = await checkEmail(String(email));
    if (!check.valid) { res.status(400).json({ success: false, error: 'email_check_failed', ...check }); return; }
    const contactId = await createGHLContact(name, check.email, phone);
    console.log(`[chat-agent] New contact registered — ${check.email} | GHL ID: ${contactId ?? 'failed'}`);
    res.status(200).json({ success: true, contact_id: contactId });
    return;
  }

  // Handle chat message — get AI response
  if (action === 'message') {
    if (!message) { res.status(400).json({ error: 'message is required' }); return; }
    try {
      // The ticket offer is left out once the visitor's email has reached the hourly ticket limit.
      const limited = email ? (await recentChatTicketCount(String(email))) >= MAX_CHAT_TICKETS_PER_EMAIL_PER_HOUR : false;
      const raw = await getAIResponse(message, language, name, history, !limited);
      const offerTicket = !limited && raw.includes(TICKET_MARKER);
      const response = raw.split(TICKET_MARKER).join('').trim();
      console.log(`[chat-agent] Response generated | lang: ${language} | message: ${message.slice(0, 50)}`);
      await saveChatQuestion(message, response, language);
      res.status(200).json({ success: true, response, offer_ticket: offerTicket });
    } catch (err) {
      console.error('[chat-agent] AI error:', err);
      res.status(500).json({
        success: false,
        response: 'Thank you for your message! Please visit assessment.druaiconsulting.com to get started, or email us at support@support.druaiconsulting.com.',
      });
    }
    return;
  }

  // Open the visitor's help desk ticket. The text is the visitor's own words, saved exactly as sent.
  // Priscilla (English) and Yara (Spanish, French, Arabic) open it after the visitor says yes, or after the
  // visitor writes their own words.
  if (action === 'open_ticket') {
    const ticketText = String(text ?? '').trim();
    if (!ticketText) { res.status(400).json({ success: false, error: 'text is required' }); return; }
    if (ticketText.length > MAX_TICKET_TEXT_CHARS) { res.status(400).json({ success: false, error: 'text_too_long' }); return; }
    if (!isSupportLanguage(language)) { res.status(400).json({ success: false, error: 'language_not_supported' }); return; }
    const check = await checkEmail(String(email ?? ''));
    if (!check.valid) { res.status(400).json({ success: false, error: 'email_check_failed', ...check }); return; }
    const visitorEmail = check.email;
    const visitorName = String(name ?? '').trim().slice(0, 120) || null;

    if ((await recentChatTicketCount(visitorEmail)) >= MAX_CHAT_TICKETS_PER_EMAIL_PER_HOUR) {
      res.status(429).json({ success: false, error: 'not_opened' });
      return;
    }

    // The same text from the same email inside ten minutes is the same ticket (a double click opens one).
    const bucket = Math.floor(Date.now() / (10 * 60 * 1000));
    const dedupeKey = `chat:${createHash('sha256').update(`${visitorEmail}\n${ticketText}\n${bucket}`).digest('hex').slice(0, 32)}`;
    const ghlContactId = typeof contactIdIn === 'string' ? contactIdIn.slice(0, 80) : '';

    const insert = await sb('support_requests', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        category: 'chat',
        question: `Subject: ${CHAT_TICKET_SUBJECT}\n\n${ticketText}`,
        status: 'open',
        member_email: visitorEmail,
        member_name: visitorName ?? visitorEmail,
        source_address: SUPPORT_ADDRESS,
        ghl_contact_id: ghlContactId || null,
        dedupe_key: dedupeKey,
        language,
      }),
    });
    if (insert.status === 409) { res.status(200).json({ success: true, duplicate: true }); return; }
    if (!insert.ok) {
      console.error(`[chat-agent] Ticket save failed: ${insert.status} ${await insert.text()}`);
      res.status(500).json({ success: false, error: 'not_opened' });
      return;
    }
    const ticketId = (await insert.json())?.[0]?.id as string | undefined;
    if (!ticketId) { res.status(500).json({ success: false, error: 'not_opened' }); return; }

    res.status(200).json({ success: true, ticket_id: ticketId });

    // The instant reply and the full draft go out after the visitor has their answer.
    waitUntil(handleTicket({
      id: ticketId, ghlContactId, ghlMessageId: '',
      fromName: visitorName, fromEmail: visitorEmail, toAddress: SUPPORT_ADDRESS, subject: CHAT_TICKET_SUBJECT, body: ticketText,
      memberName: visitorName, memberTier: null, language,
    }));
    return;
  }

  res.status(400).json({ error: `Unknown action: ${action}` });
}
