// Co-living unit economics, derived from properties + rooms + lodgers.
// Occupancy is driven by room.status; income counts occupied rooms only.
// A room whose lodger has given notice is still occupied (and still paying)
// until the vacate date passes and auto-vacancy flips it to vacant.

import { daysUntil } from '@/lib/format'
import type {
  Lodger,
  LodgerStatus,
  PropertyWithRooms,
  RoomWithLodgers,
} from '@/lib/types'

/** Lodger statuses that mean "living in the room right now". */
export const RESIDENT_STATUSES: readonly LodgerStatus[] = ['current', 'notice_given']

export function isResident(lodger: Pick<Lodger, 'status'>): boolean {
  return RESIDENT_STATUSES.includes(lodger.status)
}

/** The lodger currently attached to a room (resident, else pending move-in). */
export function activeLodger(room: RoomWithLodgers): Lodger | undefined {
  return (
    room.lodgers.find(isResident) ??
    room.lodgers.find((l) => l.status === 'pending')
  )
}

export function isOccupied(room: RoomWithLodgers): boolean {
  return room.status === 'occupied' || room.status === 'notice_given'
}

/** True when the room is expected to vacate within 30 days (notice or move-out). */
export function moveOutSoon(room: RoomWithLodgers): boolean {
  const lodger = room.lodgers.find(isResident)
  const date = room.next_vacate_date ?? lodger?.expected_move_out
  if (!date) return false
  const days = daysUntil(date)
  return days != null && days >= 0 && days <= 30
}

export interface PropertyMetrics {
  totalRooms: number
  occupiedRooms: number
  /** Weekly rent across occupied rooms only. */
  occupiedIncome: number
  /** Weekly rent if every room were occupied. */
  fullIncome: number
  headLease: number
  /** occupiedIncome - headLease */
  margin: number
  /** fullIncome - headLease */
  fullMargin: number
}

export function propertyMetrics(p: PropertyWithRooms): PropertyMetrics {
  const rooms = p.rooms ?? []
  const occupied = rooms.filter(isOccupied)
  const occupiedIncome = occupied.reduce((s, r) => s + (r.weekly_rent ?? 0), 0)
  const fullIncome = rooms.reduce((s, r) => s + (r.weekly_rent ?? 0), 0)
  const headLease = p.weekly_head_lease ?? 0
  return {
    totalRooms: rooms.length,
    occupiedRooms: occupied.length,
    occupiedIncome,
    fullIncome,
    headLease,
    margin: occupiedIncome - headLease,
    fullMargin: fullIncome - headLease,
  }
}

export function portfolioMetrics(properties: PropertyWithRooms[]): PropertyMetrics {
  return properties.map(propertyMetrics).reduce(
    (acc, m) => ({
      totalRooms: acc.totalRooms + m.totalRooms,
      occupiedRooms: acc.occupiedRooms + m.occupiedRooms,
      occupiedIncome: acc.occupiedIncome + m.occupiedIncome,
      fullIncome: acc.fullIncome + m.fullIncome,
      headLease: acc.headLease + m.headLease,
      margin: acc.margin + m.margin,
      fullMargin: acc.fullMargin + m.fullMargin,
    }),
    {
      totalRooms: 0,
      occupiedRooms: 0,
      occupiedIncome: 0,
      fullIncome: 0,
      headLease: 0,
      margin: 0,
      fullMargin: 0,
    },
  )
}

/** Fitout payback in weeks (fitout ÷ weekly margin), rounded to 1 decimal. */
export function paybackWeeks(
  fitoutTotal: number,
  weeklyMargin: number,
): number | null {
  if (weeklyMargin <= 0) return null
  return Math.round((fitoutTotal / weeklyMargin) * 10) / 10
}

export interface BondStats {
  /** AUD held: bond received and not yet returned. */
  totalHeld: number
  heldCount: number
  /** Lodgers (current or pending) with no bond_received_date. */
  pendingReceipt: number
  /** Bonds held whose lodger has an expected move-out within 30 days. */
  dueIn30Days: number
  dueIn30DaysCount: number
  /** totalHeld minus bonds due for return within 90 days. */
  net90Day: number
}

export function bondStats(lodgers: Lodger[]): BondStats {
  const held = lodgers.filter(
    (l) => l.bond_received_date && !l.bond_returned_date,
  )
  const totalHeld = held.reduce((s, l) => s + (l.bond_amount ?? 0), 0)
  const pendingReceipt = lodgers.filter(
    (l) => l.status !== 'former' && !l.bond_received_date,
  ).length

  const dueWithin = (days: number) =>
    held.filter((l) => {
      const d = daysUntil(l.expected_move_out)
      return d != null && d >= 0 && d <= days
    })
  const due30 = dueWithin(30)
  const due90Total = dueWithin(90).reduce((s, l) => s + (l.bond_amount ?? 0), 0)

  return {
    totalHeld,
    heldCount: held.length,
    pendingReceipt,
    dueIn30Days: due30.reduce((s, l) => s + (l.bond_amount ?? 0), 0),
    dueIn30DaysCount: due30.length,
    net90Day: totalHeld - due90Total,
  }
}

/** Room square colour for occupancy grids, per brand spec. */
export function roomSquareClass(room: RoomWithLodgers): string {
  if (room.status === 'notice_given' || moveOutSoon(room)) {
    return 'bg-warning border-warning'
  }
  if (isOccupied(room)) return 'bg-sage border-sage'
  return 'bg-transparent border-vacant border-2'
}
