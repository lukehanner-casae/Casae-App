// Row types mirroring the Supabase schema (migration 001).

export type PropertyStatus = 'active' | 'prospect' | 'archived'
export type RoomStatus = 'occupied' | 'vacant' | 'maintenance'
export type LodgerStatus = 'current' | 'former' | 'pending'
export type JobStatus = 'open' | 'in-progress' | 'completed' | 'cancelled'
export type JobPriority = 'low' | 'medium' | 'high' | 'urgent'
export type CleanStatus = 'scheduled' | 'completed' | 'skipped'
export type CleanType = 'routine' | 'end-of-tenancy' | 'pre-move-in'
export type Recurrence = 'none' | 'weekly' | 'fortnightly'
export type ContactType = 'landlord' | 'agent' | 'contractor' | 'other'
export type ProspectStage =
  | 'prospect'
  | 'viewing-booked'
  | 'viewed'
  | 'proposal-sent'
  | 'negotiating'
  | 'secured'
  | 'dead'
export type ProspectSource = 'kaylin-outreach' | 'agent' | 'private' | 'referral'

export interface Property {
  id: string
  display_name: string
  address: string | null
  suburb: string | null
  weekly_head_lease: number | null
  landlord_contact_id: string | null
  agent_contact_id: string | null
  head_lease_start: string | null
  head_lease_end: string | null
  is_fixed_rent: boolean
  smart_lock_installed: boolean
  fitout_cost_total: number
  status: PropertyStatus
  notes: string | null
  created_at: string
}

export interface Room {
  id: string
  property_id: string
  room_name: string
  weekly_rent: number | null
  is_ensuite: boolean
  is_couple_room: boolean
  size_category: string | null
  status: RoomStatus
  /** When the room became vacant; null while occupied. */
  vacated_at: string | null
  notes: string | null
}

export interface Lodger {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  room_id: string | null
  move_in_date: string | null
  expected_move_out: string | null
  bond_amount: number | null
  bond_received_date: string | null
  bond_returned_date: string | null
  lodging_agreement_signed: boolean
  lodging_agreement_date: string | null
  is_couple: boolean
  partner_name: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  status: LodgerStatus
  notes: string | null
}

export interface MaintenanceJob {
  id: string
  property_id: string
  room_id: string | null
  title: string
  description: string | null
  contractor_contact_id: string | null
  status: JobStatus
  priority: JobPriority
  estimated_cost: number | null
  actual_cost: number | null
  reported_by_user_id: string | null
  created_at: string
  completed_at: string | null
  notes: string | null
}

export interface Clean {
  id: string
  property_id: string
  scheduled_date: string | null
  clean_type: CleanType
  assigned_to: string | null
  status: CleanStatus
  completed_at: string | null
  notes: string | null
  recurrence: Recurrence
}

export interface Contact {
  id: string
  type: ContactType
  first_name: string | null
  last_name: string | null
  company_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  trade_type: string | null
  last_contact_date: string | null
  notes: string | null
  created_at: string
}

export interface Expense {
  id: string
  property_id: string | null
  amount: number | null
  expense_date: string | null
  category: string | null
  description: string | null
  receipt_url: string | null
  submitted_to_xero: boolean
  xero_expense_id: string | null
  hubdoc_forwarded: boolean
  hubdoc_forwarded_at: string | null
  created_by: string | null
  created_at: string
}

export interface FitoutItem {
  id: string
  property_id: string
  description: string | null
  cost: number | null
  purchase_date: string | null
  category: string | null
  receipt_url: string | null
  notes: string | null
}

export interface PropertyProspect {
  id: string
  address: string | null
  suburb: string | null
  est_rooms: number | null
  est_weekly_head_lease: number | null
  est_weekly_room_income: number | null
  projected_weekly_margin: number | null
  source: ProspectSource | null
  agent_contact_id: string | null
  stage: ProspectStage
  first_contact_date: string | null
  viewing_date: string | null
  assigned_to_user_id: string | null
  notes: string | null
  created_at: string
}

// Common joined shapes
export type RoomWithLodgers = Room & { lodgers: Lodger[] }
export type PropertyWithRooms = Property & { rooms: RoomWithLodgers[] }
