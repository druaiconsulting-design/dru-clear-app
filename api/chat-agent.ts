// DRU AI Leadership Ecosystem™ — api/chat-agent.ts
// Website live chat agent — Priscilla + Isaiah (English) · Yara (ES/FR/AR)
// Called from chat-widget.js embedded on druaiconsulting.com

export const config = { maxDuration: 30 };

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_LOCATION_ID = 'gl07I4JnbkGgW8zJprSz';

// Logs every real API call's actual token usage and cost to Supabase so spend
// is visible in the Intelligence Hub instead of estimated by hand.
async function logModelUsage(model: string, inputTokens: number, outputTokens: number): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const rate = model.startsWith('claude-sonnet') ? { in: 3, out: 15 } : { in: 1, out: 5 };
  const cost_usd = (inputTokens / 1_000_000) * rate.in + (outputTokens / 1_000_000) * rate.out;
  await fetch(`${url}/rest/v1/model_usage_log`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` }, body: JSON.stringify({ source_file: 'chat-agent', model, input_tokens: inputTokens, output_tokens: outputTokens, cost_usd }) });
}

const PERSONAS: Record<string, string> = {
  en: `You are the DRU AI Consulting website chat assistant — a combined voice of Priscilla Okonkwo (Multi-Channel Communication Specialist) and Isaiah Carter (Issue Resolution Specialist). You represent DeAnna R. Upshaw, AI Authority and CEO/Founder of DRU AI Consulting.

BRAND: "AI Mastery. Leadership Clarity. Measurable Results."

YOUR NAME: Priscilla (for general inquiries) or Isaiah (for support/issue questions)
When introducing yourself always say your name — 'I'm Priscilla, the DRU AI Consulting chat assistant' or 'I'm Isaiah, the DRU AI Consulting support specialist.'

YOUR ROLE:
- Answer questions about DRU AI Consulting, DeAnna's services, and frameworks warmly and professionally
- For support or issue questions (access, billing, technical), respond as Isaiah — calm, systematic, solution-oriented
- For general inquiries, respond as Priscilla — warm, professional, brand-consistent
- Always direct to assessment.druaiconsulting.com as the primary entry point
- Keep responses concise — 2-4 sentences maximum

SERVICES:
- DRU CLEAR™ AI Readiness Assessment — Free at assessment.druaiconsulting.com (START HERE)
- Strategic Diagnostic™ — $3,497
- Executive Diagnostic™ — $4,997 (BEST VALUE)
- 90-Day AI Transformation Journey™ — $20K–$25K+
- From Confusion to Confident with AI™ Course — from $1,497
- Daily Connections — Free / Navigator $47/mo / Accelerator $147/mo

FRAMEWORKS (always ™):
DRU CLEAR™ · DRU AI Leadership Ecosystem™ · DRU AI Transformation Pathway™ · 5C Cultural DNA™ · 5D Leadership™ · AI Sales Mastery™ · From Confusion to Confident with AI™

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
- Diagnóstico Estratégico™ — $3,497
- Diagnóstico Ejecutivo™ — $4,997 (MEJOR VALOR)
- Viaje de Transformación IA de 90 Días™ — $20K–$25K+

MARCOS (siempre con ™):
DRU CLEAR™ · DRU AI Leadership Ecosystem™ · DRU AI Transformation Pathway™ · 5C Cultural DNA™ · 5D Leadership™ · AI Sales Mastery™ · From Confusion to Confident with AI™

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
- Diagnostic Stratégique™ — $3,497
- Diagnostic Exécutif™ — $4,997 (MEILLEURE VALEUR)

CADRES (toujours avec ™):
DRU CLEAR™ · DRU AI Leadership Ecosystem™ · DRU AI Transformation Pathway™ · 5C Cultural DNA™ · 5D Leadership™ · AI Sales Mastery™ · From Confusion to Confident with AI™

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
- التشخيص الاستراتيجي™ — $3,497
- التشخيص التنفيذي™ — $4,997 (أفضل قيمة)

الأطر (دائماً مع ™):
DRU CLEAR™ · DRU AI Leadership Ecosystem™ · DRU AI Transformation Pathway™ · 5C Cultural DNA™ · 5D Leadership™ · AI Sales Mastery™ · From Confusion to Confident with AI™

القواعد:
- 2-4 جمل كحد أقصى لكل رد
- انتهي دائماً برابط assessment.druaiconsulting.com
- لما لا يمكنك الإجابة عنه: "سؤال ممتاز — سيتواصل معك فريقنا مباشرة."`,
};

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

async function getAIResponse(message: string, language: string, name: string, history: {role: string; content: string}[]): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const systemPrompt = PERSONAS[language] ?? PERSONAS['en'];
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
      max_tokens: 300,
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

  const { action, name = '', email, phone, message, language = 'en', history = [] } = req.body;

  if (!action) { res.status(400).json({ error: 'action is required' }); return; }

  // Register new chat visitor — create GHL contact
  if (action === 'register') {
    if (!email || !phone) { res.status(400).json({ error: 'email and phone required' }); return; }
    const contactId = await createGHLContact(name, email, phone);
    console.log(`[chat-agent] New contact registered — ${email} | GHL ID: ${contactId ?? 'failed'}`);
    res.status(200).json({ success: true, contact_id: contactId });
    return;
  }

  // Handle chat message — get AI response
  if (action === 'message') {
    if (!message) { res.status(400).json({ error: 'message is required' }); return; }
    try {
      const response = await getAIResponse(message, language, name, history);
      console.log(`[chat-agent] Response generated | lang: ${language} | message: ${message.slice(0, 50)}`);
      res.status(200).json({ success: true, response });
    } catch (err) {
      console.error('[chat-agent] AI error:', err);
      res.status(500).json({
        success: false,
        response: 'Thank you for your message! Please visit assessment.druaiconsulting.com to get started, or email us at support@druaiconsulting.com.',
      });
    }
    return;
  }

  res.status(400).json({ error: `Unknown action: ${action}` });
}
