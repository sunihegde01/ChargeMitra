import { Link } from 'react-router-dom'

const features = [
  {
    number: '01',
    title: 'Find a nearby charger',
    description: 'Explore charging options and find a station that fits your route.',
  },
  {
    number: '02',
    title: 'Know what to expect',
    description: 'Compare clear per-kWh pricing before you plug in.',
  },
  {
    number: '03',
    title: 'Charge with confidence',
    description: 'Keep your charging sessions and account details in one place.',
  },
]
const currentYear = new Date().getFullYear()

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f9f6] text-slate-900">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <Link aria-label="ChargeMitra home" className="flex items-center gap-2.5" to="/">
          <span className="grid size-10 place-items-center rounded-xl bg-emerald-700 text-lg font-bold text-white">
            C
          </span>
          <span className="text-xl font-bold tracking-tight">ChargeMitra</span>
        </Link>
        <nav aria-label="Main navigation" className="flex items-center gap-3">
          <Link className="hidden rounded-full px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white sm:inline-flex" to="/support">
            Help & support
          </Link>
          <Link className="rounded-full px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white" to="/login">
            Sign in
          </Link>
          <Link
            className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800"
            to="/register"
          >
            Create an account
          </Link>
        </nav>
      </header>

      <section className="relative mx-auto grid max-w-7xl items-center gap-14 px-6 pb-20 pt-12 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:pb-28 lg:pt-20">
        <div className="relative z-10">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-emerald-800">
            <span aria-hidden="true" className="size-2 rounded-full bg-emerald-500" />
            A simpler way to power every trip
          </p>
          <h1 className="max-w-2xl text-5xl font-semibold leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">
            The next stop for your{' '}
            <span className="text-emerald-700">electric journey.</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-slate-600">
            Find charging, understand the price, and get back on the road.
            ChargeMitra makes EV charging feel a little less complicated.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link
              className="rounded-full bg-emerald-700 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-900/10 transition hover:-translate-y-0.5 hover:bg-emerald-800"
              to="/register"
            >
              Create an account <span aria-hidden="true">→</span>
            </Link>
            <Link
              className="px-4 py-3 font-semibold text-slate-700 hover:text-emerald-800"
              to="/login"
            >
              Sign in
            </Link>
          </div>
          <div className="mt-12 flex items-center gap-4 border-t border-slate-200 pt-6">
            <div aria-hidden="true" className="flex -space-x-2">
              <span className="grid size-9 place-items-center rounded-full border-2 border-[#f7f9f6] bg-emerald-100 text-xs font-bold text-emerald-900">EV</span>
              <span className="grid size-9 place-items-center rounded-full border-2 border-[#f7f9f6] bg-amber-100 text-xs font-bold text-amber-900">GO</span>
              <span className="grid size-9 place-items-center rounded-full border-2 border-[#f7f9f6] bg-sky-100 text-xs font-bold text-sky-900">+</span>
            </div>
            <p className="text-sm text-slate-600">
              A clearer charging experience, from search to session.
            </p>
          </div>
        </div>

        <div aria-label="Electric vehicle charging illustration" className="relative mx-auto w-full max-w-xl">
          <div aria-hidden="true" className="absolute inset-8 rounded-full bg-emerald-200/50 blur-3xl" />
          <div className="relative rounded-[2rem] border border-white bg-white p-4 shadow-2xl shadow-emerald-950/10 sm:p-6">
            <div className="flex items-center justify-between px-2 pb-5">
              <div>
                <p className="text-sm font-semibold text-slate-900">Your next charge</p>
                <p className="mt-1 text-xs text-slate-500">A better stop is just around the corner</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">READY TO GO</span>
            </div>
            <div className="relative flex min-h-72 items-center justify-center overflow-hidden rounded-3xl bg-[#e8f1e8]">
              <div aria-hidden="true" className="absolute inset-0 opacity-60">
                <div className="absolute left-[12%] top-0 h-full w-px rotate-[24deg] bg-white" />
                <div className="absolute left-[70%] top-0 h-full w-px -rotate-[28deg] bg-white" />
                <div className="absolute left-0 top-[30%] h-px w-full rotate-[-12deg] bg-white" />
                <div className="absolute left-0 top-[72%] h-px w-full rotate-[9deg] bg-white" />
                <div className="absolute left-[38%] top-0 h-full w-px rotate-[8deg] bg-white" />
              </div>
              <div aria-hidden="true" className="absolute left-[18%] top-[22%] size-3 rounded-full bg-emerald-400 ring-8 ring-emerald-200/50" />
              <div aria-hidden="true" className="absolute right-[19%] top-[28%] size-3 rounded-full bg-emerald-400 ring-8 ring-emerald-200/50" />
              <div aria-hidden="true" className="absolute bottom-[18%] left-[28%] size-3 rounded-full bg-emerald-400 ring-8 ring-emerald-200/50" />
              <div className="relative grid size-24 place-items-center rounded-full border-[10px] border-white bg-emerald-700 shadow-xl shadow-emerald-900/20">
                <svg aria-hidden="true" className="size-10 text-white" fill="none" viewBox="0 0 24 24">
                  <path d="M13 2 5.5 13h5L10 22l8.5-12h-5L13 2Z" fill="currentColor" />
                </svg>
              </div>
              <div className="absolute bottom-5 left-5 rounded-2xl bg-white px-4 py-3 shadow-lg">
                <p className="text-xs text-slate-500">Charging made simple</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">Find your next stop</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 px-2 pt-5">
              <div>
                <p className="text-xs text-slate-500">More confidence on every trip</p>
                <p className="mt-1 font-semibold text-slate-900">Plug in. Power up. Go.</p>
              </div>
              <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-emerald-50 text-xl text-emerald-700">↗</span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-white" aria-labelledby="how-it-works">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-20">
          <div className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">Made for the road ahead</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl" id="how-it-works">
                Charging, without the guesswork.
              </h2>
            </div>
            <p className="max-w-md text-slate-600">
              Everything you need to make your next charging stop a more confident one.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {features.map((feature) => (
              <article className="rounded-3xl border border-slate-200 bg-[#fbfcfa] p-6 sm:p-7" key={feature.number}>
                <p className="text-sm font-semibold text-emerald-700">{feature.number}</p>
                <h3 className="mt-8 text-xl font-semibold">{feature.title}</h3>
                <p className="mt-3 leading-7 text-slate-600">{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-7 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <p>© {currentYear} ChargeMitra</p>
        <div className="flex flex-wrap items-center gap-4">
          <p>Helping every EV journey find its next charge.</p>
          <Link className="font-semibold text-emerald-700 hover:underline" to="/support">Help & support</Link>
        </div>
      </footer>
    </main>
  )
}
