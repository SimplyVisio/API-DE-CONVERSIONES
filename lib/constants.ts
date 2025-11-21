export const EVENT_MAPPING: Record<string, { event_name: string; value: number }> = {
  'Nuevo Lead': { event_name: 'Lead', value: 5 },
  'Lead contactado': { event_name: 'Contact', value: 25 },
  'Cita agendada': { event_name: 'Schedule', value: 75 },
  'En proceso de venta': { event_name: 'InitiateCheckout', value: 150 },
  'Venta cerrada': { event_name: 'Purchase', value: 500 },
  'Nueva Venta con el mismo cliente': { event_name: 'Purchase', value: 750 }
};

export const CONFIG = {
  MIN_LEAD_SCORE: Number(process.env.MIN_LEAD_SCORE) || 0,
  MAX_EVENT_AGE_DAYS: Number(process.env.MAX_EVENT_AGE_DAYS) || 7,
  CURRENCY: 'MXN',
  // Used to prevent re-sending too old events
  LOOKBACK_WINDOW_HOURS: 48 
};