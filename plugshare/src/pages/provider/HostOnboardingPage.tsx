import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Map, { Marker, NavigationControl } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useAuth } from '../../context/AuthContext'
import { approximatePoint, parsePoint, reverseGeocode } from '../../location'
import { MAP_STYLE } from '../../mapStyle'
import { supabase } from '../../supabase'

type BusinessType = 'HOTEL' | 'PUBLIC_PARKING' | 'PRIVATE_HOME'
type HostForm = {
  businessName: string
  address: string
  city: string
  state: string
  pinCode: string
  latitude: string
  longitude: string
  contactPerson: string
  receptionPhone: string
  evBays: string
  accessType: 'GUESTS_ONLY' | 'OPEN_TO_PUBLIC'
  restaurant: boolean
  restroom: boolean
  wifi: boolean
  desk24x7: boolean
  entryInstructions: string
  hotelLicense: string
  homeContactNumber: string
  homeType: 'INDEPENDENT_HOUSE' | 'VILLA' | 'APARTMENT_SOCIETY'
  parkingLocation: 'OWN_GARAGE' | 'DRIVEWAY' | 'SOCIETY_PARKING'
  societyName: string
  societyApproval: boolean
  numberOfChargers: string
  availabilityHours: string
  homeIdAddressProof: string
  electricityBill: string
  hostApprovalRequired: boolean
  parkingType: 'MALL' | 'OPEN_LOT' | 'MULTI_LEVEL' | 'ROADSIDE' | 'OTHER'
  covered: boolean
  totalSlots: string
  open24x7: boolean
  openingHours: string
  parkingFeeType: 'FREE' | 'HOURLY'
  hourlyFee: string
  attendant: boolean
  security: boolean
  cctv: boolean
  heightLimit: string
  parkingLicense: string
}

const fieldClass = 'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15'
const initialForm: HostForm = {
  businessName: '',
  address: '',
  city: '',
  state: '',
  pinCode: '',
  latitude: '',
  longitude: '',
  contactPerson: '',
  receptionPhone: '',
  evBays: '',
  accessType: 'GUESTS_ONLY',
  restaurant: false,
  restroom: false,
  wifi: false,
  desk24x7: false,
  entryInstructions: '',
  hotelLicense: '',
  homeContactNumber: '',
  homeType: 'INDEPENDENT_HOUSE',
  parkingLocation: 'OWN_GARAGE',
  societyName: '',
  societyApproval: false,
  numberOfChargers: '1',
  availabilityHours: '24x7',
  homeIdAddressProof: '',
  electricityBill: '',
  hostApprovalRequired: true,
  parkingType: 'MALL',
  covered: false,
  totalSlots: '',
  open24x7: false,
  openingHours: '',
  parkingFeeType: 'FREE',
  hourlyFee: '',
  attendant: false,
  security: false,
  cctv: false,
  heightLimit: '',
  parkingLicense: '',
}
const defaultMapView = { latitude: 20.5937, longitude: 78.9629, zoom: 4 }

function isBusinessType(value: string | null): value is BusinessType {
  return value === 'HOTEL' || value === 'PUBLIC_PARKING' || value === 'PRIVATE_HOME'
}

function optionalNumber(value: string): number | null {
  return value.trim() ? Number(value) : null
}

export default function HostOnboardingPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const businessType = searchParams.get('type')
  const [providerId, setProviderId] = useState('')
  const [form, setForm] = useState<HostForm>(initialForm)
  const [mapViewState, setMapViewState] = useState(defaultMapView)
  const [initializing, setInitializing] = useState(true)
  const [saving, setSaving] = useState(false)
  const [locating, setLocating] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [locationMessage, setLocationMessage] = useState('')
  const locationLookupId = useRef(0)

  useEffect(() => {
    let active = true

    async function loadOnboarding() {
      if (!user || !isBusinessType(businessType)) {
        setInitializing(false)
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      if (!active) return
      if (profileError) {
        setErrorMessage(`Could not verify host access: ${profileError.message}`)
        setInitializing(false)
        return
      }
      if (!profile || (profile.role !== 'PROVIDER' && profile.role !== 'BOTH')) {
        setErrorMessage('Choose Charging host from account selection before continuing.')
        setInitializing(false)
        return
      }

      const { data: provider, error: providerError } = await supabase
        .from('providers')
        .select('id,business_name,business_type,address,location')
        .eq('profile_id', user.id)
        .maybeSingle()

      if (!active) return
      if (providerError) {
        setErrorMessage(`Could not load your host profile: ${providerError.message}`)
        setInitializing(false)
        return
      }

      if (!provider) {
        setInitializing(false)
        return
      }

      setProviderId(provider.id)
      setForm((current) => ({
        ...current,
        businessName: provider.business_name ?? '',
      }))
      const point = parsePoint(provider.location)
      if (point) {
        setForm((current) => ({
          ...current,
          businessName: provider.business_name ?? '',
          latitude: String(point.lat),
          longitude: String(point.lng),
        }))
        setMapViewState({ latitude: point.lat, longitude: point.lng, zoom: 15 })
      }

      if (provider.business_type === businessType) {
        const table = businessType === 'HOTEL'
          ? 'hotel_details'
          : businessType === 'PUBLIC_PARKING' ? 'parking_details' : 'home_details'
        const { data: details, error: detailsError } = await supabase
          .from(table)
          .select('*')
          .eq('provider_id', provider.id)
          .maybeSingle()
        if (!active) return
        if (detailsError) {
          setErrorMessage(`Could not load your business details: ${detailsError.message}`)
        } else if (details) {
          const row = details as Record<string, unknown>
          setForm((current) => ({
            ...current,
            address: businessType === 'PRIVATE_HOME' ? current.address : String(row.street_address ?? ''),
            city: businessType === 'PRIVATE_HOME' ? current.city : String(row.city ?? ''),
            state: businessType === 'PRIVATE_HOME' ? current.state : String(row.state ?? ''),
            pinCode: businessType === 'PRIVATE_HOME' ? current.pinCode : String(row.pin_code ?? ''),
            contactPerson: String(row.contact_person ?? ''),
            receptionPhone: String(row.reception_phone ?? ''),
            evBays: row.number_of_ev_bays == null ? '' : String(row.number_of_ev_bays),
            accessType: row.access_type === 'OPEN_TO_PUBLIC' ? 'OPEN_TO_PUBLIC' : 'GUESTS_ONLY',
            restaurant: row.restaurant === true,
            restroom: row.restroom === true,
            wifi: row.wifi === true,
            desk24x7: row.desk_24x7 === true,
            entryInstructions: businessType === 'PRIVATE_HOME' ? current.entryInstructions : String(row.entry_instructions ?? ''),
            hotelLicense: String(row.gst_or_business_license ?? ''),
            homeContactNumber: String(row.contact_number ?? ''),
            homeType: row.home_type === 'VILLA' || row.home_type === 'APARTMENT_SOCIETY'
              ? row.home_type
              : 'INDEPENDENT_HOUSE',
            parkingLocation: row.parking_location === 'DRIVEWAY' || row.parking_location === 'SOCIETY_PARKING'
              ? row.parking_location
              : 'OWN_GARAGE',
            societyName: String(row.society_name ?? ''),
            societyApproval: row.society_approval === true,
            numberOfChargers: row.number_of_chargers == null ? '1' : String(row.number_of_chargers),
            availabilityHours: String(row.availability_hours ?? '24x7'),
            homeIdAddressProof: String(row.id_address_proof ?? ''),
            electricityBill: String(row.electricity_bill ?? ''),
            hostApprovalRequired: row.host_approval_required !== false,
            parkingType: row.parking_type === 'OPEN_LOT' || row.parking_type === 'MULTI_LEVEL'
              || row.parking_type === 'ROADSIDE' || row.parking_type === 'OTHER'
              ? row.parking_type
              : 'MALL',
            covered: row.covered === true,
            totalSlots: row.total_slots == null ? '' : String(row.total_slots),
            open24x7: row.open_24x7 === true,
            openingHours: String(row.opening_hours ?? ''),
            parkingFeeType: row.parking_fee_type === 'HOURLY' ? 'HOURLY' : 'FREE',
            hourlyFee: row.hourly_fee == null ? '' : String(row.hourly_fee),
            attendant: row.attendant === true,
            security: row.security === true,
            cctv: row.cctv === true,
            heightLimit: row.vehicle_height_limit_m == null ? '' : String(row.vehicle_height_limit_m),
            parkingLicense: String(row.operator_license ?? ''),
          }))
        }
        if (businessType === 'PRIVATE_HOME') {
          const { data: accessDetails, error: accessError } = await supabase
            .from('home_access_details')
            .select('street_address,city,state,pin_code,exact_location,entry_instructions')
            .eq('provider_id', provider.id)
            .maybeSingle()
          if (!active) return
          if (accessError) {
            setErrorMessage(`Could not load private home access details: ${accessError.message}`)
          } else if (accessDetails) {
            setForm((current) => ({
              ...current,
              address: accessDetails.street_address ?? '',
              city: accessDetails.city ?? '',
              state: accessDetails.state ?? '',
              pinCode: accessDetails.pin_code ?? '',
              entryInstructions: accessDetails.entry_instructions ?? '',
            }))
            const exactPoint = parsePoint(accessDetails.exact_location)
            if (exactPoint) {
              setForm((current) => ({
                ...current,
                latitude: String(exactPoint.lat),
                longitude: String(exactPoint.lng),
              }))
              setMapViewState({ latitude: exactPoint.lat, longitude: exactPoint.lng, zoom: 15 })
            }
          }
        }
      }
      setInitializing(false)
    }

    void loadOnboarding()
    return () => { active = false }
  }, [businessType, user])

  function updateField<Key extends keyof HostForm>(key: Key, value: HostForm[Key]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function setMapLocation(latitude: number, longitude: number) {
    const lookupId = ++locationLookupId.current
    setErrorMessage('')
    setLocationMessage('Location selected. Looking up street address, city, state, and PIN code...')
    setForm((current) => ({
      ...current,
      latitude: String(latitude),
      longitude: String(longitude),
    }))
    setMapViewState((current) => ({
      ...current,
      latitude,
      longitude,
      zoom: Math.max(current.zoom, 15),
    }))

    try {
      const address = await reverseGeocode({ lat: latitude, lng: longitude })
      if (lookupId !== locationLookupId.current) return
      setForm((current) => ({
        ...current,
        address: address.streetAddress || current.address,
        city: address.city || current.city,
        state: address.state || current.state,
        pinCode: address.pinCode || current.pinCode,
      }))
      setLocationMessage(address.formattedAddress
        ? 'Address, city, state, and PIN code filled from the selected location.'
        : 'No address was found for this pin. Enter the address details manually.')
    } catch {
      if (lookupId !== locationLookupId.current) return
      setLocationMessage('Address lookup was unavailable. The map pin is saved; enter the address details manually.')
    }
  }

  function useCurrentLocation() {
    setErrorMessage('')
    setLocationMessage('')
    if (!navigator.geolocation) {
      setErrorMessage('Location access is not supported by this browser. Select the location on the map instead.')
      return
    }
    if (!window.isSecureContext) {
      setErrorMessage('Location access requires a secure connection. Open this site on localhost or HTTPS, or select a location on the map.')
      return
    }

    setLocating(true)
    try {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          setLocating(false)
          if (!Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)
            || Math.abs(coords.latitude) > 90 || Math.abs(coords.longitude) > 180) {
            setErrorMessage('Your device returned an invalid location. Select the location on the map instead.')
            return
          }
          void setMapLocation(coords.latitude, coords.longitude)
        },
        (error) => {
          const message = error.code === error.PERMISSION_DENIED
            ? 'Location permission was denied. Allow it for this site in your browser settings, or select a location on the map.'
            : error.code === error.POSITION_UNAVAILABLE
              ? 'Your location is unavailable right now. Check device location services or select a location on the map.'
              : 'Finding your location timed out. Try again or select a location on the map.'
          setErrorMessage(message)
          setLocating(false)
        },
        { enableHighAccuracy: false, timeout: 30000, maximumAge: 120000 },
      )
    } catch (error) {
      setErrorMessage(error instanceof Error
        ? `Could not start location access: ${error.message}`
        : "Could not start location access. Check this site's browser permissions.")
      setLocating(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || !isBusinessType(businessType)) return

    const latitude = Number(form.latitude)
    const longitude = Number(form.longitude)
    if (!form.latitude || !form.longitude || !Number.isFinite(latitude) || !Number.isFinite(longitude)
      || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      setErrorMessage('Select the business location by clicking the map or using your current location.')
      return
    }
    if (businessType === 'PUBLIC_PARKING' && Number(form.evBays) > Number(form.totalSlots)) {
      setErrorMessage('EV bays cannot exceed the total number of parking slots.')
      return
    }
    if (businessType === 'PRIVATE_HOME' && form.homeType === 'APARTMENT_SOCIETY'
      && (!form.societyName.trim() || !form.societyApproval)) {
      setErrorMessage('Enter the society name and confirm you have society/RWA approval before listing this home.')
      return
    }

    setSaving(true)
    setErrorMessage('')
    const address = [form.address.trim(), form.city.trim(), form.state.trim(), form.pinCode.trim()]
      .filter(Boolean)
      .join(', ')
    const exactLocation = `SRID=4326;POINT(${longitude} ${latitude})`
    const publicPoint = businessType === 'PRIVATE_HOME'
      ? approximatePoint({ lat: latitude, lng: longitude })
      : { lat: latitude, lng: longitude }
    const location = `SRID=4326;POINT(${publicPoint.lng} ${publicPoint.lat})`
    const publicAddress = businessType === 'PRIVATE_HOME'
      ? `Approximate area, ${form.city.trim()}, ${form.state.trim()}`
      : address

    try {
      const providerValues = {
        profile_id: user.id,
        business_name: form.businessName.trim(),
        business_type: businessType,
        address: publicAddress,
        location,
        location_geog: location,
      }
      const providerResult = providerId
        ? await supabase.from('providers').update(providerValues).eq('id', providerId).select('id').single()
        : await supabase.from('providers').insert(providerValues).select('id').single()
      if (providerResult.error) {
        setErrorMessage(`Could not save your host profile: ${providerResult.error.message}`)
        return
      }

      const savedProviderId = providerResult.data.id
      setProviderId(savedProviderId)
      const detailsResult = businessType === 'HOTEL'
        ? await supabase.from('hotel_details').upsert({
            provider_id: savedProviderId,
            hotel_name: form.businessName.trim(),
            street_address: form.address.trim(),
            city: form.city.trim(),
            state: form.state.trim(),
            pin_code: form.pinCode.trim(),
            contact_person: form.contactPerson.trim(),
            reception_phone: form.receptionPhone.trim(),
            number_of_ev_bays: Number(form.evBays),
            access_type: form.accessType,
            restaurant: form.restaurant,
            restroom: form.restroom,
            wifi: form.wifi,
            desk_24x7: form.desk24x7,
            entry_instructions: form.entryInstructions.trim() || null,
            gst_or_business_license: form.hotelLicense.trim() || null,
          }, { onConflict: 'provider_id' })
        : businessType === 'PUBLIC_PARKING'
          ? await supabase.from('parking_details').upsert({
            provider_id: savedProviderId,
            operator_name: form.businessName.trim(),
            street_address: form.address.trim(),
            city: form.city.trim(),
            state: form.state.trim(),
            pin_code: form.pinCode.trim(),
            parking_type: form.parkingType,
            covered: form.covered,
            total_slots: Number(form.totalSlots),
            number_of_ev_bays: Number(form.evBays),
            open_24x7: form.open24x7,
            opening_hours: form.open24x7 ? null : form.openingHours.trim(),
            parking_fee_type: form.parkingFeeType,
            hourly_fee: form.parkingFeeType === 'HOURLY' ? optionalNumber(form.hourlyFee) : null,
            attendant: form.attendant,
            security: form.security,
            cctv: form.cctv,
            vehicle_height_limit_m: optionalNumber(form.heightLimit),
            operator_license: form.parkingLicense.trim() || null,
          }, { onConflict: 'provider_id' })
          : await supabase.from('home_details').upsert({
            provider_id: savedProviderId,
            host_name: form.businessName.trim(),
            contact_number: form.homeContactNumber.trim(),
            home_type: form.homeType,
            parking_location: form.parkingLocation,
            society_name: form.homeType === 'APARTMENT_SOCIETY' ? form.societyName.trim() : null,
            society_approval: form.homeType === 'APARTMENT_SOCIETY' && form.societyApproval,
            number_of_chargers: Number(form.numberOfChargers),
            availability_hours: form.availabilityHours.trim(),
            id_address_proof: form.homeIdAddressProof.trim() || null,
            electricity_bill: form.electricityBill.trim() || null,
            host_approval_required: form.hostApprovalRequired,
          }, { onConflict: 'provider_id' })
      if (detailsResult.error) {
        setErrorMessage(`Host profile saved, but business details could not be saved: ${detailsResult.error.message}`)
        return
      }
      if (businessType === 'PRIVATE_HOME') {
        const { error: accessError } = await supabase.from('home_access_details').upsert({
          provider_id: savedProviderId,
          street_address: form.address.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          pin_code: form.pinCode.trim(),
          exact_location: exactLocation,
          entry_instructions: form.entryInstructions.trim() || null,
        }, { onConflict: 'provider_id' })
        if (accessError) {
          setErrorMessage(`Home profile saved, but private access details could not be saved: ${accessError.message}`)
          return
        }
      }

      const otherDetailsTables = businessType === 'HOTEL'
        ? ['parking_details', 'home_details'] as const
        : businessType === 'PUBLIC_PARKING'
          ? ['hotel_details', 'home_details'] as const
          : ['hotel_details', 'parking_details'] as const
      for (const table of otherDetailsTables) {
        const { error: cleanupError } = await supabase.from(table).delete().eq('provider_id', savedProviderId)
        if (cleanupError) {
          setErrorMessage(`Business details saved, but old business details could not be removed: ${cleanupError.message}`)
          return
        }
      }

      navigate('/provider/dashboard', { replace: true })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not save your host onboarding details.')
    } finally {
      setSaving(false)
    }
  }

  if (!isBusinessType(businessType)) {
    return (
      <main className="min-h-screen bg-[#f7f9f6] px-6 py-12 text-slate-900">
        <section className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8">
          <h1 className="text-2xl font-semibold">Choose a host business type</h1>
          <p className="mt-2 text-slate-600">Select a host business type before continuing with host setup.</p>
          <Link className="mt-5 inline-flex font-semibold text-emerald-700 underline" to="/account-type">Back to account selection</Link>
        </section>
      </main>
    )
  }

  if (initializing) return <main className="p-8">Loading host onboarding...</main>

  const isHotel = businessType === 'HOTEL'
  const isParking = businessType === 'PUBLIC_PARKING'
  const isHome = businessType === 'PRIVATE_HOME'
  const locationSelected = Boolean(form.latitude && form.longitude)

  return (
    <main className="min-h-screen bg-[#f7f9f6] px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <Link className="text-sm font-semibold text-emerald-700" to="/account-type">← Choose a different business type</Link>
        <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            {isHotel ? 'Hotel host onboarding' : isParking ? 'Public parking host onboarding' : 'Private home host onboarding'}
          </p>
          <h1 className="mt-2 text-3xl font-semibold">{isHotel ? 'Tell us about your hotel' : isParking ? 'Tell us about your parking location' : 'Tell us about your home charger'}</h1>
          <p className="mt-2 text-slate-600">
            {isHome
              ? 'Your exact address and entry instructions stay private until you accept a booking.'
              : 'Add your business details and location so EV drivers know what to expect.'}
          </p>
          {errorMessage && <p className="mt-5 rounded-xl bg-red-50 p-4 text-red-800" role="alert">{errorMessage}</p>}

          <form className="mt-7 grid gap-5 sm:grid-cols-2" onSubmit={(event) => void handleSubmit(event)}>
            <label className="grid gap-2 text-sm font-medium sm:col-span-2">
              {isHotel ? 'Hotel name' : isParking ? 'Parking / operator name' : 'Host name'}
              <input className={fieldClass} onChange={(event) => updateField('businessName', event.target.value)} required value={form.businessName} />
            </label>
            <label className="grid gap-2 text-sm font-medium sm:col-span-2">
              Street address
              <input className={fieldClass} onChange={(event) => updateField('address', event.target.value)} required value={form.address} />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              City
              <input className={fieldClass} onChange={(event) => updateField('city', event.target.value)} required value={form.city} />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              State
              <input className={fieldClass} onChange={(event) => updateField('state', event.target.value)} required value={form.state} />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              PIN code
              <input className={fieldClass} inputMode="numeric" maxLength={6} onChange={(event) => updateField('pinCode', event.target.value)} pattern="[0-9]{6}" required title="Enter a 6-digit PIN code" value={form.pinCode} />
            </label>

            {isHotel ? (
              <>
                <label className="grid gap-2 text-sm font-medium">
                  Contact person
                  <input className={fieldClass} onChange={(event) => updateField('contactPerson', event.target.value)} required value={form.contactPerson} />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Reception phone
                  <input className={fieldClass} onChange={(event) => updateField('receptionPhone', event.target.value)} required type="tel" value={form.receptionPhone} />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Number of EV bays
                  <input className={fieldClass} min="1" onChange={(event) => updateField('evBays', event.target.value)} required type="number" value={form.evBays} />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Access type
                  <select className={fieldClass} onChange={(event) => updateField('accessType', event.target.value as HostForm['accessType'])} value={form.accessType}>
                    <option value="GUESTS_ONLY">Guests only</option>
                    <option value="OPEN_TO_PUBLIC">Open to public</option>
                  </select>
                </label>
                <fieldset className="grid gap-3 sm:col-span-2">
                  <legend className="mb-1 text-sm font-semibold">Amenities</legend>
                  {([
                    ['restaurant', 'Restaurant'],
                    ['restroom', 'Restroom'],
                    ['wifi', 'Wi-Fi'],
                    ['desk24x7', '24x7 desk'],
                  ] as const).map(([field, label]) => (
                    <label className="flex items-center gap-3 text-sm" key={field}>
                      <input checked={form[field]} onChange={(event) => updateField(field, event.target.checked)} type="checkbox" />
                      {label}
                    </label>
                  ))}
                </fieldset>
                <label className="grid gap-2 text-sm font-medium sm:col-span-2">
                  Entry instructions
                  <textarea className={fieldClass} onChange={(event) => updateField('entryInstructions', event.target.value)} rows={3} value={form.entryInstructions} />
                </label>
                <label className="grid gap-2 text-sm font-medium sm:col-span-2">
                  GST / business licence reference (optional)
                  <input className={fieldClass} onChange={(event) => updateField('hotelLicense', event.target.value)} value={form.hotelLicense} />
                </label>
              </>
            ) : isParking ? (
              <>
                <label className="grid gap-2 text-sm font-medium">
                  Parking type
                  <select className={fieldClass} onChange={(event) => updateField('parkingType', event.target.value as HostForm['parkingType'])} value={form.parkingType}>
                    <option value="MALL">Mall</option>
                    <option value="OPEN_LOT">Open lot</option>
                    <option value="MULTI_LEVEL">Multi-level</option>
                    <option value="ROADSIDE">Roadside</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>
                <label className="flex items-center gap-3 self-end pb-3 text-sm font-medium">
                  <input checked={form.covered} onChange={(event) => updateField('covered', event.target.checked)} type="checkbox" />
                  Covered parking
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Total parking slots
                  <input className={fieldClass} min="1" onChange={(event) => updateField('totalSlots', event.target.value)} required type="number" value={form.totalSlots} />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Number of EV bays
                  <input className={fieldClass} min="1" onChange={(event) => updateField('evBays', event.target.value)} required type="number" value={form.evBays} />
                </label>
                <label className="flex items-center gap-3 text-sm font-medium sm:col-span-2">
                  <input checked={form.open24x7} onChange={(event) => updateField('open24x7', event.target.checked)} type="checkbox" />
                  Open 24x7
                </label>
                {!form.open24x7 && (
                  <label className="grid gap-2 text-sm font-medium sm:col-span-2">
                    Opening hours
                    <input className={fieldClass} onChange={(event) => updateField('openingHours', event.target.value)} required value={form.openingHours} />
                  </label>
                )}
                <label className="grid gap-2 text-sm font-medium">
                  Parking fee
                  <select className={fieldClass} onChange={(event) => updateField('parkingFeeType', event.target.value as HostForm['parkingFeeType'])} value={form.parkingFeeType}>
                    <option value="FREE">Free</option>
                    <option value="HOURLY">Hourly</option>
                  </select>
                </label>
                {form.parkingFeeType === 'HOURLY' && (
                  <label className="grid gap-2 text-sm font-medium">
                    Informational fee per hour (₹)
                    <input className={fieldClass} min="0" onChange={(event) => updateField('hourlyFee', event.target.value)} required step="0.01" type="number" value={form.hourlyFee} />
                  </label>
                )}
                <fieldset className="grid gap-3 sm:col-span-2">
                  <legend className="mb-1 text-sm font-semibold">On-site facilities</legend>
                  {([
                    ['attendant', 'Attendant available'],
                    ['security', 'Security available'],
                    ['cctv', 'CCTV available'],
                  ] as const).map(([field, label]) => (
                    <label className="flex items-center gap-3 text-sm" key={field}>
                      <input checked={form[field]} onChange={(event) => updateField(field, event.target.checked)} type="checkbox" />
                      {label}
                    </label>
                  ))}
                </fieldset>
                <label className="grid gap-2 text-sm font-medium">
                  Vehicle height limit (m, optional)
                  <input className={fieldClass} min="0.1" onChange={(event) => updateField('heightLimit', event.target.value)} step="0.1" type="number" value={form.heightLimit} />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Operator permission / lease / licence (optional)
                  <input className={fieldClass} onChange={(event) => updateField('parkingLicense', event.target.value)} value={form.parkingLicense} />
                </label>
              </>
            ) : (
              <>
                <label className="grid gap-2 text-sm font-medium">
                  Contact number
                  <input className={fieldClass} onChange={(event) => updateField('homeContactNumber', event.target.value)} required type="tel" value={form.homeContactNumber} />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Home type
                  <select className={fieldClass} onChange={(event) => updateField('homeType', event.target.value as HostForm['homeType'])} value={form.homeType}>
                    <option value="INDEPENDENT_HOUSE">Independent house</option>
                    <option value="VILLA">Villa</option>
                    <option value="APARTMENT_SOCIETY">Apartment / society</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Parking location
                  <select className={fieldClass} onChange={(event) => updateField('parkingLocation', event.target.value as HostForm['parkingLocation'])} value={form.parkingLocation}>
                    <option value="OWN_GARAGE">Own garage</option>
                    <option value="DRIVEWAY">Driveway</option>
                    <option value="SOCIETY_PARKING">Society parking</option>
                  </select>
                </label>
                {form.homeType === 'APARTMENT_SOCIETY' && (
                  <>
                    <label className="grid gap-2 text-sm font-medium">
                      Society name
                      <input className={fieldClass} onChange={(event) => updateField('societyName', event.target.value)} required value={form.societyName} />
                    </label>
                    <label className="flex items-start gap-3 self-end pb-3 text-sm font-medium">
                      <input checked={form.societyApproval} onChange={(event) => updateField('societyApproval', event.target.checked)} required type="checkbox" />
                      I have approval from the society/RWA to share charging
                    </label>
                  </>
                )}
                <label className="grid gap-2 text-sm font-medium">
                  Number of chargers
                  <input className={fieldClass} min="1" onChange={(event) => updateField('numberOfChargers', event.target.value)} required type="number" value={form.numberOfChargers} />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Availability hours
                  <input className={fieldClass} onChange={(event) => updateField('availabilityHours', event.target.value)} placeholder="e.g. Weekdays 6 PM–10 PM" required value={form.availabilityHours} />
                </label>
                <label className="grid gap-2 text-sm font-medium sm:col-span-2">
                  ID / address proof reference (optional)
                  <input className={fieldClass} onChange={(event) => updateField('homeIdAddressProof', event.target.value)} value={form.homeIdAddressProof} />
                </label>
                <label className="grid gap-2 text-sm font-medium sm:col-span-2">
                  Electricity bill reference (optional)
                  <input className={fieldClass} onChange={(event) => updateField('electricityBill', event.target.value)} value={form.electricityBill} />
                </label>
                <label className="flex items-start gap-3 text-sm font-medium sm:col-span-2">
                  <input checked={form.hostApprovalRequired} onChange={(event) => updateField('hostApprovalRequired', event.target.checked)} type="checkbox" />
                  Host approval required before accepting a booking
                </label>
                <p className="text-sm text-slate-600 sm:col-span-2">
                  Time-based charging estimates are selected by default for private homes. Hosts may choose meter-based calculation when approving a booking if the charger has a dedicated meter.
                </p>
              </>
            )}

            <div className="sm:col-span-2">
              <h2 className="font-semibold">GPS / map pin</h2>
              <p className="mt-1 text-sm text-slate-600">
                {isHome
                  ? 'Set the exact home location. Drivers will only see an approximate area until you accept their booking.'
                  : 'Click the map to set the public business location.'}
              </p>
              <button className="mt-3 rounded-full border border-emerald-700 px-5 py-3 font-semibold text-emerald-800 disabled:cursor-wait disabled:opacity-60" disabled={locating} onClick={useCurrentLocation} type="button">
                {locating ? 'Getting your location...' : 'Use my current location'}
              </button>
              {locationSelected && (
                <div className="mt-2 text-sm text-emerald-800" role="status">
                  <p>Pinned at {Number(form.latitude).toFixed(6)}, {Number(form.longitude).toFixed(6)}</p>
                  {locationMessage && <p className="mt-1">{locationMessage}</p>}
                </div>
              )}
              <div className="mt-4 h-[360px] overflow-hidden rounded-2xl border border-slate-200">
                <Map
                  {...mapViewState}
                  mapStyle={MAP_STYLE}
                  onClick={(event) => void setMapLocation(event.lngLat.lat, event.lngLat.lng)}
                  onMove={(event) => setMapViewState({
                    latitude: event.viewState.latitude,
                    longitude: event.viewState.longitude,
                    zoom: event.viewState.zoom,
                  })}
                  style={{ width: '100%', height: '100%' }}
                >
                  <NavigationControl position="top-right" />
                  {locationSelected && (
                    <Marker anchor="bottom" latitude={Number(form.latitude)} longitude={Number(form.longitude)}>
                      <span className="grid size-8 place-items-center rounded-full border-2 border-white bg-emerald-700 text-sm text-white shadow">●</span>
                    </Marker>
                  )}
                </Map>
              </div>
            </div>

            <button className="rounded-full bg-emerald-700 px-5 py-3 font-semibold text-white disabled:opacity-60 sm:col-span-2" disabled={saving} type="submit">
              {saving ? 'Saving host details...' : 'Save and continue'}
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}
