import React, { useMemo, useState } from 'react';
import { Personnel } from '../types';
import { db } from '../db';
import { normalizeMatriculaDigits } from '../utils/matricula';
import { supabase } from '../supabaseClient';

interface LoginProps {
  onLoginSuccess: (payload: { email: string; role: string; mustChangePassword?: boolean }) => void;
}

type Phase = 'identify' | 'firstAccess' | 'login';

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [matr, setMatr] = useState('');
  const [identifiedUser, setIdentifiedUser] = useState<Personnel | null>(null);
  const [phase, setPhase] = useState<Phase>('identify');

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const clearMustChangePasswordFlag = async (user: Personnel | null) => {
    if (!user) return;
    if (user.mustChangePassword !== true) return;
    try {
      await db.personnel.put({ ...user, mustChangePassword: false } as Personnel);
    } catch {
      // ignore
    }
  };

  const validations = useMemo(() => {
    return {
      length: newPassword.length >= 8,
      upper: /[A-Z]/.test(newPassword),
      lower: /[a-z]/.test(newPassword),
      number: /[0-9]/.test(newPassword),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword),
    };
  }, [newPassword]);

  const isFirstAccessFormValid =
    validations.length &&
    validations.upper &&
    validations.lower &&
    validations.number &&
    validations.special &&
    newPassword === confirmPassword;

  const resetState = () => {
    setIdentifiedUser(null);
    setPhase('identify');
    setPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setInfo('');
  };

  const handleMatriculaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    setInfo('');
    const digits = normalizeMatriculaDigits(e.target.value);
    setMatr(digits);
    resetState();
  };

  const emailFromMatr = (m: string) => `${normalizeMatriculaDigits(m)}@app.local`;

  const pickRole = (row: any): string => {
    const raw = (row?.role ?? row?.perfil ?? row?.papel ?? row?.cargo ?? 'USER') as any;
    const role = (raw ?? 'USER').toString().trim().toUpperCase();
    return role || 'USER';
  };

  const buildMinimalPersonnel = (matrDigits: string, allowedRow: any): Personnel => {
    return {
      id: (allowedRow?.id ?? `allowed:${matrDigits}`).toString(),
      ant: 0,
      grad: 'SD',
      quadro: '',
      nome: (allowedRow?.nome ?? allowedRow?.name ?? '').toString(),
      matr: matrDigits,
      unid: '',
      secao: '',
      situacao: allowedRow?.ativo === false ? 'INATIVO' : 'ATIVO',
      esc: '',
      saldoFerias: 0,
      saldoAbono: 0,
      role: pickRole(allowedRow) as any,
      mustChangePassword: Boolean(
        allowedRow?.mustChangePassword ??
          allowedRow?.must_change_password ??
          allowedRow?.must_change ??
          allowedRow?.first_access
      ),
      email: allowedRow?.email ? String(allowedRow.email) : emailFromMatr(matrDigits),
    };
  };

  const findUserByMatricula = async (
    inputDigits: string
  ): Promise<{ user: Personnel | null; message?: string }> => {
    const cleanInput = normalizeMatriculaDigits(inputDigits);
    if (cleanInput.length < 6) {
      return { user: null, message: 'Informe uma matrícula válida (somente números).' };
    }
    try {
      const { data: allowed, error: allowedErr } = await supabase
        .from('allowed_matriculas')
        .select('*')
        .or(`matricula_normalizada.eq.${cleanInput},matricula.eq.${cleanInput}`)
        .maybeSingle();

      if (allowed && allowed.ativo === false) {
        return { user: null, message: 'Matrícula inativa. Procure o administrador.' };
      }
      if (allowed) {
        const user = buildMinimalPersonnel(cleanInput, allowed);
        return { user };
      }
    } catch (err) {
      console.warn('[Login] allowed_matriculas lookup exception:', err);
    }

    try {
      const { data: pRow, error: pErr } = await supabase
        .from('personnel')
        .select('*')
        .eq('matr', cleanInput)
        .maybeSingle();

      if (!pErr && pRow) {
        const user = pRow as Personnel;
        user.email = user.email ?? emailFromMatr(user.matr);
        return { user };
      }
    } catch {
      // ignore
    }
    return { user: null, message: 'Matrícula não autorizada/localizada.' };
  };

  const handleIdentifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setIsLoading(true);
    const { user, message } = await findUserByMatricula(matr);
    if (!user) {
      setError(message ?? 'Matrícula não autorizada/localizada.');
      setIsLoading(false);
      return;
    }
    setIdentifiedUser(user);
    if (message) setInfo(message);
    setPhase(user.mustChangePassword ? 'firstAccess' : 'login');
    setIsLoading(false);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifiedUser) return;
    setError('');
    setIsLoading(true);
    const pass = password.trim();
    if (!pass) {
      setError('Informe a senha.');
      setIsLoading(false);
      return;
    }
    try {
      const email = identifiedUser.email ?? emailFromMatr(identifiedUser.matr);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
      });
      if (error) {
        setError('Senha incorreta ou usuário não encontrado.');
        setIsLoading(false);
        return;
      }
      if (data.user) {
        await clearMustChangePasswordFlag(identifiedUser);
        onLoginSuccess({
          email,
          role: (identifiedUser.role ?? 'USER').toString().toUpperCase(),
          mustChangePassword: false,
        });
      } else {
        setError('Erro inesperado ao autenticar.');
      }
    } catch (err) {
      console.error(err);
      setError('Falha na conexão com o Supabase.');
    }
    setIsLoading(false);
  };

  const handleFirstAccessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifiedUser) return;
    setError('');
    if (!isFirstAccessFormValid) {
      setError('A nova senha não atende aos requisitos.');
      return;
    }
    setIsLoading(true);
    try {
      const email = identifiedUser.email ?? emailFromMatr(identifiedUser.matr);
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password: newPassword,
      });
      if (signUpError) {
        const msg = (signUpError as any)?.message ?? String(signUpError);
        if (/already registered/i.test(msg) || /already exists/i.test(msg)) {
          const { error: signInErr } = await supabase.auth.signInWithPassword({
            email,
            password: newPassword,
          });
          if (signInErr) {
            setError('Usuário já possui senha cadastrada. Use a opção de login.');
            setIsLoading(false);
            return;
          }
        } else {
          setError('Não foi possível criar o usuário. ' + msg);
          setIsLoading(false);
          return;
        }
      } else {
        await supabase.auth.signInWithPassword({
          email,
          password: newPassword,
        });
      }
      await clearMustChangePasswordFlag(identifiedUser);
      onLoginSuccess({
        email,
        role: (identifiedUser.role ?? 'USER').toString().toUpperCase(),
        mustChangePassword: false,
      });
    } catch (err) {
      console.error(err);
      setError('Falha ao criar senha no Supabase.');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo/Icon Area */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-600 text-white rounded-3xl shadow-xl shadow-indigo-200 mb-4 transform -rotate-6">
            <i className="fas fa-shield-halved text-3xl"></i>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Seção Administrativa</h1>
          <p className="text-slate-500 font-medium mt-2">Gestão de Efetivo e Afastamentos</p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white shadow-2xl shadow-slate-200/50 p-8">
          {phase === 'identify' && (
            <form onSubmit={handleIdentifySubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Matrícula</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <i className="fas fa-id-card"></i>
                  </div>
                  <input
                    type="text"
                    value={matr}
                    onChange={handleMatriculaChange}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-lg font-medium"
                    placeholder="000.000-0"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || matr.length < 6}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-200 transition-all active:scale-[0.98] flex items-center justify-center gap-3 text-lg"
              >
                {isLoading ? (
                  <i className="fas fa-circle-notch animate-spin"></i>
                ) : (
                  <>
                    Continuar
                    <i className="fas fa-arrow-right text-sm"></i>
                  </>
                )}
              </button>
            </form>
          )}

          {phase === 'login' && identifiedUser && (
            <form onSubmit={handleLoginSubmit} className="space-y-6">
              <div className="bg-indigo-50/50 rounded-2xl p-4 flex items-center gap-4 border border-indigo-100/50">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm font-bold">
                  {identifiedUser.grad}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Usuário Identificado</p>
                  <p className="text-slate-900 font-bold truncate">{identifiedUser.nome}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Sua Senha</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <i className="fas fa-lock"></i>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-12 py-3.5 bg-slate-50/50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-lg font-medium"
                    placeholder="••••••••"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-200 transition-all active:scale-[0.98] flex items-center justify-center gap-3 text-lg"
                >
                  {isLoading ? <i className="fas fa-circle-notch animate-spin"></i> : 'Entrar no Sistema'}
                </button>
                <button
                  type="button"
                  onClick={resetState}
                  className="w-full bg-transparent hover:bg-slate-50 text-slate-500 font-bold py-3 rounded-2xl transition-all flex items-center justify-center gap-2"
                >
                  <i className="fas fa-chevron-left text-xs"></i>
                  Voltar
                </button>
              </div>
            </form>
          )}

          {phase === 'firstAccess' && identifiedUser && (
            <form onSubmit={handleFirstAccessSubmit} className="space-y-6">
              <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
                <p className="text-amber-800 text-sm font-bold flex items-center gap-2 mb-1">
                  <i className="fas fa-sparkles"></i>
                  Primeiro Acesso
                </p>
                <p className="text-amber-700 text-xs leading-relaxed">
                  Olá, <strong>{identifiedUser.nome}</strong>. Para sua segurança, crie uma senha forte para acessar o sistema.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Nova Senha</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-lg font-medium"
                    placeholder="Mínimo 8 caracteres"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Confirmar Senha</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-lg font-medium"
                    placeholder="Repita a senha"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                {[
                  { key: 'length', label: '8+ caracteres' },
                  { key: 'upper', label: 'Maiúscula' },
                  { key: 'lower', label: 'Minúscula' },
                  { key: 'number', label: 'Número' },
                  { key: 'special', label: 'Símbolo' },
                ].map((req) => (
                  <div key={req.key} className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center ${validations[req.key as keyof typeof validations] ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                      {validations[req.key as keyof typeof validations] && <i className="fas fa-check text-[10px] text-white"></i>}
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${validations[req.key as keyof typeof validations] ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {req.label}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={isLoading || !isFirstAccessFormValid}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-200 transition-all active:scale-[0.98] flex items-center justify-center gap-3 text-lg"
                >
                  {isLoading ? <i className="fas fa-circle-notch animate-spin"></i> : 'Criar Senha e Acessar'}
                </button>
                <button
                  type="button"
                  onClick={resetState}
                  className="w-full bg-transparent hover:bg-slate-50 text-slate-500 font-bold py-3 rounded-2xl transition-all flex items-center justify-center gap-2"
                >
                  Voltar
                </button>
              </div>
            </form>
          )}

          {error && (
            <div className="mt-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 animate-shake">
              <i className="fas fa-circle-exclamation text-rose-500 mt-0.5"></i>
              <p className="text-rose-700 text-sm font-bold leading-tight">{error}</p>
            </div>
          )}

          {info && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-3">
              <i className="fas fa-circle-info text-blue-500 mt-0.5"></i>
              <p className="text-blue-700 text-sm font-medium leading-tight">{info}</p>
            </div>
          )}
        </div>

        <p className="text-center text-slate-400 text-xs font-bold uppercase tracking-widest mt-8">
          &copy; 2026 Seção Administrativa • v2.0 Modern
        </p>
      </div>
    </div>
  );
};

export default Login;
