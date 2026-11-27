// Small read-only panels for the dashboards: payments, check-in per day, membership share.
// Pure display: all numbers come from the server (nothing is computed from cached rows here).
const rs = (n) => (n == null ? 'not set' : `Rs. ${Number(n).toLocaleString()}`)
const pct = (n) => `${Math.round(n ?? 0)}%`

function Panel({ title, children }) {
  return (
    <div className="bg-white/5 border border-white/20 rounded-lg p-4">
      <h3 className="text-md font-normal text-white mb-3">{title}</h3>
      <div className="space-y-2 text-sm text-white/80">{children}</div>
    </div>
  )
}
const Row = ({ label, value }) => (
  <div className="flex justify-between gap-4"><span>{label}</span><span className="text-white font-semibold">{value}</span></div>
)

function CheckinRows({ days, registeredKey, checkedKey }) {
  if (!days?.length) return <p className="text-white/50">No event days defined.</p>
  return days.map((d) => (
    <Row key={d.sportDay} label={`${d.sportDay} ${d.label ?? ''}`.trim()} value={`${d[checkedKey]} / ${d[registeredKey]} checked in`} />
  ))
}

export function AdminLiveSummary({ payments, checkin, membership }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Panel title="Payments">
        <Row label="Slips awaiting review" value={payments?.pendingSlips ?? 0} />
        <Row label="Approved / rejected" value={`${payments?.approvedSlips ?? 0} / ${payments?.rejectedSlips ?? 0}`} />
        <Row label="Approved amount" value={rs(payments?.approvedAmount)} />
        <Row label="Yet to come" value={rs(payments?.amountYetToCome)} />
      </Panel>
      <Panel title="Check-in">
        <CheckinRows days={checkin} registeredKey="uniquePlayers" checkedKey="dayRegistered" />
      </Panel>
      <Panel title="General members share">
        {membership ? (
          <>
            <Row label="Target" value={membership.target == null ? 'not set' : `${membership.target}%`} />
            <Row label="Clubs under the target" value={`${membership.clubsPenalised} of ${membership.clubsWithPlayers}`} />
            {membership.belowTarget.slice(0, 5).map((c) => (
              <Row key={c.club_id} label={c.club_name} value={`${pct(c.percentage)} (${c.deduction})`} />
            ))}
          </>
        ) : <p className="text-white/50">Penalty rules are not configured.</p>}
      </Panel>
    </div>
  )
}

export function PortalLiveSummary({ stats }) {
  const m = stats?.membership
  const p = stats?.payments
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Panel title="General members">
        <Row label="Share" value={pct(m?.generalPercentage)} />
        <Row label="Needed to avoid a penalty" value={m?.target == null ? 'not set' : `${m.target}%`} />
        <Row label="Penalty right now" value={m?.deduction ?? 0} />
      </Panel>
      <Panel title="Payments">
        <Row label="Amount due" value={rs(p?.totalAmount)} />
        <Row label="Paid" value={rs(p?.paidAmount)} />
        <Row label="Remaining" value={rs(p?.remainingAmount)} />
        <Row label="Slips pending / rejected" value={`${p?.pendingSlips ?? 0} / ${p?.rejectedSlips ?? 0}`} />
      </Panel>
      <Panel title="Check-in">
        <CheckinRows days={stats?.checkin} registeredKey="players" checkedKey="checkedIn" />
      </Panel>
    </div>
  )
}
