import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'

const root = ReactDOM.createRoot(document.getElementById('root')!)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
const supabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl !== 'https://your-project.supabase.co' &&
    supabaseAnonKey !== 'your-supabase-anon-key',
)

if (!supabaseConfigured) {
  root.render(
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-900">
      <section className="w-full max-w-xl rounded-2xl bg-white p-8 shadow">
        <h1 className="text-2xl font-semibold">Supabase configuration required</h1>
        <p className="mt-3 text-slate-700">
          The app needs a Supabase project URL and publishable/anon key before it can load.
        </p>
        <ol className="mt-4 list-inside list-decimal space-y-2 text-slate-700">
          <li>Copy the repository-root .env.example to .env.local.</li>
          <li>Replace both example values with your Supabase project credentials.</li>
          <li>Restart the dev server with npm run dev.</li>
        </ol>
      </section>
    </main>,
  )
} else {
  void Promise.all([import('./App'), import('./context/AuthContext')]).then(
    ([{ default: App }, { AuthProvider }]) => {
      root.render(
        <React.StrictMode>
          <BrowserRouter>
            <AuthProvider>
              <App />
            </AuthProvider>
          </BrowserRouter>
        </React.StrictMode>,
      )
    },
  )
}
