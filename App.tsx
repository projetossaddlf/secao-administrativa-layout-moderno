import React, { useEffect, useMemo, useState } from "react";
import type { Personnel, LeaveRecord, RoleConfig, Permission, AppTab } from "./types";

import Dashboard from "./components/Dashboard";
import LeaveForm from "./components/LeaveForm";
import Reports from "./components/Reports";
import Campaign from "./components/Campaign";
import Maintenance from "./components/Maintenance";
import VirtualBattalionManager from "./components/VirtualBattalionManager";
import Login from "./components/Login";
import ImportModal from "./components/ImportModal";
import RedScale from "./components/RedScale";
import ForceMap from "./components/ForceMap";
import PasswordChange from "./components/PasswordChange";
import LeaveHistory from "./components/LeaveHistory";
import ProfileManagement from "./components/ProfileManagement";
import PersonnelEditModal from "./components/PersonnelEditModal";

import { db } from "./db";
import { supabase } from "./supabaseClient";

type Route = AppTab | "PASSWORD_CHANGE" | "PROFILE_MGMT";

const withLaunchMeta = (l: any, launchedBy: string) => {
  const fixed = { ...(l ?? {}) };
  if (fixed.launchedBy == null || String(fixed.launchedBy).trim() === "") {
    fixed.launchedBy = launchedBy;
  }
  return fixed;
};

const makeBlankPersonnel = (): Personnel =>
({
  id: "",
  ant: 0,
  grad: "SD",
  quadro: "",
  nome: "",
  matr: "",
  unid: "",
  secao: "",
  situacao: "ATIVO",
  esc: "",
  saldoFerias: 0,
  saldoAbono: 0,
  role: "USER",
  mustChangePassword: true,
} as any);

const App: React.FC = () => {
  const [route, setRoute] = useState<Route>("DASHBOARD");
  const [user, setUser] = useState<{ email: string; role: string } | null>(null);

  const [mustChangePassword, setMustChangePassword] = useState(false);

  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [roleConfigs, setRoleConfigs] = useState<RoleConfig[]>([]);

  const [showImport, setShowImport] = useState(false);

  // estados que seu app já usa (mantidos)
  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<Personnel | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [launchPerson, setLaunchPerson] = useState<Personnel | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const loadAll = async () => {
    const [p, l, r] = await Promise.all([
      db.personnel.toArray(),
      db.leaves.toArray(),
      db.roleConfigs.toArray(),
    ]);
    setPersonnel(p);
    setLeaves(l);
    setRoleConfigs(r);
  };

  useEffect(() => {
    if (!user) return;
    loadAll();
  }, [user]);

  // realtime opcional (mantém seu padrão atual)
  useEffect(() => {
    if (!user) return;

    let t: any = null;
    const scheduleReload = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => loadAll(), 200);
    };

    const channel = supabase
      .channel(`secao-admin-sync`)
      .on("postgres_changes", { event: "*", schema: "public", table: "personnel" }, () => scheduleReload())
      .on("postgres_changes", { event: "*", schema: "public", table: "leaves" }, () => scheduleReload())
      .on("postgres_changes", { event: "*", schema: "public", table: "role_configs" }, () => scheduleReload())
      .subscribe();

    return () => {
      if (t) clearTimeout(t);
      supabase.removeChannel(channel);
    };
  }, [user]);

  const can = useMemo(() => {
    const role = (user?.role ?? "USER").toUpperCase();
    const isAdmin = role === "ADMIN" || role === "ADMINISTRADOR";

    const cfg =
      roleConfigs.find((c: any) => (c.role ?? c.name ?? "").toUpperCase() === role) ?? null;

    const perms: Permission[] = (cfg?.permissions ?? []) as any;

    const has = (p: Permission) => isAdmin || perms.includes(p);

    return {
      isAdmin,
      showForceMap: isAdmin || has("REDSCALE_VIEW"),
      showHistory: isAdmin || has("HISTORY_VIEW") || has("LEAVE_LAUNCH"),
      showReports: isAdmin || has("REPORTS_VIEW"),
      showCampaign: isAdmin || has("PROFILE_MANAGE"),
      showMaintenance: isAdmin || has("BACKUP_MANAGE"),
      showRedScale: isAdmin || has("REDSCALE_VIEW"),
      showVirtualBattalion: isAdmin,
      canManagePersonnel: isAdmin || has("PERSONNEL_EDIT"),
    };
  }, [user, roleConfigs]);

  const handleUpdateRoleConfigs = async (configs: RoleConfig[]) => {
    // Atualiza estado + cache local (Dexie)
    setRoleConfigs(configs);
    try {
      await db.roleConfigs.clear();
      if (configs.length) await db.roleConfigs.bulkAdd(configs as any);
    } catch (e) {
      console.warn("Falha ao salvar roleConfigs no cache local:", e);
    }

    // Sincroniza com Supabase (se existir a tabela role_configs)
    try {
      const payload = (configs as any[]).map((c) => ({
        id: c.id,
        name: c.name,
        permissions: c.permissions,
      }));
      if (payload.length) {
        const { error } = await supabase.from("role_configs").upsert(payload, { onConflict: "id" });
        if (error) console.warn("role_configs upsert:", error.message);
      }
    } catch (e) {
      // se a tabela não existir / sem permissão, apenas loga e mantém funcionando localmente
      console.warn("Falha ao sincronizar role_configs no Supabase:", e);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setMustChangePassword(false);
    setRoute("DASHBOARD");
  };

  const NavItem = ({ id, label, icon, active, show }: any) => {
    if (!show) return null;
    return (
      <button
        onClick={() => setRoute(id)}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 ${active
          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 font-bold"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 font-medium"
          }`}
      >
        <div
          className={`w-8 h-8 flex items-center justify-center rounded-xl ${active ? "bg-white/20" : "bg-slate-100"
            }`}
        >
          <i className={`fas ${icon}`}></i>
        </div>
        {isSidebarOpen && <span className="truncate">{label}</span>}
      </button>
    );
  };

  // ✅ Login (usa o callback certo do seu Login.tsx)
  if (!user) {
    return (
      <Login
        onLoginSuccess={(p) => {
          setUser({ email: p.email, role: p.role });
          setMustChangePassword(Boolean(p.mustChangePassword));
          setRoute(p.mustChangePassword ? "PASSWORD_CHANGE" : "DASHBOARD");
        }}
      />
    );
  }

  if (mustChangePassword || route === "PASSWORD_CHANGE") {
    return (
      <PasswordChange
        userEmail={user.email}
        onDone={async () => {
          setMustChangePassword(false);
          setRoute("DASHBOARD");
          await loadAll();
        }}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      {/* Sidebar */}
      <aside
        className={`${isSidebarOpen ? "w-72" : "w-20"
          } bg-white border-r border-slate-200 transition-all duration-300 flex flex-col z-20`}
      >
        <div className="p-6 flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100 shrink-0">
            <i className="fas fa-shield-halved"></i>
          </div>
          {isSidebarOpen && (
            <span className="font-black text-slate-900 text-lg tracking-tight truncate">
              SecAdmin
            </span>
          )}
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <NavItem
            id="DASHBOARD"
            label="Dashboard"
            icon="fa-chart-pie"
            active={route === "DASHBOARD"}
            show={true}
          />
          <NavItem
            id="FORCE_MAP"
            label="Mapa de Força"
            icon="fa-map-location-dot"
            active={route === "FORCE_MAP"}
            show={can.showForceMap}
          />
          <NavItem
            id="REDSCALE"
            label="Escala Vermelha"
            icon="fa-list-ol"
            active={route === "REDSCALE"}
            show={can.showRedScale}
          />
          <NavItem
            id="VIRTUAL_BATTALION"
            label="Batalhão Virtual"
            icon="fa-layer-group"
            active={route === "VIRTUAL_BATTALION"}
            show={can.showVirtualBattalion}
          />
          <NavItem
            id="LEAVE_LAUNCH"
            label="Lançar Afastamento"
            icon="fa-calendar-plus"
            active={route === "LEAVE_LAUNCH"}
            show={true}
          />
          <NavItem
            id="LEAVE_HISTORY"
            label="Histórico"
            icon="fa-clock-rotate-left"
            active={route === "LEAVE_HISTORY"}
            show={can.showHistory}
          />
          <NavItem
            id="REPORTS"
            label="Relatórios"
            icon="fa-file-invoice"
            active={route === "REPORTS"}
            show={can.showReports}
          />
          <NavItem
            id="CAMPAIGN"
            label="Efetivo"
            icon="fa-users-gear"
            active={route === "CAMPAIGN"}
            show={can.showCampaign}
          />
          <NavItem
            id="MAINTENANCE"
            label="Manutenção"
            icon="fa-gears"
            active={route === "MAINTENANCE"}
            show={can.showMaintenance}
          />

          {/* ✅ PERFIS: só ADMIN */}
          <NavItem
            id="PROFILE_MGMT"
            label="Perfis"
            icon="fa-user-gear"
            active={route === "PROFILE_MGMT"}
            show={can.isAdmin}
          />
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div
            className={`flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100 ${!isSidebarOpen ? "justify-center" : ""
              }`}
          >
            <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold shrink-0">
              {user.email?.[0]?.toUpperCase() ?? "U"}
            </div>

            {isSidebarOpen && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black text-indigo-600 uppercase tracking-wider">
                  {user.role}
                </p>
                <p className="text-slate-900 font-bold text-sm truncate">
                  {user.email}
                </p>
              </div>
            )}

            {isSidebarOpen && (
              <button
                onClick={handleLogout}
                className="text-slate-400 hover:text-rose-500 transition-colors"
                title="Sair"
              >
                <i className="fas fa-power-off"></i>
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="w-10 h-10 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
              title="Recolher menu"
            >
              <i className={`fas ${isSidebarOpen ? "fa-indent" : "fa-outdent"}`}></i>
            </button>

            <h2 className="text-xl font-black text-slate-900">
              {route === "DASHBOARD" && "Dashboard Geral"}
              {route === "FORCE_MAP" && "Mapa de Força"}
              {route === "REDSCALE" && "Escala Vermelha"}
              {route === "VIRTUAL_BATTALION" && "Gestão de Batalhão Virtual"}
              {route === "LEAVE_LAUNCH" && "Lançar Afastamento"}
              {route === "LEAVE_HISTORY" && "Histórico de Afastamentos"}
              {route === "REPORTS" && "Relatórios de Gestão"}
              {route === "CAMPAIGN" && "Gestão de Efetivo"}
              {route === "MAINTENANCE" && "Configurações e Manutenção"}
              {route === "PROFILE_MGMT" && "Perfis e Permissões"}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              <span className="text-xs font-bold uppercase tracking-widest">
                Sistema Online
              </span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          {route === "DASHBOARD" && <Dashboard personnel={personnel} leaves={leaves} />}

          {route === "FORCE_MAP" && <ForceMap personnel={personnel} leaves={leaves} />}

          {route === "REDSCALE" && <RedScale personnel={personnel} leaves={leaves} />}

          {route === "VIRTUAL_BATTALION" && <VirtualBattalionManager />}

          {route === "LEAVE_LAUNCH" && (
            <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
              <LeaveForm
                personnel={personnel}
                leaves={leaves}
                onSubmit={async (l: any) => {
                  const launcher = user.email;
                  if (Array.isArray(l)) {
                    for (const item of l) await db.leaves.add(withLaunchMeta(item, launcher));
                  } else {
                    await db.leaves.add(withLaunchMeta(l, launcher));
                  }
                  await loadAll();
                }}
                initialPerson={launchPerson as any}
              />
            </div>
          )}

          {route === "LEAVE_HISTORY" && <LeaveHistory personnel={personnel} leaves={leaves} />}

          {route === "REPORTS" && <Reports personnel={personnel} leaves={leaves} />}

          {route === "CAMPAIGN" && (
            <Campaign
              personnel={personnel}
              leaves={leaves}
              onAddPersonClick={async () => {
                setEditDraft(makeBlankPersonnel());
                setEditOpen(true);
              }}
              onEditPerson={(p: any) => {
                setEditDraft({ ...p });
                setEditOpen(true);
              }}
              onDeletePerson={async (id: any) => {
                await db.personnel.delete(id);
                await loadAll();
              }}
              onResetPassword={async (id: any) => {
                const p = await db.personnel.get(id);
                if (p) {
                  await db.personnel.update(id, { mustChangePassword: true, password: "123" } as any);
                  alert("Senha resetada para '123' e troca obrigatória ativada.");
                }
              }}
              onLaunchLeave={(p: any) => {
                setLaunchPerson(p);
                setRoute("LEAVE_LAUNCH");
              }}
              onUpdatePerson={async (p: any) => {
                await db.personnel.put(p);
                await loadAll();
              }}
              onImportClick={() => setShowImport(true)}
              canManagePersonnel={can.canManagePersonnel}
              currentUserRole={user.role}
            />
          )}

          {route === "PROFILE_MGMT" && (
            <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
              <ProfileManagement
                roleConfigs={roleConfigs}
                onUpdateConfigs={handleUpdateRoleConfigs}
              />
            </div>
          )}

          {route === "MAINTENANCE" && <Maintenance />}
        </div>
      </main>

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={async () => {
            setShowImport(false);
            await loadAll();
          }}
        />
      )}

      {editOpen && (
        <PersonnelEditModal
          initialData={editDraft}
          onClose={() => {
            setEditOpen(false);
            setEditDraft(null);
          }}
          onSave={async () => {
            await loadAll();
          }}
        />
      )}
    </div>
  );
};

export default App;
