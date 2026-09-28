export interface Driver {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  vehicle_model: string;
  vehicle_number: string;
  vehicle_type: string;
  is_online: boolean;
  current_lat?: number | null;
  current_lng?: number | null;
  rating?: number | null;
  total_trips?: number | null;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface Booking {
  id: string;
  reference: string;
  customer_id: string;
  driver_id: string | null;
  pickup_area: string;
  pickup_address: string;
  drop_area: string;
  drop_address: string;
  distance_km: number;
  duration_min: number;
  vehicle_code: string;
  vehicle_name: string;
  base_fare: number;
  distance_fare: number;
  tax_amount: number;
  estimated_fare: number;
  final_fare?: number | null;
  status: 'searching' | 'accepted' | 'arrived' | 'in_progress' | 'completed' | 'cancelled' | 'scheduled';
  payment_method: 'cash' | 'upi' | 'wallet';
  payment_status: string;
  ride_otp?: string | null;
  scheduled_at?: string | null;
  accepted_at?: string | null;
  arrived_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  rating?: number | null;
  review?: string | null;
  sos_raised?: boolean;
  customer_name?: string;
  customer_phone?: string;
  created_at?: string;
}

export interface DriverStats {
  todayEarnings: number;
  todayTrips: number;
  todayHours: number;
  cashCollected: number;
  rating: number;
  acceptanceRate: number;
}
