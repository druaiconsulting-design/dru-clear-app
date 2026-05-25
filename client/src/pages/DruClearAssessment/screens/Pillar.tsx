import { ScoreRow } from "./Utility";
import type { Scores } from "../types";

interface PillarProps {
  pillarLetter: string;
  pillarName: string;
  subtitle: string;
  progress: number;
  progressLabel: string;
  questions: string[];
  questionStartIndex: number;
  scores: Scores;
  onScoreChange: (qIndex: number, value: number) => void;
  onNext: () => void;
  nextLabel?: string;
}

export default function Pillar({
  pillarLetter, pillarName, subtitle, progress, progressLabel,
  questions, questionStartIndex, scores, onScoreChange, onNext, nextLabel = "Next →",
}: PillarProps) {
  const allAnswered = questions.every((_, i) => scores[questionStartIndex + i] && scores[questionStartIndex + i] > 0);
  return (
    <div className="screen-enter flex flex-col" style={{ minHeight: "100dvh", background: "#0A2342", padding: "2rem 1.5rem 2rem", maxWidth: 480, margin: "0 auto", width: "100%" }}>
      <div className="mb-5">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-medium" style={{ color: "rgba(212,175,55,0.7)" }}>{progressLabel}</span>
          <span className="text-xs" style={{ color: "rgba(230,230,230,0.4)" }}>{progress}%</span>
        </div>
        <div className="progress-bar-track"><div className="progress-bar-fill" style={{ width: `${progress}%` }} /></div>
      </div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-1" style={{ fontFamily: "'Playfair Display', serif", color: "#D4AF37" }}>{pillarLetter} — {pillarName}</h2>
        <p className="text-sm" style={{ color: "#E6E6E6" }}>{subtitle}</p>
      </div>
      <div className="gold-divider mb-6" />
      <div className="flex-1">
        {questions.map((q, i) => (
          <ScoreRow
            key={i}
            questionNum={questionStartIndex + i + 1}
            question={q}
            value={scores[questionStartIndex + i] || 0}
            onChange={(v) => onScoreChange(questionStartIndex + i, v)}
          />
        ))}
      </div>
      <div className="mt-4">
        {!allAnswered && <p className="text-xs text-center mb-3" style={{ color: "rgba(230,230,230,0.4)" }}>Please answer all questions to continue</p>}
        <button className="btn-gold" onClick={onNext} disabled={!allAnswered} style={{ opacity: allAnswered ? 1 : 0.4 }}>{nextLabel}</button>
      </div>
    </div>
  );
}
