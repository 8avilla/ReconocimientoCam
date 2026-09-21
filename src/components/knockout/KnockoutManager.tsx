"use client";

import { useState } from "react";
import { CalendarPlus, Pencil, Plus, Swords, Trash2, Users } from "lucide-react";
import { FixtureModal } from "@/components/match/FixtureModal";
import { RoundFormModal } from "@/components/knockout/RoundFormModal";
import { TieCard } from "@/components/knockout/TieCard";
import { TiesEditorModal } from "@/components/knockout/TiesEditorModal";
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, Loading, PageHeader, useToast } from "@/components/ui";
import { errorMessage, http } from "@/lib/client/http";
import { useRole } from "@/components/layout/RoleContext";
import { useFetch } from "@/lib/client/useFetch";
import { LEGS_LABEL } from "@/lib/labels";
import type { BracketDTO, BracketRoundDTO } from "@/types/api";

type Dialog =
  | { kind: "round"; round: BracketRoundDTO | null }
  | { kind: "ties" | "fixture" | "delete"; round: BracketRoundDTO }
  | null;

/**
 * Knockout phase: the organizer defines the rounds, the ties, the matches and who advances.
 * Every automation (draw, seeding, scheduling, winner hint) is an optional button.
 */
export function KnockoutManager({ phaseId }: { phaseId: string }) {
  const toast = useToast();
  const manage = useRole().can("championship.manage");
  const bracket = useFetch<BracketDTO>(`/phases/${phaseId}/bracket`);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [deleting, setDeleting] = useState(false);

  if (bracket.error) return <ErrorState message={bracket.error.message} onRetry={bracket.reload} />;
  if (!bracket.data) return <Loading />;
  const data = bracket.data;
  const close = () => setDialog(null);
  const saved = () => {
    close();
    bracket.reload();
  };

  async function confirmDelete() {
    if (dialog?.kind !== "delete") return;
    setDeleting(true);
    try {
      await http(`/phases/${phaseId}/rounds/${dialog.round._id}`, { method: "DELETE" });
      toast.success("Ronda eliminada");
      saved();
    } catch (error) {
      toast.error(errorMessage(error));
      close();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHeader
        title={data.phase.name}
        description="Eliminatoria: tú defines las rondas, los cruces y quién avanza."
        breadcrumb={[{ label: "Campeonatos", href: "/championships" }, { label: "Fases", href: `/championships/${data.phase.championshipId}` }, { label: data.phase.name }]}
        actions={manage && <Button icon={<Plus size={18} />} onClick={() => setDialog({ kind: "round", round: null })}>Nueva ronda</Button>}
        mobileActions={manage ? [{ label: "Nueva ronda", icon: <Plus size={20} />, onClick: () => setDialog({ kind: "round", round: null }) }] : undefined}
      />

      {data.rounds.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Swords size={28} />}
            title="Aún no hay rondas"
            description="Crea las rondas en el orden en que se juegan (por ejemplo cuartos, semifinal y final) y elige en cada una si es partido único o ida y vuelta."
            action={manage && <Button onClick={() => setDialog({ kind: "round", round: null })}>Crear la primera ronda</Button>}
          />
        </div>
      ) : (
        <div className="row" style={{ alignItems: "flex-start", overflowX: "auto", gap: "var(--space-lg)", paddingBottom: "var(--space-lg)" }}>
          {data.rounds.map((round) => (
            <section key={round._id} className="stack" style={{ minWidth: 300, flex: "1 0 300px" }} aria-label={round.name}>
              <div className="card stack-sm">
                <div className="row-between">
                  <h2 style={{ fontSize: 18 }}>{round.name}</h2>
                  {manage && <div className="row">
                    <button className="icon-button" onClick={() => setDialog({ kind: "round", round })} aria-label={`Editar ${round.name}`} title="Editar"><Pencil size={18} /></button>
                    <button className="icon-button" onClick={() => setDialog({ kind: "delete", round })} aria-label={`Eliminar ${round.name}`} title="Eliminar"><Trash2 size={18} /></button>
                  </div>}
                </div>
                <div className="row-wrap"><Badge>{LEGS_LABEL[round.legs]}</Badge><Badge tone={round.ties.length ? "info" : "warning"}>{round.ties.length} cruces</Badge></div>
                {manage && <div className="row-wrap">
                  <Button variant="secondary" size="small" icon={<Users size={16} />} onClick={() => setDialog({ kind: "ties", round })}>Cruces</Button>
                  <Button variant="secondary" size="small" icon={<CalendarPlus size={16} />} disabled={!round.ties.some((tie) => !tie.bye)} onClick={() => setDialog({ kind: "fixture", round })}>Crear partidos</Button>
                </div>}
              </div>
              {round.ties.length === 0 && <p className="text-secondary text-small" style={{ textAlign: "center" }}>Sin cruces todavía.</p>}
              {round.ties.map((tie) => <TieCard key={tie._id} tie={tie} round={round} onChanged={bracket.reload} />)}
            </section>
          ))}
        </div>
      )}

      <RoundFormModal open={dialog?.kind === "round"} phaseId={phaseId} round={dialog?.kind === "round" ? dialog.round : null} onClose={close} onSaved={saved} />
      {dialog?.kind === "ties" && (
        <TiesEditorModal open bracket={data} round={dialog.round} previousRound={data.rounds[data.rounds.findIndex((entry) => entry._id === dialog.round._id) - 1]} onClose={close} onSaved={saved} />
      )}
      {dialog?.kind === "fixture" && (
        <FixtureModal
          open
          championshipId={data.phase.championshipId}
          phases={[]}
          target={{
            endpoint: `/phases/${phaseId}/rounds/${dialog.round._id}/fixture`,
            title: `Crear partidos · ${dialog.round.name}`,
            note: `Opcional: crea de una vez los ${dialog.round.legs === 2 ? "partidos de ida y de vuelta" : "partidos"} de todos los cruces, sin día ni hora (los programas después). También puedes agregarlos uno a uno en cada cruce.`,
          }}
          onClose={close}
          onCreated={saved}
        />
      )}
      <ConfirmDialog
        open={dialog?.kind === "delete"}
        title="Eliminar ronda"
        message={`¿Eliminar "${dialog?.kind === "delete" ? dialog.round.name : ""}" y sus cruces? Solo es posible si aún no tiene partidos.`}
        confirmLabel="Eliminar"
        loading={deleting}
        onConfirm={confirmDelete}
        onClose={close}
      />
    </>
  );
}
