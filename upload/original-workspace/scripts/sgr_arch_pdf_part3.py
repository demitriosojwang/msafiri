"""
SGR Feeder Architecture PDF — Content Part 2 (Chapters 8-14)
"""

def build_content_part2(H1, H2, H3, P, PL, Muted, Bullets, Code, Callout, Table2, HR,
                        Spacer, PageBreak, safe_keep_together, Paragraph, body_style,
                        CONTENT_W, ACCENT, HEADER_FILL):
    story = []

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # CHAPTER 8 — LOCATION TRACKING STRATEGY
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    story.append(H1('8. Location Tracking Strategy'))
    story.append(P(
        'Driver location tracking is the most operationally complex piece of the platform. Naively '
        'streaming one GPS update per second per active driver would saturate the API, bloat the database, '
        'drain driver phone batteries, and run into Android\'s background-location restrictions on Android 14 '
        'and later. The strategy below treats GPS as a state-dependent signal whose frequency adapts to '
        'what the platform actually needs to know about each driver at any given moment.'
    ))

    story.append(H2('8.1 Two Concepts: Current Position vs Historical Events'))
    story.append(P(
        'A driver has two distinct location records. The <b>current position</b> is a single row per driver, '
        'updated in place, used to answer "where is the driver right now?" for passenger-facing ETAs and '
        'admin dispatch dashboards. The <b>historical events</b> are an append-only log, partitioned by '
        'month, used for trip replay, dispute resolution, route analysis, and operational analytics. '
        'Conflating these into one table creates either a write-amplification problem (every GPS ping '
        'updates the "current" row AND inserts a history row) or a query problem (history queries scan '
        'the live table).'
    ))

    story.extend(Code("""\
-- Live position (one row per driver, updated in place)
CREATE TABLE driver_locations (
  driver_profile_id uuid PRIMARY KEY REFERENCES driver_profiles(id),
  location       geography(Point, 4326) NOT NULL,
  heading_deg    numeric(4,1),                   -- 0..359.9
  speed_kmh      numeric(4,1),
  accuracy_m     integer,                        -- GPS reported accuracy
  recorded_at    timestamptz NOT NULL,
  updated_at     timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX driver_locations_gist_idx ON driver_locations USING GIST (location);

-- Historical events (append-only, partitioned by month)
CREATE TABLE driver_location_events (
  id              uuid NOT NULL DEFAULT uuid_v7(),
  driver_profile_id uuid NOT NULL REFERENCES driver_profiles(id),
  ride_id         uuid REFERENCES rides(id),     -- null when not on a ride
  location        geography(Point, 4326) NOT NULL,
  heading_deg     numeric(4,1),
  speed_kmh       numeric(4,1),
  accuracy_m      integer,
  battery_pct     integer,                       -- for adaptive frequency
  recorded_at     timestamptz NOT NULL,
  PRIMARY KEY (id, recorded_at)
) PARTITION BY RANGE (recorded_at);

-- Create monthly partitions (example for 2026-08)
CREATE TABLE driver_location_events_2026_08
  PARTITION OF driver_location_events
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE INDEX dle_2026_08_driver_time_idx
  ON driver_location_events_2026_08 (driver_profile_id, recorded_at DESC);
CREATE INDEX dle_2026_08_ride_idx
  ON driver_location_events_2026_08 (ride_id) WHERE ride_id IS NOT NULL;
"""))

    story.append(H2('8.2 Adaptive GPS Frequency'))
    story.append(P(
        'The driver app does not send GPS at a fixed interval. Instead, it adapts based on the driver\'s '
        'current operational state, the device\'s battery level, and a distance threshold (only send if '
        'moved >50m from last reported position). This dramatically reduces bandwidth and database writes '
        'while still giving the platform the resolution it needs for each operational context.'
    ))

    freq_rows = [
        ['Offline / off-duty', '0 (no tracking)', 'Driver is not working; no location collected.'],
        ['Online, idle (no assignment)', 'Every 5 minutes', 'Lets admin see roughly where idle drivers are for dispatch.'],
        ['Assignment offered, not accepted', 'Every 5 minutes', 'Driver considering; no urgency.'],
        ['Assigned to pickup (en route to passenger)', 'Every 15 seconds', 'Passenger needs to see driver approaching; live ETA matters.'],
        ['Passenger picked up (trip in progress)', 'Every 10 seconds', 'Trip replay resolution; safety monitoring.'],
        ['Trip completed, awaiting next assignment', 'Every 5 minutes', 'Back to idle state.'],
        ['Battery < 15%', 'Half the normal frequency', 'Preserve battery; degrade gracefully.'],
    ]
    story.extend(Table2(
        ['Driver State', 'GPS Frequency', 'Rationale'],
        freq_rows,
        col_widths=[22*5, 22*3.5, 22*9],
        caption='Table 8.1 — Adaptive GPS frequency. Combine with 50m minimum-distance threshold.',
    ))

    story.append(H2('8.3 Android Background Location Reality'))
    story.append(P(
        'Expo\'s location tooling supports foreground and background location, Android foreground services, '
        'and geofencing — but background location has OS-level limitations that the driver app must respect. '
        'Android 14 (API 34) requires the <code>FOREGROUND_SERVICE_LOCATION</code> permission for any '
        'foreground service that accesses location, and the driver app must display a persistent '
        'notification while such a service is running. iOS imposes its own 30-second background task '
        'windows that are unsuitable for continuous tracking.'
    ))
    story.append(P(
        'Practical implication: while the driver app is in the foreground (driver is actively looking at '
        'their next pickup), we get high-frequency updates cheaply. When the app goes to background, we '
        'rely on a foreground service (Android) to keep location flowing — but we still degrade the '
        'frequency aggressively because the OS will kill services that drain battery. We do NOT design '
        'the system around assuming the driver\'s phone will continuously stream GPS every second for '
        'their entire working day.'
    ))
    story.append(PageBreak())

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # CHAPTER 9 — SECURITY & AUTHENTICATION
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    story.append(H1('9. Security & Authentication'))
    story.append(P(
        'Security is layered: HTTPS at the transport, JWT-based authentication at the application, '
        'role-based access control (RBAC) at the service, and row-level policies inside PostgreSQL for '
        'defence in depth. Authorization is enforced on the server, never on the client — the client '
        'can lie about who it is, but the API always re-checks against the canonical user record.'
    ))

    story.append(H2('9.1 Authentication'))
    story.append(P(
        'Passengers authenticate with phone number + OTP. This is the expected pattern for a Kenyan '
        'consumer app and avoids password fatigue. Drivers authenticate with phone + OTP plus an '
        'additional device/session binding step (the driver app is bound to one device at a time; a '
        'new device login forces a re-verification of the driver\'s identity). Admins authenticate '
        'with phone + OTP plus a password, and admin sessions have shorter refresh-token lifetimes.'
    ))
    story.append(P(
        'All sessions issue a short-lived JWT access token (15 minutes) plus a longer refresh token '
        '(7 days, rotated on each use). Refresh tokens are stored hashed in a <code>refresh_tokens</code> '
        'table so they can be revoked. On logout, on password change, or on suspicious activity, all '
        'refresh tokens for that user are invalidated.'
    ))

    story.append(H2('9.2 Role Hierarchy'))
    story.append(P(
        'A <code>users</code> row has a <code>role_mask</code> bitmask: 1=passenger, 2=driver, 4=admin. '
        'A single user can hold multiple roles (e.g., a driver who also books personal trips as a '
        'passenger). The role profiles live in separate tables (<code>passenger_profiles</code>, '
        '<code>driver_profiles</code>) that reference back to the user. There is one authentication '
        'system; there are three authorization profiles.'
    ))

    story.append(H2('9.3 Authorization Matrix'))
    authz_rows = [
        ['Read own bookings', 'Yes', 'No', 'Yes (own + filtered)', 'GET /bookings?me=true'],
        ['Create booking', 'Yes', 'No', 'No', 'POST /bookings'],
        ['Cancel own booking', 'Yes', 'No', 'Yes (any booking)', 'POST /bookings/:id/cancel'],
        ['Read assigned trips', 'No', 'Yes', 'Yes (any trip)', 'GET /trips?driver=:me'],
        ['Update trip status', 'No', 'Yes (own trips only)', 'Yes', 'PATCH /trips/:id/status'],
        ['Send driver location', 'No', 'Yes (own)', 'No', 'POST /drivers/:me/location'],
        ['Manage drivers', 'No', 'No', 'Yes', 'POST /admin/drivers'],
        ['Manage pricing rules', 'No', 'No', 'Yes', 'PUT /admin/pricing'],
        ['Refund payments', 'No', 'No', 'Yes', 'POST /admin/refunds'],
        ['View audit logs', 'No', 'No', 'Yes', 'GET /admin/audit-logs'],
    ]
    story.extend(Table2(
        ['Action', 'Passenger', 'Driver', 'Admin', 'Endpoint'],
        authz_rows,
        col_widths=[22*4.5, 22*2, 22*3, 22*3.5, 22*4.5],
        caption='Table 9.1 — Authorization matrix. Every cell is enforced server-side.',
    ))

    story.append(H2('9.4 Driver Verification'))
    story.append(P(
        'Drivers carry passengers. The platform cannot allow an unverified driver to accept bookings. '
        'The <code>driver_profiles</code> table tracks <code>verification_status</code> (documents '
        'submitted, verified, rejected) separately from <code>approval_status</code> (the admin\'s '
        'operational approval to start driving). A driver must be in <code>verified + approved</code> '
        'state before any ride can be assigned to them.'
    ))
    story.append(P(
        'Verification documents (national ID, driving license, vehicle logbook, insurance, NTSA '
        'inspection) are uploaded to S3-compatible object storage. PostgreSQL stores only the '
        '<code>storage_key</code>, document type, status, and metadata. The actual file never lives in '
        'the database. This keeps the database small, makes document rotation trivial (replace the '
        'S3 object, update the metadata), and allows documents to be served via signed URLs with '
        'short expiry for admin review.'
    ))

    story.append(H2('9.5 Audit Logging'))
    story.append(P(
        'Every state-changing action — admin changes driver status, driver accepts trip, payment '
        'callback confirms, fare manually overridden — writes a row to <code>audit_logs</code>. This '
        'is operational gold the moment a dispute arises ("the driver said the passenger never showed, '
        'the passenger said they waited 30 minutes") and is mandatory for any platform handling money.'
    ))
    story.extend(Code("""\
CREATE TABLE audit_logs (
  id              uuid PRIMARY KEY DEFAULT uuid_v7(),
  actor_id        uuid REFERENCES users(id),    -- null for system actions
  actor_role      text NOT NULL,                -- 'passenger','driver','admin','system'
  action          text NOT NULL,                -- 'booking.cancel','payment.refund','driver.suspend'
  entity_type     text NOT NULL,                -- 'booking','payment','driver_profile'
  entity_id       uuid,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address      inet,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX audit_logs_actor_idx ON audit_logs (actor_id, created_at DESC);
CREATE INDEX audit_logs_entity_idx ON audit_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX audit_logs_action_idx ON audit_logs (action, created_at DESC);
"""))
    story.append(P(
        'Audit logs are append-only. No row is ever updated or deleted; corrections are made by writing '
        'a new audit entry that supersedes the prior one (chained via <code>metadata.supersedes_id</code>). '
        'Logs are retained for at least 7 years to satisfy Kenyan financial-services record-keeping norms.'
    ))
    story.append(PageBreak())

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # CHAPTER 10 — API CONTRACT
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    story.append(H1('10. API Contract'))
    story.append(P(
        'The API is REST with versioning in the URL path (<code>/api/v1/...</code>). Where real-time '
        'updates are required (driver location during a trip, dispatch offers to drivers, trip status '
        'updates to passengers), WebSocket connections are used as a complement — not a replacement — '
        'for the REST surface.'
    ))

    story.append(H2('10.1 Conventions'))
    story.extend(Bullets([
        '<b>Versioning:</b> <code>/api/v1/...</code> in URL path. Breaking changes bump version; non-breaking changes are additive.',
        '<b>Auth:</b> <code>Authorization: Bearer &lt;jwt&gt;</code> header on every request except <code>/auth/*</code> and webhook endpoints.',
        '<b>Idempotency:</b> All POST endpoints accept <code>Idempotency-Key</code> header. Same key + same payload returns the original response instead of duplicating the side effect.',
        '<b>Pagination:</b> <code>?cursor=...&amp;limit=20</code> cursor-based pagination for list endpoints.',
        '<b>Errors:</b> RFC 7807 problem+json format. <code>{ "type": "...", "title": "...", "status": 409, "detail": "...", "instance": "/api/v1/bookings/123" }</code>',
        '<b>Time:</b> All timestamps are ISO 8601 with timezone offset (<code>2026-08-19T15:00:00+03:00</code>). EAT throughout.',
        '<b>Money:</b> All amounts are integer KSh (no decimals). KSh 450.50 does not exist in this system.',
    ]))

    story.append(H2('10.2 Key Endpoints'))
    endpoint_rows = [
        ['POST', '/quotes', 'Passenger', 'Compute fare quote (pickup, dropoff, kind, seats). Returns quote_id valid 15min.'],
        ['POST', '/bookings', 'Passenger', 'Create booking from quote. Initiates payment flow.'],
        ['GET', '/bookings/:id', 'Passenger/Driver/Admin', 'Fetch booking detail. Authorization scoped by role.'],
        ['POST', '/bookings/:id/cancel', 'Passenger/Admin', 'Cancel booking. Triggers refund if applicable.'],
        ['POST', '/bookings/:id/payment', 'Passenger', 'Initiate M-Pesa STK push. Returns payment_attempt_id.'],
        ['POST', '/webhooks/mpesa', 'M-Pesa', 'Daraja callback. Verifies and confirms payment. NO AUTH — verified by signature.'],
        ['GET', '/trips/assigned', 'Driver', 'List trips assigned to current driver.'],
        ['GET', '/trips/:id', 'Driver/Admin', 'Trip detail with manifest, stops, vehicle, driver.'],
        ['PATCH', '/trips/:id/status', 'Driver', 'Update trip state (en_route, picked_up, in_progress, completed).'],
        ['POST', '/drivers/me/location', 'Driver', 'Submit GPS update. Adaptive frequency enforced client-side.'],
        ['POST', '/drivers/me/assignments/:id/accept', 'Driver', 'Accept a dispatch offer.'],
        ['POST', '/drivers/me/assignments/:id/reject', 'Driver', 'Reject a dispatch offer.'],
        ['GET', '/admin/arrivals/:train_id', 'Admin', 'Stage-by-stage breakdown for an arriving train.'],
        ['GET', '/admin/stage-coverage', 'Admin', 'Full stage coverage map with gap detection.'],
        ['POST', '/admin/refunds', 'Admin', 'Initiate refund for a payment.'],
        ['GET', '/admin/audit-logs', 'Admin', 'Query audit logs with filters.'],
    ]
    story.extend(Table2(
        ['Method', 'Path', 'Role', 'Description'],
        endpoint_rows,
        col_widths=[22*1.5, 22*5, 22*3, 22*8],
        caption='Table 10.1 — Key REST endpoints. Full OpenAPI spec lives in /docs/api alongside this document.',
    ))

    story.append(H2('10.3 WebSocket Channels'))
    story.append(P(
        'WebSocket connections are authenticated with the JWT in the initial handshake (query string '
        '<code>?token=...</code> for browser clients, header for native clients). Two channels are '
        'defined today; more will be added as the platform matures.'
    ))
    ws_rows = [
        ['/ws/driver', 'Driver', 'Server pushes dispatch offers, ride state changes, passenger cancellations. Driver acks offers via REST, not WS.'],
        ['/ws/passenger/:booking_id', 'Passenger', 'Server pushes trip state updates for a specific booking (driver assigned, en route, picked up, completed).'],
    ]
    story.extend(Table2(
        ['Channel', 'Client', 'Purpose'],
        ws_rows,
        col_widths=[22*4.5, 22*2.5, 22*10.5],
    ))

    story.append(H2('10.4 Gateway Rules'))
    story.append(P(
        'The platform runs behind a single Caddy reverse proxy. The Caddyfile maps paths to backend '
        'services. For mini-services (e.g., the location ingestion worker that may eventually split '
        'out of the main API), cross-origin requests carry the target port in a <code>XTransformPort</code> '
        'query parameter. API request URLs are always relative paths — never absolute URLs with embedded '
        'ports. The same applies to WebSocket URLs: <code>io("/?XTransformPort=3030")</code>, never '
        '<code>io("http://localhost:3030")</code>.'
    ))
    story.append(PageBreak())

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # CHAPTER 11 — NOTIFICATIONS
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    story.append(H1('11. Notifications'))
    story.append(P(
        'The notification strategy is push-first, SMS-fallback. Push notifications are essentially free '
        'at volume (Expo Notifications handles FCM/APNs delivery) and arrive within seconds. SMS costs '
        'real money per message and should be reserved for moments where push has failed or the message '
        'is too critical to risk a missed delivery.'
    ))

    story.append(H2('11.1 Event → Notification Mapping'))
    notif_rows = [
        ['Booking confirmed', 'Push', '"Your seat is confirmed. Driver will be assigned shortly."'],
        ['Driver assigned', 'Push', '"Driver [name] assigned to your trip. Plate [plate]. Rating [rating]."'],
        ['Driver en route', 'Push + SMS', '"Driver is en route. ETA [X] minutes." Critical, so SMS backs up push.'],
        ['Pickup time changed', 'Push + SMS', '"Your pickup time changed to [time]. Be at [stage] by [time]."'],
        ['Payment received', 'Push', '"Payment of KSh [amount] received for booking [ref]."'],
        ['Trip completed', 'Push', '"Your trip is complete. Rate your driver?"'],
        ['Trip cancelled', 'Push + SMS', '"Your trip was cancelled. Reason: [reason]. Refund: [status]."'],
        ['Charter accepted', 'Push', '"[Driver] accepted your private charter. Whole vehicle reserved."'],
        ['Coverage gap alert', 'Push (admin)', '"Stage [name] has [N] passengers waiting with no cab assigned."'],
    ]
    story.extend(Table2(
        ['Event', 'Channel', 'Template'],
        notif_rows,
        col_widths=[22*4, 22*3, 22*10],
    ))

    story.append(H2('11.2 Notification Queue'))
    story.append(P(
        'Notifications are not sent synchronously from the action that triggered them. The action writes '
        'a row to the <code>notifications</code> table with status <code>queued</code>; a background '
        'worker picks up queued rows, attempts delivery, and updates status to <code>sent</code> or '
        '<code>failed</code>. Failed push notifications trigger an SMS fallback after the configured '
        'retry window. This decouples user-facing latency from notification provider latency.'
    ))
    story.extend(Code("""\
CREATE TABLE notifications (
  id              uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id         uuid NOT NULL REFERENCES users(id),
  channel         text NOT NULL CHECK (channel IN ('push','sms','in_app')),
  event_type      text NOT NULL,                 -- 'driver_assigned','trip_cancelled'...
  title           text NOT NULL,
  body            text NOT NULL,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  status          text NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued','sent','failed','superseded')),
  attempts        integer NOT NULL DEFAULT 0,
  max_attempts    integer NOT NULL DEFAULT 3,
  next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  sent_at         timestamptz,
  failed_at       timestamptz,
  failure_reason  text,
  provider_message_id text,                      -- FCM/APNs/SMS gateway message ID
  created_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at      timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX notifications_queued_idx
  ON notifications (next_attempt_at) WHERE status = 'queued';
CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);
"""))
    story.append(P(
        'Push delivery uses Expo Notifications (which handles FCM for Android and APNs for iOS). SMS '
        'delivery uses Africa\'s Talking or a similar Kenyan SMS gateway. The provider abstraction '
        'is similar to the payments module — each provider implements a <code>NotificationChannel</code> '
        'interface, and adding a new SMS gateway does not touch the notification domain logic.'
    ))
    story.append(PageBreak())

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # CHAPTER 12 — INFRASTRUCTURE & DEPLOYMENT
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    story.append(H1('12. Infrastructure & Deployment'))
    story.append(P(
        'The platform starts on a single Linux VPS. This is deliberate. A startup that has not yet '
        'carried its first passenger does not need Kubernetes, a service mesh, or a multi-region '
        'deployment. What it needs is a system that is easy to operate, easy to back up, and easy to '
        'debug — all of which favour a single well-configured machine over a distributed fleet.'
    ))

    story.append(H2('12.1 Initial Deployment Topology'))
    topo_diagram = """\
              Internet
                 |
                 v
        +-----------------+
        |   Cloudflare    |  (DNS, DDoS protection, free TLS)
        +--------+--------+
                 |
                 v
        +-----------------+
        |     Caddy       |  (reverse proxy, automatic HTTPS via Let's Encrypt)
        +--------+--------+
                 |
        +--------+---------+
        |                  |
        v                  v
  +-----------+    +----------------+
  |  NestJS   |    |  Next.js admin |
  |   API     |    |  (SSR)         |
  +-----+-----+    +----------------+
        |
   +----+----+----+----+
   |         |         |
   v         v         v
+------+  +------+  +----------+
| Post |  | Redis|  | Object   |
|greSQL|  |      |  | Storage  |
| +PG  |  |      |  | (MinIO   |
|      |  |      |  |  or R2)  |
+--+---+  +------+  +----------+
   |
   | WAL archiving
   v
+----------+
| Off-site |
| backups  |
| (S3/R2)  |
+----------+
"""
    story.extend(Code(topo_diagram, caption='Figure 12.1 — Initial VPS deployment. One machine, one database, one reverse proxy.'))

    story.append(H2('12.2 Docker Compose for Local and Prod'))
    story.append(P(
        'The same <code>docker-compose.yml</code> is used in development and production, with environment '
        'variables for secrets and a separate <code>docker-compose.prod.yml</code> override for production '
        'tweaks (no port exposure to host, read-only filesystems where possible, log drivers, restart '
        'policies). This eliminates the "works on my machine" gap between dev and prod.'
    ))

    story.append(H2('12.3 Backups: The "Untested Backup Is A Hope" Rule'))
    story.append(P(
        'Having PostgreSQL on the server is not a backup strategy. The platform runs daily full backups '
        '(<code>pg_dump</code> to compressed SQL) plus continuous WAL archiving via <code>pgBackRest</code> '
        'or <code>walg</code>. WAL files stream to off-site object storage (Cloudflare R2 or S3) every '
        'few minutes, giving us point-in-time recovery to within 5 minutes of any failure.'
    ))
    story.append(P(
        'Backups are tested by restoring them to a staging database every Sunday at 03:00 EAT. The '
        'restore script runs end-to-end without human intervention; if it fails, the on-call engineer '
        'gets a critical alert. This is the only way to know the backups actually work — a backup you '
        'have never successfully restored is only a hope.'
    ))

    story.append(H2('12.4 CI/CD Pipeline'))
    story.append(P(
        'GitHub Actions runs three pipelines: <code>ci</code> (on every push: lint, typecheck, unit '
        'tests, build), <code>deploy-staging</code> (on push to <code>main</code>: build Docker images, '
        'push to registry, SSH into staging VPS, <code>docker compose pull &amp;&amp; docker compose '
        'up -d</code>), and <code>deploy-prod</code> (manual dispatch from a tagged release: same as '
        'staging but against prod VPS, with a 5-minute canary window where the new container runs '
        'alongside the old one and traffic is shifted over only if error rate stays below threshold).'
    ))

    story.append(H2('12.5 Monitoring'))
    story.append(P(
        'Logs are structured JSON emitted to stdout, captured by Docker\'s json-file log driver, '
        'shipped to a log aggregator (Loki or plain Elasticsearch for the MVP) and searchable via '
        'Grafana or <code>jq</code>. Sentry (self-hosted or cloud) catches uncaught exceptions and '
        'frontend errors with full stack traces. UptimeRobot or a similar external probe hits '
        '<code>/health</code> every minute from outside the VPS and pages the on-call engineer if it '
        'fails twice in a row. The principle is: every signal an operator needs to debug an incident '
        'should be available without SSHing into the box.'
    ))

    story.append(H2('12.6 When to Split Services'))
    story.append(P(
        'The modular monolith becomes a multi-service architecture when — and only when — a specific '
        'module develops a scaling or operational need that justifies the cost. Likely candidates, in '
        'order of probability:'
    ))
    story.extend(Bullets([
        '<b>Location ingestion</b> — if driver count grows past ~500 concurrent, the GPS write path may extract into its own service with its own connection pool and a Kafka-style ingest queue.',
        '<b>Payments</b> — if we add card processing or corporate billing, the payment module may extract to isolate PCI scope.',
        '<b>Notifications</b> — if push/SMS volume grows large enough that the worker pool starves the API, notifications extract into their own queue-consumer service.',
        '<b>Admin reporting</b> — heavy read queries (analytics dashboards) may eventually run against a read replica to avoid contending with transactional writes.',
    ]))
    story.append(P(
        'None of these are day-one problems. The modular monolith keeps the seams clean so that when '
        'they become problems, the extraction is a refactor — not a rewrite.'
    ))
    story.append(PageBreak())

    return story
