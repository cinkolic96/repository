import { useEffect, type ReactNode } from 'react';
import { fmtMoney } from '../lib/calc';
import { useDB } from '../lib/store';
import type { RentalStatus } from '../lib/types';
import { rentalStatusLabels } from '../lib/labels';

export function Money({ value, colored }: { value: number; colored?: boolean }) {
  const { settings } = useDB();
  const cls = colored ? (value < 0 ? 'money-neg' : value > 0 ? 'money-pos' : '') : '';
  return <span className={cls}>{fmtMoney(value, settings.currency)}</span>;
}

export function useMoney() {
  const { settings } = useDB();
  return (n: number) => fmtMoney(n, settings.currency);
}

export function Field({ label, help, children, full }: { label: string; help?: string; children: ReactNode; full?: boolean }) {
  return (
    <div className={'field' + (full ? ' full' : '')}>
      <label>
        {label}
        {children}
      </label>
      {help && <div className="help">{help}</div>}
    </div>
  );
}

export function StatusBadge({ status, late }: { status: RentalStatus; late?: boolean }) {
  if (late) return <span className="badge bad">Kasni povrat</span>;
  const cls = { rezervisano: 'info', aktivno: 'good', zavrseno: 'neutral', otkazano: 'bad' }[status];
  return <span className={'badge ' + cls}>{rentalStatusLabels[status]}</span>;
}

export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn small" onClick={onClose} aria-label="Zatvori">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function PageHead({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

export function num(v: string): number {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export function optNum(v: string): number | undefined {
  if (v.trim() === '') return undefined;
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}
