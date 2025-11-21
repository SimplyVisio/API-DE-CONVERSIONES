import React from 'react';
import { Activity, Database, CheckCircle, Server, AlertTriangle, Settings, ShieldCheck, Zap } from 'lucide-react';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        
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
            value="Supabase"
            subtitle="Trigger: Webhook (Insert/Update)"
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
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Migration Status</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 rounded-lg bg-gray-50 border border-gray-200">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-gray-900">Logic Ported</h3>
                  <p className="text-sm text-gray-600">
                    Phone normalization, Email hashing, and ID Fallback (LeadID/Phone/Email) active.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 rounded-lg bg-gray-50 border border-gray-200">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-gray-900">Deduplication</h3>
                  <p className="text-sm text-gray-600">
                    Using <code>eventos_enviados_meta</code> table as the source of truth.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Webhook Configuration Guide */}
          <div className="bg-white rounded-xl shadow-sm border border-blue-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="w-6 h-6 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Supabase Webhook Configuration</h2>
            </div>

            <div className="space-y-4">
               <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                <h3 className="font-medium text-blue-900 mb-2">1. Endpoint URL</h3>
                <code className="block bg-white text-blue-800 p-3 rounded border border-blue-200 text-xs font-mono break-all">
                  POST https://[YOUR_VERCEL_DOMAIN]/api/webhook/meta?secret=[YOUR_SECRET]
                </code>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <h3 className="font-medium text-amber-900">2. NO Value Filters</h3>
                  </div>
                  <p className="text-sm text-amber-800 mb-3">
                    <strong>Critical:</strong> Do not add `WHERE` clauses.
                  </p>
                  <p className="text-xs text-amber-700 bg-amber-100 p-2 rounded mb-2">
                    Leave the "When to trigger" condition <strong>EMPTY</strong>.
                  </p>
                  <p className="text-xs text-amber-800">
                    We want the API to receive ALL status changes, then decide via code what to ignore. This prevents "silent failures".
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-indigo-50 border border-indigo-200">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-medium text-indigo-900">3. Column Triggers</h3>
                  </div>
                  <p className="text-sm text-indigo-800 mb-3">
                    To reduce noise, trigger the webhook ONLY when these columns change:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <code className="px-2 py-1 bg-white rounded text-xs border border-indigo-200 font-mono text-indigo-700">estado_lead</code>
                    <code className="px-2 py-1 bg-white rounded text-xs border border-indigo-200 font-mono text-indigo-700">fecha_conversion</code>
                  </div>
                </div>
              </div>

              {/* Database Automation Section - Addressing User's Specific Setup */}
              <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-medium text-emerald-900">4. Database Automation (Your Setup)</h3>
                </div>
                <p className="text-sm text-emerald-800 mb-2">
                  Using a DB Trigger to auto-update <code>fecha_conversion</code> when <code>estado_lead</code> changes is <strong>excellent</strong>.
                </p>
                <ul className="list-disc list-inside text-xs text-emerald-700 space-y-1 ml-1">
                  <li>It ensures exact timestamps for conversions.</li>
                  <li>The Webhook (listening to <code>fecha_conversion</code>) will correctly pick up these auto-updates.</li>
                  <li>Monitoring <code>estado_lead</code> ensures we catch the status change itself.</li>
                </ul>
              </div>

            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

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

export default App;