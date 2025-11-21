import React from 'react';
import { Activity, Database, CheckCircle, XCircle, Server } from 'lucide-react';

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
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Migration Status & Setup</h2>
          
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 rounded-lg bg-gray-50 border border-gray-200">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-gray-900">Python Logic Migrated</h3>
                <p className="text-sm text-gray-600">
                  Phone normalization, Email hashing (SHA256), and Event Mapping have been ported to TypeScript/Node.js.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-lg bg-gray-50 border border-gray-200">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-gray-900">Deduplication Storage</h3>
                <p className="text-sm text-gray-600">
                  Switched from BigQuery to Supabase table <code>eventos_enviados_meta</code>.
                </p>
              </div>
            </div>

             <div className="flex items-start gap-4 p-4 rounded-lg bg-blue-50 border border-blue-200">
              <Activity className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-blue-900">Next Step: Configure Supabase Webhook</h3>
                <p className="text-sm text-blue-700 mt-1 mb-2">
                  To enable automatic execution, create a Database Webhook in Supabase:
                </p>
                <code className="block bg-blue-900 text-blue-100 p-3 rounded text-xs font-mono overflow-x-auto">
                  POST https://[YOUR_VERCEL_DOMAIN]/api/webhook/meta?secret=[YOUR_SECRET]
                </code>
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