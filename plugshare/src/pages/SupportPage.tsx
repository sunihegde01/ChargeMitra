import { useState } from 'react'
import type { FormEvent } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase'

type Message = { role: 'user' | 'assistant'; content: string }

async function getFunctionErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError && error.context instanceof Response) {
    try {
      const body = await error.context.json() as { error?: unknown; message?: unknown }
      if (typeof body.error === 'string') return body.error
      if (typeof body.message === 'string') return body.message
    } catch {
      return error.message
    }
  }
  return error instanceof Error ? error.message : 'Support chat is unavailable right now.'
}

const commonQuestions = [
  {
    question: 'How do I book a charger?',
    answer: 'Sign in, open Find a charger, select a charger on the map, choose your vehicle and a time slot, then send a booking request.',
  },
  {
    question: 'How is my charging bill calculated?',
    answer: 'The provider selects meter-based actual billing or time-based estimated billing. You confirm the method before charging begins.',
  },
  {
    question: 'How do I pay?',
    answer: 'The current booking option is pay at the station by cash or UPI. Confirm payment arrangements with the provider.',
  },
]

export default function SupportPage() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const question = input.trim()
    if (!question || !user || loading) return

    const nextMessages: Message[] = [...messages, { role: 'user', content: question }]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)
    setErrorMessage('')
    try {
      const { data, error } = await supabase.functions.invoke<{ answer: string }>('sarvam-assistant', {
        body: { messages: nextMessages.slice(-10) },
        headers: { 'x-sarvam-action': 'support-chat' },
      })
      if (error) throw new Error(await getFunctionErrorMessage(error))
      if (!data?.answer?.trim()) throw new Error('The support assistant returned an empty reply.')
      setMessages([...nextMessages, { role: 'assistant', content: data.answer }])
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Support chat is unavailable right now.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f9f6] px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <Link className="text-sm font-semibold text-emerald-700" to="/">← ChargeMitra home</Link>
        <header className="mt-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">How it works · Support</p>
          <h1 className="mt-2 text-3xl font-semibold">How can we help?</h1>
          <p className="mt-2 text-slate-600">Get guidance on bookings, charging bills, and payments.</p>
        </header>

        <section className="mt-6 space-y-3" aria-label="Common questions">
          {commonQuestions.map(({ question, answer }) => (
            <details className="rounded-2xl border border-slate-200 bg-white p-4" key={question}>
              <summary className="cursor-pointer font-semibold">{question}</summary>
              <p className="mt-3 text-sm leading-6 text-slate-600">{answer}</p>
            </details>
          ))}
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 sm:p-7" aria-labelledby="support-chat-heading">
          <h2 className="text-xl font-semibold" id="support-chat-heading">ChargeMitra support chat</h2>
          <p className="mt-1 text-sm text-slate-600">Ask in English, Kannada, or Hindi. Replies follow your language.</p>
          {!user ? (
            <p className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
              <Link className="font-semibold underline" to="/login">Sign in</Link> to chat with support.
            </p>
          ) : (
            <>
              <div aria-live="polite" className="mt-4 max-h-96 space-y-3 overflow-y-auto rounded-2xl bg-slate-50 p-4">
                {!messages.length && <p className="text-sm text-slate-500">Start with a question about booking, billing, or payment.</p>}
                {messages.map((message, index) => (
                  <p
                    className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === 'user' ? 'ml-auto bg-emerald-700 text-white' : 'bg-white text-slate-800 shadow-sm'}`}
                    key={`${message.role}-${index}`}
                  >
                    {message.content}
                  </p>
                ))}
                {loading && <p className="text-sm text-slate-500" role="status">Thinking…</p>}
              </div>
              <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => void sendMessage(event)}>
                <input
                  aria-label="Ask ChargeMitra support"
                  className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
                  maxLength={1000}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Type your question"
                  value={input}
                />
                <button
                  className="rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white disabled:opacity-60"
                  disabled={loading || !input.trim()}
                  type="submit"
                >
                  Send
                </button>
              </form>
              {errorMessage && <p className="mt-3 text-sm text-red-700" role="alert">{errorMessage}</p>}
            </>
          )}
        </section>
      </div>
    </main>
  )
}
