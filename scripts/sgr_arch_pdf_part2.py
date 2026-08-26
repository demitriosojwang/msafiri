"""
SGR Feeder Architecture PDF — Content Part 1 (TOC + Chapters 1-7)
"""
# This file is imported by sgr_arch_pdf.py — it expects all helpers from part1 to be in scope.

def build_content_part1(H1, H2, H3, P, PL, Muted, Bullets, Code, Callout, Table2, HR,
                        Spacer, PageBreak, safe_keep_together, Paragraph, body_style,
                        CONTENT_W, ACCENT, HEADER_FILL):
    story = []

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # TABLE OF CONTENTS
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    from reportlab.platypus.tableofcontents import TableOfContents
    from reportlab.lib.styles import ParagraphStyle

    toc_title_style = ParagraphStyle(
        name='TOCTitle', fontName='FreeSerif-Bold', fontSize=22, leading=28,
        textColor=HEADER_FILL, spaceBefore=0, spaceAfter=20, alignment=0,  # TA_LEFT
    )
    story.append(Paragraph('Table of Contents', toc_title_style))
    story.append(HR())

    toc = TableOfContents()
    toc.levelStyles = [
        ParagraphStyle(name='TOC0', fontName='FreeSerif-Bold', fontSize=11, leading=18,
                       textColor='#1b1a18', leftIndent=0, spaceBefore=4, spaceAfter=2),
        ParagraphStyle(name='TOC1', fontName='FreeSerif', fontSize=10, leading=15,
                       textColor='#78756f', leftIndent=14, spaceBefore=0, spaceAfter=2),
    ]
    story.append(toc)
    story.append(PageBreak())

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # CHAPTER 1 — EXECUTIVE SUMMARY
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    story.append(H1('1. Executive Summary'))
    story.append(P(
        'This document defines the production architecture, domain model, and database schema for the '
        '<b>SGR Feeder Platform</b> — a multi-user transport coordination system that connects passengers '
        'arriving at or departing from the Mombasa SGR Terminus with shared or private cab services operating '
        'along the North Coast and South Coast corridors.'
    ))
    story.append(P(
        'The platform exists to solve a specific operational pain point that is currently absorbed informally: '
        'cab drivers at the existing SGR waiting/collection points (stages) cannot leave for the terminus until '
        'their vehicle is full, and "full" depends on strangers physically showing up at the stage in real time. '
        'That unpredictability eats into the check-in, ticketing, and security buffer that passengers need in '
        'order to catch their train. The same problem repeats in reverse for arriving passengers, who must '
        'find a cab home from a terminus that may be unfamiliar to them.'
    ))
    story.append(P(
        'The platform converts both of these physical waiting problems into digital coordination problems. '
        'Passengers reserve seats in advance. Drivers see seat counts fill virtually, hours before anyone is '
        'physically at the stage. Departure times are reverse-engineered from the train schedule so that the '
        'cab leaves the pickup point at the latest possible moment that still gets passengers to the train on '
        'time. The return leg pools arriving passengers by destination zone, so a cab fills up by destination '
        'instead of by waiting at a stage.'
    ))
    story.append(H2('1.1 Platform Scope'))
    story.extend(Bullets([
        '<b>Passenger App</b> (React Native + Expo) — book shared or charter rides, choose pickup stage or off-stage location, pay via M-Pesa, receive live trip updates.',
        '<b>Driver App</b> (React Native + Expo) — receive assigned trips, view passenger manifest, send adaptive GPS updates, mark trip status changes.',
        '<b>Admin Web</b> (Next.js) — monitor arrivals and departures, detect stage coverage gaps, manage drivers and pricing, refund payments, audit operations.',
        '<b>Backend API</b> (NestJS + Fastify) — modular monolith exposing REST + WebSocket endpoints, owns all business rules and transactional integrity.',
        '<b>Database</b> (PostgreSQL + PostGIS) — single source of truth for all transactional state, with spatial indexes for location queries.',
    ]))
    story.append(H2('1.2 Architecture Principles'))
    story.extend(Bullets([
        '<b>PostgreSQL is the source of truth. Redis is not.</b> Redis may hold ephemeral state (driver presence, recent GPS, rate limits) but never owns data the business cares about.',
        '<b>Mobile apps never talk directly to PostgreSQL.</b> All data flows through an authenticated API that enforces authorization, validation, and transactional integrity.',
        '<b>SQLite is an edge cache, not the centre.</b> Mobile devices use SQLite for offline profile/booking cache that syncs through the API. SQLite is not the authoritative database for this platform.',
        '<b>Modular monolith, not microservices.</b> One backend, one database, clean internal module boundaries. Service split happens only when the business outgrows the monolith — not on day one.',
        '<b>Bookings, rides, and trips are distinct entities.</b> A booking is a commercial reservation; a ride is a physical vehicle trip; multiple passengers can share a single ride. This separation is built in from day one.',
        '<b>State machines, not booleans.</b> Booking and payment status use explicit state machines with allowed transitions. Random boolean combinations like <code>isPaid &amp;&amp; !isBooked</code> are impossible by construction.',
    ]))
    story.append(H2('1.3 Document Status'))
    story.append(P(
        'This is Version 1.0 of the engineering specification. It is intended as the authoritative reference '
        'for the founding engineering team. Subsequent revisions will be tracked via dated appendices; '
        'architectural changes that reverse decisions in this document must be recorded as new Architecture '
        'Decision Records (ADRs) in Chapter 13 rather than silently editing the existing text.'
    ))
    story.append(PageBreak())

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # CHAPTER 2 — SYSTEM ARCHITECTURE OVERVIEW
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    story.append(H1('2. System Architecture Overview'))
    story.append(P(
        'The platform is structured as four independently deployable surfaces — two mobile apps, one web admin, '
        'and one backend — backed by a small set of infrastructure primitives. The diagram below shows the '
        'topology and the directional flow of trust. Every arrow represents an authenticated call; no client '
        'ever reads from or writes to the database directly.'
    ))

    arch_diagram = """\
+-----------------------+      +-----------------------+
|  Passenger App        |      |     Driver App        |
|  React Native + Expo  |      |  React Native + Expo  |
|  SQLite offline cache |      |  GPS / foreground svc |
+-----------+-----------+      +-----------+-----------+
            |                              |
            |   HTTPS REST + WebSocket     |
            |   (auth: JWT + refresh)      |
            v                              v
+-------------------------------------------------------+
|                   API (NestJS + Fastify)              |
|                  Modular Monolith                     |
|  auth | users | bookings | rides | dispatch |         |
|  payments | pricing | locations | notifications |     |
|  admin | audit                                        |
+---+----------------+----------------+----------------+|
    |                |                |                |
    |  source truth  |   ephemeral    |  documents     |
    |                |   realtime     |  (driver docs, |
    |                |   / cache      |  support media)|
    v                v                v
+-----------+   +-----------+   +-----------+
| PostgreSQL|   |   Redis   |   |  Object   |
| + PostGIS |   |  cache/   |   |  Storage  |
| (TRUTH)   |   |  presence |   |  S3-compat|
+-----+-----+   +-----------+   +-----------+
      |
      |  (read-only / batch views)
      v
+-------------------------------------------------------+
|              Admin Web (Next.js + TypeScript)         |
|  arrival monitoring | coverage gaps | charter status  |
|  fleet mgmt | pricing | refunds | audit log           |
+-------------------------------------------------------+
"""
    story.extend(Code(arch_diagram, caption='Figure 2.1 — Platform topology. PostgreSQL is the only source of truth.'))

    story.append(H2('2.1 The Trust Boundary'))
    story.append(P(
        'The API is the only component allowed to write to PostgreSQL. Mobile clients authenticate via '
        'short-lived JWT access tokens (15 minutes) backed by longer refresh tokens (rotated on each use). '
        'Admin operations require an additional RBAC role check at the service layer. No client receives '
        'database credentials, and no client is trusted to make authorization decisions — every '
        '<code>isAdmin</code>-style check happens inside the API, against the user\'s server-side role record.'
    ))
    story.append(P(
        'The API also owns all rate limiting, audit logging, and idempotency enforcement. A duplicate M-Pesa '
        'callback, a double-tapped "book seat" button, or a flaky network retry must not produce duplicate '
        'bookings or duplicate charges. These guarantees are enforced at the database transaction boundary, '
        'not at the client.'
    ))

    story.append(H2('2.2 Why Modular Monolith'))
    story.append(P(
        'A modular monolith runs as a single NestJS process with one PostgreSQL database, but internally it '
        'is organised into bounded modules: <code>auth</code>, <code>bookings</code>, <code>rides</code>, '
        '<code>dispatch</code>, <code>payments</code>, <code>pricing</code>, <code>locations</code>, '
        '<code>notifications</code>, <code>admin</code>, <code>audit</code>. Each module owns its own tables, '
        'service classes, and DTOs. Cross-module communication happens via explicit service calls, not via '
        'a shared database grab-bag.'
    ))
    story.append(P(
        'This is the sweet spot for a startup that has not yet carried its first passenger. Microservices '
        'would saddle the team with twelve Docker containers, eight databases, five message brokers, and four '
        'deployment pipelines before the platform has any traffic to justify them. The modular monolith '
        'retains clean boundaries so that, when (and only when) a single module genuinely needs to scale '
        'independently — for example, the GPS ingestion pipeline — that module can be extracted into a '
        'separate service with minimal friction.'
    ))

    story.append(H2('2.3 The Offline Edge'))
    story.append(P(
        'Mobile apps run on Kenyan mobile networks that are reliable in urban centres but uneven along the '
        'highway corridors that connect Mombasa to Malindi, Ukunda, and the Likoni South Coast. Each mobile '
        'app ships with a SQLite database that caches the user\'s profile, their most recent bookings, '
        'station lists, fare quotes, and any locally initiated actions that have not yet synced. The cache is '
        'authoritative for nothing — it is a read-through cache for offline display, and a write-ahead queue '
        'for actions that will be replayed when connectivity returns.'
    ))
    story.append(P(
        'Critically, the SQLite cache never makes booking decisions locally. A passenger who taps "book seat" '
        'while offline sees a "queued for when you reconnect" state; the actual seat reservation happens '
        'server-side under a PostgreSQL transaction. This avoids the impossible problem of reconciling two '
        'passengers who both thought they had the last seat on a 4-seater while offline.'
    ))
    story.append(PageBreak())

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # CHAPTER 3 — TECHNOLOGY STACK DECISIONS
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    story.append(H1('3. Technology Stack Decisions'))
    story.append(P(
        'Each layer of the stack is chosen for a concrete reason, not for fashion. The table below lists '
        'the chosen technology, the most credible alternative that was considered, and the reason for the '
        'choice. Where a decision is reversible later, that is noted; where it is effectively one-way '
        '(database, identity model), the rationale is correspondingly heavier.'
    ))

    stack_rows = [
        ['Passenger App', 'React Native + Expo + TypeScript', 'Flutter',
         'Same TS ecosystem as the rest of the platform. Expo location tooling supports foreground services and Android 14 background-location permissions.'],
        ['Driver App', 'React Native + Expo + TypeScript', 'Flutter',
         'Same reasoning. Driver app shares ~70% of code with passenger app (auth, network layer, types).'],
        ['Admin Web', 'Next.js + TypeScript', 'CRA / Vite SPA',
         'SSR for fast first paint on admin dashboards. App Router suits the multi-section dashboard layout. Same TS ecosystem.'],
        ['Backend', 'NestJS + Fastify + TypeScript', 'Express / Next.js API routes',
         'Modular structure with DI, guards, interceptors. Fastify adapter is faster than Express. Far more maintainable than a giant Next.js API folder for a system this size.'],
        ['Main DB', 'PostgreSQL + PostGIS', 'MongoDB / MySQL',
         'ACID + row-level locking for booking concurrency. PostGIS for spatial queries (find drivers within X km of passenger). SQLite recommends client/server RDBMS for multi-writer systems.'],
        ['Local Mobile DB', 'SQLite (via expo-sqlite)', 'Realm / WatermelonDB',
         'Officially recommended by SQLite docs for local device storage. Simple, battle-tested, no sync engine lock-in.'],
        ['Cache / Realtime', 'Redis', 'In-memory only',
         'Driver presence, rate limiting, recent GPS, WebSocket scaling. NOT a source of truth. Can be skipped for initial low-traffic launch.'],
        ['Payments', 'M-Pesa Daraja (with provider abstraction)', 'Direct M-Pesa hardcoding',
         'Daraja 3.0 is the standard Kenyan payment API. Provider abstraction (payments/mpesa/ module) allows adding card / Airtel Money later.'],
        ['Map UI', 'MapLibre', 'Google Maps SDK',
         'Open-source, no per-load licensing cost. Map rendering separated from routing/geocoding.'],
        ['Routing', 'OSRM or Valhalla (self-hosted)', 'Google Directions API',
         'Avoids per-request Google billing. Self-hosted on a single VPS handles MVP volume easily.'],
        ['Object Storage', 'S3-compatible (e.g., MinIO self-hosted or Cloudflare R2)', 'Filesystem',
         'Driver documents (ID, logbook, insurance) must survive server rebuilds. Filesystem ties data to one machine.'],
        ['Deploy', 'Linux VPS + Docker Compose + Caddy', 'AWS ECS / Kubernetes',
         'One VPS handles considerably more traffic than an MVP generates. Caddy gives automatic HTTPS. K8s is premature.'],
        ['CI/CD', 'GitHub Actions', 'Jenkins / CircleCI',
         'Native to GitHub repos, free for OSS, simple YAML.'],
        ['Monitoring', 'Structured JSON logs + Sentry + UptimeRobot', 'ELK / Datadog',
         'Structured logs are searchable via grep/jq. Sentry self-hosted for error tracking. UptimeRobot for external probes.'],
    ]
    story.extend(Table2(
        ['Layer', 'Chosen', 'Alternative', 'Rationale'],
        stack_rows,
        col_widths=[22*2.5, 22*4.5, 22*3.5, 22*7],
    ))

    story.append(H2('3.1 What This Stack Is Not'))
    story.append(P(
        'It is not a serverless architecture. Lambda-style functions introduce cold-start latency and obscure '
        'transaction boundaries — both poison for a booking system where the difference between "reserved" '
        'and "available" must be resolved in single-digit milliseconds. It is also not a NoSQL architecture. '
        'MongoDB would force us to rebuild transactional integrity in application code that PostgreSQL gives '
        'us for free, and we would lose PostGIS entirely — there is no equivalent document-store spatial '
        'index that approaches PostGIS for the queries this platform needs.'
    ))
    story.append(P(
        'It is not a microservices architecture. The platform has not yet carried its first passenger. '
        'Adding a message broker, a service mesh, and inter-service network calls at this stage would burn '
        'engineering time on infrastructure instead of product. The modular monolith keeps the option open '
        'to extract services later — the module boundaries are the seams along which a future service split '
        'would happen.'
    ))
    story.append(PageBreak())

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # CHAPTER 4 — DOMAIN MODEL
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    story.append(H1('4. Domain Model'))
    story.append(P(
        'The domain model is the most important decision in this document. Get it wrong and most of the '
        'application architecture becomes a fight against the data shape. The model below separates three '
        'concepts that are often incorrectly merged into a single "booking" table: the passenger\'s '
        'commercial reservation, the physical vehicle trip that fulfils it, and the operational route the '
        'vehicle takes with its stops.'
    ))

    story.append(H2('4.1 Booking vs Ride vs Trip'))
    story.append(P(
        'A <b>booking</b> is what the passenger pays for. It is a commercial reservation: "I want a seat '
        'from Mombasa Terminus to Mtwapa on the 14:00 arriving train." The booking has a price, a payment '
        'state, and a passenger. It does not yet know which vehicle will carry it.'
    ))
    story.append(P(
        'A <b>ride</b> is the physical vehicle trip that fulfils one or more bookings. A ride has a driver, '
        'a vehicle, a route, and a sequence of stops. When four passengers book seats on the same 4-seater '
        'cab going to Mtwapa, they all attach to the same ride. When one passenger books a private charter, '
        'they are the only booking on that ride, but the ride still exists as a distinct entity.'
    ))
    story.append(P(
        'A <b>trip</b> in our domain model is the operational envelope around a ride: driver, vehicle, '
        'route, stops, and the dispatch state machine. We use "ride" and "trip" somewhat interchangeably '
        'in the codebase, but the database table is named <code>rides</code> to avoid collision with the '
        'transit-industry meaning of "trip" as a scheduled service.'
    ))

    story.append(H3('Why the separation matters'))
    story.append(P(
        'If you collapse booking + ride into one table, you cannot represent shared rides without duplicating '
        'the driver, vehicle, and route across every passenger row. You also cannot represent a charter, '
        'where one booking consumes the whole vehicle. And you cannot reassign a passenger from one vehicle '
        'to another (e.g., when the original cab breaks down) without rewriting the booking. The separation '
        'lets all three cases work without schema changes.'
    ))

    story.append(H2('4.2 Entity Inventory'))
    entity_rows = [
        ['users', 'Identity root. Phone number is the natural key. One user can be passenger, driver, and admin simultaneously.'],
        ['passenger_profiles', 'Passenger-specific data: saved pickup points, payment defaults, ratings received.'],
        ['driver_profiles', 'Driver-specific data: license, NTSA logbook ref, verification status, vehicle assignment.'],
        ['vehicles', 'Vehicle registry: plate, capacity, cab type (4/7/11/14-seater), insurance, owner.'],
        ['driver_documents', 'Verification documents (ID, license, logbook, insurance). File in object storage; metadata in PostgreSQL.'],
        ['stations', 'Agreed SGR waiting/collection points used as pickup/drop-off stages (e.g., Kiembeni Mwisho, Likoni Ferry Container).'],
        ['service_areas', 'Geographic polygons (South Coast, North Coast, Mombasa CBD) used for driver allocation and pricing.'],
        ['pickup_points', 'Off-stage pickup locations (geocoded landmarks) with distance-from-nearest-stage for surcharge calculation.'],
        ['journeys', 'A scheduled train departure or arrival. Ties to a specific train code and time.'],
        ['bookings', 'Passenger\'s commercial reservation. Has price, payment state, lifecycle state machine.'],
        ['rides', 'Physical vehicle trip. Has driver, vehicle, route, dispatch state. Multiple bookings attach to one ride.'],
        ['ride_stops', 'Ordered stops on a ride (pickup and drop-off). Each stop has a location and a sequence number.'],
        ['ride_passengers', 'Join table: which passengers are on which ride, which stop they board/alight at.'],
        ['driver_assignments', 'Which driver is assigned to which ride, with assignment state (offered, accepted, rejected, revoked).'],
        ['driver_locations', 'Live driver position (single row per driver, updated in place). For "driver is X km away" displays.'],
        ['driver_location_events', 'Historical GPS events, partitioned by month. For trip replay, dispute resolution, analytics.'],
        ['payments', 'Top-level payment record for a booking. Tracks total amount, provider, status.'],
        ['payment_attempts', 'Individual attempts (STK push, callback). Idempotent on (provider, provider_transaction_id).'],
        ['refunds', 'Refund records with reason, amount, approver, provider reference.'],
        ['pricing_rules', 'Configurable fare rules: base fare, per-km surcharge, charter multiplier, peak-hour multiplier.'],
        ['fare_quotes', 'Snapshot of a quoted fare (valid for X minutes) so the booking sees the same price the quote saw.'],
        ['notifications', 'Outbound notification log: channel (push/SMS), payload, status, retry count.'],
        ['ratings', 'Passenger-to-driver and driver-to-passenger ratings after a completed ride.'],
        ['support_tickets', 'Customer support tickets linked to bookings, rides, or payments.'],
        ['audit_logs', 'Append-only record of state-changing actions: actor, action, entity, metadata, IP, timestamp.'],
    ]
    story.extend(Table2(
        ['Entity', 'Description'],
        entity_rows,
        col_widths=[22*4.5, 22*13],
    ))
    story.append(PageBreak())

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # CHAPTER 5 — DATABASE SCHEMA (FULL SQL DDL)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    story.append(H1('5. Database Schema (Full SQL DDL)'))
    story.append(P(
        'The schema below is presented as runnable PostgreSQL DDL with PostGIS extensions enabled. The DDL '
        'is organised by domain: identity, geography, operations, payments, location, pricing, and system. '
        'All foreign keys are explicit; all spatial columns use <code>geography(Point,4326)</code> so '
        'distance queries return metres without manual projection. Indexes are partial where appropriate '
        '(e.g., only active bookings are indexed by ride_id).'
    ))
    story.append(P(
        'A few conventions: every table has <code>created_at</code> and <code>updated_at</code> timestamps '
        'managed by triggers (not shown for brevity). Every primary key is a UUID v7 (time-sortable, '
        'index-friendly). Enumerations are CHECK constraints rather than enum types so that schema migrations '
        'do not require enum type alterations. Soft-deleted rows have <code>deleted_at</code> set; queries '
        'filter <code>WHERE deleted_at IS NULL</code> via a partial index where it matters.'
    ))

    story.append(H2('5.1 Extensions and Conventions'))
    story.extend(Code("""\
-- Required extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- fuzzy text search for landmarks

-- UUID v7 generation function (time-sortable, index-friendly)
-- In production, use pg_uuidv7 extension or application-side generation.
CREATE OR REPLACE FUNCTION uuid_v7() RETURNS uuid AS $$
DECLARE
  unix_ts_ms bigint := extract(epoch from clock_timestamp()) * 1000;
  uuid_bytes bytea;
BEGIN
  uuid_bytes := decode(
    lpad(to_hex(unix_ts_ms), 12, '0') ||
    lpad(to_hex(floor(random() * 4294967296)::bigint), 8, '0') ||
    lpad(to_hex(floor(random() * 4294967296)::bigint), 8, '0') ||
    lpad(to_hex(floor(random() * 65536)::bigint), 4, '0'),
    'hex'
  );
  -- Set version 7 and variant bits per RFC 9562
  RETURN encode(uuid_bytes, 'hex')::uuid;
END;
$$ LANGUAGE plpgsql;

-- updated_at trigger (apply to every table)
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = clock_timestamp();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""))

    story.append(H2('5.2 Identity & Profiles'))
    story.extend(Code("""\
CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT uuid_v7(),
  phone           text NOT NULL UNIQUE,         -- E.164 format: +2547XXXXXXXX
  phone_verified  boolean NOT NULL DEFAULT false,
  email           text UNIQUE,
  email_verified  boolean NOT NULL DEFAULT false,
  password_hash   text,                          -- admins only; passengers use OTP
  role_mask       integer NOT NULL DEFAULT 1,    -- bitmask: 1=passenger 2=driver 4=admin
  status          text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','suspended','deactivated')),
  last_login_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
  deleted_at      timestamptz
);
CREATE INDEX users_role_mask_idx ON users (role_mask) WHERE deleted_at IS NULL;

CREATE TABLE passenger_profiles (
  id              uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id         uuid NOT NULL REFERENCES users(id),
  display_name    text NOT NULL,
  default_stage_id uuid REFERENCES stations(id),
  rating_avg      numeric(2,1) NOT NULL DEFAULT 0.0,
  rating_count    integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (user_id)
);

CREATE TABLE driver_profiles (
  id                uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id           uuid NOT NULL REFERENCES users(id),
  display_name      text NOT NULL,
  license_number    text NOT NULL UNIQUE,
  ntsa_logbook_ref  text,                       -- reference to vehicle logbook
  vehicle_id        uuid REFERENCES vehicles(id),
  verification_status text NOT NULL DEFAULT 'pending'
                    CHECK (verification_status IN
                      ('pending','submitted','verified','rejected','suspended')),
  approval_status   text NOT NULL DEFAULT 'pending'
                    CHECK (approval_status IN
                      ('pending','approved','rejected','revoked')),
  rating_avg        numeric(2,1) NOT NULL DEFAULT 0.0,
  rating_count      integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at        timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (user_id)
);
CREATE INDEX driver_profiles_verification_idx
  ON driver_profiles (verification_status, approval_status);

CREATE TABLE vehicles (
  id              uuid PRIMARY KEY DEFAULT uuid_v7(),
  plate_number    text NOT NULL UNIQUE,
  cab_type        text NOT NULL CHECK (cab_type IN
                    ('4-seater','7-seater','11-seater','14-seater')),
  capacity        integer NOT NULL CHECK (capacity > 0 AND capacity <= 20),
  owner_user_id   uuid REFERENCES users(id),    -- may differ from driver
  insurance_expiry date NOT NULL,
  inspection_expiry date NOT NULL,
  status          text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','maintenance','retired')),
  created_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at      timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX vehicles_status_idx ON vehicles (status) WHERE status = 'active';

CREATE TABLE driver_documents (
  id              uuid PRIMARY KEY DEFAULT uuid_v7(),
  driver_profile_id uuid NOT NULL REFERENCES driver_profiles(id),
  doc_type        text NOT NULL CHECK (doc_type IN
                    ('national_id','driving_license','logbook','insurance',
                     'ntsa_inspection','passport_photo')),
  storage_key     text NOT NULL,                -- S3-compatible object key
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','verified','rejected','expired')),
  uploaded_at     timestamptz NOT NULL DEFAULT clock_timestamp(),
  verified_at     timestamptz,
  verified_by     uuid REFERENCES users(id),
  expires_at      date,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX driver_documents_driver_idx ON driver_documents (driver_profile_id, doc_type);
"""))

    story.append(H2('5.3 Geography (Stations, Service Areas, Pickup Points)'))
    story.extend(Code("""\
-- Note: stations table is referenced by passenger_profiles and others above.
-- Forward declaration pattern: create stations before profiles in real migrations.

CREATE TABLE service_areas (
  id              uuid PRIMARY KEY DEFAULT uuid_v7(),
  name            text NOT NULL UNIQUE,         -- 'South Coast','North Coast','Mombasa CBD'
  coast           text NOT NULL CHECK (coast IN ('south','north','cbd')),
  boundary        geography(Polygon, 4326) NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at      timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX service_areas_boundary_gist_idx ON service_areas USING GIST (boundary);

CREATE TABLE stations (
  id              uuid PRIMARY KEY DEFAULT uuid_v7(),
  name            text NOT NULL,                -- 'Kiembeni Mwisho','Likoni Ferry Container'
  area            text NOT NULL,                -- 'Likoni','Bamburi','Mtwapa','Malindi','Kombani','Ukunda'
  coast           text NOT NULL CHECK (coast IN ('south','north','cbd')),
  location        geography(Point, 4326) NOT NULL,
  landmark        text,                         -- human-readable description
  travel_min_to_terminus integer NOT NULL,      -- typical travel time in minutes
  peak_adjust_min integer NOT NULL DEFAULT 0,   -- extra minutes during peak hours
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (name, area)
);
CREATE INDEX stations_location_gist_idx ON stations USING GIST (location);
CREATE INDEX stations_active_idx ON stations (coast, area) WHERE is_active = true;

CREATE TABLE pickup_points (
  id              uuid PRIMARY KEY DEFAULT uuid_v7(),
  nearest_station_id uuid NOT NULL REFERENCES stations(id),
  label           text NOT NULL,                -- 'Near Tuskys Bamburi'
  location        geography(Point, 4326) NOT NULL,
  distance_km     numeric(4,2) NOT NULL,        -- precomputed distance to nearest station
  created_by      uuid REFERENCES users(id),    -- the passenger who first used it
  created_at      timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX pickup_points_location_gist_idx ON pickup_points USING GIST (location);
CREATE INDEX pickup_points_station_idx ON pickup_points (nearest_station_id);
"""))

    story.append(PageBreak())

    # Continue with operations, payments, location, pricing, system
    story.append(H2('5.4 Operations (Journeys, Bookings, Rides, Stops)'))
    story.extend(Code("""\
CREATE TABLE journeys (
  id              uuid PRIMARY KEY DEFAULT uuid_v7(),
  train_code     text NOT NULL,                 -- 'Madaraka Express'
  train_time      time NOT NULL,                -- 08:00, 15:00, 22:00, 04:00, 14:00, 20:30
  direction       text NOT NULL CHECK (direction IN ('inbound','outbound')),
  origin          text NOT NULL,
  destination     text NOT NULL,
  journey_date    date NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (train_code, train_time, journey_date)
);

CREATE TABLE bookings (
  id              uuid PRIMARY KEY DEFAULT uuid_v7(),
  booking_ref     text NOT NULL UNIQUE,         -- human-readable: SGRF-AB12CD
  passenger_id    uuid NOT NULL REFERENCES users(id),
  journey_id      uuid NOT NULL REFERENCES journeys(id),
  pickup_kind     text NOT NULL CHECK (pickup_kind IN ('stage','off-stage')),
  pickup_station_id uuid REFERENCES stations(id),
  pickup_point_id uuid REFERENCES pickup_points(id),
  dropoff_station_id uuid REFERENCES stations(id),
  seats_reserved  integer NOT NULL CHECK (seats_reserved >= 1 AND seats_reserved <= 20),
  booking_kind    text NOT NULL CHECK (booking_kind IN ('pooled','charter')),
  state           text NOT NULL DEFAULT 'quote_created'
                  CHECK (state IN
                    ('quote_created','booking_pending','awaiting_payment',
                     'confirmed','assignment_pending','driver_assigned',
                     'driver_en_route','passenger_picked_up','in_progress',
                     'completed','expired','cancelled','no_show')),
  fare_quoted_ksh integer NOT NULL,             -- snapshot of fare at quote time
  fare_final_ksh  integer,                      -- settled on completion
  -- CHECK constraint: charter must reserve all vehicle seats; pooled 1..N
  -- (enforced at application layer once ride is assigned)
  has_e_ticket    boolean NOT NULL DEFAULT false,
  confirmed_pickup_time timestamptz,            -- reverse-engineered latest-leave
  ride_id         uuid REFERENCES rides(id),    -- null until dispatch assigns
  created_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at      timestamptz NOT NULL,         -- quote expires in 15 min
  cancelled_at    timestamptz,
  cancellation_reason text
);
CREATE INDEX bookings_passenger_idx ON bookings (passenger_id) WHERE cancelled_at IS NULL;
CREATE INDEX bookings_ride_idx ON bookings (ride_id) WHERE ride_id IS NOT NULL;
CREATE INDEX bookings_journey_state_idx ON bookings (journey_id, state)
  WHERE cancelled_at IS NULL;
CREATE INDEX bookings_state_idx ON bookings (state) WHERE cancelled_at IS NULL;

CREATE TABLE rides (
  id              uuid PRIMARY KEY DEFAULT uuid_v7(),
  journey_id      uuid NOT NULL REFERENCES journeys(id),
  driver_id       uuid REFERENCES driver_profiles(id),
  vehicle_id      uuid REFERENCES vehicles(id),
  stage_id        uuid NOT NULL REFERENCES stations(id),  -- primary stage
  direction       text NOT NULL CHECK (direction IN ('inbound','outbound')),
  capacity_total  integer NOT NULL,
  capacity_booked integer NOT NULL DEFAULT 0,
  is_charter      boolean NOT NULL DEFAULT false,
  state           text NOT NULL DEFAULT 'open'
                  CHECK (state IN
                    ('open','filling','locked','departed','completed','cancelled')),
  base_fare_ksh   integer NOT NULL DEFAULT 450,
  current_fare_ksh integer NOT NULL DEFAULT 450,
  departed_at     timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at      timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX rides_journey_idx ON rides (journey_id, direction, state);
CREATE INDEX rides_driver_idx ON rides (driver_id) WHERE state IN ('open','filling','locked','departed');
CREATE INDEX rides_stage_idx ON rides (stage_id, direction, state);

CREATE TABLE ride_stops (
  id              uuid PRIMARY KEY DEFAULT uuid_v7(),
  ride_id         uuid NOT NULL REFERENCES rides(id),
  sequence        integer NOT NULL,             -- 1, 2, 3...
  stop_type       text NOT NULL CHECK (stop_type IN ('pickup','dropoff')),
  station_id      uuid REFERENCES stations(id),
  pickup_point_id uuid REFERENCES pickup_points(id),
  location        geography(Point, 4326) NOT NULL,
  planned_time    timestamptz,                  -- reverse-engineered
  actual_time     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (ride_id, sequence)
);
CREATE INDEX ride_stops_ride_idx ON ride_stops (ride_id, sequence);

CREATE TABLE ride_passengers (
  id              uuid PRIMARY KEY DEFAULT uuid_v7(),
  ride_id         uuid NOT NULL REFERENCES rides(id),
  booking_id      uuid NOT NULL REFERENCES bookings(id),
  board_stop_id   uuid NOT NULL REFERENCES ride_stops(id),
  alight_stop_id  uuid NOT NULL REFERENCES ride_stops(id),
  seats           integer NOT NULL CHECK (seats >= 1),
  created_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (booking_id),                          -- one booking = one ride row
  UNIQUE (ride_id, booking_id)
);
CREATE INDEX ride_passengers_ride_idx ON ride_passengers (ride_id);

CREATE TABLE driver_assignments (
  id              uuid PRIMARY KEY DEFAULT uuid_v7(),
  ride_id         uuid NOT NULL REFERENCES rides(id),
  driver_id       uuid NOT NULL REFERENCES driver_profiles(id),
  state           text NOT NULL DEFAULT 'offered'
                  CHECK (state IN ('offered','accepted','rejected','revoked','completed')),
  offered_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
  responded_at    timestamptz,
  revoked_at      timestamptz,
  revoked_reason  text,
  UNIQUE (ride_id)                               -- one driver per ride at a time
);
CREATE INDEX driver_assignments_driver_state_idx
  ON driver_assignments (driver_id, state) WHERE state IN ('offered','accepted');
"""))

    story.append(PageBreak())

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # CHAPTER 6 — BOOKING STATE MACHINE
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    story.append(H1('6. Booking State Machine'))
    story.append(P(
        'Booking state is modelled as an explicit finite state machine, not as a collection of booleans. '
        'This eliminates impossible combinations (e.g., <code>isPaid &amp;&amp; isCancelled</code>) by '
        'construction and makes the lifecycle visible to engineers, ops, and support. Each transition is '
        'guarded by an allowed-actor check and produces audit-log entries plus side effects.'
    ))

    state_diagram = """\
                +-----------------+
                |  QUOTE_CREATED  |  passenger requests fare quote
                +--------+--------+
                         |
                         |  passenger confirms
                         v
                +-----------------+
                | BOOKING_PENDING |  booking row created, seats held briefly
                +--------+--------+
                         |
                         |  system initiates M-Pesa STK push
                         v
                +-----------------+
                | AWAITING_PAYMENT|  STK push sent, waiting for callback
                +--------+--------+
                         |
              +----------+-----------+
              |                      |
     callback confirmed       quote expires (15min)
              |                      |
              v                      v
        +-----------+         +-----------+
        | CONFIRMED |         |  EXPIRED  |
        +-----+-----+         +-----------+
              |
              |  dispatcher assigns ride
              v
        +---------------------+
        | ASSIGNMENT_PENDING  |  ride created, driver offer sent
        +----------+----------+
                   |
        +----------+-----------+
        |                      |
   driver accepts        driver rejects / timeout
        |                      |
        v                      v
  +-------------+       (back to ASSIGNMENT_PENDING,
  |DRIVER_ASSIGNED        new driver offered)
  +------+------+
         |
         |  driver starts en route
         v
  +---------------+
  |DRIVER_EN_ROUTE|
  +------+--------+
         |
         |  driver arrives, picks up passenger
         v
  +----------------------+
  | PASSENGER_PICKED_UP  |
  +----------+-----------+
             |
             |  trip in progress
             v
   +---------------+
   |  IN_PROGRESS  |
   +-------+-------+
           |
           |  driver completes trip
           v
   +------------+
   | COMPLETED  |
   +------------+

   Branches from any pre-COMPLETED state:
       CONFIRMED ─────────────────► CANCELLED  (passenger cancels)
       DRIVER_ASSIGNED ────────────► NO_SHOW   (passenger didn't appear)

   Terminal states: COMPLETED, EXPIRED, CANCELLED, NO_SHOW
"""
    story.extend(Code(state_diagram, caption='Figure 6.1 — Booking lifecycle state machine.'))

    story.append(H2('6.1 Transition Rules'))
    transition_rows = [
        ['QUOTE_CREATED', 'BOOKING_PENDING', 'Passenger', 'Quote created, passenger confirms seat selection.'],
        ['BOOKING_PENDING', 'AWAITING_PAYMENT', 'System', 'M-Pesa STK push initiated, payment_attempt row created.'],
        ['BOOKING_PENDING', 'EXPIRED', 'System (timer)', '15-minute quote TTL elapsed without confirmation.'],
        ['AWAITING_PAYMENT', 'CONFIRMED', 'System (callback)', 'M-Pesa callback verified, payment recorded.'],
        ['AWAITING_PAYMENT', 'EXPIRED', 'System (timer)', 'Payment callback not received within 5 minutes.'],
        ['CONFIRMED', 'ASSIGNMENT_PENDING', 'System (dispatcher)', 'Ride created, driver assignment offered.'],
        ['CONFIRMED', 'CANCELLED', 'Passenger / Admin', 'Pre-departure cancellation, triggers refund flow.'],
        ['ASSIGNMENT_PENDING', 'DRIVER_ASSIGNED', 'Driver (accept)', 'Driver accepts assignment via app.'],
        ['ASSIGNMENT_PENDING', 'ASSIGNMENT_PENDING', 'System (timeout)', 'Driver rejected or timed out; new driver offered.'],
        ['DRIVER_ASSIGNED', 'DRIVER_EN_ROUTE', 'Driver', 'Driver taps "Start trip" in app.'],
        ['DRIVER_ASSIGNED', 'NO_SHOW', 'Driver / System', 'Passenger not at pickup after 15min grace.'],
        ['DRIVER_EN_ROUTE', 'PASSENGER_PICKED_UP', 'Driver', 'Driver confirms pickup at stop.'],
        ['PASSENGER_PICKED_UP', 'IN_PROGRESS', 'Driver', 'Vehicle departs pickup location.'],
        ['IN_PROGRESS', 'COMPLETED', 'Driver', 'Vehicle arrives at drop-off, all passengers alight.'],
    ]
    story.extend(Table2(
        ['From State', 'To State', 'Actor', 'Trigger & Side Effects'],
        transition_rows,
        col_widths=[22*3.5, 22*3.5, 22*2.5, 22*8],
        caption='Table 6.1 — Allowed state transitions. Any transition not listed is rejected by the API.',
    ))

    story.append(H2('6.2 Concurrency: Holding Seats Without Selling Them Twice'))
    story.append(P(
        'When two passengers tap "book seat" on the same 4-seater cab at nearly the same instant, only one '
        'can get the last seat. PostgreSQL\'s row-level locking resolves this with <code>SELECT ... FOR '
        'UPDATE</code> on the rides row inside a transaction. The full booking transaction looks like:'
    ))
    story.extend(Code("""\
BEGIN;

-- Lock the ride row; other concurrent bookings block here
SELECT capacity_total, capacity_booked
  FROM rides
  WHERE id = :ride_id
  FOR UPDATE;

-- Verify availability (re-check after lock acquired)
IF capacity_booked + :seats_requested > capacity_total THEN
  ROLLBACK;
  RETURN insufficient_capacity;
END IF;

-- Create the booking row
INSERT INTO bookings (...) VALUES (...);

-- Atomically reserve capacity
UPDATE rides
  SET capacity_booked = capacity_booked + :seats_requested
  WHERE id = :ride_id;

-- Create the payment attempt (idempotency key prevents dup STK push)
INSERT INTO payment_attempts (...) VALUES (...);

COMMIT;
"""))
    story.append(P(
        'The <code>FOR UPDATE</code> lock is held for milliseconds. If Passenger B\'s transaction begins '
        'while Passenger A\'s is in flight, B waits until A commits, then re-reads the capacity and either '
        'succeeds (if A took fewer seats than the remaining capacity) or fails cleanly. There is no '
        'window in which both passengers can be sold the same seat.'
    ))
    story.append(P(
        'For high-contention scenarios (e.g., a popular train time with multiple cabs filling at once), '
        'we can use <code>SKIP LOCKED</code> to skip over locked rides and try the next available cab '
        'in the queue, rather than blocking. This pattern is documented in PostgreSQL\'s SELECT reference '
        'and is the standard way to build work-queue-style dispatch without Redis.'
    ))
    story.append(PageBreak())

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # CHAPTER 7 — PAYMENT FLOWS
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    story.append(H1('7. Payment Flows'))
    story.append(P(
        'Payments are integrated with M-Pesa Daraja 3.0 (Safaricom\'s developer platform) but the payment '
        'module is structured as a provider abstraction so we can add Airtel Money, card processing, or '
        'corporate billing later without leaking provider concepts into the booking module.'
    ))

    story.append(H2('7.1 Payment Lifecycle'))
    story.append(P(
        'A payment is never considered successful just because M-Pesa sent a callback. The flow verifies '
        'every callback against the provider\'s transaction query API before marking the booking as paid. '
        'This protects against spoofed callbacks and against Daraja\'s occasional duplicate delivery of '
        'the same callback.'
    ))
    payment_flow = """\
   Passenger taps "Pay"
            |
            v
   +-------------------+
   | BOOKING_PENDING   |
   +---------+---------+
             |
             |  API: POST /bookings/:id/payment
             |  → calls payments/mpesa/stk_push
             v
   +-------------------+
   | AWAITING_PAYMENT  |  ← payment_attempts row created
   +---------+---------+            (status=sent, idempotency_key=uuid)
             |
             |  Safaricom sends STK push to passenger phone
             |  Passenger enters M-Pesa PIN
             |
             |  Daraja calls our webhook: POST /webhooks/mpesa
             v
   +-------------------+
   | CALLBACK_RECEIVED |  ← payment_attempts row updated
   +---------+---------+    (status=callback_received, provider_txn_id captured)
             |
             |  API: verify transaction via Daraja Transaction Status API
             |  (do NOT trust the callback alone)
             v
   +-------------------+
   | VERIFY_TRANSACTION|
   +---------+---------+
             |
             +-----------+-----------+
             |                       |
        verified OK            verification failed
             |                       |
             v                       v
   +-------------------+   +-------------------+
   | PAYMENT_CONFIRMED |   | PAYMENT_FAILED    |
   +---------+---------+   +-------------------+
             |
             |  booking.state -> CONFIRMED
             |  ride.capacity_booked += seats
             |  notification: "Payment received"
             v
        BOOKING CONFIRMED
"""
    story.extend(Code(payment_flow, caption='Figure 7.1 — Payment verification flow. Callbacks are never trusted alone.'))

    story.append(H2('7.2 Idempotency'))
    story.append(P(
        'Safaricom occasionally delivers the same callback twice. Without idempotency, the second callback '
        'would confirm a second payment on a booking that was already paid. The schema enforces idempotency '
        'at two levels: (1) the <code>payment_attempts</code> table has a unique constraint on '
        '<code>(provider, provider_transaction_id)</code>, so the second insert fails; and (2) the booking '
        'state machine refuses the <code>AWAITING_PAYMENT -> CONFIRMED</code> transition once the booking '
        'is already confirmed.'
    ))

    story.append(H2('7.3 Payment Schema (DDL)'))
    story.extend(Code("""\
CREATE TABLE payments (
  id              uuid PRIMARY KEY DEFAULT uuid_v7(),
  booking_id      uuid NOT NULL REFERENCES bookings(id),
  amount_ksh      integer NOT NULL CHECK (amount_ksh > 0),
  currency        text NOT NULL DEFAULT 'KES',
  provider        text NOT NULL DEFAULT 'mpesa'
                  CHECK (provider IN ('mpesa','airtel','card','cash','corporate')),
  provider_payment_ref text,                    -- M-Pesa transaction ID
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','confirmed','failed','refunded','partially_refunded')),
  created_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (booking_id)                           -- one payment per booking
);

CREATE TABLE payment_attempts (
  id              uuid PRIMARY KEY DEFAULT uuid_v7(),
  payment_id      uuid NOT NULL REFERENCES payments(id),
  provider        text NOT NULL,
  idempotency_key text NOT NULL,                 -- client-supplied UUID
  provider_request_ref text,                     -- M-Pesa CheckoutRequestID
  provider_transaction_id text,                  -- M-Pesa MpesaCode (from callback)
  status          text NOT NULL DEFAULT 'sent'
                  CHECK (status IN
                    ('sent','callback_received','verified','failed','timeout')),
  request_payload jsonb NOT NULL,
  response_payload jsonb,
  callback_payload jsonb,
  sent_at         timestamptz NOT NULL DEFAULT clock_timestamp(),
  callback_at     timestamptz,
  verified_at     timestamptz,
  UNIQUE (provider, provider_transaction_id)     -- ← idempotency on callback
);
CREATE INDEX payment_attempts_payment_idx ON payment_attempts (payment_id);
CREATE INDEX payment_attempts_idem_idx ON payment_attempts (idempotency_key);

CREATE TABLE refunds (
  id              uuid PRIMARY KEY DEFAULT uuid_v7(),
  payment_id      uuid NOT NULL REFERENCES payments(id),
  amount_ksh      integer NOT NULL CHECK (amount_ksh > 0),
  reason          text NOT NULL,
  provider_ref    text,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','completed','failed')),
  approved_by     uuid NOT NULL REFERENCES users(id),  -- admin
  approved_at     timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at    timestamptz,
  UNIQUE (payment_id)                            -- at most one refund per payment
);
"""))

    story.append(H2('7.4 Provider Abstraction'))
    story.append(P(
        'The payment module exposes a <code>PaymentProvider</code> interface with methods like '
        '<code>initiateCharge(booking, payment_attempt)</code> and '
        '<code>verifyCallback(payload) -> { verified, transactionId, amount }</code>. '
        'The M-Pesa implementation lives in <code>payments/mpesa/</code>. When we add Airtel Money or card '
        'processing, each gets its own subdirectory implementing the same interface. The booking module '
        'never sees provider-specific concepts like "STK push" or "CheckoutRequestID" — it only sees '
        'the abstract payment state transitions.'
    ))
    story.append(PageBreak())

    return story
