'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseNavegador } from '@/lib/supabase/client';
import { btn, campo } from '@/components/ui';

type Modo = 'entrar' | 'criar' | 'esqueci';

export default function Login() {
  const [modo, setModo] = useState<Modo>('entrar');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [msg, setMsg] = useState<{ tipo: 'erro' | 'ok'; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const router = useRouter();
  const sb = supabaseNavegador();
  const site = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '');

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setMsg(null);
    try {
      if (modo === 'entrar') {
        const { error } = await sb.auth.signInWithPassword({ email, password: senha });
        if (error) throw new Error(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message);
        router.replace('/');
        router.refresh();
      } else if (modo === 'criar') {
        if (senha.length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.');
        const { data, error } = await sb.auth.signUp({
          email, password: senha,
          options: { data: { nome, telefone }, emailRedirectTo: `${site}/auth/callback?next=/vincular` },
        });
        if (error) throw new Error(error.message);
        if (data.session) { router.replace('/vincular'); router.refresh(); }
        else setMsg({ tipo: 'ok', texto: 'Conta criada. Abra o link que enviamos para o seu e-mail para confirmar.' });
      } else {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${site}/auth/callback?next=/nova-senha` });
        if (error) throw new Error(error.message);
        setMsg({ tipo: 'ok', texto: 'Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha.' });
      }
    } catch (err: any) {
      setMsg({ tipo: 'erro', texto: err.message });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-cinza-fundo px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <img src="/logo.png" alt="Logo do Condomínio Parque Bello Solare" className="h-24 w-24 object-contain" />
          <h1 className="text-2xl font-extrabold">Parque Bello Solare</h1>
          <p className="text-[15px] text-cinza-texto">Encomendas, manutenção, reservas e comunicados do condomínio.</p>
        </div>
        <form onSubmit={enviar} className="flex flex-col gap-4 rounded-2xl border border-cinza-borda bg-white p-6">
          <h2 className="text-lg font-extrabold">
            {modo === 'entrar' ? 'Entrar' : modo === 'criar' ? 'Criar conta' : 'Recuperar senha'}
          </h2>
          {modo === 'criar' && (
            <>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-cinza-texto">Nome completo
                <input className={campo} value={nome} onChange={(e) => setNome(e.target.value)} required autoComplete="name" />
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-cinza-texto">Celular (opcional)
                <input className={campo} value={telefone} onChange={(e) => setTelefone(e.target.value)} inputMode="tel" autoComplete="tel" />
              </label>
            </>
          )}
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-cinza-texto">E-mail
            <input className={campo} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>
          {modo !== 'esqueci' && (
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-cinza-texto">Senha
              <input className={campo} type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required
                minLength={modo === 'criar' ? 8 : undefined} autoComplete={modo === 'criar' ? 'new-password' : 'current-password'} />
            </label>
          )}
          {msg && (
            <p role={msg.tipo === 'erro' ? 'alert' : 'status'}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${msg.tipo === 'erro' ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>
              {msg.texto}
            </p>
          )}
          <button className={btn} disabled={enviando}>
            {enviando ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : modo === 'criar' ? 'Criar conta' : 'Enviar link'}
          </button>
          {modo === 'criar' && (
            <p className="text-xs leading-relaxed text-cinza-texto">
              Ao criar a conta você concorda com o uso dos seus dados pelo condomínio apenas para a gestão condominial
              (encomendas, acesso, comunicados e cobranças), conforme a LGPD. Veja os detalhes em Meu perfil.
            </p>
          )}
          <div className="flex flex-wrap justify-between gap-2 text-sm font-semibold">
            {modo !== 'entrar' && <button type="button" className="min-h-11 text-royal" onClick={() => setModo('entrar')}>Já tenho conta</button>}
            {modo !== 'criar' && <button type="button" className="min-h-11 text-royal" onClick={() => setModo('criar')}>Criar conta</button>}
            {modo !== 'esqueci' && <button type="button" className="min-h-11 text-royal" onClick={() => setModo('esqueci')}>Esqueci a senha</button>}
          </div>
        </form>
      </div>
    </main>
  );
}
