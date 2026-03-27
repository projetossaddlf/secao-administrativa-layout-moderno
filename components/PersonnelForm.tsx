import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Personnel } from "../types";
import { db } from "../db";

type Props = {
  personnel: Personnel[];
  onChange: (updater: (prev: Personnel[]) => Personnel[]) => void;
  onReload: () => Promise<void>;
};

const normalizeMatricula = (raw: any) => (raw ?? "").toString().trim().replace(/\D/g, "");

const PersonnelForm: React.FC<Props> = ({ personnel, onChange, onReload }) => {
  const editorRef = useRef<HTMLDivElement | null>(null);

  const [editing, setEditing] = useState<Personnel | null>(null);
  const [search, setSearch] = useState("");

  // ✅ UX: ao clicar em "Editar" / "Novo", rola automaticamente até o bloco do editor
  useEffect(() => {
    if (!editing) return;
    // aguarda o render do editor
    setTimeout(() => {
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }, [editing]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return personnel;
    return personnel.filter((p) => {
      return (
        (p.nome ?? "").toLowerCase().includes(q) ||
        (p.matr ?? "").toString().includes(q) ||
        (p.unid ?? "").toLowerCase().includes(q) ||
        (p.secao ?? "").toLowerCase().includes(q)
      );
    });
  }, [personnel, search]);

  const startNew = () => {
    setEditing({
      id: "",
      matr: "",
      nome: "",
      role: "USER",
      situacao: "ATIVO",
      unid: "",
      secao: "",
      grad: "",
      ant: 0,
      ativo: true,
      matr_norm: "",
      restr: "",
      pttc: false,
      quadro: "",
      funcao: "",
    } as any);
  };

  const startEdit = (p: Personnel) => {
    // copia para edição
    setEditing({ ...(p as any) });
  };

  const cancel = () => setEditing(null);

  const save = async () => {
    if (!editing) return;

    const payload: any = { ...editing };
    payload.matr = normalizeMatricula(payload.matr);
    payload.matr_norm = payload.matr_norm ? normalizeMatricula(payload.matr_norm) : payload.matr;

    // remove lixo
    if (!payload.id) delete payload.id;

    try {
      let saved: Personnel;

      if (payload.id) {
        // atualização por UUID (permite alterar matr sem quebrar)
        saved = await db.personnel.put(payload as Personnel);
      } else {
        saved = await db.personnel.add(payload as Personnel);
      }

      onChange((prev) => {
        const idx = prev.findIndex((x) => x.id === saved.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = saved;
          return copy;
        }
        return [saved, ...prev];
      });

      setEditing(null);
      await onReload();
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Falha ao salvar cadastro.");
    }
  };

  const remove = async (p: Personnel) => {
    if (!confirm(`Excluir ${p.nome} (${p.matr})?`)) return;
    try {
      await db.personnel.remove(p.id);
      onChange((prev) => prev.filter((x) => x.id !== p.id));
      await onReload();
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Falha ao excluir cadastro.");
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div>
            <div className="text-base md:text-lg font-black text-slate-800">Efetivo</div>
            <div className="text-xs text-slate-500 font-semibold">
              Cadastros: <span className="font-black">{personnel.length}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, matrícula, unidade..."
              className="w-full sm:w-80 px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-800"
            />

            <button
              onClick={startNew}
              className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-black hover:bg-slate-800"
            >
              Novo
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-black text-slate-500 uppercase">
                <th className="px-4 py-3">Matrícula</th>
                <th className="px-4 py-3">Patente</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Unidade</th>
                <th className="px-4 py-3">Seção</th>
                <th className="px-4 py-3">Situação</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.map((p) => (
                <tr key={p.id || p.matr} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-bold text-slate-800">{p.matr}</td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{p.grad}</td>
                  <td className="px-4 py-3 font-bold text-slate-900 uppercase">{p.nome}</td>
                  <td className="px-4 py-3 text-slate-700 font-semibold uppercase">{p.unid}</td>
                  <td className="px-4 py-3 text-slate-600 font-semibold uppercase">{p.secao}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-[10px] font-black border uppercase ${
                        (p.situacao ?? "").toUpperCase() === "ATIVO"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                          : "bg-slate-50 text-slate-600 border-slate-200"
                      }`}
                    >
                      {p.situacao ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-2">
                      <button
                        onClick={() => startEdit(p)}
                        className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-black hover:bg-slate-50"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => remove(p)}
                        className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-black hover:bg-red-700"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-400 italic font-medium">
                    Nenhum cadastro encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Editor */}
      {editing && (
        <div ref={editorRef} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <div className="text-base md:text-lg font-black text-slate-800">
              {editing.id ? "Editar Cadastro" : "Novo Cadastro"}
            </div>
            <div className="flex gap-2">
              <button
                onClick={cancel}
                className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs md:text-sm font-black hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={save}
                className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs md:text-sm font-black hover:bg-blue-700"
              >
                Salvar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <div className="text-[10px] font-black uppercase text-slate-500 mb-1">Matrícula</div>
              <input
                value={(editing as any).matr ?? ""}
                onChange={(e) => setEditing((p) => ({ ...(p as any), matr: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold"
              />
            </div>

            <div>
              <div className="text-[10px] font-black uppercase text-slate-500 mb-1">Patente</div>
              <input
                value={(editing as any).grad ?? ""}
                onChange={(e) => setEditing((p) => ({ ...(p as any), grad: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold"
              />
            </div>

            <div>
              <div className="text-[10px] font-black uppercase text-slate-500 mb-1">Antiguidade</div>
              <input
                value={(editing as any).ant ?? 0}
                onChange={(e) => setEditing((p) => ({ ...(p as any), ant: Number(e.target.value) }))}
                type="number"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold"
              />
            </div>

            <div className="md:col-span-3">
              <div className="text-[10px] font-black uppercase text-slate-500 mb-1">Nome</div>
              <input
                value={(editing as any).nome ?? ""}
                onChange={(e) => setEditing((p) => ({ ...(p as any), nome: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold"
              />
            </div>

            <div>
              <div className="text-[10px] font-black uppercase text-slate-500 mb-1">Unidade</div>
              <input
                value={(editing as any).unid ?? ""}
                onChange={(e) => setEditing((p) => ({ ...(p as any), unid: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold"
              />
            </div>

            <div>
              <div className="text-[10px] font-black uppercase text-slate-500 mb-1">Seção</div>
              <input
                value={(editing as any).secao ?? ""}
                onChange={(e) => setEditing((p) => ({ ...(p as any), secao: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold"
              />
            </div>

            <div>
              <div className="text-[10px] font-black uppercase text-slate-500 mb-1">Situação</div>
              <input
                value={(editing as any).situacao ?? ""}
                onChange={(e) => setEditing((p) => ({ ...(p as any), situacao: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold"
              />
            </div>

            <div>
              <div className="text-[10px] font-black uppercase text-slate-500 mb-1">Role</div>
              <input
                value={(editing as any).role ?? "USER"}
                onChange={(e) => setEditing((p) => ({ ...(p as any), role: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold"
              />
            </div>

            <div>
              <div className="text-[10px] font-black uppercase text-slate-500 mb-1">Quadro</div>
              <input
                value={(editing as any).quadro ?? ""}
                onChange={(e) => setEditing((p) => ({ ...(p as any), quadro: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold"
              />
            </div>

            <div>
              <div className="text-[10px] font-black uppercase text-slate-500 mb-1">Função</div>
              <input
                value={(editing as any).funcao ?? ""}
                onChange={(e) => setEditing((p) => ({ ...(p as any), funcao: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonnelForm;
