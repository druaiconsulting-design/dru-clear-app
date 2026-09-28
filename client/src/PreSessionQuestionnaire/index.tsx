import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { GAP_MESSAGES, STRENGTH_MESSAGES, TIER_MESSAGES, BADGE_URLS } from '../pages/DruClearAssessment/constants';

// ── Brand colors — same palette used everywhere else ──────────────────────────
const NAVY = '#0A2342';
const GOLD = '#D4AF37';
const MAGENTA = '#C2185B';
const WARM_WHITE = '#FAFAF8';
const BODY_TEXT_ON_NAVY = '#E8E8E8';

// ── The original 15 free-assessment questions, grouped by pillar ──────────────
// This is reminder content only — their real answers get pulled from `submissions`
// (q1..q15) and displayed next to the matching statement below.
const CLEAR_PILLARS: Array<{
  key: string;
  questions: string[];
  scoreField: 'clarity_score' | 'leadership_score' | 'execution_score' | 'alignment_score' | 'results_score';
  qFields: [string, string, string];
}> = [
  {
    key: 'Clarity',
    questions: [
      'Our organization has a clearly defined AI vision that connects to our overall business strategy.',
      'Leaders and teams across the organization understand why we are pursuing AI and what success looks like.',
      'We have identified specific strategic priorities where AI will have the greatest business impact.',
    ],
    scoreField: 'clarity_score',
    qFields: ['q1', 'q2', 'q3'],
  },
  {
    key: 'Leadership',
    questions: [
      'Our organizational leaders can clearly articulate how AI connects to our business strategy and competitive position.',
      'There is a designated executive sponsor who is accountable for driving AI transformation.',
      'Our leadership team actively participates in AI learning, development, and decision-making.',
    ],
    scoreField: 'leadership_score',
    qFields: ['q4', 'q5', 'q6'],
  },
  {
    key: 'Execution',
    questions: [
      'We have identified specific business processes where AI can deliver measurable impact.',
      'Our teams have the skills, tools, and resources needed to implement AI solutions today.',
      'We have completed at least one AI pilot or proof of concept in the past 12 months.',
    ],
    scoreField: 'execution_score',
    qFields: ['q7', 'q8', 'q9'],
  },
  {
    key: 'Alignment',
    questions: [
      'Our AI initiatives are aligned with our overall business goals and strategic plan.',
      'There is clear and consistent communication between departments about AI priorities and progress.',
      'Our AI efforts are coordinated across teams and business units rather than operating in silos.',
    ],
    scoreField: 'alignment_score',
    qFields: ['q10', 'q11', 'q12'],
  },
  {
    key: 'Results',
    questions: [
      'We have defined clear Key Performance Indicators to measure the success of our AI initiatives.',
      'We can demonstrate measurable return on investment from at least one AI-related initiative.',
      'We have a system in place to regularly track and report AI progress to leadership.',
    ],
    scoreField: 'results_score',
    qFields: ['q13', 'q14', 'q15'],
  },
];

const FRAMEWORK_LABELS: Record<string, string> = {
  CLEAR: 'DRU CLEAR™',
  '5D_LEADERSHIP': '5D Leadership™ Reflection',
  '5C_CULTURAL_DNA': '5C Cultural DNA™ Reflection',
  AI_SALES_MASTERY: 'AI Sales Mastery™ Reflection',
};

// Fixed display order, both for frameworks and for pillars within each one.
const FRAMEWORK_ORDER = ['CLEAR', '5D_LEADERSHIP', '5C_CULTURAL_DNA', 'AI_SALES_MASTERY'];
const PILLAR_ORDER: Record<string, string[]> = {
  CLEAR: ['Clarity', 'Leadership', 'Execution', 'Alignment', 'Results'],
  '5D_LEADERSHIP': ['Self', 'People', 'Teams', 'Organizations', 'Visionary'],
  '5C_CULTURAL_DNA': ['Communication', 'Connection', 'Collaboration', 'Coaching', 'Culture Transformation'],
  AI_SALES_MASTERY: [
    'Hyper-Personalized Outreach at Scale',
    "Speak Your Client's Decision Language",
    'Predict Objections Before They Happen',
    'Close with Confidence, Not Pressure',
    'Build Long-Term Client Relationships',
  ],
};

const CLOSING_TEXT: Record<string, string> = {
  strategic:
    'Insight identifies five gaps individually. The DRU AI Transformation Pathway™ moves them together, one sequence across ninety days: Discover, Diagnose, Design, Deploy, Dominate, each stage built on the one before it. Please specify the gap positioned to move first.',
  executive:
    'Insight delineates four distinct frameworks: DRU CLEAR™, 5D Leadership™, 5C Cultural DNA™, and AI Sales Mastery™. The DRU AI Transformation Pathway™ integrally advances all four frameworks through a comprehensive Full Ecosystem sequence spanning ninety days: Discover, Diagnose, Design, Deploy, and Dominate. This process includes twelve sessions, with each stage systematically building on the previous one. Kindly specify the framework designated to commence the sequence.',
};

interface QuestionRow {
  id: string;
  question_id: string;
  answer_text: string | null;
  diagnostic_questions: {
    framework: string;
    pillar: string;
    question_order: number;
    question_text: string;
  };
}

interface SubmissionRow {
  first_name: string | null;
  tier: string;
  clarity_score: number;
  leadership_score: number;
  execution_score: number;
  alignment_score: number;
  results_score: number;
  q1: string; q2: string; q3: string; q4: string; q5: string; q6: string;
  q7: string; q8: string; q9: string; q10: string; q11: string; q12: string;
  q13: string; q14: string; q15: string;
}

export default function PreSessionQuestionnaire() {
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [email, setEmail] = useState('');
  const [diagnosticTier, setDiagnosticTier] = useState<'strategic' | 'executive' | ''>('');
  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [submission, setSubmission] = useState<SubmissionRow | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('prep');
    if (!token) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    load(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(token: string) {
    const { data: responseRows, error } = await supabase
      .from('diagnostic_responses')
      .select('id, question_id, answer_text, email, diagnostic_tier, diagnostic_questions(framework, pillar, question_order, question_text)')
      .eq('access_token', token);

    if (error || !responseRows || responseRows.length === 0) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const first = responseRows[0] as any;
    setEmail(first.email);
    setDiagnosticTier(first.diagnostic_tier);
    setRows(responseRows as unknown as QuestionRow[]);

    const { data: submissionRow } = await supabase
      .from('submissions')
      .select(
        'first_name, tier, clarity_score, leadership_score, execution_score, alignment_score, results_score, q1,q2,q3,q4,q5,q6,q7,q8,q9,q10,q11,q12,q13,q14,q15'
      )
      .eq('email', first.email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    setSubmission((submissionRow as unknown as SubmissionRow) ?? null);
    setLoading(false);
  }

  const saveAnswer = useCallback(async (rowId: string, value: string) => {
    await supabase
      .from('diagnostic_responses')
      .update({ answer_text: value, last_saved_at: new Date().toISOString() })
      .eq('id', rowId);
    setSavedId(rowId);
    setTimeout(() => setSavedId((cur) => (cur === rowId ? null : cur)), 1800);
  }, []);

  function updateLocalAnswer(rowId: string, value: string) {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, answer_text: value } : r)));
  }

  if (loading) {
    return (
      <div style={pageStyle}>
        <p style={{ color: BODY_TEXT_ON_NAVY, fontFamily: 'Inter, sans-serif' }}>Loading your questionnaire…</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={pageStyle}>
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <h1 style={{ ...headingStyle, fontSize: 24 }}>Link not recognized</h1>
          <p style={{ color: BODY_TEXT_ON_NAVY, fontFamily: 'Inter, sans-serif' }}>
            This link did not match a pre-session questionnaire on file. Reach out to your DRU AI Consulting contact for a new link.
          </p>
        </div>
      </div>
    );
  }

  const totalCount = rows.length;
  const answeredCount = rows.filter((r) => (r.answer_text ?? '').trim().length > 0).length;
  const isComplete = totalCount > 0 && answeredCount === totalCount;

  const frameworksPresent = FRAMEWORK_ORDER.filter((fw) => rows.some((r) => r.diagnostic_questions.framework === fw));

  return (
    <div style={{ ...pageStyle, alignItems: 'stretch', padding: '48px 24px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', width: '100%' }}>
        {/* Header */}
        <div style={{ marginBottom: 8, color: GOLD, fontFamily: 'Inter, sans-serif', fontSize: 13, letterSpacing: 1 }}>
          {answeredCount} of {totalCount} answered
        </div>
        <h1 style={{ ...headingStyle, fontSize: 32, marginBottom: 4 }}>
          {diagnosticTier === 'executive' ? 'Executive Diagnostic' : 'Strategic Diagnostic'} — Pre-Session Questionnaire
        </h1>
        {submission?.tier && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
            {BADGE_URLS[submission.tier] && (
              <img src={BADGE_URLS[submission.tier]} alt={submission.tier} style={{ height: 28 }} />
            )}
            <span style={{ color: GOLD, fontFamily: 'Inter, sans-serif', fontSize: 14, letterSpacing: 1 }}>{submission.tier}</span>
          </div>
        )}

        {frameworksPresent.map((framework) => {
          const pillars = PILLAR_ORDER[framework].filter((p) =>
            rows.some((r) => r.diagnostic_questions.framework === framework && r.diagnostic_questions.pillar === p)
          );

          return (
            <div key={framework} style={{ marginBottom: 48 }}>
              <h2 style={{ ...headingStyle, fontSize: 22, color: GOLD, borderBottom: `1px solid ${GOLD}`, paddingBottom: 10, marginBottom: 24 }}>
                {FRAMEWORK_LABELS[framework]}
              </h2>

              {pillars.map((pillar) => {
                const pillarRows = rows
                  .filter((r) => r.diagnostic_questions.framework === framework && r.diagnostic_questions.pillar === pillar)
                  .sort((a, b) => a.diagnostic_questions.question_order - b.diagnostic_questions.question_order);

                const clearMeta = framework === 'CLEAR' ? CLEAR_PILLARS.find((c) => c.key === pillar) : null;

                return (
                  <div key={pillar} style={{ marginBottom: 36 }}>
                    <h3 style={{ ...headingStyle, fontSize: 18, marginBottom: 12 }}>{pillar}</h3>

                    {clearMeta && submission && (
                      <div style={reminderBoxStyle}>
                        <div style={{ fontSize: 12, letterSpacing: 1, color: GOLD, marginBottom: 8, fontFamily: 'Inter, sans-serif' }}>
                          Already on record; solely from the assessment reminder.
                        </div>
                        {clearMeta.questions.map((qText, i) => (
                          <p key={i} style={{ margin: '0 0 8px 0', color: BODY_TEXT_ON_NAVY, fontFamily: 'Inter, sans-serif', fontSize: 14 }}>
                            &ldquo;{qText}&rdquo; &rarr; Their answer:{' '}
                            <strong style={{ color: '#fff' }}>{(submission as any)[clearMeta.qFields[i]] ?? '—'}</strong>
                          </p>
                        ))}
                        <p style={{ margin: '8px 0 0 0', color: BODY_TEXT_ON_NAVY, fontFamily: 'Inter, sans-serif', fontSize: 14 }}>
                          Their badge: <strong style={{ color: '#fff' }}>{submission.tier}</strong>
                        </p>
                        <p style={{ margin: '8px 0 0 0', color: BODY_TEXT_ON_NAVY, fontFamily: 'Inter, sans-serif', fontSize: 14 }}>
                          What this means:{' '}
                          <em>
                            {(submission[clearMeta.scoreField] as number) < 12
                              ? GAP_MESSAGES[pillar]
                              : STRENGTH_MESSAGES[pillar]}
                          </em>
                        </p>
                      </div>
                    )}

                    <div style={{ marginTop: clearMeta ? 16 : 0 }}>
                      <div style={{ fontSize: 12, letterSpacing: 1, color: MAGENTA, marginBottom: 10, fontFamily: 'Inter, sans-serif' }}>
                        {framework === 'CLEAR' ? 'Deeper Dive: Complete these tasks before your session:' : ''}
                      </div>
                      {pillarRows.map((row, idx) => (
                        <div key={row.id} style={{ marginBottom: 16 }}>
                          <label style={{ display: 'block', color: BODY_TEXT_ON_NAVY, fontFamily: 'Inter, sans-serif', fontSize: 15, marginBottom: 6 }}>
                            {framework === 'CLEAR' ? `${idx + 1}. ` : ''}
                            {row.diagnostic_questions.question_text}
                          </label>
                          <textarea
                            defaultValue={row.answer_text ?? ''}
                            onChange={(e) => updateLocalAnswer(row.id, e.target.value)}
                            onBlur={(e) => saveAnswer(row.id, e.target.value)}
                            rows={3}
                            style={textareaStyle}
                          />
                          {savedId === row.id && (
                            <div style={{ color: GOLD, fontSize: 12, marginTop: 4, fontFamily: 'Inter, sans-serif' }}>Saved</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Closing */}
        {diagnosticTier && (
          <div
            style={{
              backgroundColor: MAGENTA,
              padding: 24,
              borderRadius: 4,
              marginBottom: 32,
            }}
          >
            <p style={{ margin: 0, color: WARM_WHITE, fontFamily: 'Playfair Display, serif', fontSize: 16, lineHeight: 1.6 }}>
              {CLOSING_TEXT[diagnosticTier]}
            </p>
          </div>
        )}

        {isComplete && (
          <div style={{ textAlign: 'center', padding: 24, border: `1px solid ${GOLD}`, borderRadius: 4 }}>
            <p style={{ margin: 0, color: GOLD, fontFamily: 'Inter, sans-serif', fontSize: 15 }}>
              Complete — every question has an answer on file. See you on the call.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  backgroundColor: NAVY,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-start',
};

const headingStyle: React.CSSProperties = {
  color: GOLD,
  fontFamily: 'Playfair Display, serif',
  fontWeight: 700,
  margin: 0,
};

const reminderBoxStyle: React.CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(212,175,55,0.3)',
  borderRadius: 4,
  padding: 16,
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  backgroundColor: WARM_WHITE,
  color: '#2C2C2C',
  border: '1px solid rgba(212,175,55,0.5)',
  borderRadius: 4,
  padding: 10,
  fontFamily: 'Inter, sans-serif',
  fontSize: 14,
  resize: 'vertical',
};
