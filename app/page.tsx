"use client";

import React, { useEffect, useState } from 'react';
import { 
  Activity, CheckCircle, Terminal, RefreshCw, AlertOctagon, Check, Info, PlayCircle, Copy, Database, Key, Globe, Leaf, Megaphone, ShieldCheck, Fingerprint, Globe2, Cookie, User
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

  const [tableName, setTableName] = useState('leads_formularios_optimizada');
  const [projectUrl, setProjectUrl] = useState('https://tu-proyecto.vercel.app');
  const [secret, setSecret] = useState('mi_secreto_seguro');
  const [generatedSql, setGeneratedSql] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/webhook/meta?_t=${Date.now()}`);
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
        table: tableName, 
        record: {
          lead_id: `test-lead-${Math.floor(Math.random() * 1000)}`,
          estado_lead: "Nuevo Lead",
          email: "test_simulation@example.com",
          telefono: "+525512345678",
          nombre: "Simulated User",
          direccion_ip: "192.168.1.1", // Adding IP to prove it works
          user_agent: "Mozilla/5.0 (Test Browser)", // Adding UA
          fecha_conversion: new Date().toISOString(),
          score_lead: 10,
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

  useEffect(() => {
    const cleanUrl = projectUrl.replace(/\/$/, '');
    const sql = `-- TRIGGER UPDATE (Including IP/UA support)
-- Run this in Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA net;

DROP TRIGGER IF EXISTS trigger_meta_capi ON ${tableName};
DROP FUNCTION IF EXISTS notify_meta_capi();

CREATE OR REPLACE FUNCTION notify_meta_capi()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT := '${cleanUrl}/api/webhook/meta?secret=${secret}';
  payload JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    payload := jsonb_build_object('type', TG_OP, 'table', TG_TABLE_NAME, 'record', row_to_json(NEW), 'old_record', NULL);
    PERFORM net.http_post(url := webhook_url, headers := '{"Content-Type": "application/json"}'::jsonb, body := payload);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF (OLD.estado_lead IS DISTINCT FROM NEW.estado_lead) OR 
       (OLD.fecha_conversion IS DISTINCT FROM NEW.fecha_conversion) THEN
      payload := jsonb_build_object('type', TG_OP, 'table', TG_TABLE_NAME, 'record', row_to_json(NEW), 'old_record', row_to_json(OLD));
      PERFORM net.http_post(url := webhook_url, headers := '{"Content-Type": "application/json"}'::jsonb, body := payload);
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_meta_capi
AFTER INSERT OR UPDATE ON ${tableName}
FOR EACH ROW
EXECUTE FUNCTION notify_meta_capi();`;
    setGeneratedSql(sql);
  }, [tableName, projectUrl, secret]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setProjectUrl(window.location.origin);
    }
    fetchLogs();
    const interval = setInterval(fetchLogs, 30000);
    return () => clearInterval(interval);
  }, []);

  const getLogType = (msg: string) => {
    if (!msg) return 'error';
    if (msg.includes('Meta Ads - OK')) return 'ads';
    if (msg.includes('Completo')) return 'perfect';
    if (msg.includes('IP+UA OK')) return 'good';
    if (msg.includes('Falta Cookie')) return 'good'; // Backward compatibility
    if (msg.includes('Falta IP/UA')) return 'warning';
    if (msg.includes('LOG:')) return 'info';
    return 'error';
  };

  // Helper to check if the log message implies missing data
  const getDataStatus = (msg: string) => {
     const isAds = msg.includes('Meta Ads');
     const missingIP = msg.includes('Falta IP');
     // New logic: If message says "IP+UA OK", then cookie is missing but IP/UA is good.
     // If message says "Completo", everything is good.
     // If message says "Falta Cookie" (old), cookie missing.
     
     const hasIPUA = msg.includes('Completo') || msg.includes('IP+UA') || (msg.includes('Falta Cookie') && !msg.includes('IP'));
     const hasCookie = msg.includes('Completo');

     return {
        ip: isAds ? 'N/A' : (hasIPUA ? 'OK' : 'MISSING'),
        cookie: isAds ? 'N/A' : (hasCookie ? 'OK' : 'MISSING')
     };
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
            <p className="text-gray-500 mt-1">Real-time Webhook Processor</p>
          </div>
          <div className="flex items-center gap-4">
             {lastRefreshed && <span className="text-xs text-gray-400">Updated: {lastRefreshed.toLocaleTimeString()}</span>}
            <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full text-sm font-medium">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              System Active
            </div>
          </div>
        </header>

        <div className="grid lg:grid-cols-2 gap-6">
           
            {/* --- LOGS TABLE --- */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[600px] lg:col-span-2">
              <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-gray-600" />
                  Live Event Logs
                </h3>
                <div className="flex gap-2">
                  <button onClick={simulateTestEvent} disabled={simulating} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium hover:bg-indigo-100 transition-colors">
                    {simulating ? 'Sending...' : 'Simulate Event'}
                  </button>
                  <button onClick={fetchLogs} disabled={loading} className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded text-xs font-medium hover:bg-gray-50">
                    {loading ? '...' : 'Refresh'}
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto flex-1">
                 <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0 shadow-sm">
                      <tr>
                        <th className="px-4 py-3 w-24">Time</th>
                        <th className="px-4 py-3 w-32">Result</th>
                        <th className="px-4 py-3">Match Data Sent</th>
                        <th className="px-4 py-3">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {errorLogs.length === 0 ? (
                         <tr><td colSpan={4} className="p-8 text-center text-gray-400">No logs available.</td></tr>
                      ) : errorLogs.map((log) => {
                        const type = getLogType(log.error_meta);
                        const status = getDataStatus(log.error_meta);
                        let badgeClass = "bg-gray-100 text-gray-600";
                        let icon = <Info className="w-3 h-3" />;
                        
                        if (type === 'perfect') { badgeClass = "bg-green-100 text-green-800"; icon = <CheckCircle className="w-3 h-3" />; }
                        else if (type === 'ads') { badgeClass = "bg-purple-100 text-purple-800"; icon = <Megaphone className="w-3 h-3" />; }
                        else if (type === 'good') { badgeClass = "bg-blue-100 text-blue-800"; icon = <ShieldCheck className="w-3 h-3" />; }
                        else if (type === 'warning') { badgeClass = "bg-amber-100 text-amber-800"; icon = <AlertOctagon className="w-3 h-3" />; }
                        else if (type === 'error') { badgeClass = "bg-red-100 text-red-800"; }

                        return (
                          <tr key={log.lead_id || Math.random()} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-gray-500 whitespace-nowrap font-mono text-xs">
                              {new Date(log.updated_at).toLocaleTimeString()}
                            </td>
                            <td className="px-4 py-3">
                               <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${badgeClass}`}>
                                 {icon}
                                 {type === 'ads' ? 'Meta Ads' : type === 'perfect' ? 'Complete' : type === 'good' ? 'High Quality' : type === 'warning' ? 'Partial' : 'Skipped'}
                               </span>
                            </td>
                            <td className="px-4 py-3">
                               <div className="flex gap-2">
                                  {/* IP Indicator */}
                                  <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-mono 
                                    ${status.ip === 'OK' ? 'bg-green-50 border-green-200 text-green-700' : 
                                      status.ip === 'MISSING' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-gray-200 text-gray-400 opacity-50'}`}>
                                    <Globe2 className="w-3 h-3" />
                                    {status.ip === 'OK' ? 'IP' : status.ip === 'MISSING' ? 'NO IP' : 'N/A'}
                                  </div>

                                  {/* UA Indicator */}
                                   <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-mono 
                                    ${status.ip === 'OK' ? 'bg-green-50 border-green-200 text-green-700' : 
                                      status.ip === 'MISSING' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-gray-200 text-gray-400 opacity-50'}`}>
                                    <User className="w-3 h-3" />
                                    {status.ip === 'OK' ? 'UA' : 'N/A'}
                                  </div>

                                  {/* Cookie Indicator */}
                                  <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-mono
                                    ${status.cookie === 'OK' ? 'bg-blue-50 border-blue-200 text-blue-700' : 
                                      status.cookie === 'MISSING' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-gray-50 border-gray-200 text-gray-400 opacity-50'}`}>
                                    <Cookie className="w-3 h-3" />
                                    {status.cookie === 'OK' ? 'FBP' : status.cookie === 'MISSING' ? 'NO FBP' : 'N/A'}
                                  </div>
                               </div>
                            </td>
                            <td className="px-4 py-3 text-gray-600 text-xs max-w-xs truncate" title={log.error_meta}>
                              {log.error_meta.replace('LOG:', '')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                 </table>
              </div>
            </div>
        </div>

        {/* --- SQL GENERATOR --- */}
        <div className="bg-white rounded-xl shadow-lg border border-blue-100 overflow-hidden">
           <div className="p-4 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
              <h3 className="font-bold text-blue-900 flex items-center gap-2">
                <Database className="w-4 h-4" /> Connection Helper
              </h3>
              <button onClick={() => { navigator.clipboard.writeText(generatedSql); alert("SQL Copied!"); }} className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
                Copy SQL
              </button>
           </div>
           <div className="p-4">
             <pre className="text-xs font-mono bg-gray-900 text-gray-300 p-4 rounded-lg h-32 overflow-auto">
               {generatedSql}
             </pre>
           </div>
        </div>

      </div>
    </div>
  );
}