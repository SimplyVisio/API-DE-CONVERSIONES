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
 */
function getEventConfig(status: string) {
  if (!status) return null;
  if (EVENT_MAPPING[status]) return EVENT_MAPPING[status];
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
  } catch (e) {
    console.error('Failed to log skip reason', e);
  }
}

export async function GET(req: NextRequest) {
  try {
    const { data: successLogs } = await supabase
      .from('eventos_enviados_meta')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(20);

    let errorLogs: any[] = [];
    
    // Fetch from both potential tables to be safe
    const tables = ['leads_formularios_optimizada', 'leads_formularios_meta'];
    
    for (const table of tables) {
      const { data } = await supabase
        .from(table)
        .select('lead_id, nombre, email, estado_lead, error_meta, updated_at')
        .not('error_meta', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(15); // Limit 15 per table
      
      if (data) errorLogs = [...errorLogs, ...data];
    }

    // Sort combined logs
    errorLogs.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    return NextResponse.json({
      success: true,
      data: {
        successLogs: successLogs || [],
        errorLogs: errorLogs.slice(0, 30)
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

    // 3. Change Detection
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

    if ((lead.score_lead || 0) < CONFIG.MIN_LEAD_SCORE) {
      await logSkipReason(lead, `Skipped: Low Score`, sourceTable);
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

    // 6. Prepare User Data (Robust Extraction)
    const userData: any = {};
    
    // --- Hashed PII ---
    const email = utils.normalizeEmail(lead.email);
    if (email) userData.em = [utils.hashData(email)];
    
    const phone = utils.normalizePhone(lead.telefono, lead.pais);
    if (phone) userData.ph = [utils.hashData(phone)];
    
    const { firstName, lastName } = utils.extractNames(lead.nombre);
    if (firstName) userData.fn = [utils.hashData(firstName.toLowerCase())];
    if (lastName) userData.ln = [utils.hashData(lastName.toLowerCase())];

    // --- Location ---
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

    // --- Technical Data (Critical for Match Quality) ---
    userData.external_id = [String(effectiveId)];

    // IP Address - Strict Checking
    const rawIp = lead.direccion_ip || lead.ip_address; // Try multiple aliases if they exist in DB
    if (rawIp && typeof rawIp === 'string' && rawIp.trim().length > 5) {
      userData.client_ip_address = rawIp.trim();
    }

    // User Agent
    const rawUa = lead.user_agent;
    if (rawUa && typeof rawUa === 'string' && rawUa.trim().length > 5) {
      userData.client_user_agent = rawUa.trim();
    }
    
    // --- Browser/Click IDs (Cookies) ---
    let trafficType = 'unknown';

    // 1. Meta Lead Ads Detection
    // If source is explicitly Meta_ADS OR lead_id matches Meta's numeric format and we have no cookies
    const isMetaLeadAd = (lead.fuente === 'Meta_ADS') || (!lead.fbclid && !lead.fbp && /^\d+$/.test(String(lead.lead_id)));

    if (isMetaLeadAd) {
      trafficType = 'paid_lead_ad';
      // For Lead Ads, we don't expect cookies, but we send what we have.
    } else {
      trafficType = 'organic_or_web';
    }

    // 2. FBC (Click ID) Handling
    if (lead.fbc) {
      userData.fbc = lead.fbc;
    } else if (lead.fbclid) {
       // Robust FBC construction
       const nowTs = Math.floor(Date.now() / 1000);
       // Check if it accidentally already has the prefix
       const val = lead.fbclid.startsWith('fb.1.') ? lead.fbclid : `fb.1.${nowTs}.${lead.fbclid}`;
       userData.fbc = val;
       trafficType = 'paid_web';
    }

    // 3. FBP (Browser ID) Handling
    if (lead.fbp) {
      userData.fbp = lead.fbp;
    }

    // 7. Custom Data
    const isReturning = String(lead.es_cliente).toLowerCase().trim() === 'true' || lead.es_cliente === true;

    const customData: any = {
      value: eventInfo.value,
      currency: CONFIG.CURRENCY,
      content_type: 'lead',
      customer_type: isReturning ? 'returning' : 'new',
      traffic_type: trafficType
    };

    if (lead.servicio) customData.content_name = lead.servicio;
    else if (lead.nombre_formulario) customData.content_name = lead.nombre_formulario;

    // 8. Send to Meta
    const payload: MetaEventPayload = {
      data: [{
        event_name: eventInfo.event_name,
        event_time: utils.toUnixTimestamp(conversionDate),
        event_id: eventId,
        action_source: 'website', // Keep 'website' for broad compatibility, or 'system_generated' if strictly Lead Ads
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

    // 9. Success - Detailed Logging for Dashboard
    await supabase.from('eventos_enviados_meta').insert({
      event_id: eventId,
      lead_id: effectiveId,
      estado_lead: lead.estado_lead,
      event_name: eventInfo.event_name,
      value: eventInfo.value,
      sent_at: new Date().toISOString(),
      fecha_conversion: conversionDate
    });

    // --- Smart Log Message ---
    let logMessage = 'LOG: Enviado';
    
    const hasIP = !!userData.client_ip_address;
    const hasUA = !!userData.client_user_agent;
    const hasFBP = !!userData.fbp;
    const hasFBC = !!userData.fbc;

    if (trafficType === 'paid_lead_ad') {
      logMessage = 'LOG: Enviado (Meta Ads - OK)';
    } else {
      // Organic/Web Logic
      if (hasFBP && hasIP && hasUA) {
        logMessage = 'LOG: Enviado (Web - Completo)';
      } else if (!hasFBP && hasIP && hasUA) {
        // High quality match (IP+UA) but missing cookie
        logMessage = 'LOG: Enviado (Web - Falta Cookie)';
      } else if (!hasIP || !hasUA) {
        // Missing technical data
        logMessage = 'LOG: Enviado (Web - Falta IP/UA)'; 
      } else {
        logMessage = 'LOG: Enviado (Web - Datos Básicos)';
      }
    }

    // Append technical flags to log for UI to parse if needed, but the text is good enough for now
    if (lead.lead_id) {
      await supabase.from(sourceTable)
        .update({ error_meta: logMessage, updated_at: new Date().toISOString() })
        .eq('lead_id', lead.lead_id);
    }

    return NextResponse.json({ 
      success: true, 
      eventId, 
      traffic_type: trafficType,
      quality_flags: { hasIP, hasUA, hasFBP, hasFBC },
      events_received: metaResult.events_received 
    });

  } catch (error: any) {
    console.error('Processing Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}