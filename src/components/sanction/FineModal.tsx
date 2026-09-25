"use client";

import { useState } from "react";
import { AlertCircle, ImagePlus, Paperclip, Trash2, X } from "lucide-react";
import { Badge, Button, Input, Modal, useToast } from "@/components/ui";
import { errorMessage, http } from "@/lib/client/http";
import { fileToResizedDataUrl } from "@/lib/client/image";
import { FINE_STATUS_LABEL, formatMoney, PAYMENT_METHOD_LABEL } from "@/lib/labels";
import type { FineDTO } from "@/types/api";

interface Props {
  fine: FineDTO;
  onClose: () => void;
  /** Reload the list after any change (the modal stays open to show the new state). */
  onChanged: () => void;
}

/** One fine: what it is for, the payments received, and the form to register a new payment (or waive it). */
export function FineModal({ fine, onClose, onChanged }: Props) {
  return (
    <Modal open title={fine.type === "registration" ? "Cuota de inscripción" : "Multa"} onClose={onClose}>
      <FineDetail key={fine._id} fine={fine} onChanged={onChanged} onClose={onClose} />
    </Modal>
  );
}

function FineDetail({ fine, onChanged, onClose }: Props) {
  const toast = useToast();
  const balance = Math.max(0, fine.amount - fine.paidAmount);
  const open = fine.status === "pending" || fine.status === "partial";
  const [amount, setAmount] = useState(String(balance));
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");
  // Optional proof of payment: a photo or screenshot of the transfer/receipt.
  const [receipt, setReceipt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const state = FINE_STATUS_LABEL[fine.status];

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    try {
      await action();
      toast.success(success);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function pickReceipt(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      setReceipt(await fileToResizedDataUrl(file, 1600, "image/jpeg"));
      setError("");
    } catch {
      setError("No se pudo leer la imagen del comprobante");
    }
  }

  const pay = (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isInteger(value) || value < 1) {
      setError("Indica cuánto se pagó");
      return;
    }
    void run(async () => {
      await http(`/fines/${fine._id}/payments`, { json: { amount: value, method, note: note.trim() || undefined, receipt: receipt ?? undefined } });
      setNote("");
      setReceipt(null);
      // Suggest what is still owed after this payment.
      setAmount(String(Math.max(0, balance - value)));
    }, "Pago registrado");
  };

  return (
    <div className="stack">
      {error && <div className="alert error" role="alert"><AlertCircle size={18} /> {error}</div>}

      <div className="stack-sm">
        <div className="row-between">
          <strong>{fine.playerId?.fullName ?? fine.concept}</strong>
          <Badge tone={state.tone}>{state.label}</Badge>
        </div>
        <span className="text-secondary text-small">{fine.teamId.name} · {fine.concept}{fine.matchId && ` · ${fine.matchId.homeTeamId.name} vs ${fine.matchId.awayTeamId.name}`}</span>
        <div className="fine-figures">
          <div><span className="text-secondary text-small">Valor</span><strong>{formatMoney(fine.amount)}</strong></div>
          <div><span className="text-secondary text-small">Pagado</span><strong style={{ color: "var(--color-success)" }}>{formatMoney(fine.paidAmount)}</strong></div>
          <div><span className="text-secondary text-small">Debe</span><strong style={{ color: balance > 0 && open ? "var(--color-warning)" : undefined }}>{open ? formatMoney(balance) : formatMoney(0)}</strong></div>
        </div>
        {fine.eventVoided && (
          <div className="alert warning" role="note"><AlertCircle size={18} /> La tarjeta fue anulada pero ya había pagos. Si devuelves el dinero, elimina el pago para cerrar la multa.</div>
        )}
      </div>

      {fine.payments.length > 0 && (
        <section aria-label="Pagos recibidos">
          <h3 style={{ marginBottom: "var(--space-sm)" }}>Pagos recibidos</h3>
          <ul style={{ listStyle: "none" }} className="stack-sm">
            {fine.payments.map((payment) => (
              <li key={payment._id} className="row-between">
                <div style={{ minWidth: 0 }}>
                  <div className="text-strong">{formatMoney(payment.amount)} · {PAYMENT_METHOD_LABEL[payment.method]}</div>
                  <div className="text-secondary text-small">
                    {new Date(payment.paidAt).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })} · {payment.receivedBy}{payment.note && ` · ${payment.note}`}
                  </div>
                  {payment.receiptUrl && (
                    <a href={payment.receiptUrl} target="_blank" rel="noreferrer" className="text-small row" style={{ gap: 4, color: "var(--color-primary)" }}>
                      <Paperclip size={14} aria-hidden /> Ver comprobante
                    </a>
                  )}
                </div>
                <button className="icon-button" aria-label={`Eliminar pago de ${formatMoney(payment.amount)}`} title="Eliminar pago" disabled={busy}
                  onClick={() => run(() => http(`/fines/${fine._id}/payments/${payment._id}`, { method: "DELETE" }), "Pago eliminado")}>
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {open && (
        <form onSubmit={pay} className="stack" noValidate>
          <h3>Registrar pago</h3>
          <div className="form-grid two">
            <Input label="Valor recibido ($)" type="number" min={1} max={balance} step={1000} inputMode="numeric" required value={amount} onChange={(e) => setAmount(e.target.value)} hint={`Debe ${formatMoney(balance)}`} />
          </div>
          <div className="field">
            <span id="method-label" style={{ fontSize: 12, fontWeight: 500, color: "var(--color-label)" }}>Tipo de pago</span>
            <div className="phase-chips" style={{ marginBottom: 0, flexWrap: "wrap", overflow: "visible" }} role="radiogroup" aria-labelledby="method-label">
              {Object.entries(PAYMENT_METHOD_LABEL).map(([id, label]) => (
                <button key={id} type="button" role="radio" aria-checked={method === id} className={`phase-chip${method === id ? " active" : ""}`} onClick={() => setMethod(id)}>{label}</button>
              ))}
            </div>
          </div>
          <Input label="Nota (opcional)" value={note} onChange={(e) => setNote(e.target.value)} hint="Por ejemplo: quién pagó o el número de la transferencia." />
          <div className="field">
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-label)" }}>Comprobante (opcional)</span>
            {receipt ? (
              <div className="receipt-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={receipt} alt="Vista previa del comprobante" />
                <Button variant="ghost" size="small" icon={<X size={16} />} onClick={() => setReceipt(null)}>Quitar</Button>
              </div>
            ) : (
              <label className="btn secondary" style={{ cursor: "pointer" }}>
                <ImagePlus size={18} aria-hidden /> Adjuntar foto del comprobante
                <input type="file" accept="image/*" hidden onChange={pickReceipt} />
              </label>
            )}
            <span className="field-hint">Foto o captura de la transferencia o del recibo. No es obligatorio.</span>
          </div>
          <div className="action-bar">
            <Button variant="secondary" onClick={() => run(() => http(`/fines/${fine._id}/waive`, { json: {} }), "Multa perdonada")} disabled={busy}>Perdonar multa</Button>
            <Button type="submit" size="large" loading={busy}>Registrar pago</Button>
          </div>
        </form>
      )}

      {fine.status === "waived" && (
        <Button variant="secondary" loading={busy} onClick={() => run(() => http(`/fines/${fine._id}/reopen`, { json: {} }), "Multa reabierta")}>Reabrir multa</Button>
      )}
      {!open && <Button variant="ghost" onClick={onClose}>Cerrar</Button>}
    </div>
  );
}
