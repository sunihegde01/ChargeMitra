import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button, LinkButton } from '../components/Button'
import { Spinner } from '../components/ui/Spinner'
import { supabase } from '../supabase'

export default function LoginPage() {
  const { session, loading: authLoading } = useAuth()
  if (authLoading) {
    return <div className="flex min-h-screen items-center justify-center"><Spinner size="md" /></div>
  }
  if (session) return <Navigate to="/account-type" replace />
  return <LoginForm />
}

function LoginForm() {
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
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setErrorMessage(error.message)
        return
      }

      navigate('/account-type', { replace: true })
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to log in. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-warm-ivory px-4 py-8 text-graphite sm:px-6 sm:py-12">
      <section className="w-full max-w-md rounded-[1.75rem] border border-sage-grey bg-white p-6 shadow-xl shadow-deep-forest/5 sm:p-10">
        <Link aria-label="ChargeMitra home" className="inline-flex items-center gap-2 text-sm font-semibold text-deep-forest hover:text-emerald-800" to="/">
          <span className="grid size-8 place-items-center rounded-lg bg-deep-forest text-xs font-bold text-electric-lime">C</span>
          ChargeMitra
        </Link>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.16em] text-deep-forest">Welcome back</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Log in to ChargeMitra</h1>
        <p className="mt-2 leading-6 text-slate-600">Continue to your account and pick up where you left off.</p>

        <form className="mt-8 flex flex-col gap-5" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Email
            <input
              autoComplete="email"
              className="cm-field"
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
              className="cm-field"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          <Button className="mt-1 w-full" disabled={loading} type="submit">
            {loading ? 'Logging in...' : 'Log in'}
          </Button>
        </form>

        {errorMessage && <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800" role="alert">{errorMessage}</p>}
        <p className="mt-7 flex flex-wrap items-center gap-x-1 gap-y-2 text-sm text-slate-600">
          New to ChargeMitra?
          <LinkButton className="min-h-9 px-3 py-1 text-sm" to="/register" variant="secondary">
            Create an account
          </LinkButton>
        </p>
      </section>
    </main>
  )
}
