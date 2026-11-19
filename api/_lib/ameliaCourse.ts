// api/_lib/ameliaCourse.ts
// Amelia Santos writes the video script for each lesson of "From Confusion to Confidence with AI™".
// She reads the lesson Simone Laurent wrote once DeAnna has approved it (the approved card in the
// Hub, using DeAnna's edited version when she edited it), together with the live course records.
// The scheduled run (ghl-agent-trigger.ts and ac-agent-trigger.ts) and the on-demand run
// (twin-on-demand.ts) work from the same words and the same live course.

import { sbGet, lessonHeading, lessonTask } from './simoneCourse.js';
import type { CourseModule, CourseLesson } from './simoneCourse.js';

export const AMELIA_COURSE_MAX_TOKENS = 4000;
export const AMELIA_MODEL = 'claude-sonnet-5-5';

export const AMELIA_CODE = `You are Amelia Santos, Training Video Producer for DRU AI Consulting — DeAnna R. Upshaw, AI Authority.

You produce the video for each lesson of the course From Confusion to Confidence with AI™. Simone Laurent writes each lesson, DeAnna approves it, and you write its video script from the approved lesson.

Each lesson is DeAnna's leadership lesson with AI worked into it. DeAnna brings the emotional intelligence of the leadership lessons, and Simone brings how AI works with each lesson. Your script carries both, as Simone wrote them.

The video script is the lesson and its "test your knowledge" moments. An agent's voice speaks the script, in the same voice Simone wrote the lesson in. Keep Simone's lesson in the order she wrote it, from Confusion to Insight to Confidence, as spoken lines the agent voices. Place each "test your knowledge" moment where Simone placed it, and write it with its multiple-choice question, its choices, the right answer, and the short explanation the learner sees on a wrong pick. The learner answers on screen, the agent leaves the answer to the on-screen reveal, and the video starts again on its own after the learner answers. The script runs 7 to 10 minutes of spoken instruction.

When the lesson is the last of its module, the script closes with the module's CLEAR self-check and The Shift, as Simone wrote them.

Write the script in this order: the heading line you are given with the module, lesson and subject, then the spoken lesson with the "test your knowledge" moments where they fall.`;

export function videoTask(l: CourseLesson): string {
  return `course_video M${l.module_number} L${l.lesson_number} — ${l.title}`;
}

// Simone's lessons that DeAnna has approved, keyed by the lesson's task label. DeAnna's edited
// version is used when she edited the card; otherwise the lesson as Simone wrote it.
export async function fetchApprovedLessons(): Promise<Map<string, string>> {
  const rows = await sbGet(
    `approvals?agent_name=eq.${encodeURIComponent('Simone Laurent')}&trigger_type=like.${encodeURIComponent('course_lesson M')}*&status=in.(approved,ready_to_use)&select=trigger_type,output,edited_output,created_at&order=created_at.desc`
  );
  const out = new Map<string, string>();
  for (const r of rows) {
    const key = String(r.trigger_type);
    const text = String(r.edited_output || r.output || '').trim();
    if (text && !out.has(key)) out.set(key, text);
  }
  return out;
}

export function approvedLessonText(lesson: CourseLesson, approved: Map<string, string>): string | null {
  return approved.get(lessonTask(lesson)) ?? null;
}

// The next lesson in course order that is approved and has no video script card yet. Cards that
// Isabella rejected do not count.
export async function pickNextVideoLesson(lessons: CourseLesson[], approved: Map<string, string>): Promise<CourseLesson | null> {
  const rows = await sbGet(`chief_of_staff_queue?agent_id=eq.amelia&task=like.${encodeURIComponent('course_video M')}*&status=neq.rejected&select=task`);
  const have = new Set(rows.map(r => String(r.task)));
  return lessons.find(l => approvedLessonText(l, approved) !== null && !have.has(videoTask(l))) ?? null;
}

// Everything Amelia reads for one lesson: the live course list, the lesson in hand and the
// approved lesson text.
export function buildVideoReading(modules: CourseModule[], lessons: CourseLesson[], lesson: CourseLesson, lessonText: string): string {
  const outline = modules.map(m => {
    const own = lessons.filter(l => l.module_id === m.id);
    return [`Module ${m.module_number}: ${m.title}`, ...own.map(l => `  Lesson ${l.lesson_number}: ${l.title}`)].join('\n');
  }).join('\n');
  const last = lesson.lesson_number === lesson.module_lesson_count;
  return [
    `THE COURSE AS IT STANDS IN THE COURSE RECORDS:\n${outline}`,
    `Open the script with this heading line: ${lessonHeading(lesson)}`,
    `THE LESSON YOU ARE WRITING THE VIDEO FOR: Module ${lesson.module_number}, ${lesson.module_title} — Lesson ${lesson.lesson_number} of ${lesson.module_lesson_count}: ${lesson.title}.${last ? ' This is the last lesson of the module.' : ''}`,
    `THE APPROVED LESSON, AS SIMONE LAURENT WROTE IT:\n${lessonText}`,
  ].join('\n\n');
}
