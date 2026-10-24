export type Role = "owner" | "admin" | "member";
export type ReservationStatus = "confirmed" | "seated" | "completed" | "cancelled" | "no_show";
export type WalkinStatus = "waiting" | "ready" | "seated" | "cancelled";
export type WaitlistStatus = "waiting" | "notified" | "booked" | "cancelled" | "expired";

export interface TurnRule { upTo: number; minutes: number }

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  timezone: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  online_enabled: boolean;
  queue_open: boolean;
  notify_push: boolean;
  notify_email: boolean;
  min_notice_minutes: number;
  max_advance_days: number;
  slot_interval_minutes: number;
  max_party_size: number;
  cancellation_window_hours: number;
  turn_times: TurnRule[];
  created_at: string;
}

export interface Membership { id: string; restaurant_id: string; user_id: string; role: Role; display_name: string }

export interface DiningTable {
  id: string;
  restaurant_id: string;
  name: string;
  seats: number;
  online: boolean;
  active: boolean;
  position: number;
}

export interface ServicePeriod {
  id: string;
  restaurant_id: string;
  name: string;
  days: number[]; // 0 = Sunday
  opens: string; // "17:00:00"
  last_seating: string;
  active: boolean;
}

export interface Closure { id: string; restaurant_id: string; on_date: string; note: string | null }

export interface Reservation {
  id: string;
  restaurant_id: string;
  table_id: string | null;
  guest_name: string;
  email: string | null;
  phone: string | null;
  party_size: number;
  starts_at: string;
  ends_at: string;
  status: ReservationStatus;
  notes: string | null;
  source: "online" | "host";
  token: string;
  created_at: string;
}

export interface WaitlistEntry {
  id: string;
  restaurant_id: string;
  guest_name: string;
  email: string;
  phone: string | null;
  party_size: number;
  wanted_date: string;
  from_time: string;
  to_time: string;
  status: WaitlistStatus;
  token: string;
  notified_at: string | null;
  created_at: string;
}

export interface Walkin {
  id: string;
  restaurant_id: string;
  guest_name: string;
  party_size: number;
  phone: string | null;
  email: string | null;
  notes: string | null;
  quoted_minutes: number | null;
  status: WalkinStatus;
  source: "host" | "online";
  token: string;
  joined_at: string;
  ready_at: string | null;
  closed_at: string | null;
}

export interface GuestNotice {
  id: string;
  restaurant_id: string;
  message: string;
  starts_at: string;
  ends_at: string;
  show_reservations: boolean;
  show_queue: boolean;
  created_at: string;
}
