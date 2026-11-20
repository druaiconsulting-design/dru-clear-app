// api/_lib/simoneCourse.ts
// Simone Laurent writes the course "From Confusion to Confidence with AI™", one lesson at a time.
// This file holds her code and everything she reads, so the scheduled run (ghl-agent-trigger.ts and
// ac-agent-trigger.ts) and the on-demand run (twin-on-demand.ts) work from the same words and the
// same live course.
//
// What she reads on every run:
//   - the modules and lessons from the course records (course_modules, course_lessons), live
//   - for the lesson being written, the licensed Training Manual and Instructor Guide for its topic
//     (licensed_course_materials)
//   - which lessons already have a card, so a scheduled run takes the next lesson in order
// The foundation is DeAnna's course handoff brief (Sept 3, 2026) and the course flyer; the Module 2
// wording, the 23 lessons and the lesson order are DeAnna's, Nov 18, 2026.

export const COURSE_LESSON_MAX_TOKENS = 6000;
// Simone writes on Claude Sonnet 5.5 (DeAnna, Nov 18, 2026), the same model as Imani.
export const SIMONE_MODEL = 'claude-sonnet-5-5';

const COURSE_ID = 'confusion_to_confidence';
// The two licensed files are read in full. This ceiling keeps the largest topic (about 430,000
// characters) comfortably inside the model's reading room.
const SOURCE_MAX_CHARS = 600000;

const PATHWAY_STAGE: Record<number, string> = { 1: 'Discover', 2: 'Diagnose', 3: 'Design', 4: 'Deploy', 5: 'Dominate' };
const CLEAR_CHECK: Record<number, string> = { 1: 'Clarity', 2: 'Leadership', 3: 'Execution', 4: 'Alignment', 5: 'Results' };

// One tease per module, from the handoff brief. A tease is a single line, placed once. Module 3 has none.
const MODULE_TEASE: Record<number, string> = {
  1: 'Place this line once, unattributed: "Most organizations don\'t have an AI problem — they have a culture problem."',
  2: 'Name The Lid, Solid Ground and Magnetism by their 5D Leadership™ labels, each in a single line, as real leadership content. The 5D Leadership™ methodology belongs to the separate 5D Leadership™ product.',
  4: 'Place one line once, in plain words: how you say it matters as much as what you say.',
  5: 'Place one line once, in plain vocabulary with no ™: the learner has moved from confusion to AI Mastery.',
};

export const SIMONE_CODE = `You are Simone Laurent, Course Architect for DRU AI Consulting — DeAnna R. Upshaw, AI Authority.

You write the course From Confusion to Confidence with AI™ — $1,497, self-paced. The course takes leaders who are scared and confused about AI to confidence with AI. Its spine is the DRU AI Transformation Pathway™, and each module is one stage: Discover, Diagnose, Design, Deploy and Dominate. You write every lesson in the course, and you are its foundation.

You and Amelia Santos work together on the courses. You write each lesson, and Amelia produces its video from your writing, so you write each lesson as a script an agent can voice and Amelia can film.

Each lesson is DeAnna's leadership lesson with AI worked into it. DeAnna brings the emotional intelligence of the leadership lessons, and you bring how AI works with each lesson. The leadership lesson comes from the lesson's licensed topic, which you receive as the Training Manual and the Instructor Guide. Write it in your own phrasing, drawing on the licensed ideas and some of its words. You work AI into the lesson by showing what AI's capabilities are and how they work alongside the lesson's ideas, which takes the fear and confusion out of AI.

Each lesson moves from Confusion, the teaching content, to Insight, a reflection on where the learner stands, to Confidence, the actionable takeaway that moves the learner forward. A lesson runs 7 to 10 minutes of spoken instruction, about 900 to 1,300 words, led by an agent's voice.

Place a few "test your knowledge" moments in each lesson. Each is a multiple-choice question the learner answers on screen, drawn from the quiz and review questions in the licensed material where they fit. Write each question with its choices, the right answer, and the short explanation the learner sees on a wrong pick.

Each module closes with a CLEAR self-check and The Shift. The self-checks run Clarity, Leadership, Execution, Alignment, Results, one per module in that order, and The Shift is the one concrete, transferable realization the learner walks away with. When you write the last lesson of a module, close it with that module's self-check and The Shift.

A tease is a single line, placed once in the module. The course flyer is the course's own tease, and it reads:
Clarity. Leadership. Empowerment. AI. Results.
1. Is AI fostering greater clarity within your organization, or is it revealing deficiencies in leadership alignment?
2. Are you leading AI adoption strategically, or simply reacting to the latest AI tools and trends?
3. If your team asked for your AI vision today, could you communicate it with confidence and clarity?
Lead with clarity. Empower with AI. Achieve results.

Write the lesson in this order: the heading line you are given with the module, lesson and subject, then the lesson from Confusion to Insight to Confidence with the "test your knowledge" moments where they fall, then the module close when it is the last lesson of the module.`;

export type CourseModule = { id: string; module_number: number; title: string; description: string | null };
export type CourseLesson = {
  id: string; module_id: string; lesson_number: number; title: string; description: string | null;
  module_number: number; module_title: string; module_description: string | null; module_lesson_count: number;
};

export async function sbGet(path: string): Promise<any[]> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  try {
    const res = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!res.ok) { console.error(`[simoneCourse] read failed ${res.status}: ${path.split('?')[0]}`); return []; }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('[simoneCourse] read error:', err);
    return [];
  }
}

// The modules and lessons exactly as they stand in the course records right now.
export async function fetchCourse(): Promise<{ modules: CourseModule[]; lessons: CourseLesson[] }> {
  const modules: CourseModule[] = await sbGet(`course_modules?course_id=eq.${COURSE_ID}&select=id,module_number,title,description&order=module_number.asc`);
  if (modules.length === 0) return { modules: [], lessons: [] };
  const rows = await sbGet(`course_lessons?module_id=in.(${modules.map(m => m.id).join(',')})&select=id,module_id,lesson_number,title,description&order=lesson_number.asc`);
  const byId = new Map(modules.map(m => [m.id, m]));
  const countByModule = new Map<string, number>();
  for (const r of rows) countByModule.set(r.module_id, (countByModule.get(r.module_id) ?? 0) + 1);
  const lessons: CourseLesson[] = rows
    .filter(r => byId.has(r.module_id))
    .map(r => {
      const m = byId.get(r.module_id)!;
      return { ...r, module_number: m.module_number, module_title: m.title, module_description: m.description, module_lesson_count: countByModule.get(r.module_id) ?? 0 };
    })
    .sort((a, b) => a.module_number - b.module_number || a.lesson_number - b.lesson_number);
  return { modules, lessons };
}

function outlineText(modules: CourseModule[], lessons: CourseLesson[]): string {
  return modules.map(m => {
    const own = lessons.filter(l => l.module_id === m.id);
    const head = `Module ${m.module_number}: ${m.title}${m.description ? ` — ${m.description}` : ''} (${PATHWAY_STAGE[m.module_number] ?? ''} · ${CLEAR_CHECK[m.module_number] ?? ''})`;
    return [head, ...own.map(l => `  Lesson ${l.lesson_number}: ${l.title}`)].join('\n');
  }).join('\n');
}

// The heading a lesson opens with, and the title of its card: "Module 1 · Lesson 1 · Critical Thinking".
export function lessonHeading(l: CourseLesson): string {
  return `Module ${l.module_number} · Lesson ${l.lesson_number} · ${l.title}`;
}

// A card's readable title from its task label ("course_lesson M1 L1 — Critical Thinking", "course_video ..." or
// "course_deck M1 L1 — Critical Thinking"), or null when the task is not a course label.
export function courseCardLabel(task: string): string | null {
  const m = String(task ?? '').match(/^course_(?:lesson|video|deck) M(\d+) L(\d+) — (.+)$/);
  return m ? `Module ${m[1]} · Lesson ${m[2]} · ${m[3]}` : null;
}

// The card's task label. A scheduled run reads these labels to see which lessons already have a card.
export function lessonTask(l: CourseLesson): string {
  return `course_lesson M${l.module_number} L${l.lesson_number} — ${l.title}`;
}

// The next lesson in order that has no card yet. Cards that Isabella rejected do not count.
export async function pickNextLesson(lessons: CourseLesson[]): Promise<CourseLesson | null> {
  const rows = await sbGet(`chief_of_staff_queue?agent_id=eq.simone&task=like.${encodeURIComponent('course_lesson M')}*&status=neq.rejected&select=task`);
  const have = new Set(rows.map(r => String(r.task)));
  return lessons.find(l => !have.has(lessonTask(l))) ?? null;
}

// The lesson DeAnna names in an on-demand request ("Module 2 Lesson 3", or the topic's name).
export function findNamedLesson(text: string, lessons: CourseLesson[]): CourseLesson | null {
  const t = String(text ?? '').toLowerCase();
  const m = t.match(/module\s*(\d)\D{0,12}lesson\s*(\d+)/);
  if (m) {
    const hit = lessons.find(l => l.module_number === Number(m[1]) && l.lesson_number === Number(m[2]));
    if (hit) return hit;
  }
  const byLength = [...lessons].sort((a, b) => b.title.length - a.title.length);
  return byLength.find(l => t.includes(l.title.toLowerCase())) ?? null;
}

// The licensed Training Manual and Instructor Guide for a lesson's topic, in full.
export async function fetchLessonSource(topic: string): Promise<{ text: string; files: string[] }> {
  const rows = await sbGet(`licensed_course_materials?licensed_title=ilike.${encodeURIComponent(topic)}*&status=eq.processed&select=licensed_title,extracted_text`);
  const want = topic.toLowerCase();
  const mine = rows.filter(r => {
    const t = String(r.licensed_title ?? '').toLowerCase();
    return t === want || t.startsWith(`${want} - `);
  });
  const rank = (t: string) => (/training manual/i.test(t) ? 0 : /instructor guide/i.test(t) ? 1 : 2);
  mine.sort((a, b) => rank(a.licensed_title) - rank(b.licensed_title));
  let text = mine.map(r => `----- ${r.licensed_title} -----\n${r.extracted_text ?? ''}`).join('\n\n');
  if (text.length > SOURCE_MAX_CHARS) text = text.slice(0, SOURCE_MAX_CHARS);
  return { text, files: mine.map(r => String(r.licensed_title)) };
}

// Everything Simone reads for one run: the live course, the lesson in hand and its licensed source.
export function buildCourseReading(modules: CourseModule[], lessons: CourseLesson[], lesson: CourseLesson | null, source: { text: string; files: string[] } | null): string {
  const parts: string[] = [`THE COURSE AS IT STANDS IN THE COURSE RECORDS:\n${outlineText(modules, lessons)}`];
  if (lesson) {
    const stage = PATHWAY_STAGE[lesson.module_number] ?? '';
    const check = CLEAR_CHECK[lesson.module_number] ?? '';
    const last = lesson.lesson_number === lesson.module_lesson_count;
    const tease = MODULE_TEASE[lesson.module_number];
    parts.push([
      `Open the lesson with this heading line: ${lessonHeading(lesson)}`,
      `THE LESSON YOU ARE WRITING: Module ${lesson.module_number}, ${lesson.module_title} — Lesson ${lesson.lesson_number} of ${lesson.module_lesson_count}: ${lesson.title}.`,
      `Pathway stage: ${stage}. Module self-check: ${check}.${last ? ` This is the last lesson of the module, so it closes with the ${check} self-check and The Shift.` : ''}`,
      tease ? `Module tease: ${tease}` : '',
    ].filter(Boolean).join('\n'));
  }
  if (source && source.text) {
    parts.push(`THE LICENSED SOURCE FOR THIS LESSON (${source.files.join('; ')}):\n${source.text}`);
  }
  return parts.join('\n\n');
}
