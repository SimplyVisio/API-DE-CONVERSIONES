"use client";

import React, { useEffect, useState } from 'react';
import { 
  Activity, Database, CheckCircle, Server, AlertTriangle, 
  Settings, ShieldCheck, Zap, Terminal, RefreshCw, AlertOctagon, Check 
} from 'lucide-react';

interface SuccessLog {
  event_id: string;
  event_name: string;
  lead_id: string;
  value: number;
  sent_at: string;
  fecha_conversion: string;
}

interface ErrorLog {
  lead_id: string;
  nombre?: string;
  email?: string;
  estado_lead: string;
  error_meta: string;
  updated_at: string;
}

export default function Dashboard() {
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [successLogs, setSuccessLogs] = useState<SuccessLog[]>([]);
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/logs');
      
      // Handle 404 specifically
      if (res.status === 404) {
        throw new Error("API Endpoint not found (404). If you just added this feature, please restart your dev server or rebuild the project.");
      }

      // Check if the response is actually JSON
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        console.error("Server returned non-JSON response:", text.substring(0, 100));
        throw new Error(`Server returned unexpected format (${res.status}). Check Vercel logs.`);
      }

      const data = await res.json();
      
      if (!res.ok || data.success === false) {
        throw new Error(data.error || 'Failed to fetch logs');
      }
      
      setSuccessLogs(data.data.successLogs);
      setErrorLogs(data.data.errorLogs);
      setLastRefreshed(new Date());
    } catch (err: any) {
      console.error("Fetch logs error:", err);
      setFetchError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchLogs, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Activity className="w-8 h-8 text-blue-600" />
              Meta CAPI Sync
            </h1>
            <p className="text-gray-500 mt-1">Real-time Webhook Processor & Monitor</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full text-sm font-medium">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              System Active
            </div>
          </div>
        </header>

        {/* --- MONITORING CONSOLE --- */}
        <div className="space-y-4">
          <div className="flex justify-between items-end">
             <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Terminal className="w-6 h-6 text-gray-700" />
                Live Console
             </h2>
             <button 
                onClick={fetchLogs}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
             >
               <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
               {loading ? 'Refreshing...' : 'Refresh Logs'}
             </button>
          </div>

          {fetchError && (
            <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200 flex items-start gap-3">
              <AlertOctagon className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-bold">Connection Error</p>
                <p className="text-sm mb-2">{fetchError}</p>
                {fetchError.includes("404") && (
                   <p className="text-xs bg-red-100 p-2 rounded border border-red-200">
                     <strong>Tip:</strong> The new API route <code>/api/logs</code> was created, but the running server might not see it yet. Try stopping and restarting your server (`npm run dev` or `next dev`).
                   </p>
                )}
              </div>
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-6">
            
            {/* Success Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[500px]">
              <div className="p-4 border-b border-gray-100 bg-green-50/30 flex justify-between items-center">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Successful Events (Last 20)
                </h3>
                <span className="text-xs text-gray-500">
                  {successLogs.length} records
                </span>
              </div>
              <div className="overflow-y-auto flex-1 p-0">
                {successLogs.length === 0 ? (
                   <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                     <Activity className="w-12 h-12 mb-2 opacity-20" />
                     <p>No events sent yet.</p>
                     <p className="text-xs mt-2">Trigger a change in your DB to see data here.</p>
                   </div>
                ) : (
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3">Time (Sent)</th>
                        <th className="px-4 py-3">Event</th>
                        <th className="px-4 py-3">Lead ID</th>
                        <th className="px-4 py-3 text-right">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {successLogs.map((log) => (
                        <tr key={log.event_id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                            {new Date(log.sent_at).toLocaleTimeString()} <span className="text-xs text-gray-400">{new Date(log.sent_at).toLocaleDateString()}</span>
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900">
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded-md text-xs">
                              {log.event_name}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 font-mono text-xs truncate max-w-[100px]" title={log.lead_id}>
                            {log.lead_id || 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-700">
                            ${log.value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Error Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[500px]">
              <div className="p-4 border-b border-gray-100 bg-red-50/30 flex justify-between items-center">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  Failed Leads / Errors
                </h3>
                 <span className="text-xs text-gray-500">
                  {errorLogs.length} records
                </span>
              </div>
              <div className="overflow-y-auto flex-1 p-0">
                {errorLogs.length === 0 ? (
                   <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8">
                     <Check className="w-12 h-12 mb-2 opacity-20" />
                     <p>No recent errors found.</p>
                   </div>
                ) : (
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3">Time (Updated)</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Error Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {errorLogs.map((log) => (
                        <tr key={log.lead_id} className="hover:bg-gray-50 group">
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap align-top">
                            {new Date(log.updated_at).toLocaleTimeString()}
                          </td>
                          <td className="px-4 py-3 align-top">
                             <div className="font-medium text-gray-900 text-xs">{log.email || log.nombre || 'Unknown'}</div>
                             <div className="text-xs text-gray-500">{log.estado_lead}</div>
                             <div className="text-[10px] text-gray-400 font-mono mt-1">{log.lead_id}</div>
                          </td>
                          <td className="px-4 py-3 text-red-600 text-xs align-top break-words max-w-[200px]">
                            {log.error_meta}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

          </div>
          
          <div className="text-center text-xs text-gray-400 pt-2">
            Last updated: {lastRefreshed ? lastRefreshed.toLocaleTimeString() : 'Never'}
          </div>
        </div>

        <hr className="border-gray-200" />

        {/* Architecture Info (Collapsed/Secondary) */}
        <div className="opacity-80 hover:opacity-100 transition-opacity">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Configuration & Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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

            {/* Webhook Configuration Guide */}
            <div className="bg-white rounded-xl shadow-sm border border-blue-100 overflow-hidden">
                <div className="p-6 border-b border-blue-100 bg-blue-50/50">
                <div className="flex items-center gap-2 mb-1">
                    <Settings className="w-6 h-6 text-blue-600" />
                    <h2 className="text-lg font-semibold text-gray-900">Database Trigger Configuration</h2>
                </div>
                <p className="text-sm text-blue-800">
                    This SQL configuration is the recommended setup for your environment.
                </p>
                </div>

                <div className="p-4 overflow-x-auto bg-gray-900">
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
    payload := jsonb_build_object('type', TG_OP, 'table', TG_TABLE_NAME, 'record', row_to_json(NEW), 'old_record', NULL);
    PERFORM net.http_post(url := webhook_url, headers := '{"Content-Type": "application/json"}'::jsonb, body := payload::text);
    RETURN NEW;
  END IF;

  -- CASE 2: UPDATE (Send only if critical columns change)
  IF TG_OP = 'UPDATE' THEN
    IF (OLD.estado_lead IS DISTINCT FROM NEW.estado_lead) OR (OLD.fecha_conversion IS DISTINCT FROM NEW.fecha_conversion) THEN
      payload := jsonb_build_object('type', TG_OP, 'table', TG_TABLE_NAME, 'record', row_to_json(NEW), 'old_record', row_to_json(OLD));
      PERFORM net.http_post(url := webhook_url, headers := '{"Content-Type": "application/json"}'::jsonb, body := payload::text);
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create Trigger
DROP TRIGGER IF EXISTS trigger_notify_vercel ON leads_formularios_optimizada;
CREATE TRIGGER trigger_notify_vercel AFTER INSERT OR UPDATE ON leads_formularios_optimizada FOR EACH ROW EXECUTE FUNCTION notify_vercel_webhook();`}
                  </pre>
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
