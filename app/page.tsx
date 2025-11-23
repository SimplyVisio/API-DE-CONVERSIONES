"use client";

import React, { useEffect, useState } from 'react';
import { 
  Activity, CheckCircle, Terminal, RefreshCw, AlertOctagon, Check, Info, PlayCircle, Copy, Database, Key, Globe
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
  const [simulating, setSimulating] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [successLogs, setSuccessLogs] = useState<SuccessLog[]>([]);
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // SQL Generator State - Default updated to likely user table
  const [tableName, setTableName] = useState('leads_formularios_meta');
  const [projectUrl, setProjectUrl] = useState('https://tu-proyecto.vercel.app');
  const [secret, setSecret] = useState('mi_secreto_seguro');
  const [generatedSql, setGeneratedSql] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/webhook/meta?_t=${Date.now()}`);
      
      if (res.status === 404) {
        throw new Error("API Endpoint not found. Ensure '/api/webhook/meta' exists.");
      }

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`Server Error (${res.status}). Check terminal logs.`);
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

  const simulateTestEvent = async () => {
    const inputSecret = prompt("Enter your WEBHOOK_SECRET to verify authorization:", secret);
    if (!inputSecret) return;

    setSimulating(true);
    try {
      const testPayload = {
        type: "INSERT",
        table: tableName, // Send the currently selected table name
        record: {
          lead_id: `test-lead-${Math.floor(Math.random() * 1000)}`,
          estado_lead: "Nuevo Lead",
          email: "test_simulation@example.com",
          telefono: "+525512345678",
          nombre: "Simulated User",
          fecha_conversion: new Date().toISOString(),
          score_lead: 10,
          // Adding fake DB fields to match what Supabase sends
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      };

      const res = await fetch(`/api/webhook/meta?secret=${inputSecret}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload)
      });

      const result = await res.json();
      
      if (res.ok) {
        alert(`✅ Simulation Successful!\nMeta Response: ${JSON.stringify(result, null, 2)}`);
        fetchLogs();
      } else {
        alert(`❌ Simulation Failed:\n${result.error || result.message || 'Unknown error'}`);
      }

    } catch (err: any) {
      alert(`❌ Network Error: ${err.message}`);
    } finally {
      setSimulating(false);
    }
  };

  // Update SQL when inputs change
  useEffect(() => {
    const cleanUrl = projectUrl.replace(/\/$/, ''); // remove trailing slash
    const sql = `-- CÓDIGO CORREGIDO: ${new Date().toLocaleTimeString()}
-- Si ves errores de "net.http_post arguments", EJECUTA ESTE CÓDIGO COMPLETO.

-- 1. Habilita la extensión para hacer peticiones HTTP
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA net;

-- 2. ELIMINAR FUNCIÓN ANTIGUA (Evita conflictos de tipos)
DROP TRIGGER IF EXISTS trigger_meta_capi ON ${tableName};
DROP FUNCTION IF EXISTS notify_meta_capi();

-- 3. Crea la función corregida (JSONB body)
CREATE OR REPLACE FUNCTION notify_meta_capi()
RETURNS TRIGGER AS $$
DECLARE
  -- TU URL CONFIGURADA:
  webhook_url TEXT := '${cleanUrl}/api/webhook/meta?secret=${secret}';
  payload JSONB;
BEGIN
  -- CASO 1: INSERT (Siempre enviar nuevos leads)
  IF TG_OP = 'INSERT' THEN
    payload := jsonb_build_object(
      'type', TG_OP, 
      'table', TG_TABLE_NAME, 
      'record', row_to_json(NEW), 
      'old_record', NULL
    );
    
    -- CORRECCIÓN CRÍTICA: 'body' se pasa directamente como JSONB
    PERFORM net.http_post(
      url := webhook_url, 
      headers := '{"Content-Type": "application/json"}'::jsonb, 
      body := payload
    );
    
    RETURN NEW;
  END IF;

  -- CASO 2: UPDATE (Solo enviar si cambia el estado o la fecha)
  IF TG_OP = 'UPDATE' THEN
    IF (OLD.estado_lead IS DISTINCT FROM NEW.estado_lead) OR 
       (OLD.fecha_conversion IS DISTINCT FROM NEW.fecha_conversion) THEN
       
      payload := jsonb_build_object(
        'type', TG_OP, 
        'table', TG_TABLE_NAME, 
        'record', row_to_json(NEW), 
        'old_record', row_to_json(OLD)
      );
      
      -- CORRECCIÓN CRÍTICA: 'body' se pasa directamente como JSONB
      PERFORM net.http_post(
        url := webhook_url, 
        headers := '{"Content-Type": "application/json"}'::jsonb, 
        body := payload
      );
    END IF;
    RETURN NEW;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Asigna el Trigger a tu tabla: ${tableName}
CREATE TRIGGER trigger_meta_capi
AFTER INSERT OR UPDATE ON ${tableName}
FOR EACH ROW
EXECUTE FUNCTION notify_meta_capi();`;
    setGeneratedSql(sql);
  }, [tableName, projectUrl, secret]);

  useEffect(() => {
    // Try to guess current URL for convenience
    if (typeof window !== 'undefined') {
      setProjectUrl(window.location.origin);
    }
    fetchLogs();
    const interval = setInterval(fetchLogs, 30000);
    return () => clearInterval(interval);
  }, []);

  const getLogType = (msg: string) => {
    if (!msg) return 'error';
    if (msg.startsWith('LOG:') || msg.includes('Skipped')) return 'warning';
    return 'error';
  };

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
             <div className="flex gap-2">
               <button 
                  onClick={simulateTestEvent}
                  disabled={simulating}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors disabled:opacity-50"
               >
                 <PlayCircle className={`w-4 h-4 ${simulating ? 'animate-spin' : ''}`} />
                 {simulating ? 'Sending...' : '⚡ Simulate Test Event'}
               </button>
               <button 
                  onClick={fetchLogs}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
               >
                 <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                 {loading ? 'Refreshing...' : 'Refresh Logs'}
               </button>
             </div>
          </div>

          {fetchError && (
            <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200 flex items-start gap-3 animate-pulse">
              <AlertOctagon className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-bold">Connection Status: Disconnected</p>
                <p className="text-sm">{fetchError}</p>
              </div>
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-6">
            
            {/* Success Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[400px]">
              <div className="p-4 border-b border-gray-100 bg-green-50/30 flex justify-between items-center">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Successful Events
                </h3>
                <span className="text-xs text-gray-500">{successLogs.length} records</span>
              </div>
              <div className="overflow-y-auto flex-1 p-0">
                {successLogs.length === 0 ? (
                   <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                     <Activity className="w-12 h-12 mb-2 opacity-20" />
                     <p>No events sent yet.</p>
                     <p className="text-xs mt-2">Use "Simulate Test Event" to verify connection.</p>
                   </div>
                ) : (
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3">Time</th>
                        <th className="px-4 py-3">Event</th>
                        <th className="px-4 py-3">Lead ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {successLogs.map((log) => (
                        <tr key={log.event_id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                            {new Date(log.sent_at).toLocaleTimeString()}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900">
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded-md text-xs">
                              {log.event_name}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 font-mono text-xs truncate max-w-[100px]" title={log.lead_id}>
                            {log.lead_id || 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Error/Warning Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[400px]">
              <div className="p-4 border-b border-gray-100 bg-amber-50/30 flex justify-between items-center">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <Info className="w-5 h-5 text-amber-600" />
                  Logs & Debug
                </h3>
                 <span className="text-xs text-gray-500">{errorLogs.length} records</span>
              </div>
              <div className="overflow-y-auto flex-1 p-0">
                {errorLogs.length === 0 ? (
                   <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8">
                     <Check className="w-12 h-12 mb-2 opacity-20" />
                     <p>No logs found.</p>
                     <p className="text-xs mt-2 text-center">Skipped/Ignored events will appear here.</p>
                   </div>
                ) : (
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3">Time</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {errorLogs.map((log) => {
                        const type = getLogType(log.error_meta);
                        return (
                          <tr key={log.lead_id || Math.random()} className="hover:bg-gray-50 group">
                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap align-top">
                              {new Date(log.updated_at).toLocaleTimeString()}
                            </td>
                            <td className="px-4 py-3 align-top">
                              <div className="text-xs text-gray-500">{log.estado_lead}</div>
                            </td>
                            <td className={`px-4 py-3 text-xs align-top break-words max-w-[200px] ${type === 'warning' ? 'text-amber-700' : 'text-red-600'}`}>
                              {log.error_meta ? log.error_meta.replace('LOG:', '') : 'Unknown Error'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* --- SQL GENERATOR TOOL --- */}
        <div className="bg-white rounded-xl shadow-lg border border-blue-100 overflow-hidden">
          <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Database className="w-6 h-6" />
              Fix Supabase Connection
            </h2>
            <p className="text-blue-100 mt-1 text-sm">
              The error <code>function net.http_post(..., body = text) does not exist</code> means your database has the OLD version of the trigger.
              <br/>
              <strong>Solution:</strong> Copy and run the updated SQL below. It deletes the old trigger and creates the correct one.
            </p>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Database className="w-3 h-3" /> Database Table Name
                </label>
                <input 
                  type="text" 
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="leads_formularios_meta"
                />
                <p className="text-xs text-gray-500 mt-1">Make sure this matches your Supabase table EXACTLY.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Globe className="w-3 h-3" /> Project URL
                </label>
                <input 
                  type="text" 
                  value={projectUrl}
                  onChange={(e) => setProjectUrl(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Key className="w-3 h-3" /> Webhook Secret
                </label>
                <input 
                  type="text" 
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="relative group">
              <div className="absolute top-2 right-2">
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(generatedSql);
                    alert("Copied SQL to clipboard!");
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded shadow transition-colors"
                >
                  <Copy className="w-3 h-3" /> Copy SQL
                </button>
              </div>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs font-mono overflow-x-auto border border-gray-800 leading-relaxed h-64">
                {generatedSql}
              </pre>
            </div>

            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg">
              <h4 className="text-sm font-bold text-amber-800 mb-1">Instructions:</h4>
              <ol className="list-decimal list-inside text-sm text-amber-700 space-y-1">
                <li>Copy the SQL above (It now includes <code>DROP FUNCTION</code> to fully reset the trigger).</li>
                <li>Go to Supabase &gt; <strong>SQL Editor</strong>.</li>
                <li>Paste and run.</li>
                <li>Verify "Success" message in Supabase.</li>
                <li>Then modify a lead status again.</li>
              </ol>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}