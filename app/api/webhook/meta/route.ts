import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Lead, MetaEventPayload } from '@/types';
import { EVENT_MAPPING, CONFIG } from '@/lib/constants';
import * as utils from '@/lib/utils';

// FORCE DYNAMIC: Ensure this route is not statically cached
export const dynamic = 'force-dynamic';

// Initialize Supabase Admin Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Meta Config
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN!;
const META_PIXEL_ID = process.env.META_PIXEL_ID!;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

/**
 * Helper: Case-Insensitive Event Mapping Lookup
 * Returns the event config for "Nuevo Lead" even if input is "nuevo lead" or "NUEVO LEAD"
 */
function getEventConfig(status: string) {
  if (!status) return null;
  
  // 1. Direct match
  if (EVENT_MAPPING[status]) return EVENT_MAPPING[status];

  // 2. Case-insensitive match
  const lowerStatus = status.trim().toLowerCase();
  const foundKey = Object.keys(EVENT_MAPPING).find(k => k.toLowerCase() === lowerStatus);
  
  return foundKey ? EVENT_MAPPING[foundKey] : null;
}

/**
 * Helper to log "Soft Errors" or "Warnings" to the database.
 */
async function logSkipReason(lead: any, reason: string, tableName: string = 'leads_formularios_optimizada') {
  const message = `LOG: ${reason}`;
  const now = new Date().toISOString();
  
  try {
    if (lead.lead_id) {
      await supabase.from(tableName)
        .update({ error_meta: message, updated_at: now })
        .eq('lead_id', lead.lead_id);
      return;
    }
    // Fallbacks
    if (lead.email) {
      await supabase.from(tableName).update({ error_meta: message, updated_at: now }).eq('email', lead.email);
      return;
    }
    if (lead.telefono) {
      await supabase.from(tableName).update({ error_meta: message, updated_at: now }).eq('telefono', lead.telefono);
      return;
    }
    console.warn('[SkipLog] Could not log error (No ID/Email/Phone):', reason);
  } catch (e) {
    console.error('Failed to log skip reason', e);
  }
}

/**
 * GET Handler: Retrieves logs for the Dashboard
 */
export async function GET(req: NextRequest) {
  try {
    const { data: successLogs, error: successError } = await supabase
      .from('eventos_enviados_meta')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(20);

    let errorLogs = [];
    const { data: logsOpt, error: errorOpt } = await supabase
      .from('leads_formularios_optimizada')
      .select('lead_id, nombre, email, estado_lead, error_meta, updated_at')
      .not('error_meta', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(20);
    
    if (logsOpt) errorLogs = [...logsOpt];

    // Try alternate table
    const { data: logsMeta } = await supabase
      .from('leads_formularios_meta')
      .select('lead_id, nombre, email, estado_lead, error_meta, updated_at')
      .not('error_meta', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(20);
    
    if (logsMeta) {
      errorLogs = [...errorLogs, ...logsMeta].sort((a, b) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      ).slice(0, 20);
    }

    return NextResponse.json({
      success: true,
      data: {
        successLogs: successLogs || [],
        errorLogs: errorLogs || []
      }
    }, {
      headers: { 'Cache-Control': 'no-store, no-cache' }
    });

  } catch (error: any) {
    console.error('GET Logs Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Security Check
    const url = new URL(req.url);
    const secret = url.searchParams.get('secret');
    
    if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
      console.error(`[Webhook] Unauthorized: Secret mismatch.`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse Payload
    const body = await req.json();
    const { type, record: lead, old_record, table } = body;
    const sourceTable = table || 'leads_formularios_optimizada';
    const effectiveId = lead?.lead_id || lead?.telefono || lead?.email;

    if (!lead || !effectiveId) {
      return NextResponse.json({ message: 'Ignored: No identifying data' }, { status: 200 }); 
    }

    // 3. Smart Change Detection
    if (type === 'UPDATE' && old_record) {
      // Ignore log-only updates
      if (lead.error_meta !== old_record.error_meta && 
          lead.estado_lead === old_record.estado_lead &&
          lead.fecha_conversion === old_record.fecha_conversion) {
         return NextResponse.json({ message: 'Ignored: Log update', skipped: true }, { status: 200 });
      }

      const statusChanged = lead.estado_lead !== old_record.estado_lead;
      const newDate = lead.fecha_conversion ? new Date(lead.fecha_conversion).getTime() : 0;
      const oldDate = old_record.fecha_conversion ? new Date(old_record.fecha_conversion).getTime() : 0;
      
      if (!statusChanged && newDate === oldDate) {
        return NextResponse.json({ message: 'Ignored: No significant change', skipped: true }, { status: 200 });
      }
    }

    // 4. Event Mapping & Filters
    const eventInfo = getEventConfig(lead.estado_lead);
    
    if (!eventInfo) {
      await logSkipReason(lead, `Status '${lead.estado_lead}' not mapped`, sourceTable);
      return NextResponse.json({ message: 'Status not mapped' });
    }

    const score = lead.score_lead || 0;
    if (score < CONFIG.MIN_LEAD_SCORE) {
      await logSkipReason(lead, `Skipped: Low Score (${score})`, sourceTable);
      return NextResponse.json({ message: 'Skipped: Low Score' });
    }

    const conversionDate = lead.fecha_conversion || lead.updated_at || lead.created_at;
    if (utils.isTooOld(conversionDate, CONFIG.MAX_EVENT_AGE_DAYS)) {
      await logSkipReason(lead, `Skipped: Event too old`, sourceTable);
      return NextResponse.json({ message: 'Skipped: Event too old' });
    }

    // 5. Deduplication ID
    const eventId = utils.generateEventId(effectiveId, lead.estado_lead, conversionDate);

    const { data: existingEvent } = await supabase
      .from('eventos_enviados_meta')
      .select('event_id')
      .eq('event_id', eventId)
      .single();

    if (existingEvent) {
      await logSkipReason(lead, `Skipped: Already sent`, sourceTable);
      return NextResponse.json({ message: 'Skipped: Deduplicated' });
    }

    // 7. Prepare User Data
    const userData: any = {};
    
    // Hashed PII
    const email = utils.normalizeEmail(lead.email);
    if (email) userData.em = [utils.hashData(email)];
    
    const phone = utils.normalizePhone(lead.telefono, lead.pais);
    if (phone) userData.ph = [utils.hashData(phone)];
    
    // Names
    const { firstName, lastName } = utils.extractNames(lead.nombre);
    if (firstName) userData.fn = [utils.hashData(firstName.toLowerCase())];
    if (lastName) userData.ln = [utils.hashData(lastName.toLowerCase())];

    // Location
    const city = utils.normalizeLocation(lead.estado);
    if (city) {
      const hashedLoc = utils.hashData(city);
      userData.ct = [hashedLoc];
      userData.st = [hashedLoc]; 
    }
    const zip = utils.normalizeLocation(lead.codigo_postal);
    if (zip) userData.zp = [utils.hashData(zip)];

    const country = utils.normalizeCountry(lead.pais);
    if (country) userData.country = [utils.hashData(country)];

    // EXTERNAL ID - Raw
    userData.external_id = [String(effectiveId)];

    // Technical Data (Raw)
    if (lead.direccion_ip) userData.client_ip_address = lead.direccion_ip;
    if (lead.user_agent) userData.client_user_agent = lead.user_agent;
    
    // Browser/Click IDs Logic for Organic vs Paid
    let isOrganic = true;

    // Check for fbc or fbclid
    if (lead.fbc) {
      userData.fbc = lead.fbc;
      isOrganic = false;
    } else if (lead.fbclid) {
       const nowTs = Math.floor(Date.now() / 1000);
       userData.fbc = `fb.1.${nowTs}.${lead.fbclid}`;
       isOrganic = false;
    }

    // FBP is critical for Organic Traffic matching
    if (lead.fbp) {
      userData.fbp = lead.fbp;
    }

    // Custom Data
    const isReturning = String(lead.es_cliente).toLowerCase().trim() === 'true' || lead.es_cliente === true;

    const customData: any = {
      value: eventInfo.value,
      currency: CONFIG.CURRENCY,
      content_type: 'lead',
      customer_type: isReturning ? 'returning' : 'new',
      traffic_type: isOrganic ? 'organic' : 'paid' // Informative custom param
    };

    if (lead.servicio) customData.content_name = lead.servicio;
    else if (lead.nombre_formulario) customData.content_name = lead.nombre_formulario;

    if (lead.fuente) customData.content_category = lead.fuente;
    if (lead.nombre_campana) customData.campaign_name = lead.nombre_campana;
    if (lead.score_lead) customData.predicted_ltv = lead.score_lead;

    // 8. Send to Meta
    const payload: MetaEventPayload = {
      data: [{
        event_name: eventInfo.event_name,
        event_time: utils.toUnixTimestamp(conversionDate),
        event_id: eventId,
        action_source: 'website',
        user_data: userData,
        custom_data: customData,
        event_source_url: lead.url_origen
      }],
      access_token: META_ACCESS_TOKEN
    };

    const metaResponse = await fetch(`https://graph.facebook.com/v19.0/${META_PIXEL_ID}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const metaResult = await metaResponse.json();

    if (!metaResponse.ok) {
      console.error('Meta API Error:', metaResult);
      await logSkipReason(lead, `Meta API Error: ${metaResult.error?.message}`, sourceTable);
      return NextResponse.json({ error: 'Meta API Failed', details: metaResult }, { status: 500 });
    }

    // 9. Success Log
    await supabase.from('eventos_enviados_meta').insert({
      event_id: eventId,
      lead_id: effectiveId,
      estado_lead: lead.estado_lead,
      event_name: eventInfo.event_name,
      value: eventInfo.value,
      sent_at: new Date().toISOString(),
      fecha_conversion: conversionDate
    });

    // Clean error flag OR Warn about Organic Quality
    let logMessage = null;
    
    if (isOrganic && !userData.fbp) {
      logMessage = 'LOG: Enviado (Orgánico - Falta FBP)';
    } else if (isOrganic) {
      logMessage = 'LOG: Enviado (Orgánico)';
    }

    if (lead.lead_id) {
      await supabase.from(sourceTable)
        .update({ error_meta: logMessage, updated_at: new Date().toISOString() })
        .eq('lead_id', lead.lead_id);
    }

    return NextResponse.json({ 
      success: true, 
      eventId, 
      is_organic: isOrganic,
      events_received: metaResult.events_received 
    });

  } catch (error: any) {
    console.error('Processing Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}