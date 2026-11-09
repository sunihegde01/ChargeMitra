import { useCallback, useEffect, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { clearDefaultVehicleId, getDefaultVehicleId, setDefaultVehicleId } from '../../vehiclePreference'
import { supabase } from '../../supabase'

type Vehicle = {
  id: string
  brand: string
  model: string
  variant: string | null
  usable_battery_kwh: number
  connector_types: string[]
}

type Booking = {
  id: string
  status: string
  scheduled_start: string
  scheduled_end: string
  price_per_kwh_snapshot: number
  estimated_total_snapshot: number | null
  payment_method: string | null
  charger_id: string
}

type Charger = { id: string; name: string }
type SessionLink = { id: string; booking_id: string }

type VehicleModelSpec = {
  model: string
  batteryKwh: number
  maxAcKw: number
  maxDcKw: number
  connectors: string[]
}

const vehicleModelsByBrand: Record<string, VehicleModelSpec[]> = {
  Audi: [
    { model: 'Q4 e-tron', batteryKwh: 77, maxAcKw: 11, maxDcKw: 175, connectors: ['Type 2', 'CCS2'] },
    { model: 'Q6 e-tron', batteryKwh: 94.9, maxAcKw: 11, maxDcKw: 270, connectors: ['Type 2', 'CCS2'] },
    { model: 'Q8 e-tron', batteryKwh: 114, maxAcKw: 11, maxDcKw: 170, connectors: ['Type 2', 'CCS2'] },
    { model: 'e-tron GT', batteryKwh: 93.4, maxAcKw: 11, maxDcKw: 270, connectors: ['Type 2', 'CCS2'] },
  ],
  BMW: [
    { model: 'i4', batteryKwh: 83.9, maxAcKw: 11, maxDcKw: 205, connectors: ['Type 2', 'CCS2'] },
    { model: 'i5', batteryKwh: 81.2, maxAcKw: 11, maxDcKw: 205, connectors: ['Type 2', 'CCS2'] },
    { model: 'i7', batteryKwh: 101.7, maxAcKw: 11, maxDcKw: 195, connectors: ['Type 2', 'CCS2'] },
    { model: 'iX', batteryKwh: 111.5, maxAcKw: 11, maxDcKw: 195, connectors: ['Type 2', 'CCS2'] },
    { model: 'iX1', batteryKwh: 66.4, maxAcKw: 11, maxDcKw: 130, connectors: ['Type 2', 'CCS2'] },
  ],
  BYD: [
    { model: 'Atto 3', batteryKwh: 60.5, maxAcKw: 7, maxDcKw: 80, connectors: ['Type 2', 'CCS2'] },
    { model: 'e6', batteryKwh: 71.7, maxAcKw: 6.6, maxDcKw: 60, connectors: ['Type 2', 'CCS2'] },
    { model: 'eMAX 7', batteryKwh: 55.4, maxAcKw: 7, maxDcKw: 115, connectors: ['Type 2', 'CCS2'] },
    { model: 'Seal', batteryKwh: 82.5, maxAcKw: 11, maxDcKw: 150, connectors: ['Type 2', 'CCS2'] },
    { model: 'Sealion 7', batteryKwh: 82.5, maxAcKw: 11, maxDcKw: 150, connectors: ['Type 2', 'CCS2'] },
  ],
  Citroen: [
    { model: 'eC3', batteryKwh: 29.2, maxAcKw: 7.2, maxDcKw: 30, connectors: ['Type 2', 'CCS2'] },
  ],
  Hyundai: [
    { model: 'Creta Electric', batteryKwh: 42, maxAcKw: 11, maxDcKw: 100, connectors: ['Type 2', 'CCS2'] },
    { model: 'IONIQ 5', batteryKwh: 72.6, maxAcKw: 11, maxDcKw: 220, connectors: ['Type 2', 'CCS2'] },
    { model: 'IONIQ 6', batteryKwh: 77.4, maxAcKw: 11, maxDcKw: 230, connectors: ['Type 2', 'CCS2'] },
    { model: 'Kona Electric', batteryKwh: 64, maxAcKw: 11, maxDcKw: 100, connectors: ['Type 2', 'CCS2'] },
  ],
  Kia: [
    { model: 'Carens Clavis EV', batteryKwh: 51.4, maxAcKw: 11, maxDcKw: 100, connectors: ['Type 2', 'CCS2'] },
    { model: 'EV6', batteryKwh: 77.4, maxAcKw: 11, maxDcKw: 240, connectors: ['Type 2', 'CCS2'] },
    { model: 'EV9', batteryKwh: 99.8, maxAcKw: 11, maxDcKw: 210, connectors: ['Type 2', 'CCS2'] },
  ],
  Mahindra: [
    { model: 'BE 6', batteryKwh: 59, maxAcKw: 11, maxDcKw: 140, connectors: ['Type 2', 'CCS2'] },
    { model: 'XEV 9e', batteryKwh: 59, maxAcKw: 11, maxDcKw: 140, connectors: ['Type 2', 'CCS2'] },
    { model: 'XUV400 EV', batteryKwh: 39.4, maxAcKw: 7.2, maxDcKw: 50, connectors: ['Type 2', 'CCS2'] },
  ],
  'Maruti Suzuki': [
    { model: 'e Vitara', batteryKwh: 61, maxAcKw: 7.2, maxDcKw: 70, connectors: ['Type 2', 'CCS2'] },
  ],
  'Mercedes-Benz': [
    { model: 'EQA', batteryKwh: 70.5, maxAcKw: 11, maxDcKw: 100, connectors: ['Type 2', 'CCS2'] },
    { model: 'EQB', batteryKwh: 70.5, maxAcKw: 11, maxDcKw: 100, connectors: ['Type 2', 'CCS2'] },
    { model: 'EQE SUV', batteryKwh: 90.6, maxAcKw: 11, maxDcKw: 170, connectors: ['Type 2', 'CCS2'] },
    { model: 'EQS SUV', batteryKwh: 108.4, maxAcKw: 11, maxDcKw: 200, connectors: ['Type 2', 'CCS2'] },
  ],
  MG: [
    { model: 'Comet EV', batteryKwh: 17.3, maxAcKw: 3.3, maxDcKw: 0, connectors: ['Type 2'] },
    { model: 'Cyberster', batteryKwh: 77, maxAcKw: 11, maxDcKw: 144, connectors: ['Type 2', 'CCS2'] },
    { model: 'Windsor EV', batteryKwh: 38, maxAcKw: 7.4, maxDcKw: 45, connectors: ['Type 2', 'CCS2'] },
    { model: 'ZS EV', batteryKwh: 50.3, maxAcKw: 7.4, maxDcKw: 50, connectors: ['Type 2', 'CCS2'] },
  ],
  Porsche: [
    { model: 'Macan Electric', batteryKwh: 95, maxAcKw: 11, maxDcKw: 270, connectors: ['Type 2', 'CCS2'] },
    { model: 'Taycan', batteryKwh: 93.4, maxAcKw: 11, maxDcKw: 270, connectors: ['Type 2', 'CCS2'] },
  ],
  'Tata Motors': [
    { model: 'Curvv EV', batteryKwh: 55, maxAcKw: 7.2, maxDcKw: 70, connectors: ['Type 2', 'CCS2'] },
    { model: 'Harrier EV', batteryKwh: 65, maxAcKw: 7.2, maxDcKw: 120, connectors: ['Type 2', 'CCS2'] },
    { model: 'Nexon EV', batteryKwh: 45, maxAcKw: 7.2, maxDcKw: 60, connectors: ['Type 2', 'CCS2'] },
    { model: 'Punch EV', batteryKwh: 35, maxAcKw: 7.2, maxDcKw: 50, connectors: ['Type 2', 'CCS2'] },
    { model: 'Tiago EV', batteryKwh: 24, maxAcKw: 7.2, maxDcKw: 50, connectors: ['Type 2', 'CCS2'] },
    { model: 'Tigor EV', batteryKwh: 26, maxAcKw: 7.2, maxDcKw: 25, connectors: ['Type 2', 'CCS2'] },
  ],
  Tesla: [
    { model: 'Model 3', batteryKwh: 75, maxAcKw: 11, maxDcKw: 250, connectors: ['Type 2', 'CCS2'] },
    { model: 'Model S', batteryKwh: 100, maxAcKw: 11, maxDcKw: 250, connectors: ['Type 2', 'CCS2'] },
    { model: 'Model X', batteryKwh: 100, maxAcKw: 11, maxDcKw: 250, connectors: ['Type 2', 'CCS2'] },
    { model: 'Model Y', batteryKwh: 75, maxAcKw: 11, maxDcKw: 250, connectors: ['Type 2', 'CCS2'] },
  ],
  VinFast: [
    { model: 'VF 6', batteryKwh: 59.6, maxAcKw: 11, maxDcKw: 100, connectors: ['Type 2', 'CCS2'] },
    { model: 'VF 7', batteryKwh: 75.3, maxAcKw: 11, maxDcKw: 150, connectors: ['Type 2', 'CCS2'] },
  ],
  Volvo: [
    { model: 'EX30', batteryKwh: 69, maxAcKw: 11, maxDcKw: 153, connectors: ['Type 2', 'CCS2'] },
    { model: 'EX40', batteryKwh: 78, maxAcKw: 11, maxDcKw: 200, connectors: ['Type 2', 'CCS2'] },
    { model: 'EX90', batteryKwh: 107, maxAcKw: 11, maxDcKw: 250, connectors: ['Type 2', 'CCS2'] },
  ],
}

const fieldClass = 'w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15'

export default function OwnerDashboard() {
  const { user, signOut } = useAuth()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [chargers, setChargers] = useState<Charger[]>([])
  const [sessionsByBooking, setSessionsByBooking] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [defaultVehicleId, setDefaultVehicleIdState] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [battery, setBattery] = useState('')
  const [maxAc, setMaxAc] = useState('')
  const [maxDc, setMaxDc] = useState('')
  const [connectors, setConnectors] = useState('Type 2, CCS2')
  const [companyOptionsOpen, setCompanyOptionsOpen] = useState(false)
  const [modelOptionsOpen, setModelOptionsOpen] = useState(false)
  const [activeCompanyOption, setActiveCompanyOption] = useState(0)
  const [activeModelOption, setActiveModelOption] = useState(0)
  const brandSuggestions = Object.keys(vehicleModelsByBrand).filter((company) =>
    !brand.trim() || company.toLowerCase().startsWith(brand.trim().toLowerCase()),
  )
  const matchingBrand = Object.keys(vehicleModelsByBrand).find((company) =>
    company.toLowerCase() === brand.trim().toLowerCase(),
  )
  const modelSuggestions = matchingBrand
    ? vehicleModelsByBrand[matchingBrand].filter((vehicle) =>
      vehicle.model.toLowerCase().includes(model.trim().toLowerCase()),
    )
    : []

  function chooseCompany(company: string) {
    setBrand(company)
    setModel('')
    setBattery('')
    setMaxAc('')
    setMaxDc('')
    setConnectors('')
    setCompanyOptionsOpen(false)
    setModelOptionsOpen(false)
    setActiveModelOption(0)
  }

  function chooseModel(vehicle: VehicleModelSpec) {
    setModel(vehicle.model)
    setBattery(String(vehicle.batteryKwh))
    setMaxAc(String(vehicle.maxAcKw))
    setMaxDc(String(vehicle.maxDcKw))
    setConnectors(vehicle.connectors.join(', '))
    setModelOptionsOpen(false)
  }

  function handleCompanyKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' && brandSuggestions.length) {
      event.preventDefault()
      setCompanyOptionsOpen(true)
      setActiveCompanyOption((index) => (index + 1) % brandSuggestions.length)
    } else if (event.key === 'ArrowUp' && brandSuggestions.length) {
      event.preventDefault()
      setCompanyOptionsOpen(true)
      setActiveCompanyOption((index) => (index - 1 + brandSuggestions.length) % brandSuggestions.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const company = brandSuggestions[activeCompanyOption]
      if (company) chooseCompany(company)
    } else if (event.key === 'Escape') {
      setCompanyOptionsOpen(false)
    }
  }

  function handleModelKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' && modelSuggestions.length) {
      event.preventDefault()
      setModelOptionsOpen(true)
      setActiveModelOption((index) => (index + 1) % modelSuggestions.length)
    } else if (event.key === 'ArrowUp' && modelSuggestions.length) {
      event.preventDefault()
      setModelOptionsOpen(true)
      setActiveModelOption((index) => (index - 1 + modelSuggestions.length) % modelSuggestions.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const vehicle = modelSuggestions[activeModelOption]
      if (vehicle) chooseModel(vehicle)
    } else if (event.key === 'Escape') {
      setModelOptionsOpen(false)
    }
  }

  const loadDashboard = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setErrorMessage('')

    const [vehiclesResult, bookingsResult] = await Promise.all([
      supabase
        .from('vehicles')
        .select('id,brand,model,variant,usable_battery_kwh,connector_types')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('bookings')
        .select('id,status,scheduled_start,scheduled_end,price_per_kwh_snapshot,estimated_total_snapshot,payment_method,charger_id')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false }),
    ])

    if (vehiclesResult.error || bookingsResult.error) {
      setErrorMessage(
        vehiclesResult.error?.message ?? bookingsResult.error?.message ?? 'Could not load your dashboard.',
      )
      setLoading(false)
      return
    }

    const vehicleRows = vehiclesResult.data ?? []
    const bookingRows = bookingsResult.data ?? []
    setVehicles(vehicleRows)
    setBookings(bookingRows)
    const savedVehicleId = getDefaultVehicleId(user.id)
    const nextDefaultVehicleId = vehicleRows.some((vehicle) => vehicle.id === savedVehicleId)
      ? savedVehicleId
      : vehicleRows[0]?.id ?? ''
    setDefaultVehicleIdState(nextDefaultVehicleId)
    if (nextDefaultVehicleId) setDefaultVehicleId(user.id, nextDefaultVehicleId)
    else clearDefaultVehicleId(user.id)

    const bookingIds = bookingRows.map((booking) => booking.id)
    if (bookingIds.length) {
      const { data: sessionRows, error } = await supabase
        .from('charging_sessions')
        .select('id,booking_id')
        .in('booking_id', bookingIds)
      if (error) setErrorMessage(error.message)
      else {
        setSessionsByBooking(Object.fromEntries(
          ((sessionRows ?? []) as SessionLink[]).map((session) => [session.booking_id, session.id]),
        ))
      }
    } else {
      setSessionsByBooking({})
    }

    const chargerIds = [...new Set(bookingRows.map((booking) => booking.charger_id))]
    if (chargerIds.length) {
      const { data: chargerRows, error } = await supabase
        .from('chargers')
        .select('id,name')
        .in('id', chargerIds)
      if (error) setErrorMessage(error.message)
      else setChargers(chargerRows ?? [])
    } else {
      setChargers([])
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  function chooseDefaultVehicle(vehicleId: string) {
    if (!user) return
    setDefaultVehicleIdState(vehicleId)
    setDefaultVehicleId(user.id, vehicleId)
    setSuccessMessage('Default car for bookings updated.')
  }

  async function addVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return
    setSaving(true)
    setErrorMessage('')
    setSuccessMessage('')

    const { data, error } = await supabase.from('vehicles').insert({
      owner_id: user.id,
      brand,
      model,
      usable_battery_kwh: Number(battery),
      max_ac_kw: Number(maxAc),
      max_dc_kw: Number(maxDc),
      connector_types: connectors.split(',').map((connector) => connector.trim()).filter(Boolean),
    }).select('id').single()

    if (error || !data) {
      setErrorMessage(error?.message ?? 'The car was added but could not be selected.')
    } else {
      setDefaultVehicleIdState(data.id)
      setDefaultVehicleId(user.id, data.id)
      setBrand('')
      setModel('')
      setBattery('')
      setMaxAc('')
      setMaxDc('')
      setConnectors('')
      setSuccessMessage('Vehicle added.')
      await loadDashboard()
    }
    setSaving(false)
  }

  const defaultVehicle = vehicles.find((vehicle) => vehicle.id === defaultVehicleId)

  return (
    <main className="min-h-screen bg-[#f7f9f6] px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link className="text-sm font-semibold text-emerald-700" to="/">ChargeMitra</Link>
            <h1 className="mt-3 text-3xl font-semibold">User dashboard</h1>
            <p className="mt-1 text-slate-600">Manage your vehicles and charging bookings.</p>
          </div>
          <button className="rounded-full border border-slate-300 px-5 py-3 font-semibold" onClick={() => void signOut()}>Sign out</button>
        </header>

        {errorMessage && <p className="mt-6 rounded-xl bg-red-50 p-4 text-red-800" role="alert">{errorMessage}</p>}
        {successMessage && <p className="mt-6 rounded-xl bg-emerald-50 p-4 text-emerald-800" role="status">{successMessage}</p>}

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Default vehicle</h2>
              <a className="text-sm font-semibold text-emerald-700 underline" href="#add-car">Add another car</a>
            </div>
            {loading ? <p className="mt-4 text-slate-600">Loading vehicles...</p> : vehicles.length ? (
              <>
                {defaultVehicle && (
                  <div className="mt-4 rounded-2xl bg-emerald-50 p-4">
                    <p className="font-semibold">{defaultVehicle.brand} {defaultVehicle.model}{defaultVehicle.variant ? ` · ${defaultVehicle.variant}` : ''}</p>
                    <p className="mt-1 text-sm text-slate-600">{defaultVehicle.usable_battery_kwh} kWh · {defaultVehicle.connector_types.join(', ')}</p>
                  </div>
                )}
                <label className="mt-4 grid gap-2 text-sm font-medium text-slate-700">
                  Change default vehicle
                  <select
                    className={fieldClass}
                    onChange={(event) => chooseDefaultVehicle(event.target.value)}
                    value={defaultVehicleId}
                  >
                    {vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>{vehicle.brand} {vehicle.model}</option>
                    ))}
                  </select>
                </label>
              </>
            ) : <p className="mt-4 text-slate-600">Add your car to start booking chargers.</p>}

            {!!vehicles.length && <p className="mt-3 text-xs text-slate-500">This vehicle is automatically used for charger bookings.</p>}

            <form className="mt-6 grid gap-3 border-t border-slate-100 pt-6 sm:grid-cols-2" id="add-car" onSubmit={addVehicle}>
              <h3 className="font-semibold sm:col-span-2">Add your car</h3>
              <label className="relative grid gap-1 text-sm font-medium text-slate-700">
                Company
                <input
                  aria-activedescendant={companyOptionsOpen ? `company-option-${activeCompanyOption}` : undefined}
                  aria-autocomplete="list"
                  aria-controls="vehicle-company-options"
                  aria-expanded={companyOptionsOpen && brandSuggestions.length > 0}
                  aria-label="Vehicle company"
                  autoComplete="off"
                  className={fieldClass}
                  onBlur={() => setCompanyOptionsOpen(false)}
                  onChange={(event) => {
                    setBrand(event.target.value)
                    setModel('')
                    setBattery('')
                    setMaxAc('')
                    setMaxDc('')
                    setConnectors('')
                    setActiveCompanyOption(0)
                    setCompanyOptionsOpen(true)
                  }}
                  onFocus={() => setCompanyOptionsOpen(true)}
                  onKeyDown={handleCompanyKeyDown}
                  placeholder="Start typing a company name"
                  required
                  role="combobox"
                  value={brand}
                />
                {companyOptionsOpen && brandSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg" id="vehicle-company-options" role="listbox">
                    {brandSuggestions.map((company, index) => (
                      <button
                        aria-selected={index === activeCompanyOption}
                        className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${index === activeCompanyOption ? 'bg-emerald-50 text-emerald-900' : 'hover:bg-slate-50'}`}
                        id={`company-option-${index}`}
                        key={company}
                        onClick={() => chooseCompany(company)}
                        onMouseDown={(event) => event.preventDefault()}
                        role="option"
                        type="button"
                      >
                        {company}
                      </button>
                    ))}
                  </div>
                )}
              </label>
              <label className="relative grid gap-1 text-sm font-medium text-slate-700">
                Car model
                <input
                  aria-activedescendant={modelOptionsOpen ? `model-option-${activeModelOption}` : undefined}
                  aria-autocomplete="list"
                  aria-controls="vehicle-model-options"
                  aria-expanded={modelOptionsOpen && modelSuggestions.length > 0}
                  aria-label="Vehicle model"
                  autoComplete="off"
                  className={fieldClass}
                  onBlur={() => setModelOptionsOpen(false)}
                  onChange={(event) => {
                    const nextModel = event.target.value
                    setModel(nextModel)
                    setActiveModelOption(0)
                    setModelOptionsOpen(true)
                    const exactMatch = matchingBrand
                      ? vehicleModelsByBrand[matchingBrand].find((vehicle) => vehicle.model.toLowerCase() === nextModel.trim().toLowerCase())
                      : undefined
                    if (exactMatch) chooseModel(exactMatch)
                  }}
                  onFocus={() => setModelOptionsOpen(true)}
                  onKeyDown={handleModelKeyDown}
                  placeholder={matchingBrand ? 'Choose or type a model' : 'Enter a company to see model suggestions'}
                  required
                  role="combobox"
                  value={model}
                />
                {modelOptionsOpen && modelSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg" id="vehicle-model-options" role="listbox">
                    {modelSuggestions.map((vehicle, index) => (
                      <button
                        aria-selected={index === activeModelOption}
                        className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${index === activeModelOption ? 'bg-emerald-50 text-emerald-900' : 'hover:bg-slate-50'}`}
                        id={`model-option-${index}`}
                        key={vehicle.model}
                        onClick={() => chooseModel(vehicle)}
                        onMouseDown={(event) => event.preventDefault()}
                        role="option"
                        type="button"
                      >
                        {vehicle.model} · {vehicle.batteryKwh} kWh
                      </button>
                    ))}
                  </div>
                )}
              </label>
              <p className="text-xs text-slate-500 sm:col-span-2">Choosing a model fills typical specifications. Values can vary by year and trim, so check and edit them for your car.</p>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Usable battery (kWh)
                <input aria-label="Usable battery in kWh" className={fieldClass} min="0.1" placeholder="Battery capacity" required type="number" step="0.1" value={battery} onChange={(event) => setBattery(event.target.value)} />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Maximum AC charging power (kW)
                <input aria-label="Maximum AC power in kW" className={fieldClass} min="0.1" placeholder="Max AC power" required type="number" step="0.1" value={maxAc} onChange={(event) => setMaxAc(event.target.value)} />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Maximum DC charging power (kW)
                <input aria-label="Maximum DC power in kW" className={fieldClass} min="0" placeholder="Enter 0 if unsupported" required type="number" step="0.1" value={maxDc} onChange={(event) => setMaxDc(event.target.value)} />
              </label>
              <input aria-label="Connector types, separated by commas" className={fieldClass} placeholder="Connectors, comma separated" required value={connectors} onChange={(event) => setConnectors(event.target.value)} />
              <button className="rounded-full bg-slate-900 px-5 py-3 font-semibold text-white disabled:opacity-60 sm:col-span-2" disabled={saving} type="submit">{saving ? 'Saving...' : 'Add car'}</button>
            </form>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-semibold">Your bookings</h2>
            {loading ? <p className="mt-4 text-slate-600">Loading bookings...</p> : bookings.length ? (
              <ul className="mt-4 divide-y divide-slate-100">
                {bookings.map((booking) => (
                  <li className="py-4 first:pt-0 last:pb-0" key={booking.id}>
                    <p className="font-semibold">{chargers.find((charger) => charger.id === booking.charger_id)?.name ?? 'Charger booking'}</p>
                    <p className="mt-1 text-sm text-slate-600">{new Date(booking.scheduled_start).toLocaleString()} · {booking.status}</p>
                    <p className="mt-1 text-sm text-slate-600">₹{booking.price_per_kwh_snapshot}/kWh · Estimated total {booking.estimated_total_snapshot == null ? 'not available' : `₹${Number(booking.estimated_total_snapshot).toFixed(2)}`}</p>
                    <p className="mt-1 text-sm text-slate-600">Payment: {booking.payment_method === 'PAY_AT_STATION' ? 'Pay at station (cash/UPI)' : booking.payment_method ?? 'Not recorded'}</p>
                    {sessionsByBooking[booking.id] && (
                      <Link className="mt-2 inline-flex text-sm font-semibold text-emerald-700 underline" to={`/session/${sessionsByBooking[booking.id]}`}>Open charging session</Link>
                    )}
                  </li>
                ))}
              </ul>
            ) : <p className="mt-4 text-slate-600">Your upcoming bookings will appear here.</p>}
            <Link
              className="group mt-6 flex items-center justify-between gap-4 overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-500 p-5 text-white shadow-lg shadow-emerald-900/15 transition hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-emerald-300"
              to="/owner/find"
            >
              <span className="flex items-center gap-4">
                <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-xl bg-white/15 text-2xl ring-1 ring-white/20">⚡</span>
                <span>
                  <span className="block text-lg font-semibold">Find a charger</span>
                  <span className="mt-1 block text-sm text-emerald-50">Explore nearby charging points and book a time</span>
                </span>
              </span>
              <span aria-hidden="true" className="text-2xl transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
