import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setErrorMessage('')

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setErrorMessage(error.message)
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle()

      if (profileError) {
        setErrorMessage(`Logged in, but could not load your profile: ${profileError.message}`)
        return
      }
      if (!profile) {
        setErrorMessage('Your account profile is missing. Run supabase-fix.sql in the Supabase SQL Editor, then try logging in again.')
        return
      }

      navigate(profile.role === 'PROVIDER' || profile.role === 'BOTH' ? '/provider/dashboard' : '/owner/dashboard', {
        replace: true,
      })
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to log in. Please try again.',
      )
    } finally {
      setLoading(false)
    }

  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f9f6] px-6 py-12 text-slate-900">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-900/5 sm:p-10">
        <Link className="text-sm font-semibold text-emerald-700 hover:text-emerald-800" to="/">
          ← ChargeMitra
        </Link>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-2 text-slate-600">Log in to continue to your ChargeMitra account.</p>

        <form className="mt-8 flex flex-col gap-5" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Email
            <input
              autoComplete="email"
              className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Password
            <input
              autoComplete="current-password"
              className="rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          <button
            className="mt-1 rounded-full bg-emerald-700 px-5 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            {loading ? 'Logging in...' : 'Log in'}
          </button>
        </form>

        {errorMessage && <p className="mt-5 text-sm text-red-700" role="alert">{errorMessage}</p>}
        <p className="mt-7 text-sm text-slate-600">
          New to ChargeMitra?{' '}
          <Link className="font-semibold text-emerald-700 hover:underline" to="/register">
            Create an account
          </Link>
        </p>
      </section>
    </main>
  )
}
