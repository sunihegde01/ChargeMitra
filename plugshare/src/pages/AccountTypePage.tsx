import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase'

type ProfileRole = 'EV_OWNER' | 'PROVIDER' | 'BOTH'

export default function AccountTypePage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [profileRole, setProfileRole] = useState<ProfileRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let active = true

    async function loadProfileRole() {
      if (!user) return
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      if (!active) return
      if (error) {
        setErrorMessage(`Could not load your account: ${error.message}`)
      } else if (!data) {
        setErrorMessage('Your account profile is missing. Run supabase-fix.sql in the Supabase SQL Editor.')
      } else if (data.role !== 'EV_OWNER' && data.role !== 'PROVIDER' && data.role !== 'BOTH') {
        setErrorMessage('Your account has an unsupported role. Please contact support.')
      } else {
        setProfileRole(data.role)
      }
      setLoading(false)
    }

    void loadProfileRole()
    return () => { active = false }
  }, [user])

  async function chooseAccountType(type: 'owner' | 'host') {
    if (!user || !profileRole) return
    setSaving(true)
    setErrorMessage('')

    const requiredRole = type === 'owner' ? 'EV_OWNER' : 'PROVIDER'
    try {
      if (profileRole !== 'BOTH' && profileRole !== requiredRole) {
        const { data, error } = await supabase
          .from('profiles')
          .update({ role: 'BOTH' })
          .eq('id', user.id)
          .select('id')
          .single()

        if (error) {
          setErrorMessage(`Could not enable this account type: ${error.message}`)
          return
        }
        if (!data) {
          setErrorMessage('Your account type could not be updated. Please try again.')
          return
        }
        setProfileRole('BOTH')
      }

      navigate(type === 'host' ? '/provider/dashboard' : '/owner/dashboard', { replace: true })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not open this account type.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSignOut() {
    setSaving(true)
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not sign out.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f9f6] px-6 py-12 text-slate-900">
      <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-900/5 sm:p-10">
        <Link className="text-sm font-semibold text-emerald-700 hover:text-emerald-800" to="/">
          ← ChargeMitra
        </Link>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight">What would you like to do?</h1>
        <p className="mt-2 text-slate-600">Choose how you want to use ChargeMitra. You can use either option.</p>

        {loading && <p className="mt-8 text-slate-600">Loading your account...</p>}
        {errorMessage && <p className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800" role="alert">{errorMessage}</p>}

        {!loading && profileRole && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <button
              className="rounded-2xl border border-slate-200 p-6 text-left transition hover:-translate-y-0.5 hover:border-emerald-600 hover:bg-emerald-50 disabled:opacity-60"
              disabled={saving}
              onClick={() => void chooseAccountType('owner')}
              type="button"
            >
              <span aria-hidden="true" className="grid size-12 place-items-center rounded-xl bg-emerald-100 text-2xl text-emerald-800">⚡</span>
              <span className="mt-5 block text-lg font-semibold">EV user</span>
              <span className="mt-2 block text-sm leading-6 text-slate-600">Find chargers, add your vehicle, and manage bookings.</span>
              <span className="mt-5 block font-semibold text-emerald-800">Continue as user →</span>
            </button>
            <button
              className="rounded-2xl border border-slate-200 p-6 text-left transition hover:-translate-y-0.5 hover:border-emerald-600 hover:bg-emerald-50 disabled:opacity-60"
              disabled={saving}
              onClick={() => void chooseAccountType('host')}
              type="button"
            >
              <span aria-hidden="true" className="grid size-12 place-items-center rounded-xl bg-emerald-100 text-2xl text-emerald-800">⌂</span>
              <span className="mt-5 block text-lg font-semibold">Charging host</span>
              <span className="mt-2 block text-sm leading-6 text-slate-600">List your charging station and manage booking requests.</span>
              <span className="mt-5 block font-semibold text-emerald-800">Continue as host →</span>
            </button>
          </div>
        )}

        {saving && <p className="mt-4 text-sm text-slate-600" role="status">Opening your account...</p>}
        <button
          className="mt-7 text-sm font-semibold text-slate-600 underline"
          disabled={saving}
          onClick={() => void handleSignOut()}
          type="button"
        >
          Sign out
        </button>
      </section>
    </main>
  )
}
