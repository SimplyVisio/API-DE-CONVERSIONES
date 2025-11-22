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
 * Helper to log "Soft Errors" or "Warnings" to the database so the user can see them in the Dashboard.
 * This helps debug why events aren't showing up (e.g., unmapped status).
 */
async function logSkipReason(leadId: string, reason: string) {
  if (!leadId) return;
  try {
    // We prefix with INFO or WARN to distinguish from real crashes in the UI
    await supabase.from('leads_formularios_optimizada')
      .update({ 
        error_meta: `LOG: ${reason}`,
        updated_at: new Date().toISOString() 
      })
      .eq('lead_id', leadId);
  } catch (e) {
    console.error('Failed to log skip reason', e);
  }
}

/**
 * GET Handler: Retrieves logs for the Dashboard
 * Hosted here to avoid '404 Not Found' issues with creating new API routes without server restart.
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Fetch recent successful events
    const { data: successLogs, error: successError } = await supabase
      .from('eventos_enviados_meta')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(20);

    // 2. Fetch recent errors (Leads with error_meta not null)
    const { data: errorLogs, error: errorLogsError } = await supabase
      .from('leads_formularios_optimizada')
      .select('lead_id, nombre, email, estado_lead, error_meta, updated_at')
      .not('error_meta', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(20);

    if (successError) console.error('Supabase Success Log Error:', successError);
    if (errorLogsError) console.error('Supabase Error Log Error:', errorLogsError);

    return NextResponse.json({
      success: true,
      data: {
        successLogs: successLogs || [],
        errorLogs: errorLogs || []
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
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
    
    // Check if secret matches (if configured in env)
    if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
      console.error(`[Webhook] Unauthorized: Secret mismatch. Received: ${secret?.slice(0,3)}...`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse Webhook Payload from Supabase
    const body = await req.json();
    
    // Extract records and type
    // Supabase sends: { type: 'INSERT' | 'UPDATE', record: { ... }, old_record: { ... } }
    const { type, record: lead, old_record } = body;

    // --- ID FALLBACK STRATEGY ---
    // Social leads (WhatsApp/Messenger) might not have a formal 'lead_id' yet.
    // We prioritize: lead_id -> telefono -> email
    const effectiveId = lead?.lead_id || lead?.telefono || lead?.email;

    if (!lead || !effectiveId) {
      return NextResponse.json({ message: 'Ignored: No identifying data (lead_id, phone, or email)' }, { status: 200 }); 
    }

    // 3. SMART CHANGE DETECTION & LOOP PREVENTION
    if (type === 'UPDATE' && old_record) {
      
      // If the only thing that changed was 'error_meta' (our logging column), IGNORE IT.
      // This prevents infinite loops when we write logs.
      if (lead.error_meta !== old_record.error_meta && 
          lead.estado_lead === old_record.estado_lead &&
          lead.fecha_conversion === old_record.fecha_conversion) {
         return NextResponse.json({ message: 'Ignored: Loop prevention (Log update)', skipped: true }, { status: 200 });
      }

      const statusChanged = lead.estado_lead !== old_record.estado_lead;
      
      // Compare dates carefully
      const newDate = lead.fecha_conversion ? new Date(lead.fecha_conversion).getTime() : 0;
      const oldDate = old_record.fecha_conversion ? new Date(old_record.fecha_conversion).getTime() : 0;
      const dateChanged = newDate !== oldDate;

      if (!statusChanged && !dateChanged) {
        return NextResponse.json({ 
          message: 'Ignored: No change in estado_lead or fecha_conversion',
          skipped: true 
        }, { status: 200 });
      }
    }

    // 4. Logic: Should we send this event?
    const eventInfo = EVENT_MAPPING[lead.estado_lead];
    if (!eventInfo) {
      // LOGGING: Inform user why this was skipped
      if (lead.lead_id) await logSkipReason(lead.lead_id, `Status '${lead.estado_lead}' not mapped in constants.ts`);
      return NextResponse.json({ message: `Status '${lead.estado_lead}' not mapped to an event` });
    }

    // Check Filters (Score & Age)
    const score = lead.score_lead || 0;
    if (score < CONFIG.MIN_LEAD_SCORE) {
      if (lead.lead_id) await logSkipReason(lead.lead_id, `Skipped: Low Score (${score})`);
      return NextResponse.json({ message: 'Skipped: Low Score' });
    }

    const conversionDate = lead.fecha_conversion || lead.updated_at || lead.created_at;
    
    if (utils.isTooOld(conversionDate, CONFIG.MAX_EVENT_AGE_DAYS)) {
      if (lead.lead_id) await logSkipReason(lead.lead_id, `Skipped: Event too old (> ${CONFIG.MAX_EVENT_AGE_DAYS} days)`);
      return NextResponse.json({ message: 'Skipped: Event too old' });
    }

    // 5. Generate Event ID using the Effective ID
    // This ensures that even if lead_id is missing, we generate a consistent hash based on phone/email
    const eventId = utils.generateEventId(effectiveId, lead.estado_lead, conversionDate);

    // 6. Deduplication
    const { data: existingEvent } = await supabase
      .from('eventos_enviados_meta')
      .select('event_id')
      .eq('event_id', eventId)
      .single();

    if (existingEvent) {
      if (lead.lead_id) await logSkipReason(lead.lead_id, `Skipped: Event already sent (Deduplicated)`);
      return NextResponse.json({ message: 'Skipped: Event already sent (Deduplicated in DB)' });
    }

    // 7. Prepare Data for Meta
    const userData: any = {};
    
    const email = utils.normalizeEmail(lead.email);
    if (email) userData.em = [utils.hashData(email)];
    
    const phone = utils.normalizePhone(lead.telefono);
    if (phone) userData.ph = [utils.hashData(phone)];
    
    // Use effectiveId for external_id to ensure we always have one
    userData.external_id = [utils.hashData(effectiveId)];

    if (lead.direccion_ip) userData.client_ip_address = lead.direccion_ip;
    if (lead.user_agent) userData.client_user_agent = lead.user_agent;
    
    // FBP/FBC Logic
    if (lead.fbp) {
      userData.fbp = lead.fbp;
    } else if (lead.client_id) {
      const ts = lead.created_at ? utils.toUnixTimestamp(lead.created_at) : '';
      userData.fbp = ts ? `fb.1.${ts}.${lead.client_id}` : `fb.1.${lead.client_id}`;
    }

    if (lead.fbc) userData.fbc = lead.fbc;
    else if (lead.fbclid) {
       const nowTs = Math.floor(Date.now() / 1000);
       userData.fbc = `fb.1.${nowTs}.${lead.fbclid}`;
    }

    const { firstName, lastName } = utils.extractNames(lead.nombre);
    if (firstName) userData.fn = [utils.hashData(firstName.toLowerCase())];
    if (lastName) userData.ln = [utils.hashData(lastName.toLowerCase())];

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

    // Custom Data
    const customData: any = {
      value: eventInfo.value,
      currency: CONFIG.CURRENCY,
      content_type: 'lead',
      customer_type: lead.es_cliente === 'TRUE' || lead.es_cliente === true ? 'returning' : 'new'
    };

    if (lead.servicio) customData.content_name = lead.servicio;
    if (lead.fuente) customData.content_category = lead.fuente;
    if (lead.nombre_campana) customData.campaign_name = lead.nombre_campana;
    if (lead.score_lead) customData.predicted_ltv = lead.score_lead;

    // 8. Send to Meta API
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
      // Try to log error, using effectiveId if lead_id is missing but making sure it fits column type if necessary
      // Assuming lead_id column is string.
      if (lead.lead_id) {
        await supabase.from('leads_formularios_optimizada')
          .update({ error_meta: `Meta API Error: ${metaResult.error?.message || 'Unknown'}` })
          .eq('lead_id', lead.lead_id);
      }
        
      return NextResponse.json({ error: 'Meta API Failed', details: metaResult }, { status: 500 });
    }

    // 9. Success: Update Supabase Tables
    
    await supabase.from('eventos_enviados_meta').insert({
      event_id: eventId,
      lead_id: effectiveId, // Stores the ID used (could be phone/email if lead_id was null)
      estado_lead: lead.estado_lead,
      event_name: eventInfo.event_name,
      value: eventInfo.value,
      sent_at: new Date().toISOString(),
      fecha_conversion: conversionDate
    });

    if (lead.lead_id) {
      await supabase.from('leads_formularios_optimizada')
        .update({ 
          error_meta: null,
          updated_at: new Date().toISOString()
        })
        .eq('lead_id', lead.lead_id);
    }

    return NextResponse.json({ 
      success: true, 
      eventId, 
      events_received: metaResult.events_received,
      used_id: effectiveId // Helpful for debugging
    });

  } catch (error: any) {
    console.error('Processing Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}