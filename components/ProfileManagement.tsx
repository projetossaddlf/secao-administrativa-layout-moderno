
import React, { useState } from 'react';
import { RoleConfig, Permission } from '../types';

interface ProfileManagementProps {
  roleConfigs: RoleConfig[];
  onUpdateConfigs: (configs: RoleConfig[]) => void;
}

interface PermissionItem {
  key: Permission;
  label: string;
  icon: string;
}

interface PermissionGroup {
  name: string;
  color: string;
  permissions: PermissionItem[];
}

const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    name: 'Visão Geral',
    color: 'bg-slate-100 text-slate-600',
    permissions: [
      { key: 'DASHBOARD_VIEW', label: 'Dashboard', icon: 'fa-chart-pie' },
    ]
  },
  {
    name: 'Efetivo & Escalas',
    color: 'bg-blue-50 text-blue-700',
    permissions: [
      { key: 'PERSONNEL_VIEW', label: 'Ver Efetivo', icon: 'fa-users' },
      { key: 'PERSONNEL_EDIT', label: 'Editar Efetivo', icon: 'fa-user-pen' },
      { key: 'REDSCALE_VIEW', label: 'Escala Vermelha', icon: 'fa-file-signature' },
    ]
  },
  {
    name: 'Movimentações',
    color: 'bg-emerald-50 text-emerald-700',
    permissions: [
      { key: 'LEAVE_LAUNCH', label: 'Lançar', icon: 'fa-calendar-plus' },
      { key: 'HISTORY_VIEW', label: 'Histórico', icon: 'fa-clock-rotate-left' },
    ]
  },
  {
    name: 'Administração',
    color: 'bg-purple-50 text-purple-700',
    permissions: [
      { key: 'REPORTS_VIEW', label: 'Relatórios', icon: 'fa-file-medical' },
      { key: 'BACKUP_MANAGE', label: 'Backups', icon: 'fa-database' },
      { key: 'PROFILE_MANAGE', label: 'Perfis', icon: 'fa-user-shield' },
    ]
  }
];

const ALL_PERMISSIONS_FLAT = PERMISSION_GROUPS.flatMap(g => g.permissions);

const ProfileManagement: React.FC<ProfileManagementProps> = ({ roleConfigs, onUpdateConfigs }) => {
  const [newRoleName, setNewRoleName] = useState('');

  const togglePermission = (roleId: string, permission: Permission) => {
    const updated = roleConfigs.map(role => {
      if (role.id === roleId) {
        const hasPerm = role.permissions.includes(permission);
        return {
          ...role,
          permissions: hasPerm 
            ? role.permissions.filter(p => p !== permission)
            : [...role.permissions, permission]
        };
      }
      return role;
    });
    onUpdateConfigs(updated);
  };

  const handleAddRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    
    const newRole: RoleConfig = {
      id: newRoleName.toUpperCase().replace(/\s+/g, '_'),
      name: newRoleName.toUpperCase(),
      permissions: ['PERSONNEL_VIEW'] // Permissão básica padrão
    };

    if (roleConfigs.find(r => r.id === newRole.id)) {
      alert('Este perfil já existe.');
      return;
    }

    onUpdateConfigs([...roleConfigs, newRole]);
    setNewRoleName('');
  };

  const deleteRole = (roleId: string) => {
    if (['ADMIN', 'MANAGER', 'USER'].includes(roleId)) {
      alert('Perfis padrão do sistema não podem ser removidos.');
      return;
    }
    if (window.confirm('Excluir este perfil permanentemente?')) {
      onUpdateConfigs(roleConfigs.filter(r => r.id !== roleId));
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight">Gestão de Perfis de Acesso</h3>
            <p className="text-sm text-slate-500 font-medium">Configure as categorias de permissões para cada nível de acesso.</p>
          </div>
          
          <form onSubmit={handleAddRole} className="flex gap-2 w-full md:w-auto">
            <input 
              type="text" 
              placeholder="Nome do Novo Perfil..."
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 flex-1 md:w-64"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
            />
            <button className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-black shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all">
              CRIAR PERFIL
            </button>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse border-separate border-spacing-0">
            <thead>
              {/* Linha 1: Categorias */}
              <tr>
                <th className="p-4 bg-slate-50 border-b-2 border-slate-200 sticky left-0 z-10"></th>
                {PERMISSION_GROUPS.map((group, idx) => (
                  <th 
                    key={idx} 
                    colSpan={group.permissions.length} 
                    className={`p-2 border-b-2 border-slate-200 border-l border-white text-center text-[10px] font-black uppercase tracking-[0.1em] ${group.color}`}
                  >
                    {group.name}
                  </th>
                ))}
                <th className="p-4 bg-slate-50 border-b-2 border-slate-200"></th>
              </tr>
              {/* Linha 2: Permissões Individuais */}
              <tr className="bg-slate-50/50">
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[180px] border-b border-slate-100 sticky left-0 z-10 bg-slate-50">Nível de Acesso</th>
                {PERMISSION_GROUPS.map((group) => 
                  group.permissions.map((perm, pIdx) => (
                    <th key={perm.key} className={`py-4 px-2 text-center min-w-[90px] border-b border-slate-100 ${pIdx === 0 ? 'border-l border-slate-100' : ''}`} title={perm.label}>
                      <div className="flex flex-col items-center gap-1.5">
                        <i className={`fas ${perm.icon} text-slate-400 text-xs`}></i>
                        <span className="text-[8px] font-black text-slate-500 uppercase leading-none truncate max-w-[80px]">
                          {perm.label}
                        </span>
                      </div>
                    </th>
                  ))
                )}
                <th className="p-4 border-b border-slate-100"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {roleConfigs.map(role => (
                <tr key={role.id} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="py-4 px-4 sticky left-0 z-10 bg-white group-hover:bg-blue-50/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] shrink-0 shadow-sm ${
                        role.id === 'ADMIN' ? 'bg-slate-900 text-white' :
                        role.id === 'MANAGER' ? 'bg-blue-600 text-white' :
                        'bg-white border border-slate-200 text-slate-600'
                      }`}>
                        {role.name.charAt(0)}
                      </div>
                      <span className="text-xs font-black text-slate-800">{role.name}</span>
                    </div>
                  </td>
                  
                  {PERMISSION_GROUPS.map((group) => 
                    group.permissions.map((perm, pIdx) => (
                      <td key={perm.key} className={`py-4 px-2 text-center align-middle ${pIdx === 0 ? 'border-l border-slate-50' : ''}`}>
                        <button 
                          onClick={() => togglePermission(role.id, perm.key)}
                          disabled={role.id === 'ADMIN'}
                          className={`w-6 h-6 rounded-lg transition-all flex items-center justify-center border-2 mx-auto ${
                            role.permissions.includes(perm.key)
                              ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20'
                              : 'bg-white border-slate-200 text-transparent'
                          } ${role.id === 'ADMIN' ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110 active:scale-95'}`}
                        >
                          <i className="fas fa-check text-[10px]"></i>
                        </button>
                      </td>
                    ))
                  )}

                  <td className="py-4 px-4 text-right">
                    {!['ADMIN', 'MANAGER', 'USER'].includes(role.id) && (
                      <button 
                        onClick={() => deleteRole(role.id)}
                        className="text-slate-300 hover:text-red-500 p-2 transition-colors"
                      >
                        <i className="fas fa-trash-alt text-xs"></i>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm mb-4 border border-slate-100">
             <i className="fas fa-layer-group text-sm"></i>
          </div>
          <h4 className="font-bold text-slate-800 text-sm mb-1 uppercase tracking-tight">Grupos Lógicos</h4>
          <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
            As permissões estão agrupadas por contexto de uso para evitar erros de atribuição e facilitar a auditoria de acessos.
          </p>
        </div>
        
        <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
           <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-500 shadow-sm mb-4 border border-blue-100">
             <i className="fas fa-shield-halved text-sm"></i>
          </div>
          <h4 className="font-bold text-blue-900 text-sm mb-1 uppercase tracking-tight">Privilégios Administrativos</h4>
          <p className="text-[11px] text-blue-800/70 font-medium leading-relaxed">
            O perfil <b>ADMINISTRADOR</b> possui todas as permissões concedidas de forma permanente e não editável pelo sistema.
          </p>
        </div>

        <div className="bg-slate-900 p-6 rounded-2xl text-white shadow-xl relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl"></div>
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-blue-400 shadow-sm mb-4 border border-white/10">
             <i className="fas fa-user-check text-sm"></i>
          </div>
          <h4 className="font-bold text-white text-sm mb-1 uppercase tracking-tight">Segurança de Dados</h4>
          <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
            Mudanças nos perfis afetam imediatamente as capacidades dos usuários logados. Recomenda-se cautela ao remover permissões de visualização.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProfileManagement;
