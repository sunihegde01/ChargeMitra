import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabase'

export default function RegisterPage() {
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
        setErrorMessage(error.message)
      } else if (data.user && !data.session) {
        setSuccessMessage('Check your email to confirm your account.')
      } else if (data.user) {
        setSuccessMessage('Your account has been created.')
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
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-2xl font-semibold">Create an account</h1>
      <p className="mb-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
        Before registering, run <code>supabase-fix.sql</code> from the project in your Supabase SQL Editor to enable profile creation.
      </p>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <fieldset className="grid grid-cols-2 gap-3">
          <legend className="mb-2 text-sm font-medium">Create an account as</legend>
          <button
            aria-pressed={accountType === 'EV_OWNER'}
            className={`rounded-xl border p-3 text-left ${accountType === 'EV_OWNER' ? 'border-emerald-700 bg-emerald-50' : 'border-slate-300'}`}
            onClick={() => setAccountType('EV_OWNER')}
            type="button"
          >
            <span className="block font-semibold">EV user</span>
            <span className="text-xs text-slate-600">Find chargers</span>
          </button>
          <button
            aria-pressed={accountType === 'PROVIDER'}
            className={`rounded-xl border p-3 text-left ${accountType === 'PROVIDER' ? 'border-emerald-700 bg-emerald-50' : 'border-slate-300'}`}
            onClick={() => setAccountType('PROVIDER')}
            type="button"
          >
            <span className="block font-semibold">Charging host</span>
            <span className="text-xs text-slate-600">List chargers</span>
          </button>
        </fieldset>
        <label className="flex flex-col gap-1">
          Full name
          <input
            autoComplete="name"
            className="rounded border px-3 py-2"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          Phone
          <input
            autoComplete="tel"
            className="rounded border px-3 py-2"
            type="tel"
            required
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          Email
          <input
            autoComplete="email"
            className="rounded border px-3 py-2"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          Password
          <input
            autoComplete="new-password"
            className="rounded border px-3 py-2"
            type="password"
            minLength={6}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button
          className="rounded bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-60"
          disabled={loading}
          type="submit"
        >
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>
      {errorMessage && <p className="mt-4 text-red-700" role="alert">{errorMessage}</p>}
      {successMessage && <p className="mt-4 text-emerald-700" role="status">{successMessage}</p>}
      <p className="mt-6">
        Already have an account? <Link className="text-emerald-700 underline" to={`/login?type=${accountType === 'PROVIDER' ? 'host' : 'owner'}`}>Log in</Link>
      </p>
    </main>
  )
}
