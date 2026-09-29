import { useState, type FormEvent, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigured, supabaseConfigurationError } from '../lib/supabase'
import { XpButton, XpWindow } from './ui'

type Mode = 'login' | 'signup'

export default function AuthGate({ session, onSession, children }: {
  session: Session | null
  onSession: (session: Session | null) => void
  children: ReactNode
}) {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = mode === 'signup'
        ? await supabase.auth.signUp({ email: email.trim(), password })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (result.error) throw result.error
      if (result.data.session) onSession(result.data.session)
      else setMessage('Konto erstellt. Bitte bestätige deine E-Mail und melde dich anschließend an.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Anmeldung fehlgeschlagen. Bitte versuche es erneut.')
    } finally {
      setBusy(false)
    }
  }

  const signOut = async () => {
    if (!supabase) return
    setBusy(true)
    setError('')
    try {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) throw signOutError
      onSession(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Abmelden fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  if (session) {
    return <>
      <div className="glass-panel mb-2 flex items-center justify-between gap-2 rounded-[14px] px-3 py-1.5 text-[11px] text-[#d5e9e5]">
        <span className="min-w-0 truncate font-semibold">☁ Synchronisiert als {session.user.email}</span>
        <button className="glass-btn shrink-0 !px-2.5 !py-1 !text-[11px]" onClick={signOut} disabled={busy}>Abmelden</button>
      </div>
      {error && <p role="alert" className="mb-2 rounded-[12px] border border-[#ff9b92]/30 bg-[#331514]/80 p-2 text-[12px] text-[#ff9b92]">{error}</p>}
      {children}
    </>
  }

  return <XpWindow title="FitPlan – Cloud-Synchronisierung" icon="☁">
    {!supabaseConfigured ? (
      <div className="space-y-2 text-[12px] text-[#dcefec]">
        <p className="font-bold">{supabaseConfigurationError ?? 'Supabase ist noch nicht konfiguriert.'}</p>
        {!supabaseConfigurationError && <>
          <p>Lege im Projekt eine lokale <code>.env.local</code> mit <code>VITE_SUPABASE_URL</code> und <code>VITE_SUPABASE_ANON_KEY</code> an, danach den Dev-Server neu starten.</p>
          <p>Du brauchst die Project URL und den öffentlichen anon/publishable key aus Supabase → Project Settings → API. Niemals den service_role-Key im Browser verwenden.</p>
        </>}
      </div>
    ) : <form onSubmit={submit} className="flex flex-col gap-2 text-left">
      <p className="text-[12px] text-[#a9c4be]">Melde dich an, um deinen Plan und Essensfotos sicher zwischen Geräten zu synchronisieren.</p>
      <label className="text-[11px] text-[#9fb9b4]" htmlFor="account-email">E-Mail</label>
      <input id="account-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="glass-input" />
      <label className="text-[11px] text-[#9fb9b4]" htmlFor="account-password">Passwort (mind. 8 Zeichen)</label>
      <input id="account-password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} className="glass-input" />
      {error && <p role="alert" className="rounded-[12px] border border-[#ff9b92]/30 bg-[#331514]/80 p-2 text-[12px] text-[#ff9b92] shadow-[0_2px_10px_rgba(31,45,71,0.1)]">{error}</p>}
      {message && <p role="status" className="rounded-[12px] border border-[#5fe3d4]/30 bg-[#0d2b27]/85 p-2 text-[12px] text-[#8fe3d8] shadow-[0_2px_10px_rgba(0,0,0,0.3)]">{message}</p>}
      <XpButton type="submit" variant="primary" disabled={busy} className="w-full">{busy ? 'Bitte warten …' : mode === 'login' ? 'Anmelden' : 'Konto erstellen'}</XpButton>
      <button type="button" className="text-[12px] font-semibold text-[#5fe3d4] underline" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setMessage('') }}>
        {mode === 'login' ? 'Noch kein Konto? Registrieren' : 'Schon ein Konto? Anmelden'}
      </button>
    </form>}
  </XpWindow>
}
