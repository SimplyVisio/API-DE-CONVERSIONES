export interface Lead {
  lead_id: string;
  estado_lead: string;
  email?: string;
  telefono?: string;
  nombre?: string;
  apellido?: string;
  estado?: string;
  codigo_postal?: string;
  pais?: string;
  direccion_ip?: string;
  user_agent?: string;
  fbp?: string;
  fbc?: string;
  fbclid?: string;
  client_id?: string;
  fecha_conversion?: string;
  created_at?: string;
  updated_at?: string;
  fecha_creado_timestamp?: string;
  servicio?: string;
  fuente?: string;
  nombre_campana?: string;
  nombre_conjunto_anuncios?: string;
  nombre_anuncio?: string;
  es_cliente?: string | boolean;
  score_lead?: number;
  url_origen?: string;
  enviado_meta?: boolean;
}

export interface MetaEventPayload {
  data: Array<{
    event_name: string;
    event_time: number;
    event_id: string;
    user_data: {
      em?: string[];
      ph?: string[];
      fn?: string[];
      ln?: string[];
      ct?: string[];
      st?: string[];
      zp?: string[];
      country?: string[];
      client_ip_address?: string;
      client_user_agent?: string;
      fbp?: string;
      fbc?: string;
      external_id?: string[];
    };
    custom_data: {
      value?: number;
      currency: string;
      content_type: string;
      content_name?: string;
      content_category?: string;
      campaign_name?: string;
      ad_set_name?: string;
      ad_name?: string;
      customer_type?: string;
      predicted_ltv?: number;
    };
    action_source: string;
    event_source_url?: string;
  }>;
  access_token: string;
}

export interface ProcessingResult {
  success: boolean;
  message: string;
  eventId?: string;
  leadId?: string;
}