import React from 'react';
import { Activity, Database, CheckCircle, Server, AlertTriangle, Settings, ShieldCheck, Zap, Terminal, Copy } from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Activity className="w-8 h-8 text-blue-600" />
              Meta CAPI Sync
            </h1>
            <p className="text-gray-500 mt-1">Real-time Webhook Processor</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full text-sm font-medium">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            System Active
          </div>
        </header>

        {/* Architecture Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card 
            icon={<Database className="w-6 h-6 text-emerald-600" />}
            title="Source"
            value="Supabase (SQL)"
            subtitle="Trigger: Custom pg_net Function"
          />
           <Card 
            icon={<Server className="w-6 h-6 text-indigo-600" />}
            title="Processor"
            value="Vercel Function"
            subtitle="API Route: /api/webhook/meta"
          />
           <Card 
            icon={<Activity className="w-6 h-6 text-blue-600" />}
            title="Destination"
            value="Meta Conversions API"
            subtitle="Deduplication: Custom Table"
          />
        </div>

        {/* Instructions */}
        <div className="space-y-6">
          
          {/* Migration Status */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">System Status</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-start gap-4 p-4 rounded-lg bg-gray-50 border border-gray-200">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-gray-900">Smart Change Detection</h3>
                  <p className="text-sm text-gray-600">
                    API logic is ready to receive <code>old_record</code> and detect changes in Status or Date.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 rounded-lg bg-gray-50 border border-gray-200">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-gray-900">Deduplication</h3>
                  <p className="text-sm text-gray-600">
                    Events are deduplicated using <code>eventos_enviados_meta</code> table.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Webhook Configuration Guide */}
          <div className="bg-white rounded-xl shadow-sm border border-blue-100 overflow-hidden">
            <div className="p-6 border-b border-blue-100 bg-blue-50/50">
              <div className="flex items-center gap-2 mb-1">
                <Settings className="w-6 h-6 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Database Trigger Configuration</h2>
              </div>
              <p className="text-sm text-blue-800">
                This SQL configuration is <strong>active</strong> and correctly implements the "Broad Listen, Strict Filter" strategy.
              </p>
            </div>

            <div className="p-6 space-y-6">
              
              {/* Logic Explanation */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-4 h-4 text-emerald-600" />
                    <h3 className="font-semibold text-sm text-emerald-900">Why this SQL is correct:</h3>
                  </div>
                  <ul className="list-disc list-inside text-xs text-emerald-800 space-y-1">
                    <li>Uses <code>IS DISTINCT FROM</code> for safe comparison (handles NULLs).</li>
                    <li>Sends <code>old_record</code> so Vercel can validate changes accurately.</li>
                    <li>Filters locally in DB, saving Vercel execution costs.</li>
                  </ul>
                </div>

                <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <h3 className="font-semibold text-sm text-amber-900">Important:</h3>
                  </div>
                  <ul className="list-disc list-inside text-xs text-amber-800 space-y-1">
                    <li>Ensure <code>pg_net</code> extension is enabled in Supabase.</li>
                    <li><strong>Delete any UI-created webhooks</strong> to avoid double events.</li>
                  </ul>
                </div>
              </div>

              {/* SQL Code Block */}
              <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-900">
                <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                  <span className="text-xs font-mono text-gray-400 flex items-center gap-2">
                    <Terminal className="w-3 h-3" />
                    Supabase SQL Editor
                  </span>
                  <span className="text-xs text-gray-500">notify_vercel_webhook.sql</span>
                </div>
                <div className="p-4 overflow-x-auto">
                  <pre className="text-xs font-mono text-blue-300 leading-relaxed">
{`-- 1. Verify extension
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Create Function
CREATE OR REPLACE FUNCTION notify_vercel_webhook()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT := 'https://leads-meta-landing-jw6g.vercel.app/api/webhook/meta?secret=2828554491';
  payload JSONB;
BEGIN
  -- CASE 1: INSERT (Always Send)
  IF TG_OP = 'INSERT' THEN
    payload := jsonb_build_object(
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'record', row_to_json(NEW),
      'old_record', NULL
    );
    
    PERFORM net.http_post(
      url := webhook_url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := payload::text
    );
    RETURN NEW;
  END IF;

  -- CASE 2: UPDATE (Send only if critical columns change)
  IF TG_OP = 'UPDATE' THEN
    IF (OLD.estado_lead IS DISTINCT FROM NEW.estado_lead) OR 
       (OLD.fecha_conversion IS DISTINCT FROM NEW.fecha_conversion) THEN
      
      payload := jsonb_build_object(
        'type', TG_OP,
        'table', TG_TABLE_NAME,
        'record', row_to_json(NEW),
        'old_record', row_to_json(OLD) 
      );
      
      PERFORM net.http_post(
        url := webhook_url,
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := payload::text
      );
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create Trigger
DROP TRIGGER IF EXISTS trigger_notify_vercel ON leads_formularios_optimizada;

CREATE TRIGGER trigger_notify_vercel
  AFTER INSERT OR UPDATE ON leads_formularios_optimizada
  FOR EACH ROW
  EXECUTE FUNCTION notify_vercel_webhook();`}
                  </pre>
                </div>
              </div>

            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

interface CardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle: string;
}

const Card: React.FC<CardProps> = ({ icon, title, value, subtitle }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
    <div className="flex items-center gap-3 mb-2">
      <div className="p-2 bg-gray-50 rounded-lg">{icon}</div>
      <span className="text-sm font-medium text-gray-500">{title}</span>
    </div>
    <div className="text-2xl font-bold text-gray-900">{value}</div>
    <div className="text-xs text-gray-400 mt-1">{subtitle}</div>
  </div>
);
