# Product Design Doc (Full): WhatsApp-Native CRM for Micro-Businesses

**Status:** Ready to hand to a developer/build team
**Target cost to build MVP:** ₹0 (free tiers throughout — see Section 6)

---

## 1. Product Name

**Primary pick: Grahak** (ग्राहक — Hindi for "customer")

Why this works: one word, easy to say, instantly signals what it's about to any Indian small-business owner, and "Grahak" as a brand feels local and trustworthy rather than a generic English SaaS name that feels foreign/complex (which is literally the thing you're positioning against).

Tagline option: **"Grahak — apna WhatsApp, ab organized."** (Your WhatsApp, now organized.)

Alternates if you want to test others:
- **Setu** (सेतु — "bridge") — implies bridging conversations to organization
- **ChatDesk** — safer, more literal, works if you want an English-first brand
- **Vyapar Mitra** (व्यापार मित्र — "business friend") — warm, but longer/less punchy

Go with **Grahak** unless a pilot customer reacts badly to it.

---

## 2. Problem Statement

Micro-businesses (1-3 people) can't use traditional CRMs (Zoho, HubSpot) — too complex, too expensive per seat, built for sales teams they don't have. Nearly all their real customer communication already happens on WhatsApp, unstructured, easy to lose track of. They need their existing WhatsApp conversations organized, searchable, and backed by reminders — without switching to a new app to check.

**Core principle:** The product lives where the conversation already lives. The owner keeps using WhatsApp exactly as before; Grahak organizes it quietly in the background.

---

## 3. Target User

- Solo shop owners, freelancers (photographers, tutors, consultants), small service businesses (salons, clinics, repair shops), 2-3 person agencies
- Primary channel: WhatsApp Business
- Non-technical, price-sensitive, low tolerance for a learning curve
- Currently using: nothing, a notebook, or WhatsApp's built-in "labels" (limited)

---

## 4. Features

### 4.1 MVP Features (build these first, in this order of priority)

1. **Auto-capture contacts** — every WhatsApp conversation automatically becomes a contact record (name, number, first/last contacted, message count). Zero manual data entry.
2. **Follow-up reminders** — one-tap "remind me in X days" on any contact; owner gets pinged back on WhatsApp when it's due. *This is the single highest-value feature — the thing that replaces "I forgot to follow up." Build and polish this before anything else.*
3. **Simple dashboard** — list of all contacts, sortable by last contacted / follow-up due, searchable by name or number. Click into a contact to see conversation history + notes.
4. **Manual notes per contact** — free-text field (e.g., "quoted ₹5000 for wedding shoot, waiting on date confirmation"). This is the #1 thing a notebook does that raw WhatsApp doesn't.
5. **Auto-tagging** — each message classified as `new_lead`, `returning_customer`, `question`, `complaint`, or `spam`. Start simple: rule/keyword-based (e.g., "price," "cost," "available?" → new_lead). Owner can override any tag with one tap.

### 4.2 Explicitly NOT in v1 (resist scope creep — these come later or never)

- Deal/pipeline stages, sales funnel visuals
- Multi-user/team permissions (v1 is single-owner)
- Email integration
- Invoicing/payments
- Marketing broadcast campaigns
- Analytics/reporting dashboards
- Integrations with Excel/other CRMs

---

## 5. Architecture — How It Actually Works

**Plain explanation first:** You cannot build on someone's personal WhatsApp. You use Meta's official **WhatsApp Business Platform (Cloud API)** — a separate system made for businesses/software to send and receive WhatsApp messages programmatically.

**Data flow, step by step:**
1. A business connects their WhatsApp Business number to Grahak (via Meta's setup).
2. A customer messages that number normally — they don't know or care Grahak exists.
3. Meta instantly forwards that message to your server via a **webhook** (a URL on your backend that Meta calls the moment a message arrives).
4. Your backend receives it, saves it to the database, creates/updates the contact, applies a tag, checks for reminders.
5. The owner keeps replying normally in WhatsApp — no change to their behavior. (Optionally, later, they can reply from the Grahak dashboard too.)
6. The **dashboard** is a separate website that only reads from your own database — it never talks to WhatsApp directly.

**Diagram:**
```
Customer's WhatsApp message
        │
        ▼
Meta WhatsApp Cloud API
        │  (webhook: Meta calls your server)
        ▼
Your backend server
        │
        ├─► classify message (tag)
        ├─► create/update contact
        ├─► check/schedule reminders
        │
        ▼
Database (Postgres)
        │
        ▼
Dashboard website (reads from database)
```

**You are building exactly 3 things:**
- A **webhook receiver** (backend endpoint that catches incoming messages)
- A **database** (contacts, messages, reminders)
- A **dashboard** (website showing that data)

Meta's API is just the pipe — you're not rebuilding WhatsApp, you're building what sits behind it.

---

## 6. Tech Stack (all free-tier, ₹0 to start)

| Piece | Tool | Cost |
|---|---|---|
| WhatsApp messaging | Meta WhatsApp Business Platform (Cloud API) + free test number | Free at pilot volume |
| Backend | Node.js + Express (or FastAPI if Python-first) | Free |
| Backend hosting | Render or Railway | Free tier |
| Database | Supabase (Postgres) | Free tier |
| Dashboard frontend | Next.js (React) | Free |
| Dashboard hosting | Vercel | Free tier |
| Domain | Skip for now — use free subdomain (e.g. yourapp.vercel.app) | ₹0 until first paying customer |

**No native Android/iOS app needed.** A mobile-responsive website works in any phone browser, costs no extra build time, and skips app store approval entirely. Build this later only if paying customers specifically ask for it.

---

## 7. Data Model

**businesses** (your paying customers — this is multi-tenant SaaS)
| field | type |
|---|---|
| id | uuid |
| name | string |
| whatsapp_business_number | string |
| plan | enum (trial / paid) |
| created_at | timestamp |

**contacts**
| field | type |
|---|---|
| id | uuid |
| business_id | uuid (FK) |
| whatsapp_number | string |
| display_name | string |
| current_tag | enum (new_lead / returning_customer / question / complaint / spam) |
| first_contacted_at | timestamp |
| last_contacted_at | timestamp |
| notes | text |

**messages**
| field | type |
|---|---|
| id | uuid |
| contact_id | uuid (FK) |
| direction | enum (inbound / outbound) |
| body | text |
| tag_at_time | enum |
| created_at | timestamp |

**reminders**
| field | type |
|---|---|
| id | uuid |
| contact_id | uuid (FK) |
| due_at | timestamp |
| status | enum (pending / sent / done) |
| note | text |

---

## 8. Build Steps (exact order, start to finish)

### Step 1 — Connect to WhatsApp (do this first, it takes calendar time to verify)
1. Create a Meta Developer account at developers.facebook.com
2. Create a new App → add the "WhatsApp" product
3. Meta gives you a **free test phone number** automatically — use it for all development/testing
4. Save your temporary access token, phone number ID, and app secret

### Step 2 — Build the backend
1. Set up a Node.js (Express) or Python (FastAPI) project
2. Build one `/webhook` endpoint that:
   - Handles Meta's verification handshake (a required one-time check)
   - Receives incoming message JSON payloads whenever someone messages your test number
3. On each incoming message: save it to the database, create the contact if new, apply a tag
4. Deploy to Render or Railway (free tier) — you need a public live URL for Meta to call

### Step 3 — Set up the database
1. Create a free Supabase project
2. Create the four tables from Section 7
3. Connect your backend to it

### Step 4 — Build the dashboard
1. Next.js project, deploy to Vercel
2. Pages needed for v1: contact list (sortable/searchable) + contact detail (conversation + notes + reminder button)
3. Reads directly from Supabase — no WhatsApp calls needed here

### Step 5 — Wire in replies + reminders
1. Add ability to send a WhatsApp reply from the dashboard (calls Meta's API to send, not just receive)
2. Add a scheduled job (e.g. a simple cron) that checks for due reminders and messages the owner on WhatsApp

**First milestone to celebrate:** a message sent to your test WhatsApp number shows up in your Supabase table. That's the hardest unknown solved — everything after is standard web development.

---

## 9. Getting Your First Customers (no ad budget needed)

1. **Don't build a marketing website or run ads first.** That's effort spent chasing strangers before you've proven the product works for anyone.
2. **Go directly to businesses you can reach personally:** local Bhopal shop owners, service providers your family/friends/VRGC-Nexus network know. Physically show them the dashboard on your phone — this is your actual unfair advantage over a stranger cold-emailing them.
3. **Explain it in one line, not a feature list:** "Your WhatsApp already has all your customers in it — this just makes sure you never forget to follow up, and you can search old conversations instead of scrolling." Lead with the pain (forgetting to follow up, losing track of customers), not the tech.
4. **Offer the first month free** to 2-3 pilot businesses in exchange for using it daily and giving honest feedback. This is normal — you're trading free access for real usage data + a testimonial.
5. **Only ask for payment once they've felt the value** — after a few weeks of it actually saving them a forgotten follow-up or helping them find an old conversation fast. By then it's an easy yes, not a cold pitch.
6. **Price:** flat ₹499-999/month per WhatsApp number, not per-seat (per-seat pricing is exactly the model that scares off this segment).

---

## 10. Success Metrics for Pilot Phase

- Time to first value: contact list populates automatically within minutes of connecting — no manual setup needed
- Follow-up completion rate: % of reminders the owner actually acts on
- Weekly active usage: does the owner check the dashboard regularly, or forget it exists (the real churn signal)
- Pilot target: 3-5 real businesses for 4 weeks before charging anyone

---

## 11. Open Items to Resolve During Build

- Meta's WhatsApp Business Platform requires business verification for a *live* (non-test) number — start this process early since it can take days
- Confirm whether the owner needs a dedicated number ported into the Cloud API, or can layer onto an existing one — check Meta's current requirements before finalizing
- Data privacy: WhatsApp message content is sensitive customer data — confirm what consent/disclosure is needed before storing it, even for a pilot