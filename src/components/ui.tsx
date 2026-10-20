import { useEffect, useRef, useState, type ReactNode } from 'react';
import { create } from 'zustand';
import { back } from '../lib/router';

// ---------- Icônes (traits arrondis, cohérentes) ----------
const PATHS: Record<string, ReactNode> = {
  home: <><path d="M4 11.5 12 5l8 6.5" /><path d="M6.5 10v9h11v-9" /><path d="M10 19v-5h4v5" /></>,
  calendar: <><rect x="4" y="5.5" width="16" height="14" rx="3" /><path d="M8 3.5v4M16 3.5v4M4 10h16" /></>,
  food: <><path d="M7 3.5v7a2 2 0 0 0 2 2v8M5 3.5v5M9 3.5v5" /><path d="M16.5 20.5v-17c-2 1-3 3.5-3 7 0 1.5.8 2.5 3 2.5" /></>,
  sport: <><circle cx="14" cy="5" r="1.8" /><path d="m7 21 3.5-5.5 3 2.5 1-5.5 3 2" /><path d="M9 10.5 12 8.5l3.5 1.5" /></>,
  chart: <><path d="M4 19.5h16" /><path d="m5 15 4.5-4.5 3.5 3L19.5 7" /><path d="M15.5 7h4v4" /></>,
  gear: <><path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="17" r="2" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  back: <path d="M15 5 8 12l7 7" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  left: <path d="M15 5 8 12l7 7" />,
  right: <path d="m9 5 7 7-7 7" />,
  bell: <><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>,
  drop: <path d="M12 3.5s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  snow: <><path d="M12 3v18M4.5 7.5l15 9M19.5 7.5l-15 9" /><path d="m9.5 4.5 2.5 2 2.5-2M9.5 19.5l2.5-2 2.5 2" /></>,
  fridge: <><rect x="6" y="3" width="12" height="18" rx="2.5" /><path d="M6 10h12M9 6v2M9 13v3" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  cart: <><path d="M3.5 4.5h2l2 11h10l2-8H7" /><circle cx="9.5" cy="19.5" r="1.3" /><circle cx="16.5" cy="19.5" r="1.3" /></>,
  pot: <><path d="M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" /><path d="M2.5 10h19M9 6.5c0-1 1-1.5 1-2.5M13 6.5c0-1 1-1.5 1-2.5" /></>,
  alert: <><path d="M12 4 2.8 19.5h18.4z" /><path d="M12 10v4.5M12 17.2v.3" /></>,
  trash: <><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" /></>,
  edit: <><path d="M4.5 19.5h4l10-10-4-4-10 10z" /><path d="m13 7 4 4" /></>,
  book: <><path d="M5 4.5h10a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3z" /><path d="M5 16.5a3 3 0 0 1 3-3h10" /></>,
  heart: <path d="M12 19.5s-7.5-4.5-7.5-10A4 4 0 0 1 12 7a4 4 0 0 1 7.5 2.5c0 5.5-7.5 10-7.5 10z" />,
  moon: <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5 7.5 7.5 0 1 0 19 14.5z" />,
  scale: <><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M9 10a3 3 0 0 1 6 0M12 10l1.2-1.5" /></>,
  euro: <><path d="M17 6.5a6 6 0 1 0 0 11" /><path d="M5 10.5h8M5 13.5h8" /></>,
  swap: <><path d="M5 8.5h13l-3.5-3.5M19 15.5H6l3.5 3.5" /></>,
  download: <><path d="M12 4v11m-4.5-4.5L12 15l4.5-4.5" /><path d="M5 19.5h14" /></>,
  upload: <><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" /><path d="M5 19.5h14" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8v.3" /></>,
  leaf: <><path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z" /><path d="M5 19 13 11" /></>,
  phone: <><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></>,
  share: <><path d="M12 15V3.5M8 7l4-3.5L16 7" /><path d="M7 10.5H5.5v10h13v-10H17" /></>,
  sparkle: <path d="M12 4c.6 3.7 2.3 5.4 6 6-3.7.6-5.4 2.3-6 6-.6-3.7-2.3-5.4-6-6 3.7-.6 5.4-2.3 6-6z" />,
  list: <path d="M8.5 7h11M8.5 12h11M8.5 17h11M4.5 7h.5M4.5 12h.5M4.5 17h.5" />,
  photo: <><rect x="3.5" y="5.5" width="17" height="13" rx="2.5" /><circle cx="9" cy="10.5" r="1.8" /><path d="m4 17 5-4.5 4 3.5 2.5-2 4.5 3.5" /></>,
  x: <path d="M6 6l12 12M18 6 6 18" />
};

export function Icon({ name, size = 22, label }: { name: keyof typeof PATHS | string; size?: number; label?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden={label ? undefined : true} role={label ? 'img' : undefined} aria-label={label}>
      {PATHS[name] ?? PATHS.info}
    </svg>
  );
}

// ---------- Illustration : fruits en aplat, façon affiche de marché ----------
export function FruitArt({ className }: { className?: string }) {
  const rays = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);
  return (
    <svg className={className} viewBox="0 0 200 200" aria-hidden>
      <path d="M150 128c22-30 44-34 46-34-2 20-14 44-46 34z" fill="#1f5a34" />
      <path d="M151 127 190 98" stroke="#163f25" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="112" cy="66" r="54" fill="#f7b32b" />
      <circle cx="112" cy="66" r="45" fill="#fbe39a" />
      {rays.map((a) => (
        <path key={a} d={`M112 66 L${112 + 42 * Math.cos(a)} ${66 + 42 * Math.sin(a)}`} stroke="#f7b32b" strokeWidth="4" strokeLinecap="round" />
      ))}
      <circle cx="112" cy="66" r="6" fill="#f7b32b" />
      <circle cx="66" cy="146" r="40" fill="#ef5a2f" />
      <path d="M66 112l6 9 11-3-6 9 9 7-11 1-2 10-7-8-8 6 1-10-10-5 10-3-2-11z" fill="#1f5a34" />
      <circle cx="150" cy="170" r="17" fill="#e0569b" />
      <path d="M150 153c0-8 4-13 9-15" stroke="#1f5a34" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// ---------- Mise en page ----------
export function Topbar({ title, sub, backTo, right }: { title: string; sub?: ReactNode; backTo?: string | true; right?: ReactNode }) {
  return (
    <header className="topbar">
      {backTo && (
        <button className="icon-btn" onClick={() => (backTo === true ? back() : (location.hash = backTo))} aria-label="Retour">
          <Icon name="back" />
        </button>
      )}
      <div className="grow">
        <h1>{title}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {right}
    </header>
  );
}

export function Card({ children, tint, className = '', ...rest }: { children: ReactNode; tint?: 'sage' | 'rose' | 'peach' | 'sky' | 'warn' | 'danger'; className?: string } & React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={`card ${tint ? `tint-${tint}` : ''} ${className}`} {...rest}>
      {children}
    </section>
  );
}

export function CardHead({ icon, title, right }: { icon?: string; title: ReactNode; right?: ReactNode }) {
  return (
    <div className="card-head">
      <div className="title">
        {icon && <span className="pastille"><Icon name={icon} size={20} /></span>}
        <h2>{title}</h2>
      </div>
      {right}
    </div>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; small?: boolean; block?: boolean; icon?: string };
export function Btn({ variant = 'primary', small, block, icon, children, className = '', ...rest }: BtnProps) {
  return (
    <button className={`btn ${variant} ${small ? 'small' : ''} ${block ? 'block' : ''} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={small ? 18 : 20} />}
      {children}
    </button>
  );
}

/** Bouton d'envoi jamais grisé : s'il manque quelque chose, il le dit juste en dessous au lieu de ne rien faire. */
export function SubmitBtn({ missing, onClick, ...rest }: BtnProps & { missing?: string | false }) {
  const [hint, setHint] = useState('');
  useEffect(() => {
    if (!missing) setHint('');
  }, [missing]);
  return (
    <div className="submit-wrap">
      <Btn {...rest} aria-describedby={hint ? undefined : rest['aria-describedby']} onClick={(e) => (missing ? setHint(missing) : onClick?.(e))} />
      {hint && <p className="field-hint" role="alert">{hint}</p>}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span />
    </label>
  );
}

export function ToggleRow({ checked, onChange, label, help }: { checked: boolean; onChange: (v: boolean) => void; label: string; help?: ReactNode }) {
  return (
    <div className="list-item">
      <div className="grow">
        <div>{label}</div>
        {help && <div className="small muted">{help}</div>}
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

export function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} className="check" onClick={() => onChange(!checked)}>
      <Icon name="check" size={18} />
    </button>
  );
}

export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      el.dataset.overflow = String(el.scrollWidth > el.clientWidth + 1);
      el.dataset.end = String(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => { el.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [value]);
  return (
    <div className="seg" role="group" aria-label={label} ref={ref}>
      {options.map((o) => (
        <button key={o.value} type="button" data-value={o.value} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Champ numérique tolérant (virgule ou point), validé à la sortie du champ. */
export function NumberField({ label, ariaLabel, value, onChange, suffix, step = 'any', min, max, placeholder }: { label?: string; ariaLabel?: string; value: number | undefined; onChange: (v: number | undefined) => void; suffix?: string; step?: string; min?: number; max?: number; placeholder?: string }) {
  const [text, setText] = useState(value == null ? '' : String(value).replace('.', ','));
  const [error, setError] = useState('');
  useEffect(() => {
    setText(value == null ? '' : String(value).replace('.', ','));
  }, [value]);
  const commit = () => {
    const t = text.trim().replace(',', '.');
    if (t === '') {
      setError('');
      onChange(undefined);
      return;
    }
    const n = Number(t);
    if (!Number.isFinite(n)) return setError('Écris un nombre, par exemple 68,5.');
    if (min != null && n < min) return setError(`Indique au moins ${String(min).replace('.', ',')}.`);
    if (max != null && n > max) return setError(`Indique au plus ${String(max).replace('.', ',')}.`);
    setError('');
    onChange(n);
  };
  const input = (
    <div className="input-suffix">
      <input className="input" inputMode="decimal" value={text} step={step} placeholder={placeholder} aria-label={label ? undefined : ariaLabel} aria-invalid={!!error} onFocus={() => setError('')} onChange={(e) => { setError(''); setText(e.target.value); }} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
      {suffix && <span>{suffix}</span>}
    </div>
  );
  return label ? (
    <label className="field">
      {label}
      {input}
      {error && <span className="field-hint" role="alert">{error}</span>}
    </label>
  ) : (
    <>
      {input}
      {error && <span className="field-hint" role="alert">{error}</span>}
    </>
  );
}

export function TimeField({ label, value, onChange }: { label: string; value: string | undefined; onChange: (v: string) => void }) {
  return (
    <label className="field">
      {label}
      <input className="input" type="time" value={value ?? ''} onChange={(e) => e.target.value && onChange(e.target.value)} />
    </label>
  );
}

export function TextField({ label, value, onChange, placeholder, multiline, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; type?: string }) {
  return (
    <label className="field">
      {label}
      {multiline ? (
        <textarea className="input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className="input" type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

export function Stepper({ value, onChange, min = 0, max = 99, step = 1, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; label: string }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(min, +(value - step).toFixed(2)))} aria-label="Diminuer">−</button>
      <span>{String(value).replace('.', ',')}</span>
      <button type="button" onClick={() => onChange(Math.min(max, +(value + step).toFixed(2)))} aria-label="Augmenter">+</button>
    </div>
  );
}

export function Progress({ value, max, tone }: { value: number; max: number; tone?: 'rose' | 'over' }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  return (
    <div className={`progress ${tone ?? ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)}>
      <div style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Ring({ value, max, children, color = 'var(--sage)' }: { value: number; max: number; children: ReactNode; color?: string }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, max > 0 ? value / max : 0);
  return (
    <div className="ring">
      <svg width="92" height="92" viewBox="0 0 92 92" aria-hidden>
        <circle cx="46" cy="46" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="9" />
        <circle cx="46" cy="46" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: 'stroke-dashoffset .5s' }} />
      </svg>
      <div className="ring-label">{children}</div>
    </div>
  );
}

export function Provisional({ show = true }: { show?: boolean }) {
  return show ? <span className="badge-provisoire">provisoire</span> : null;
}

export function Empty({ children }: { icon?: string; children: ReactNode }) {
  return (
    <div className="empty">
      <FruitArt className="empty-art" />
      {children}
    </div>
  );
}

// ---------- Feuille modale (bas d'écran) ----------
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (useConfirmStore.getState().req) return;
      if (e.key === 'Escape') onClose();
      else trapTab(e, ref.current);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn plain" onClick={onClose} aria-label="Fermer">
            <Icon name="x" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------- Messages éphémères ----------
const useToastStore = create<{ msg?: string; id: number }>(() => ({ id: 0 }));
export function toast(msg: string) {
  const id = useToastStore.getState().id + 1;
  useToastStore.setState({ msg, id });
  setTimeout(() => {
    if (useToastStore.getState().id === id) useToastStore.setState({ msg: undefined });
  }, 2600);
}
export function ToastHost() {
  const msg = useToastStore((s) => s.msg);
  return msg ? (
    <div className="toast" role="status" aria-live="polite">
      {msg}
    </div>
  ) : null;
}

// ---------- Confirmation : nomme ce qui est concerné, bouton à verbe, « Annuler » par défaut ----------
interface ConfirmRequest { title: string; body?: string; confirm: string; danger?: boolean; resolve: (ok: boolean) => void }
const useConfirmStore = create<{ req?: ConfirmRequest }>(() => ({}));

export function confirmAsk(opts: { title: string; body?: string; confirm: string; danger?: boolean }): Promise<boolean> {
  return new Promise((resolve) => useConfirmStore.setState({ req: { ...opts, resolve } }));
}

/** Garde le focus dans un panneau modal (Tab et Maj+Tab bouclent). */
function trapTab(e: KeyboardEvent, root: HTMLElement | null) {
  if (e.key !== 'Tab' || !root) return;
  const items = [...root.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && (document.activeElement === first || document.activeElement === root)) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

export function ConfirmHost() {
  const req = useConfirmStore((s) => s.req);
  const ref = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!req) return;
    const prev = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(false); }
      else trapTab(e, ref.current);
    };
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('keydown', onKey, true); prev?.focus?.(); };
  }, [req]);
  if (!req) return null;
  function close(ok: boolean) {
    useConfirmStore.setState({ req: undefined });
    req!.resolve(ok);
  }
  return (
    <div className="confirm-backdrop" onClick={(e) => e.target === e.currentTarget && close(false)}>
      <div className="confirm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby={req.body ? 'confirm-body' : undefined} ref={ref}>
        <h2 id="confirm-title">{req.title}</h2>
        {req.body && <p id="confirm-body" className="small muted">{req.body}</p>}
        <div className="grid2">
          <button ref={cancelRef} type="button" className="btn ghost" onClick={() => close(false)}>Annuler</button>
          <button type="button" className={`btn ${req.danger ? 'destructive' : ''}`} onClick={() => close(true)}>{req.confirm}</button>
        </div>
      </div>
    </div>
  );
}
