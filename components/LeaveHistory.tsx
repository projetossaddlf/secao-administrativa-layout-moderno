import React, { useMemo, useState } from "react";
import { db } from "../db";
import type { LeaveRecord, Personnel, LeaveType } from "../types";

type Props = {
  leaves: LeaveRecord[];
  personnel: Personnel[];
};

const fmtDate = (iso: string) => {
  if (!iso) return "—";
  // aceita "YYYY-MM-DD" ou ISO completo
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
};

const fmtDateTime = (iso: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR");
};

const norm = (s: any) => (s ?? "").toString().trim().toUpperCase();

const LeaveHistory: React.FC<Props> = ({ leaves, personnel }) => {
  const [q, setQ] = useState("");
  const [type, setType] = useState<LeaveType | "ALL">("ALL");

  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<LeaveRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const peopleById = useMemo(() => {
    const map = new Map<string, Personnel>();
    for (const p of personnel) map.set(p.id, p);
    return map;
  }, [personnel]);

  const allTypes = useMemo(() => {
    const set = new Set<string>();
    for (const l of leaves) set.add(l.type);
    return Array.from(set).sort() as LeaveType[];
  }, [leaves]);

  const filtered = useMemo(() => {
    const qq = norm(q);
    let base = leaves;

    if (type !== "ALL") base = base.filter((l) => l.type === type);

    if (qq) {
      base = base.filter((l) => {
        const p = peopleById.get(l.personnelId);
        const hay = [
          l.type,
          l.description,
          l.launchedBy,
          l.startDate,
          l.endDate,
          l.createdAt,
          p?.nome,
          p?.matr,
          p?.grad,
          p?.unid,
          p?.secao,
        ]
          .filter(Boolean)
          .map((x) => norm(x))
          .join(" ");
        return hay.includes(qq);
      });
    }

    // ordena por createdAt desc (mais recente primeiro)
    return [...base].sort((a, b) => {
      const ta = new Date(a.createdAt || 0).getTime();
      const tb = new Date(b.createdAt || 0).getTime();
      return tb - ta;
    });
  }, [leaves, peopleById, q, type]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-end gap-3 md:gap-4 mb-4">
        <div className="flex-1">
          <div className="text-base md:text-lg font-black text-slate-900">Histórico de Lançamentos</div>
          <div className="text-xs md:text-sm text-slate-500 font-semibold">
            Total: {filtered.length} lançamento(s)
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar (nome, matrícula, tipo, lançador...)"
            className="w-full sm:w-72 px-3 py-2 rounded-xl border border-slate-200 font-semibold text-slate-800"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            className="w-full sm:w-56 px-3 py-2 rounded-xl border border-slate-200 font-black text-slate-800"
          >
            <option value="ALL">Todos os tipos</option>
            {allTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-auto rounded-xl border border-slate-200">
        <table className="min-w-[1080px] w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left">
              <th className="px-3 py-2 font-black text-slate-700">Militar</th>
              <th className="px-3 py-2 font-black text-slate-700">Tipo</th>
              <th className="px-3 py-2 font-black text-slate-700">Período</th>
              <th className="px-3 py-2 font-black text-slate-700">Descrição</th>
              <th className="px-3 py-2 font-black text-slate-700">Lançado em</th>
              <th className="px-3 py-2 font-black text-slate-700">Lançado por</th>
              <th className="px-3 py-2 font-black text-slate-700">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-500 font-semibold">
                  Nenhum lançamento encontrado.
                </td>
              </tr>
            ) : (
              filtered.map((l) => {
                const p = peopleById.get(l.personnelId);
                const who = p ? `${p.grad} ${p.nome} (${p.matr})` : `ID: ${l.personnelId}`;
                const place = p ? `${p.unid || "—"} • ${p.secao || "—"}` : "—";
                return (
                  <tr key={l.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <div className="font-black text-slate-900">{who}</div>
                      <div className="text-xs text-slate-500 font-semibold">{place}</div>
                    </td>
                    <td className="px-3 py-2 font-black text-slate-800">{l.type}</td>
                    <td className="px-3 py-2 font-semibold text-slate-700">
                      {fmtDate(l.startDate)} → {fmtDate(l.endDate)}
                    </td>
                    <td className="px-3 py-2 text-slate-700 font-semibold">
                      {l.description?.trim() ? l.description : "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-700 font-semibold">{fmtDateTime(l.createdAt)}</td>
                    <td className="px-3 py-2 text-slate-700 font-black">{l.launchedBy || "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setEditDraft({ ...l }); setEditOpen(true); }}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 font-black text-slate-700 hover:bg-slate-100"
                          title="Editar"
                        >
                          <i className="fas fa-pen-to-square"></i>
                        </button>
                        <button
                          onClick={() => setDeletingId(l.id)}
                          className="px-3 py-1.5 rounded-lg border border-rose-200 font-black text-rose-600 hover:bg-rose-50"
                          title="Excluir"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

{/* Modals */}
{editOpen && editDraft && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
    <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <h3 className="text-xl font-black text-slate-900">Editar Lançamento</h3>
        <button onClick={() => { setEditOpen(false); setEditDraft(null); }} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white text-slate-400 transition-colors">
          <i className="fas fa-times"></i>
        </button>
      </div>
      <div className="p-6 max-h-[70vh] overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase mb-2">Tipo</label>
            <input
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold"
              value={editDraft.type}
              onChange={(e) => setEditDraft({ ...editDraft, type: e.target.value as any })}
            />
          </div>
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase mb-2">Período (início)</label>
            <input
              type="date"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold"
              value={(editDraft.startDate ?? "").slice(0, 10)}
              onChange={(e) => setEditDraft({ ...editDraft, startDate: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase mb-2">Período (fim)</label>
            <input
              type="date"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold"
              value={(editDraft.endDate ?? "").slice(0, 10)}
              onChange={(e) => setEditDraft({ ...editDraft, endDate: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase mb-2">Lançado por</label>
            <input
              className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl font-black text-slate-600"
              value={editDraft.launchedBy || "—"}
              readOnly
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-black text-slate-400 uppercase mb-2">Descrição</label>
            <textarea
              rows={3}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
              value={editDraft.description ?? ""}
              onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => { setEditOpen(false); setEditDraft(null); }}
            className="px-6 py-3 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={async () => {
              try {
                setSaving(true);
                await db.leaves.put(editDraft);
                setEditOpen(false);
                setEditDraft(null);
              } catch (e: any) {
                alert(e?.message ?? "Falha ao salvar.");
              } finally {
                setSaving(false);
              }
            }}
            className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  </div>
)}

{deletingId && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
    <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden">
      <div className="p-6 border-b border-slate-100 bg-slate-50/50">
        <h3 className="text-lg font-black text-slate-900">Confirmar exclusão</h3>
        <p className="text-sm text-slate-600 font-semibold mt-1">Deseja excluir este lançamento? Esta ação não pode ser desfeita.</p>
      </div>
      <div className="p-6 flex justify-end gap-3">
        <button
          onClick={() => setDeletingId(null)}
          className="px-6 py-3 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition-all"
        >
          Cancelar
        </button>
        <button
          onClick={async () => {
            try {
              setSaving(true);
              await db.leaves.delete(deletingId);
              setDeletingId(null);
            } catch (e: any) {
              alert(e?.message ?? "Falha ao excluir.");
            } finally {
              setSaving(false);
            }
          }}
          className="px-6 py-3 bg-rose-600 text-white rounded-2xl font-black hover:bg-rose-700 transition-all"
        >
          {saving ? "Excluindo..." : "Excluir"}
        </button>
      </div>
    </div>
  </div>
)}

      </div>
    </div>
  );
};

export default LeaveHistory;
