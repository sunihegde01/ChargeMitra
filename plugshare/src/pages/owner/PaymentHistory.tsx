import { useEffect, useMemo, useState } from 'react'
import { Receipt } from 'lucide-react'
import { Button, EmptyState, PageHeader, Select, Spinner, StatusPill } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../supabase'

type Relation<T> = T | T[] | null

type PaymentRecord = {
  id: string
  final_amount: number | null
  payment_status: string
  started_at: string | null
  ended_at: string | null
  razorpay_payment_id: string | null
  booking: Relation<{
    id: string
    payment_method: string | null
    charger: Relation<{
      name: string
      provider: Relation<{ business_name: string }>
    }>
  }>
}

type DateRange = 'all' | '30' | '90'

function firstRelation<T>(relation: Relation<T> | undefined): T | undefined {
  return Array.isArray(relation) ? relation[0] : relation ?? undefined
}

function getStatusVariant(status: string) {
  if (status === 'PAID') return 'success'
  if (status === 'FAILED') return 'error'
  if (status === 'UNPAID' || status === 'PENDING') return 'warning'
  return 'neutral'
}

function getPaymentMethod(payment: PaymentRecord) {
  if (payment.razorpay_payment_id) return 'Razorpay'
  const booking = firstRelation(payment.booking)
  if (booking?.payment_method === 'PAY_AT_STATION') return 'Pay at station'
  return booking?.payment_method ?? '—'
}

export default function PaymentHistory() {
  const { user } = useAuth()
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [dateRange, setDateRange] = useState<DateRange>('all')
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let active = true

    async function loadPayments() {
      if (!user) {
        setPayments([])
        setLoading(false)
        return
      }

      setLoading(true)
      setErrorMessage('')
      try {
        const { data, error } = await supabase
          .from('charging_sessions')
          .select(`
            id,
            final_amount,
            payment_status,
            started_at,
            ended_at,
            razorpay_payment_id,
            booking:bookings!inner(
              id,
              owner_id,
              payment_method,
              charger:chargers(
                name,
                provider:providers(business_name)
              )
            )
          `)
          .eq('booking.owner_id', user.id)
          .eq('status', 'STOPPED')
          .not('ended_at', 'is', null)
          .order('ended_at', { ascending: false })

        if (!active) return
        if (error) {
          setErrorMessage(error.message)
          return
        }
        setPayments(data ?? [])
      } catch (error) {
        if (active) {
          setErrorMessage(error instanceof Error ? error.message : 'Could not load payment history.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadPayments()
    return () => {
      active = false
    }
  }, [user])

  const filteredPayments = useMemo(() => {
    if (dateRange === 'all') return payments
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - Number(dateRange))
    return payments.filter((payment) => (
      payment.ended_at !== null && new Date(payment.ended_at) >= cutoff
    ))
  }, [dateRange, payments])

  return (
    <main className="min-h-screen bg-[var(--color-bg)] px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          backTo="/owner/dashboard"
          subtitle="All completed charging sessions"
          title="Payment history"
        />

        <div className="mt-6 max-w-xs">
          <Select
            label="Date range"
            onChange={(event) => setDateRange(event.target.value as DateRange)}
            value={dateRange}
          >
            <option value="all">All time</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </Select>
        </div>

        <section className="mt-6">
          {loading ? (
            <div className="flex justify-center rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-10">
              <Spinner size="md" />
            </div>
          ) : errorMessage ? (
            <p className="rounded-xl bg-red-50 p-4 text-sm text-red-800" role="alert">{errorMessage}</p>
          ) : payments.length === 0 ? (
            <EmptyState
              action={<Button to="/owner/find">Find a charger</Button>}
              description="Your completed charging sessions and bills will appear here."
              icon={Receipt}
              title="No payments yet"
            />
          ) : (
            <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]">
              <table className="min-w-full divide-y divide-[var(--color-border)] text-left text-sm">
                <thead className="bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium" scope="col">Date</th>
                    <th className="px-4 py-3 font-medium" scope="col">Charger</th>
                    <th className="px-4 py-3 font-medium" scope="col">Provider</th>
                    <th className="px-4 py-3 font-medium" scope="col">Method</th>
                    <th className="px-4 py-3 font-medium" scope="col">Amount</th>
                    <th className="px-4 py-3 font-medium" scope="col">Status</th>
                    <th className="px-4 py-3 font-medium" scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] text-[var(--color-text)]">
                  {filteredPayments.length ? filteredPayments.map((payment) => {
                    const booking = firstRelation(payment.booking)
                    const charger = firstRelation(booking?.charger)
                    const provider = firstRelation(charger?.provider)
                    return (
                      <tr key={payment.id}>
                        <td className="whitespace-nowrap px-4 py-3">
                          {new Date(payment.ended_at ?? payment.started_at ?? '').toLocaleString()}
                        </td>
                        <td className="px-4 py-3">{charger?.name ?? '—'}</td>
                        <td className="px-4 py-3">{provider?.business_name ?? '—'}</td>
                        <td className="px-4 py-3">{getPaymentMethod(payment)}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {payment.final_amount === null ? '—' : `₹${Number(payment.final_amount).toFixed(2)}`}
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill label={payment.payment_status} variant={getStatusVariant(payment.payment_status)} />
                        </td>
                        <td className="px-4 py-3">
                          <Button size="sm" to={`/session/${payment.id}`} variant="ghost">View bill</Button>
                        </td>
                      </tr>
                    )
                  }) : (
                    <tr>
                      <td className="px-4 py-8 text-center text-[var(--color-text-muted)]" colSpan={7}>
                        No payments in this date range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
