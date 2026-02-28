Meta Conversions API – Server-Side Tracking Service

Backend microservice for sending conversion events from your database to Meta Conversions API (Facebook CAPI).

This service enables secure, server-side tracking of events such as:

Lead

Purchase

Appointment

Custom conversion events

It is designed to work as part of a larger automation ecosystem (CRM + Supabase + n8n + Chatwoot).

🚀 Purpose

This API acts as a secure bridge between:

Supabase / CRM / Database
        ↓
This API (Server-Side)
        ↓
Meta Conversions API

Why this matters:

Avoids browser tracking limitations

Improves attribution accuracy

Works even with ad blockers

Enables deduplicated event tracking

Centralizes conversion logic

🏗 Architecture Overview
Client / Automation Trigger
        ↓
API Endpoint (Vercel / Node)
        ↓
Event Formatter
        ↓
Meta Conversions API (Graph API)
🔐 Environment Variables

Configured in Vercel → Project → Environment Variables

Required
META_ACCESS_TOKEN=
META_PIXEL_ID=
SUPABASE_SERVICE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
WEBHOOK_SECRET=
Variable Explanation

META_ACCESS_TOKEN → Permanent Meta system user token

META_PIXEL_ID → Facebook Pixel ID

SUPABASE_SERVICE_KEY → Server-level DB access (never expose)

NEXT_PUBLIC_SUPABASE_URL → Supabase project URL

WEBHOOK_SECRET → Validates incoming requests

⚠ Important:

SUPABASE_SERVICE_KEY must never be exposed to frontend.

Rotate META_ACCESS_TOKEN periodically.

📡 API Endpoint Example

Example POST request:

{
  "event_name": "Lead",
  "email": "user@example.com",
  "phone": "1234567890",
  "event_time": 1700000000,
  "custom_data": {
    "source": "Landing Page",
    "campaign": "Test Campaign"
  }
}

The service:

Hashes user data (SHA-256)

Formats event payload

Sends to:

https://graph.facebook.com/v18.0/{PIXEL_ID}/events
🔄 Event Flow Options

This API can be triggered from:

n8n workflows

Supabase database triggers

CRM status updates

Chatwoot automation events

External landing pages

🧪 Run Locally
Prerequisites

Node.js 18+

Install
npm install
Configure .env.local
META_ACCESS_TOKEN=your_token
META_PIXEL_ID=your_pixel_id
SUPABASE_SERVICE_KEY=your_key
NEXT_PUBLIC_SUPABASE_URL=your_url
WEBHOOK_SECRET=your_secret
Start Dev Server
npm run dev
🔒 Security Best Practices

Validate incoming requests with WEBHOOK_SECRET

Hash all personal data before sending to Meta

Use HTTPS only

Protect main branch in GitHub

Never log raw user data

🧠 Integration Inside Automation Ecosystem

This service works together with:

Lead ingestion API

CRM dashboard

Supabase database

n8n orchestration layer

AI decision systems

It ensures all meaningful user actions are:

✔ Tracked
✔ Attributed
✔ Measured
✔ Optimized

📦 Tech Stack

Node.js

Vercel Serverless

Meta Graph API

Supabase

REST architecture

Secure environment configuration
