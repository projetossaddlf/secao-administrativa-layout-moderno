import { supabase } from './supabaseClient';
import { Personnel, LeaveRecord, RoleConfig } from './types';

/**
 * Camada de compatibilidade Supabase <-> app
 *
 * ⚠️ IMPORTANTE (proteção contra "apagão"):
 * - Nunca mais fazemos "clear()" em personnel.
 * - Persistência de personnel passa a ser por UPSERT (onConflict: 'matr').
 * - Quando personnel estiver vazia, tentamos reconstruir a partir de allowed_matriculas.
 */

type AllowedMatriculaRow = {
  matricula_normalizada: string;
  nome: string | null;
  role: string | null;
  ativo: boolean | null;
};

const isUuid = (v: unknown) =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

const digitsOnly = (v: unknown) => String(v ?? '').replace(/\D/g, '');

/**
 * Sanitiza objeto genérico antes de enviar ao Supabase:
 * - remove `id` se for null/undefined ou não for UUID (evita erro de PK/restore)
 * - remove `password` se existir
 */
function sanitizeId<T extends Record<string, any>>(obj: T): T {
  const copy: any = { ...obj };
  delete copy.password;

  if ('id' in copy) {
    const v = copy.id;
    if (v == null || (typeof v === 'string' && v.trim() === '') || !isUuid(v)) {
      delete copy.id;
    }
  }
  return copy;
}

/**
 * Remove campos que NÃO devem ir para o Postgres e normaliza chaves.
 * - remove `password` (nunca armazenar em texto)
 * - remove `id` se NÃO for UUID (evita erro "invalid input syntax for type uuid")
 */
function sanitizePersonnelWrite(input: Partial<Personnel>): Partial<Personnel> {
  const out: any = { ...input };

  // Nunca armazena senha em personnel
  delete out.password;

  // matr sempre como dígitos (padrão usado no login)
  if (out.matr != null) out.matr = digitsOnly(out.matr);

  // Se o id existir mas não for UUID, remove para o Postgres gerar UUID (default)
  if (out.id != null && !isUuid(out.id)) delete out.id;

  return out;
}

function mapAllowedToPersonnel(rows: AllowedMatriculaRow[]): Personnel[] {
  // Mapeia apenas o necessário para o app não quebrar caso personnel esteja vazia.
  // Campos não presentes em allowed_matriculas recebem defaults.
  return rows
    .filter((r) => !!r.matricula_normalizada)
    .map((r, idx) => {
      const matr = digitsOnly(r.matricula_normalizada);
      const ativo = r.ativo ?? true;
      return {
        // id provisório (UI). A versão “definitiva” deve vir de personnel após sync.
        id: matr || `${Date.now()}-${idx}`,
        ant: idx + 1,
        grad: 'SD',
        quadro: '',
        nome: r.nome ?? '',
        matr,
        unid: '',
        secao: '',
        situacao: ativo ? 'ATIVO' : 'INATIVO',
        esc: '',
        saldoFerias: 0,
        saldoAbono: 0,
        role: r.role ?? 'USER',
        mustChangePassword: true,
      } as Personnel;
    });
}

async function fetchAllowedMatriculas(): Promise<AllowedMatriculaRow[]> {
  const { data, error } = await supabase
    .from('allowed_matriculas')
    .select('matricula_normalizada,nome,role,ativo')
    .order('matricula_normalizada', { ascending: true });

  if (error) {
    console.error('Erro ao carregar allowed_matriculas:', error.message);
    return [];
  }
  return (data ?? []) as AllowedMatriculaRow[];
}


async function upsertPersonnelSmart(records: Partial<Personnel> | Partial<Personnel>[]) {
  const list = Array.isArray(records) ? records : [records];

  // 1) sanitiza + deduplica (evita erro: "cannot affect row a second time")
  const sanitized = list.map(sanitizePersonnelWrite);

  const byId = new Map<string, any>();
  const byMatr = new Map<string, any>();

  for (const rec of sanitized) {
    const id = (rec as any).id;
    const matr = digitsOnly((rec as any).matr);

    if (id && isUuid(id)) {
      byId.set(id, rec);
    } else if (matr) {
      (rec as any).matr = matr;
      byMatr.set(matr, rec);
    }
  }

  // 2) grava os que têm UUID por conflito em `id` (permite alterar `matr` sem inserir)
  if (byId.size) {
    const payload = Array.from(byId.values());
    const { error } = await supabase.from('personnel').upsert(payload, { onConflict: 'id' });
    if (error) throw error;
  }

  // 3) grava os demais por conflito em `matr`
  if (byMatr.size) {
    const payload = Array.from(byMatr.values()).map((r) => {
      if ((r as any).id != null && !isUuid((r as any).id)) delete (r as any).id;
      return r;
    });
    const { error } = await supabase.from('personnel').upsert(payload, { onConflict: 'matr' });
    if (error) throw error;
  }
}

export const db = {
  personnel: {
    /**
     * Carrega do espelho (personnel). Se estiver vazia, tenta reconstruir do allowed_matriculas.
     */
    toArray: async (): Promise<Personnel[]> => {
      const { data, error } = await supabase.from('personnel').select('*');
      if (error) {
        console.error('Erro ao carregar personnel:', error.message);
      }

      const list = (data ?? []) as Personnel[];
      if (list.length > 0) return list;

      // Se personnel estiver vazia, tenta "seed" a partir de allowed_matriculas
      await db.personnel.syncFromAllowed();

      const { data: data2, error: error2 } = await supabase.from('personnel').select('*');
      if (error2) {
        console.error('Erro ao recarregar personnel após sync:', error2.message);
      }

      const list2 = (data2 ?? []) as Personnel[];
      if (list2.length > 0) return list2;

      // Último fallback: não deixa o app zerado (UI) — devolve lista derivada do allowed.
      const allowed = await fetchAllowedMatriculas();
      return mapAllowedToPersonnel(allowed);
    },

    /**
     * UPSERT em lote por matrícula (matr).
     * Mantém compatibilidade com o nome bulkAdd usado no app.
     */
    bulkAdd: async (list: Partial<Personnel>[]) => {
      try {
        await upsertPersonnelSmart(list);
      } catch (e: any) {
        console.error('Erro ao upsert lista de personnel:', e?.message ?? e);
      }
    },

    /**
     * UPSERT unitário (compatível com uso atual do app)
     */
    add: async (record: Partial<Personnel>) => {
      try {
        await upsertPersonnelSmart(record);
      } catch (e: any) {
        console.error('Erro ao upsert personnel:', e?.message ?? e);
      }
    },

    /**
     * Usado pelo Login no primeiro acesso.
     */
    savePersonnel: async (record: Personnel) => {
      try {
        await upsertPersonnelSmart(record);
      } catch (e: any) {
        console.error('Erro ao salvar personnel:', e?.message ?? e);
      }
    },

    /**
     * Delete seguro: se o valor parecer UUID, apaga por id; senão tenta por matr.
     */
    delete: async (idOrMatr: string) => {
      const value = String(idOrMatr ?? '').trim();
      if (!value) return;

      const q = isUuid(value)
        ? supabase.from('personnel').delete().eq('id', value)
        : supabase.from('personnel').delete().eq('matr', digitsOnly(value));

      const { error } = await q;
      if (error) console.error('Erro ao deletar personnel:', error.message);
    },

    /**
     * ⚠️ Bloqueado por segurança.
     * Antigamente isso executava um DELETE geral e causava perda de dados.
     */
    clear: async () => {
      console.warn('[SAFEGUARD] db.personnel.clear() foi bloqueado para evitar apagar a tabela inteira.');
    },

    /**
     * Reconstrói/atualiza personnel a partir de allowed_matriculas.
     * - Mantém dados existentes em personnel (não zera nada).
     * - Garante que toda matrícula permitida exista no espelho.
     */
    syncFromAllowed: async () => {
      const allowed = await fetchAllowedMatriculas();
      if (allowed.length === 0) return;

      const mapped = mapAllowedToPersonnel(allowed).map((p) => sanitizePersonnelWrite(p));

      const { error } = await supabase
        .from('personnel')
        .upsert(mapped, { onConflict: 'matr' });

      if (error) console.error('Erro ao sincronizar personnel a partir de allowed_matriculas:', error.message);
    },

    /**
     * Mantém o comportamento antigo do Import (substituir tudo), porém seguro:
     * 1) UPSERT de tudo que veio no arquivo
     * 2) Só depois, apaga o que não está na lista importada (por matr)
     */
    replaceAll: async (list: Personnel[]) => {
      const sanitized = list.map(sanitizePersonnelWrite);

      // 1) upsert primeiro (se falhar, não perde o que já existia)
      const { error: upsertErr } = await supabase
        .from('personnel')
        .upsert(sanitized, { onConflict: 'matr' });
      if (upsertErr) {
        console.error('Erro ao upsert no replaceAll:', upsertErr.message);
        return;
      }

      // 2) delete do que ficou fora (somente se tivermos matrículas válidas)
      const matrs = sanitized
        .map((p) => digitsOnly((p as any).matr))
        .filter(Boolean);

      if (matrs.length === 0) return;

      // PostgREST "in" exige string formatada: ("a","b")
      const inList = `(${matrs.map((m) => `"${m}"`).join(',')})`;
      const { error: delErr } = await supabase
        .from('personnel')
        .delete()
        .not('matr', 'in', inList);

      if (delErr) console.error('Erro ao limpar registros fora do import:', delErr.message);
    },
  },

  leaves: {
    toArray: async (): Promise<LeaveRecord[]> => {
      const { data, error } = await supabase.from('leaves').select('*');
      if (error) {
        console.error('Erro ao carregar leaves:', error.message);
        return [];
      }
      return (data ?? []) as LeaveRecord[];
    },
    add: async (record: Partial<LeaveRecord>) => {
      const { error } = await supabase.from('leaves').insert(record);
      if (error) console.error('Erro ao adicionar leave:', error.message);
    },
    bulkAdd: async (list: Partial<LeaveRecord>[]) => {
      const { error } = await supabase.from('leaves').insert(list);
      if (error) console.error('Erro ao adicionar lista de leaves:', error.message);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('leaves').delete().eq('id', id);
      if (error) console.error('Erro ao deletar leave:', error.message);
    },
    clear: async () => {
      const { error } = await supabase.from('leaves').delete().neq('id', 0);
      if (error) console.error('Erro ao limpar leaves:', error.message);
    },
  },

  roleConfigs: {
    toArray: async (): Promise<RoleConfig[]> => {
      const { data, error } = await supabase.from('role_configs').select('*');
      if (error) {
        console.error('Erro ao carregar role_configs:', error.message);
        return [];
      }
      return (data ?? []) as RoleConfig[];
    },
    bulkAdd: async (list: Partial<RoleConfig>[]) => {
      const { error } = await supabase.from('role_configs').insert(list);
      if (error) console.error('Erro ao adicionar role_configs:', error.message);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('role_configs').delete().eq('id', id);
      if (error) console.error('Erro ao deletar role_config:', error.message);
    },
    clear: async () => {
      const { error } = await supabase.from('role_configs').delete().neq('id', 0);
      if (error) console.error('Erro ao limpar role_configs:', error.message);
    },
  },


  /**
   * Exporta um backup completo (JSON) das tabelas principais.
   * Usado pela tela de Manutenção (exportação/importação).
   */
  exportFullBackup: async () => {
    const [p, l, r] = await Promise.all([
      supabase.from('personnel').select('*'),
      supabase.from('leaves').select('*'),
      supabase.from('role_configs').select('*'),
    ]);

    if (p.error) throw new Error(`Erro ao exportar personnel: ${p.error.message}`);
    if (l.error) throw new Error(`Erro ao exportar leaves: ${l.error.message}`);
    if (r.error) throw new Error(`Erro ao exportar role_configs: ${r.error.message}`);

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      personnel: p.data ?? [],
      leaves: l.data ?? [],
      roleConfigs: r.data ?? [],
    };
  },

  /**
   * Restaura um backup completo (JSON) das tabelas principais.
   * Estratégia: limpa as tabelas e reinsere em lotes.
   */
  restoreFullBackup: async (backup: any) => {
    const personnel = Array.isArray(backup?.personnel) ? backup.personnel : [];
    const leaves = Array.isArray(backup?.leaves) ? backup.leaves : [];
    const roleConfigs = Array.isArray(backup?.roleConfigs) ? backup.roleConfigs : [];

    // Limpa tudo (Supabase exige filtro no delete)
    const delPersonnel = await supabase.from('personnel').delete().not('id', 'is', null);
    if (delPersonnel.error) throw new Error(`Erro ao limpar personnel: ${delPersonnel.error.message}`);

    const delLeaves = await supabase.from('leaves').delete().not('id', 'is', null);
    if (delLeaves.error) throw new Error(`Erro ao limpar leaves: ${delLeaves.error.message}`);

    const delRoles = await supabase.from('role_configs').delete().not('id', 'is', null);
    if (delRoles.error) throw new Error(`Erro ao limpar role_configs: ${delRoles.error.message}`);

    const chunk = <T,>(arr: T[], size: number) => {
      const out: T[][] = [];
      for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
      return out;
    };

    // Normalizações mínimas para evitar NOT NULL
    const normalizedPersonnel = personnel.map((x: any) => ({
      ...x,
      ant: x?.ant ?? 0,
      saldoFerias: x?.saldoFerias ?? 0,
      saldoAbono: x?.saldoAbono ?? 0,
      situacao: x?.situacao ?? 'ATIVO',
      role: x?.role ?? 'USER',
    }));

    const BATCH = 500;

    for (const part of chunk(normalizedPersonnel, BATCH)) {
      if (!part.length) continue;
      const clean = part.map((rec: any) => sanitizeId(rec));
      const { error } = await supabase.from('personnel').upsert(clean);
      if (error) throw new Error(`Erro ao restaurar personnel: ${error.message}`);
    }

    for (const part of chunk(leaves, BATCH)) {
      if (!part.length) continue;
      const clean = part.map((rec: any) => sanitizeId(rec));
      const { error } = await supabase.from('leaves').upsert(clean);
      if (error) throw new Error(`Erro ao restaurar leaves: ${error.message}`);
    }

    for (const part of chunk(roleConfigs, BATCH)) {
      if (!part.length) continue;
      const clean = part.map((rec: any) => sanitizeId(rec));
      const { error } = await supabase.from('role_configs').upsert(clean);
      if (error) throw new Error(`Erro ao restaurar role_configs: ${error.message}`);
    }
  },
};
