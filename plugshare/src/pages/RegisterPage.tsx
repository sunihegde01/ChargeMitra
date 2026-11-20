import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button, LinkButton } from '../components/Button'
import { Spinner } from '../components/ui/Spinner'
import { supabase } from '../supabase'

export default function RegisterPage() {
  const { session, loading: authLoading } = useAuth()
  if (authLoading) {
    return <div className="flex min-h-screen items-center justify-center"><Spinner size="md" /></div>
  }
  if (session) return <Navigate to="/account-type" replace />
  return <RegisterForm />
}

function RegisterForm() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [accountType, setAccountType] = useState<'EV_OWNER' | 'PROVIDER'>(
    searchParams.get('type') === 'host' ? 'PROVIDER' : 'EV_OWNER',
  )
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name, phone, role: accountType },
        },
      })

      if (error) {
        const message = error.message.toLowerCase()
        setErrorMessage(
          message.includes('database error saving new user')
            || message.includes('handle_new_auth_user')
            ? 'Supabase could not create your account profile. Run supabase-fix.sql once in your Supabase SQL Editor, then try registering again.'
            : error.message,
        )
      } else if (data.user && !data.session) {
        setSuccessMessage('Check your email to confirm your account.')
      } else if (data.user) {
        navigate('/account-type', { replace: true })
      } else {
        setErrorMessage('Sign-up completed without returning a user. Please try again.')
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to create your account. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-warm-ivory px-4 py-8 text-graphite sm:px-6 sm:py-12">
      <section className="w-full max-w-lg rounded-[1.75rem] border border-sage-grey bg-white p-6 shadow-xl shadow-deep-forest/5 sm:p-10">
        <Link aria-label="ChargeMitra home" className="inline-flex items-center gap-2 text-sm font-semibold text-deep-forest hover:text-emerald-800" to="/">
          <span className="grid size-8 place-items-center rounded-lg bg-deep-forest text-xs font-bold text-electric-lime">C</span>
          ChargeMitra
        </Link>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.16em] text-deep-forest">Join the charging community</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Create an account</h1>
        <p className="mt-2 leading-6 text-slate-600">One account for finding chargers or sharing yours.</p>

        <form className="mt-7 flex flex-col gap-5" onSubmit={handleSubmit}>
          <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-semibold">Create an account as</legend>
            <button
              aria-pressed={accountType === 'EV_OWNER'}
              className={`min-h-16 rounded-2xl border p-4 text-left transition hover:border-deep-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deep-forest ${accountType === 'EV_OWNER' ? 'border-deep-forest bg-warm-ivory' : 'border-slate-300 bg-white'}`}
              onClick={() => setAccountType('EV_OWNER')}
              type="button"
            >
              <span className="block font-semibold">EV user</span>
              <span className="text-xs text-slate-600">Find chargers</span>
            </button>
            <button
              aria-pressed={accountType === 'PROVIDER'}
              className={`min-h-16 rounded-2xl border p-4 text-left transition hover:border-deep-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deep-forest ${accountType === 'PROVIDER' ? 'border-deep-forest bg-warm-ivory' : 'border-slate-300 bg-white'}`}
              onClick={() => setAccountType('PROVIDER')}
              type="button"
            >
              <span className="block font-semibold">Charging host</span>
              <span className="text-xs text-slate-600">List chargers</span>
            </button>
          </fieldset>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Full name
            <input
              autoComplete="name"
              className="cm-field"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Phone
            <input
              autoComplete="tel"
              className="cm-field"
              type="tel"
              required
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Email
            <input
              autoComplete="email"
              className="cm-field"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Password
            <input
              autoComplete="new-password"
              className="cm-field"
              type="password"
              minLength={6}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <Button className="w-full" disabled={loading} type="submit">
            {loading ? 'Creating account...' : 'Create account'}
          </Button>
        </form>
        {errorMessage && <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800" role="alert">{errorMessage}</p>}
        {successMessage && <p className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900" role="status">{successMessage}</p>}
        <p className="mt-7 flex flex-wrap items-center gap-x-1 gap-y-2 text-sm text-slate-600">
          Already have an account?
          <LinkButton className="min-h-9 px-3 py-1 text-sm" to={`/login?type=${accountType === 'PROVIDER' ? 'host' : 'owner'}`} variant="secondary">
            Log in
          </LinkButton>
        </p>
      </section>
    </main>
  )
}
