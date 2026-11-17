'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { useT } from '@/lib/i18n';

export interface FlowStep {
  key: string;
  title: string;
  hint?: string;
  content: ReactNode;
  // Whether Continue can be pressed.
  ready: boolean;
  // Single-choice steps move on by themselves once a choice is made.
  auto?: boolean;
  value?: unknown;
}

// One question per screen. Progress is drawn as planets on an orbit, like
// the logo, and the buttons stay at the bottom within thumb reach.
export function StepFlow({ steps, finishLabel, onFinish, intro, footer }: { steps: FlowStep[]; finishLabel: string; onFinish: () => void; intro?: ReactNode; footer?: ReactNode }) {
  const t = useT();
  const [index, setIndex] = useState(0);
  const at = Math.min(index, steps.length - 1);
  const step = steps[at];
  const last = at === steps.length - 1;
  const top = useRef<HTMLDivElement>(null);

  // Move on after a single choice is tapped (not when arriving at a step
  // that already has an answer).
  const tapped = useRef(false);
  useEffect(() => {
    tapped.current = false;
  }, [step.key]);
  useEffect(() => {
    if (!tapped.current || !step.auto || last || !step.ready) return;
    const timer = setTimeout(() => {
      tapped.current = false;
      setIndex((i) => i + 1);
    }, 280);
    return () => clearTimeout(timer);
  }, [step.value, step.auto, step.ready, last]);

  useEffect(() => {
    top.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [at]);

  const next = () => (last ? onFinish() : setIndex(at + 1));

  return (
    <div ref={top} className="scroll-mt-20">
      {steps.length > 1 && <OrbitProgress count={steps.length} at={at} onPick={(i) => i < at && setIndex(i)} />}
      {at === 0 && intro}
      <div key={step.key} className="animate-rise">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">{t('flow.step', { n: at + 1, total: steps.length })}</p>
        <h2 className="mt-1.5 font-display text-2xl font-semibold text-ink">{step.title}</h2>
        {step.hint && <p className="mt-1 text-sm leading-relaxed text-muted">{step.hint}</p>}
        <div className="mt-5" onClickCapture={() => (tapped.current = true)}>{step.content}</div>
      </div>
      {footer}

      <div className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-line/70 bg-night/90 backdrop-blur-xl lg:static lg:mt-8 lg:border-0 lg:bg-transparent lg:pb-0 lg:backdrop-blur-none">
        <div className="mx-auto flex max-w-2xl gap-2 px-4 py-3 lg:px-0 lg:py-0">
          {at > 0 && (
            <button type="button" className="btn-ghost h-12 w-12 shrink-0 !p-0" onClick={() => setIndex(at - 1)} aria-label={t('common.back')}>
              <ArrowLeft size={18} />
            </button>
          )}
          <button type="button" className="btn-primary h-12 flex-1 text-base" disabled={!step.ready} onClick={next}>
            {last ? (
              <>
                <Sparkles size={18} /> {finishLabel}
              </>
            ) : (
              <>
                {t('common.continue')} <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function OrbitProgress({ count, at, onPick }: { count: number; at: number; onPick: (i: number) => void }) {
  return (
    <div className="mb-6 flex items-center" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`flex items-center ${i < count - 1 ? 'flex-1' : ''}`}>
          <button
            type="button"
            tabIndex={-1}
            onClick={() => onPick(i)}
            className={`relative h-3.5 w-3.5 shrink-0 rounded-full transition ${
              i < at ? 'bg-gold-soft' : i === at ? 'bg-gold ring-4 ring-gold/20' : 'border border-line bg-raised'
            }`}
          />
          {i < count - 1 && <div className={`h-px flex-1 transition ${i < at ? 'bg-gold/60' : 'bg-line'}`} />}
        </div>
      ))}
    </div>
  );
}
