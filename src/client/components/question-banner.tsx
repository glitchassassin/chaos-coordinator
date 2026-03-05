import { useState } from "preact/hooks";
import type { QuestionRequest, QuestionInfo } from "../types.js";

interface Props {
  questions: QuestionRequest[];
  onReply: (requestId: string, answers: string[][]) => void;
  onReject: (requestId: string) => void;
}

export function QuestionBanner({ questions, onReply, onReject }: Props) {
  if (questions.length === 0) return null;

  return (
    <div class="question-stack">
      {questions.map((req) => (
        <QuestionPanel key={req.id} request={req} onReply={onReply} onReject={onReject} />
      ))}
    </div>
  );
}

interface PanelProps {
  request: QuestionRequest;
  onReply: (requestId: string, answers: string[][]) => void;
  onReject: (requestId: string) => void;
}

function QuestionPanel({ request, onReply, onReject }: PanelProps) {
  const [answers, setAnswers] = useState<string[][]>(() =>
    request.questions.map(() => []),
  );
  const [step, setStep] = useState(0);
  const [customInput, setCustomInput] = useState("");

  const q: QuestionInfo = request.questions[step];
  const isLast = step === request.questions.length - 1;
  const isMulti = q.multiple === true;
  const allowCustom = q.custom !== false;

  function advance(newAnswers: string[][]) {
    if (isLast) {
      onReply(request.id, newAnswers);
    } else {
      setAnswers(newAnswers);
      setStep(step + 1);
      setCustomInput("");
    }
  }

  function pickOption(label: string) {
    const next = answers.map((a, i) => (i === step ? [...a] : a));
    if (isMulti) {
      const cur = next[step];
      const idx = cur.indexOf(label);
      if (idx === -1) cur.push(label);
      else cur.splice(idx, 1);
      setAnswers(next);
    } else {
      next[step] = [label];
      advance(next);
    }
  }

  function submitCustom() {
    const val = customInput.trim();
    if (!val) return;
    if (isMulti) {
      const next = answers.map((a, i) => (i === step ? [...a] : a));
      if (!next[step].includes(val)) next[step].push(val);
      setAnswers(next);
      setCustomInput("");
    } else {
      const next = answers.map((a, i) => (i === step ? [val] : a));
      advance(next);
    }
  }

  function handleCustomKey(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      submitCustom();
    }
  }

  const stepAnswers = answers[step] ?? [];

  return (
    <div class="question-banner">
      <button class="question-dismiss" onClick={() => onReject(request.id)}>
        Dismiss
      </button>
      <div class="question-meta">
        <span class="question-header-label">{q.header}</span>
        {request.questions.length > 1 && (
          <span class="question-step">
            {step + 1} / {request.questions.length}
          </span>
        )}
      </div>
      <p class="question-text">
        {q.question}
        {isMulti && " (select all that apply)"}
      </p>
      <div class="question-options">
        {q.options.map((opt) => {
          const picked = stepAnswers.includes(opt.label);
          return (
            <button
              key={opt.label}
              class={`question-option${picked ? " question-option--picked" : ""}`}
              onClick={() => pickOption(opt.label)}
            >
              <span class="question-option-label">
                {isMulti && (
                  <span class="question-checkbox" aria-hidden="true">
                    {picked ? "✓" : "○"}
                  </span>
                )}{" "}
                {opt.label}
              </span>
              {opt.description && (
                <span class="question-option-desc">{opt.description}</span>
              )}
            </button>
          );
        })}
        {allowCustom && (
          <div class="question-custom">
            <input
              type="text"
              class="question-custom-input"
              value={customInput}
              onInput={(e) =>
                setCustomInput((e.target as HTMLInputElement).value)
              }
              onKeyDown={handleCustomKey}
              placeholder="Type your own answer…"
            />
            <button
              class="btn btn-icon"
              onClick={submitCustom}
              disabled={!customInput.trim()}
              aria-label="Use"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M21 10.5C21 14.64 17.64 18 13.5 18H11V22L4 16L11 10V14H13.5C15.43 14 17 12.43 17 10.5V3H21V10.5Z" />
              </svg>
            </button>
          </div>
        )}
      </div>
      {isMulti && (
        <div class="question-actions">
          <button
            class="btn btn-primary"
            onClick={() => advance(answers)}
            disabled={stepAnswers.length === 0}
          >
            {isLast ? "Submit" : "Next"}
          </button>
        </div>
      )}
    </div>
  );
}
