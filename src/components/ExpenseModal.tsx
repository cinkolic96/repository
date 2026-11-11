import { useState } from 'react';
import { Field, Modal, num } from './ui';
import { isoDate, isoDateTime } from '../lib/calc';
import { expenseLabels } from '../lib/labels';
import { saveExpense, uid, useDB } from '../lib/store';
import type { Expense, ExpenseCategory } from '../lib/types';

export default function ExpenseModal({ initial, vehicleId, onClose }: { initial?: Expense; vehicleId?: string; onClose: () => void }) {
  const db = useDB();
  const [e, setE] = useState<Expense>(
    () => initial ?? { id: uid(), date: isoDate(), category: 'servis', amount: 0, vehicleId, createdAt: isoDateTime() },
  );
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const up = (p: Partial<Expense>) => setE((x) => ({ ...x, ...p }));
  return (
    <Modal
      title={initial ? 'Izmjena troška' : 'Novi trošak'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Odustani</button>
          <button
            className="btn primary"
            onClick={() => {
              if (num(amount) <= 0) return alert('Unesite iznos.');
              saveExpense({ ...e, amount: num(amount) });
              onClose();
            }}
          >
            Sačuvaj
          </button>
        </>
      }
    >
      <div className="form">
        <Field label="Kategorija">
          <select value={e.category} onChange={(ev) => up({ category: ev.target.value as ExpenseCategory })}>
            {Object.entries(expenseLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        <Field label="Iznos *"><input inputMode="decimal" value={amount} onChange={(ev) => setAmount(ev.target.value)} autoFocus /></Field>
        <Field label="Datum"><input type="date" value={e.date} onChange={(ev) => up({ date: ev.target.value })} /></Field>
        <Field label="Vozilo">
          <select value={e.vehicleId ?? ''} onChange={(ev) => up({ vehicleId: ev.target.value || undefined })}>
            <option value="">— opšti trošak agencije —</option>
            {db.vehicles.map((v) => <option key={v.id} value={v.id}>{v.make} {v.model} · {v.plate}</option>)}
          </select>
        </Field>
        <Field label="Dobavljač / servis"><input value={e.vendor ?? ''} onChange={(ev) => up({ vendor: ev.target.value })} /></Field>
        <Field label="Opis" full><textarea value={e.description ?? ''} onChange={(ev) => up({ description: ev.target.value })} /></Field>
      </div>
    </Modal>
  );
}
