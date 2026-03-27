import { supabase } from "./supabaseClient";
import type { Personnel, LeaveRecord, RoleConfig, VirtualTeam } from "./types";

const isUuid = (v: unknown) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

function sanitizeId<T extends Record<string, any>>(obj: T): T {
  // Se vier ID não-UUID (ex.: "0", "1"), remove para o Postgres gerar UUID.
  if ("id" in obj && obj.id != null && !isUuid(obj.id)) {
    const copy = { ...obj };
    delete (copy as any).id;
    return copy as T;
  }
  return obj;
}

function normalizeMatricula(raw: any) {
  const s = (raw ?? "").toString().trim();
  return s.replace(/\D/g, "");
}

function stripReadonlyPersonnelFields(p: Partial<Personnel>) {
  const copy: any = { ...p };
  // Evita mandar campos calculados/gerados pelo DB que possam travar update/upsert
  delete copy.created_at;
  delete copy.updated_at;
  return copy;
}

type FullBackup = {
  version: number;
  exportedAt: string;
  tables: {
    personnel: Personnel[];
    leaves: LeaveRecord[];
    role_configs: RoleConfig[];
    virtual_teams?: VirtualTeam[];
  };
};

export const db = {
  personnel: {
    toArray: async (): Promise<Personnel[]> => {
      const { data, error } = await supabase.from("personnel").select();
      if (error) throw error;
      return (data as Personnel[]) ?? [];
    },

    get: async (idOrMatr: string): Promise<Personnel | null> => {
      const key = (idOrMatr ?? "").toString().trim();
      if (!key) return null;

      if (isUuid(key)) {
        const { data, error } = await supabase.from("personnel").select().eq("id", key).maybeSingle();
        if (error) throw error;
        return (data as Personnel) ?? null;
      }

      const matr = normalizeMatricula(key);
      const { data, error } = await supabase.from("personnel").select().eq("matr", matr).maybeSingle();
      if (error) throw error;
      return (data as Personnel) ?? null;
    },

    update: async (id: string, fields: Partial<Personnel>): Promise<Personnel> => {
      const key = (id ?? "").toString().trim();
      if (!key) throw new Error("ID inválido para atualização.");
      if (!isUuid(key)) throw new Error("Update requer id UUID.");

      const payload: any = stripReadonlyPersonnelFields(fields as any);
      const { data, error } = await supabase.from("personnel").update(payload).eq("id", key).select().single();
      if (error) throw error;
      return data as Personnel;
    },

    add: async (p: Partial<Personnel>): Promise<Personnel> => {
      const payload: any = stripReadonlyPersonnelFields(sanitizeId(p as any));
      payload.matr = normalizeMatricula(payload.matr ?? payload.matr_norm ?? payload.matr_norma);
      payload.matr_norm = payload.matr_norm ?? payload.matr;

      const { data, error } = await supabase.from("personnel").insert(payload).select().single();
      if (error) throw error;
      return data as Personnel;
    },

    put: async (p: Personnel): Promise<Personnel> => {
      const payload: any = stripReadonlyPersonnelFields(sanitizeId(p as any));
      payload.matr = normalizeMatricula(payload.matr ?? payload.matr_norm);
      payload.matr_norm = payload.matr_norm ?? payload.matr;

      // REGRA CRÍTICA:
      // - se tem UUID -> atualiza por id (permite mudar matr)
      // - se não tem UUID -> atualiza por matr
      if (payload.id && isUuid(payload.id)) {
        const { data, error } = await supabase
          .from("personnel")
          .update(payload)
          .eq("id", payload.id)
          .select()
          .single();
        if (error) throw error;
        return data as Personnel;
      }

      const key = payload.matr;
      const { data, error } = await supabase
        .from("personnel")
        .update(payload)
        .eq("matr", key)
        .select()
        .single();

      if (error) throw error;
      return data as Personnel;
    },

    delete: async (idOrMatr: string): Promise<void> => {
      const key = idOrMatr?.toString();
      if (!key) return;

      if (isUuid(key)) {
        const { error } = await supabase.from("personnel").delete().eq("id", key);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from("personnel").delete().eq("matr", normalizeMatricula(key));
      if (error) throw error;
    },

    bulkUpsert: async (items: any[]): Promise<void> => {
      if (!items?.length) return;
      const payload = items.map((x) => {
        const p: any = stripReadonlyPersonnelFields(sanitizeId(x));
        p.matr = normalizeMatricula(p.matr ?? p.matr_norm);
        p.matr_norm = p.matr_norm ?? p.matr;
        return p;
      });

      const { error } = await supabase.from("personnel").upsert(payload, { onConflict: "matr" });
      if (error) throw error;
    },
  },

  leaves: {
    toArray: async (): Promise<LeaveRecord[]> => {
      const { data, error } = await supabase.from("leaves").select();
      if (error) throw error;
      return (data as LeaveRecord[]) ?? [];
    },

    add: async (l: Partial<LeaveRecord>): Promise<LeaveRecord> => {
      const payload: any = sanitizeId(l as any);
      const { data, error } = await supabase.from("leaves").insert(payload).select().single();
      if (error) throw error;
      return data as LeaveRecord;
    },

    put: async (l: LeaveRecord): Promise<LeaveRecord> => {
      const payload: any = sanitizeId(l as any);

      if (payload.id && isUuid(payload.id)) {
        const { data, error } = await supabase.from("leaves").update(payload).eq("id", payload.id).select().single();
        if (error) throw error;
        return data as LeaveRecord;
      }

      // fallback por campos chave (quando backup tiver id não-uuid)
      const { data, error } = await supabase.from("leaves").upsert(payload).select().single();
      if (error) throw error;
      return data as LeaveRecord;
    },

    delete: async (id: string): Promise<void> => {
      if (!id) return;
      const { error } = await supabase.from("leaves").delete().eq("id", id);
      if (error) throw error;
    },

    bulkUpsert: async (items: any[]): Promise<void> => {
      if (!items?.length) return;
      const payload = items.map((x) => sanitizeId(x));
      const { error } = await supabase.from("leaves").upsert(payload);
      if (error) throw error;
    },
  },

  roleConfigs: {
    toArray: async (): Promise<RoleConfig[]> => {
      const { data, error } = await supabase.from("role_configs").select();
      if (error) throw error;
      return (data as RoleConfig[]) ?? [];
    },

    add: async (r: Partial<RoleConfig>): Promise<RoleConfig> => {
      const payload: any = sanitizeId(r as any);
      const { data, error } = await supabase.from("role_configs").insert(payload).select().single();
      if (error) throw error;
      return data as RoleConfig;
    },

    put: async (r: RoleConfig): Promise<RoleConfig> => {
      const payload: any = sanitizeId(r as any);

      if (payload.id && isUuid(payload.id)) {
        const { data, error } = await supabase
          .from("role_configs")
          .update(payload)
          .eq("id", payload.id)
          .select()
          .single();
        if (error) throw error;
        return data as RoleConfig;
      }

      const { data, error } = await supabase.from("role_configs").upsert(payload).select().single();
      if (error) throw error;
      return data as RoleConfig;
    },

    delete: async (id: string): Promise<void> => {
      if (!id) return;
      const { error } = await supabase.from("role_configs").delete().eq("id", id);
      if (error) throw error;
    },

    bulkUpsert: async (items: any[]): Promise<void> => {
      if (!items?.length) return;
      const payload = items.map((x) => sanitizeId(x));
      const { error } = await supabase.from("role_configs").upsert(payload);
      if (error) throw error;
    },
  },

  virtualTeams: {
    toArray: async (): Promise<VirtualTeam[]> => {
      const { data, error } = await supabase.from("virtual_teams").select();
      if (error) throw error;
      return (data as VirtualTeam[]) ?? [];
    },

    add: async (t: Partial<VirtualTeam>): Promise<VirtualTeam> => {
      const payload: any = sanitizeId(t as any);
      const { data, error } = await supabase.from("virtual_teams").insert(payload).select().single();
      if (error) throw error;
      return data as VirtualTeam;
    },

    put: async (t: VirtualTeam): Promise<VirtualTeam> => {
      const payload: any = sanitizeId(t as any);

      if (payload.id && isUuid(payload.id)) {
        const { data, error } = await supabase
          .from("virtual_teams")
          .update(payload)
          .eq("id", payload.id)
          .select()
          .single();
        if (error) throw error;
        return data as VirtualTeam;
      }

      const { data, error } = await supabase.from("virtual_teams").upsert(payload).select().single();
      if (error) throw error;
      return data as VirtualTeam;
    },

    delete: async (id: string): Promise<void> => {
      if (!id) return;
      const { error } = await supabase.from("virtual_teams").delete().eq("id", id);
      if (error) throw error;
    },

    bulkUpsert: async (items: any[]): Promise<void> => {
      if (!items?.length) return;
      const payload = items.map((x) => sanitizeId(x));
      const { error } = await supabase.from("virtual_teams").upsert(payload);
      if (error) throw error;
    },
  },

  // ✅ Backup / Restore (o Maintenance.tsx espera isso)
  exportFullBackup: async (): Promise<FullBackup> => {
    const [p, l, r] = await Promise.all([
      db.personnel.toArray(),
      db.leaves.toArray(),
      db.roleConfigs.toArray(),
      db.virtualTeams.toArray(),
    ]);

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      tables: {
        personnel: p,
        leaves: l,
        role_configs: r,
        virtual_teams: p[3] as any, // p[3] é o resultado do virtualTeams.toArray()
      },
    };
  },

  importFullBackup: async (backup: any): Promise<void> => {
    // Aceita formatos antigos: {personnel, leaves, role_configs} ou {tables:{...}}
    const tables = backup?.tables ?? backup ?? {};
    const personnel = (tables.personnel ?? []) as any[];
    const leaves = (tables.leaves ?? []) as any[];
    const roleConfigs = (tables.role_configs ?? tables.roleConfigs ?? []) as any[];
    const virtualTeams = (tables.virtual_teams ?? tables.virtualTeams ?? []) as any[];

    // Ordem importante: role configs e personnel antes de leaves (por eventuais FKs/uso em UI)
    await db.roleConfigs.bulkUpsert(roleConfigs);
    await db.personnel.bulkUpsert(personnel);
    await db.leaves.bulkUpsert(leaves);
    await db.virtualTeams.bulkUpsert(virtualTeams);
  },
};
