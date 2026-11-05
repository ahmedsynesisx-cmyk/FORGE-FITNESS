import { useId, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'dark' | 'outline' | 'danger';
const variants: Record<Variant, string> = {
  primary: 'bg-gold text-charcoal disabled:bg-line disabled:text-slate',
  dark: 'bg-charcoal text-white disabled:bg-line disabled:text-slate',
  outline: 'bg-white text-charcoal border-[1.5px] border-charcoal disabled:border-line disabled:text-slate',
  danger: 'bg-white text-danger border-[1.5px] border-danger',
};

export function Button({ variant = 'primary', className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...rest}
      className={`min-h-[52px] w-full rounded-2xl px-4 text-base font-bold transition-colors disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    />
  );
}

export function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: 'text' | 'number' | 'time' | 'password';
  hint?: string;
  error?: string | null;
  placeholder?: string;
  inputMode?: 'numeric' | 'decimal' | 'text';
  autoComplete?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {props.label}
      </label>
      <input
        id={id}
        type={props.type ?? 'text'}
        value={props.value}
        inputMode={props.inputMode}
        placeholder={props.placeholder}
        autoComplete={props.autoComplete ?? 'off'}
        aria-invalid={!!props.error}
        aria-describedby={props.hint || props.error ? id + '-hint' : undefined}
        onChange={(e) => props.onChange(e.target.value)}
        className={`h-12 rounded-xl border-[1.5px] bg-white px-3.5 text-base font-medium outline-none focus:border-charcoal ${props.error ? 'border-danger' : 'border-line'}`}
      />
      {(props.error || props.hint) && (
        <span id={id + '-hint'} className={`text-xs ${props.error ? 'font-semibold text-danger' : 'text-slate'}`}>
          {props.error || props.hint}
        </span>
      )}
    </div>
  );
}

export function Choices<T extends string>(props: { label?: string; options: { value: T; label: string }[]; value: T | T[] | null; onChange: (v: T) => void; multi?: boolean }) {
  const selected = (v: T) => (Array.isArray(props.value) ? props.value.includes(v) : props.value === v);
  return (
    <fieldset className="flex flex-col gap-2">
      {props.label && <legend className="mb-2 text-sm font-semibold">{props.label}</legend>}
      <div className="flex flex-wrap gap-2">
        {props.options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={selected(o.value)}
            onClick={() => props.onChange(o.value)}
            className={`min-h-[44px] rounded-full px-4 text-sm font-semibold ${selected(o.value) ? 'bg-charcoal text-white' : 'border-[1.5px] border-line bg-white text-charcoal'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function YesNo(props: { question: string; value: boolean | undefined | null; onChange: (v: boolean) => void }) {
  const opt = (v: boolean, label: string) => (
    <button
      type="button"
      aria-pressed={props.value === v}
      onClick={() => props.onChange(v)}
      className={`min-h-[44px] flex-1 rounded-xl text-sm font-bold ${props.value === v ? 'bg-charcoal text-white' : 'border-[1.5px] border-line bg-white'}`}
    >
      {label}
    </button>
  );
  return (
    <div role="group" aria-label={props.question} className="flex flex-col gap-2.5 rounded-2xl border-[1.5px] border-line p-3.5">
      <span className="text-sm font-semibold leading-snug">{props.question}</span>
      <div className="flex gap-2">
        {opt(true, 'Yes')}
        {opt(false, 'No')}
      </div>
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[20px] border border-line bg-white p-4 ${className}`}>{children}</div>;
}

const tones = {
  info: { box: 'bg-butter', icon: '#8A6400' },
  caution: { box: 'bg-cautionbg', icon: '#A85400' },
  danger: { box: 'bg-dangerbg', icon: '#C0262D' },
  good: { box: 'bg-goodbg', icon: '#1B7A43' },
};

export function Notice({ tone = 'info', title, children }: { tone?: keyof typeof tones; title?: string; children: ReactNode }) {
  const t = tones[tone];
  return (
    <div role={tone === 'danger' ? 'alert' : undefined} className={`flex gap-3 rounded-2xl p-4 text-sm leading-relaxed ${t.box}`}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.icon} strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="mt-0.5 shrink-0">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16h.01" />
      </svg>
      <div className="flex flex-col gap-1">
        {title && <strong className="text-sm">{title}</strong>}
        <div>{children}</div>
      </div>
    </div>
  );
}

export function Page({ title, subtitle, children, footer, onBack, progress }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode; onBack?: () => void; progress?: number }) {
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col bg-white">
      {(onBack || progress !== undefined) && (
        <div className="flex items-center gap-3 px-5 pb-2 pt-5">
          {onBack && (
            <button type="button" aria-label="Back" onClick={onBack} className="flex h-11 w-11 items-center justify-center rounded-xl border-[1.5px] border-line">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1C1C1E" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}
          {progress !== undefined && (
            <div className="h-1.5 flex-1 overflow-hidden rounded bg-line" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Setup progress">
              <div className="h-1.5 rounded bg-gold" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          )}
        </div>
      )}
      <main className="flex flex-1 flex-col gap-4 px-6 pb-6 pt-3">
        <h1 className="text-[26px] font-extrabold leading-tight tracking-tight">{title}</h1>
        {subtitle && <p className="-mt-2 text-[15px] leading-relaxed text-slate">{subtitle}</p>}
        {children}
      </main>
      {footer && <div className="sticky bottom-0 flex flex-col gap-2 bg-white px-6 pb-6 pt-2">{footer}</div>}
    </div>
  );
}

export function num(s: string): number | null {
  if (s.trim() === '') return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
