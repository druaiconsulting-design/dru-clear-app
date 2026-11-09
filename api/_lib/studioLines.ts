// Shared by the Audio and Finish steps: how a scene's dialogue field is read into spoken lines.

export type Line = { speaker: string; text: string }

// Stage directions in parentheses, like "(soft, to herself)", stay in the script but are not spoken.
export const spokenOnly = (t: string) => t.replace(/\([^)]*\)/g, ' ').replace(/\s{2,}/g, ' ').replace(/\s+([.,!?;:])/g, '$1').trim()

// The script writes each spoken line as "Name: words". In narration films the whole field is the narrator's.
export function parseLines(dialogue: string | null, sound: string): { lines: Line[]; problem: string | null } {
  const raw = String(dialogue || '').trim()
  if (!raw) return { lines: [], problem: null }
  if (sound === 'narration') {
    const text = spokenOnly(raw.replace(/\s*\n+\s*/g, ' '))
    return { lines: text ? [{ speaker: 'Narrator', text }] : [], problem: null }
  }
  const lines: Line[] = []
  for (const part of raw.split(/\n+/).map(x => x.trim()).filter(Boolean)) {
    // "Name: words", "Name: (direction) words", "Name (direction): words" and "Name (direction) words"
    const m = /^[*_"'\[\s]*([^:\n(]{1,40}?)[*_"'\]\s]*:\s*(.+)$/.exec(part)
    const d = /^[*_"'\[\s]*([A-Z][^:\n(]{0,39}?)\s*\([^)]*\)\s*:?\s*(.+)$/.exec(part)
    const named = d && d[1].trim().split(/\s+/).length <= 3 && d[1].trim().split(/\s+/).every(w => /^[A-Z]/.test(w)) ? d : null
    if (named) lines.push({ speaker: named[1].trim(), text: named[2].trim() }) // the direction is dropped; it is not spoken
    else if (m && m[1].trim()) lines.push({ speaker: m[1].trim(), text: m[2].trim() })
    else if (lines.length) lines[lines.length - 1].text += ' ' + part
    else return { lines: [], problem: 'The first line has no speaker name. On the Script step, start each line with the speaker\'s name and a colon, like "Name: words".' }
  }
  return { lines: lines.map(l => ({ speaker: l.speaker, text: spokenOnly(l.text) })).filter(l => l.text), problem: null }
}
