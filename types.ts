
export type Rank = 'CEL' | 'TC' | 'MAJ' | 'CAP' | '1º TEN' | '2º TEN' | 'ASP' | 'CAD' | 'ST' | '1º SGT' | '2º SGT' | '3º SGT' | 'CB' | 'SD' | 'F.CIVIL';

export type UserRole = string;

export type Permission =
  | 'DASHBOARD_VIEW'
  | 'PERSONNEL_VIEW'
  | 'PERSONNEL_EDIT'
  | 'LEAVE_LAUNCH'
  | 'HISTORY_VIEW'
  | 'REPORTS_VIEW'
  | 'BACKUP_MANAGE'
  | 'PROFILE_MANAGE'
  | 'REDSCALE_VIEW';

export interface RoleConfig {
  id: string;
  name: string;
  permissions: Permission[];
}

export type LeaveType =
  | 'FÉRIAS'
  | 'ABONO'
  | 'LTSP'
  | 'RESTRIÇÃO'
  | 'LICENÇA ESPECIAL'
  | 'LTIP'
  | 'PRONTO EMPREGO'
  | 'EXTRA'
  | 'REPRESENTAÇÃO'
  | 'DISPENSA RECOMPENSA'
  | 'CURSO';

export interface LeaveRecord {
  id: string;
  personnelId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  description: string;
  createdAt: string;
  launchedBy: string;
  isRescheduling?: boolean;
  originalMonth?: string;
  rescheduledMonth?: string;
  isAnticipation?: boolean;
  anticipationDays?: number;
}

export interface Personnel {
  id: string;
  ant: number;
  grad: Rank;
  quadro: string;
  nome: string;
  matr: string;
  matr_norm?: string;
  unid: string;
  secao: string;
  situacao: string;
  esc: string;
  ativo?: boolean;
  restr?: string;
  pttc?: boolean;
  funcao?: string;
  saldoFerias: number;
  saldoAbono: number;
  role: UserRole;
  password?: string;
  mustChangePassword?: boolean;
  restrInicio?: string;
  restrFim?: string;
  ultimoExercicio?: string;
  email?: string;
}

export interface AppState {
  personnel: Personnel[];
  leaves: LeaveRecord[];
  virtualTeams?: VirtualTeam[];
}

export interface TeamComposition {
  rank: Rank;
  count: number;
}

export interface VirtualTeam {
  id: string;
  name: string;
  composition: TeamComposition[];
  members?: string[]; // IDs for assigned personnel
}

export type AppTab =
  | 'DASHBOARD'
  | 'FORCE_MAP'
  | 'LEAVE_LAUNCH'
  | 'LEAVE_HISTORY'
  | 'REPORTS'
  | 'CAMPAIGN'
  | 'MAINTENANCE'
  | 'MAINTENANCE'
  | 'REDSCALE'
  | 'VIRTUAL_BATTALION';
