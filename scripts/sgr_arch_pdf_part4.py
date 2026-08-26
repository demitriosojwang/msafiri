"""
SGR Feeder Architecture PDF — Content Part 3 (Chapter 13 ADRs + Appendix)
"""

def build_content_part3(H1, H2, H3, P, PL, Muted, Bullets, Code, Callout, Table2, HR,
                        Spacer, PageBreak, safe_keep_together, Paragraph, body_style,
                        CONTENT_W, ACCENT, HEADER_FILL):
    story = []

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # CHAPTER 13 — ARCHITECTURE DECISION RECORDS
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    story.append(H1('13. Architecture Decision Records (ADRs)'))
    story.append(P(
        'Architecture Decision Records capture the "why" behind a decision. Code captures the "what"; '
        'ADRs capture the reasoning that led to that "what". Six months from now, when somebody asks '
        '"why didn\'t we use MongoDB?" or "why are we on a single VPS instead of Kubernetes?", the '
        'answer lives here — not in someone\'s memory, not in a deleted Slack thread, not in a guess.'
    ))
    story.append(P(
        'Each ADR uses the standard format: Context, Decision, Consequences, Status. ADRs are numbered '
        'and never deleted. If a decision is reversed, the original ADR is marked <b>Superseded</b> '
        'with a reference to the new ADR that reverses it. This preserves the historical reasoning '
        'even after the decision changes.'
    ))

    # ADR-001
    story.append(H2('ADR-001: PostgreSQL + PostGIS as the Source of Truth'))
    story.append(H3('Status: Accepted'))
    story.append(H3('Context'))
    story.append(P(
        'The platform is a shared, multi-user transactional system with concurrent writers (multiple '
        'passengers booking seats on the same cab simultaneously) and a fundamental need for spatial '
        'queries (find drivers within X km of a passenger, find pickup points within a service area). '
        'SQLite was considered for the centre but is explicitly not recommended for multi-client '
        'transactional work — SQLite itself recommends a client/server RDBMS when many clients access '
        'the same data and when there are many concurrent writers, because SQLite allows only one '
        'writer at a time per database.'
    ))
    story.append(H3('Decision'))
    story.append(P(
        'Use PostgreSQL 16+ with the PostGIS extension as the authoritative source of truth for all '
        'transactional state. Use SQLite on mobile devices only as an offline cache that syncs '
        'through the API.'
    ))
    story.append(H3('Consequences'))
    story.extend(Bullets([
        '<b>Positive:</b> ACID transactions eliminate double-booking via <code>SELECT ... FOR UPDATE</code>. PostGIS gives us spatial indexes and queries natively. Strong ecosystem of tooling (pgBackRest, pgbouncer, pgAdmin).',
        '<b>Positive:</b> SQLite is still part of the architecture, just at the edge — its offline cache role is exactly what SQLite is designed for.',
        '<b>Negative:</b> One more piece of infrastructure to operate (vs. embedded SQLite). Requires a backup strategy, monitoring, and eventual read replicas.',
        '<b>Negative:</b> PostgreSQL must be deployed on a server the team controls — not serverless. This constrains hosting options.',
    ]))

    # ADR-002
    story.append(H2('ADR-002: React Native + Expo for Mobile'))
    story.append(H3('Status: Accepted'))
    story.append(H3('Context'))
    story.append(P(
        'Both passenger and driver apps need to ship on Android (primary Kenyan market) and iOS '
        '(smaller but present). The team is already proficient in TypeScript from the web stack. '
        'The driver app has hard requirements around GPS, foreground services, and Android 14 '
        'background-location permissions.'
    ))
    story.append(H3('Decision'))
    story.append(P(
        'Use React Native + Expo + TypeScript for both mobile apps. Flutter was considered and '
        'rejected — not because it is bad (it is excellent) but because it would introduce a second '
        'language ecosystem (Dart) for the team to maintain, with no compensating benefit for this '
        'specific product.'
    ))
    story.append(H3('Consequences'))
    story.extend(Bullets([
        '<b>Positive:</b> Shared TypeScript types between mobile apps, admin web, and backend. Shared API client package. One mental model.',
        '<b>Positive:</b> Expo Location module supports foreground services, Android 14 background-location permissions, and geofencing.',
        '<b>Positive:</b> Expo Application Services (EAS) handles native builds, OTA updates, and version management without Xcode/Android Studio on every dev machine.',
        '<b>Negative:</b> Native modules required for some platform-specific features may force ejecting from Expo\'s managed workflow. We accept this risk; the trigger would be a feature Expo cannot support.',
        '<b>Negative:</b> Background location on iOS remains constrained by Apple\'s 30-second task windows. The driver app is Android-first; iOS driver support is best-effort.',
    ]))

    # ADR-003
    story.append(H2('ADR-003: Modular Monolith over Microservices'))
    story.append(H3('Status: Accepted'))
    story.append(H3('Context'))
    story.append(P(
        'The platform needs to support ~12 bounded contexts (auth, bookings, rides, dispatch, '
        'payments, pricing, locations, notifications, admin, audit, plus shared infrastructure). '
        'The team is small. The platform has not yet carried its first passenger.'
    ))
    story.append(H3('Decision'))
    story.append(P(
        'Build a single NestJS backend with internal module boundaries. Each module owns its own '
        'tables, services, and DTOs. Cross-module communication happens via explicit service calls, '
        'not via shared database reads. Service extraction is deferred until a specific module '
        'develops a specific need.'
    ))
    story.append(H3('Consequences'))
    story.extend(Bullets([
        '<b>Positive:</b> One deployable, one database, one monitoring dashboard. Dramatically simpler ops for a small team.',
        '<b>Positive:</b> Module boundaries preserve the seams for future service extraction.',
        '<b>Positive:</b> Local development runs with a single <code>docker compose up</code>.',
        '<b>Negative:</b> A bug in one module can crash the whole process. Mitigated by process supervision (Docker restart policies) and by isolating risky operations (e.g., calling M-Pesa) behind retries and circuit breakers.',
        '<b>Negative:</b> Scaling is per-process. If one module needs to scale independently (likely: location ingestion), it must be extracted — but that is a future problem, not a day-one problem.',
    ]))

    # ADR-004
    story.append(H2('ADR-004: Adaptive GPS over Continuous Streaming'))
    story.append(H3('Status: Accepted'))
    story.append(H3('Context'))
    story.append(P(
        'Naive driver tracking would stream one GPS update per second per active driver. For 100 '
        'concurrent drivers, that is 100 writes/second to the database — sustainable but wasteful, '
        'and it scales linearly with driver count. Worse, it drains driver phone batteries, '
        'triggers Android 14 background-service restrictions, and produces historical data of '
        'questionable value (you do not need second-by-second resolution to replay a 30-minute trip).'
    ))
    story.append(H3('Decision'))
    story.append(P(
        'Driver GPS frequency adapts to operational state: no tracking when off-duty, low frequency '
        '(every 5 min) when idle, higher frequency (every 15s) when en route to pickup, active '
        'tracking (every 10s) during a trip. Combined with a 50m minimum-distance threshold and '
        'battery-level awareness.'
    ))
    story.append(H3('Consequences'))
    story.extend(Bullets([
        '<b>Positive:</b> Write volume drops ~95% versus naive streaming. Battery life improves. Android background-service limits are respected.',
        '<b>Positive:</b> Historical event table remains queryable for trip replay at 10s resolution — more than enough for dispute resolution.',
        '<b>Negative:</b> "Where is the driver right now?" between pings is interpolated. Acceptable because the driver app sends an immediate ping on state change (e.g., when starting en route).',
        '<b>Negative:</b> Driver app complexity increases — it must track its own state and choose the correct frequency. Mitigated by a single <code>useLocationTracking</code> hook that encapsulates the logic.',
    ]))
    story.append(PageBreak())

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # APPENDIX A — PICK-UP STATIONS REFERENCE
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    story.append(H1('Appendix A: Pick-up Stations Reference'))
    story.append(P(
        'The platform uses existing SGR waiting/collection points as agreed pickup/drop-off stages. '
        'This appendix lists the 25 confirmed stations across the South Coast and North Coast corridors. '
        'South Coast stations are carried forward from the initial prototype; North Coast stations are '
        'the user-confirmed list. Additional stations may be added by admin via the <code>stations</code> '
        'table without code changes — the schema and pricing logic treat them uniformly.'
    ))

    story.append(H2('A.1 South Coast Stations'))
    sc_rows = [
        ['Likoni Ferry Container', 'Likoni', 'South', 'Main SGR collection point, Likoni'],
        ['Fayaz (Kona Mpya)', 'Likoni', 'South', 'Kona Mpya junction'],
        ['ShikaAdabu (Checkpoint)', 'Likoni', 'South', 'Checkpoint stage'],
        ['Kombani', 'Kombani', 'South', 'Kombani junction'],
        ['Naivas Diani', 'Ukunda', 'South', 'Naivas Diani supermarket'],
    ]
    story.extend(Table2(
        ['Station Name', 'Area', 'Coast', 'Landmark'],
        sc_rows,
        col_widths=[22*5, 22*3, 22*2.5, 22*6.5],
    ))

    story.append(H2('A.2 North Coast Stations'))
    nc_rows = [
        ['Kiembeni mwisho', 'Kiembeni', 'North', 'End of Kiembeni road'],
        ['Kiembeni police', 'Kiembeni', 'North', 'Kiembeni police station'],
        ['Ananda Marga', 'Kiembeni', 'North', 'Ananda Marga school area'],
        ['San Sera', 'Kiembeni', 'North', 'San Sera estate'],
        ['Green Estate', 'Kiembeni', 'North', 'Green Estate residential'],
        ['Kona Kiembeni', 'Kiembeni', 'North', 'Kiembeni junction'],
        ['Bamburi Mwisho', 'Bamburi', 'North', 'End of Bamburi road'],
        ['Naivas', 'Bamburi', 'North', 'Naivas Bamburi supermarket'],
        ['Total Bamburi', 'Bamburi', 'North', 'Total petrol station, Bamburi'],
        ['Fisheries', 'Bamburi', 'North', 'Fisheries stage'],
        ['Mwembeni', 'Bamburi', 'North', 'Mwembeni area'],
        ['JCC junction', 'Nyali', 'North', 'JCC church junction'],
        ['Nyali center', 'Nyali', 'North', 'Nyali centre'],
        ['VOK', 'Nyali', 'North', 'VOK stage'],
        ['Bombolulu', 'Bombolulu', 'North', 'Bombolulu area'],
        ['Lights', 'Bombolulu', 'North', 'Lights stage'],
    ]
    story.extend(Table2(
        ['Station Name', 'Area', 'Coast', 'Landmark'],
        nc_rows,
        col_widths=[22*5, 22*3, 22*2.5, 22*6.5],
        caption='Table A.1 — All 21 confirmed pick-up stations. 5 South Coast + 16 North Coast.',
    ))

    story.append(H2('A.3 Train Schedules'))
    story.append(P(
        'Madaraka Express operates six trains daily between Mombasa Terminus (Miritini) and Nairobi '
        'Syokimau. The platform treats the three departures from Mombasa and the three arrivals at '
        'Mombasa as the operational anchors for both legs of the cab coordination problem.'
    ))
    train_rows = [
        ['08:00', 'Mombasa → Nairobi', 'Departure (inbound cab coordination)'],
        ['15:00', 'Mombasa → Nairobi', 'Departure (inbound cab coordination)'],
        ['22:00', 'Mombasa → Nairobi', 'Departure (inbound cab coordination)'],
        ['04:00', 'Nairobi → Mombasa', 'Arrival (outbound cab coordination)'],
        ['14:00', 'Nairobi → Mombasa', 'Arrival (outbound cab coordination)'],
        ['20:30', 'Nairobi → Mombasa', 'Arrival (outbound cab coordination)'],
    ]
    story.extend(Table2(
        ['Time', 'Direction', 'Platform Role'],
        train_rows,
        col_widths=[22*3, 22*6, 22*8],
    ))

    story.append(H2('A.4 Pricing Rules'))
    story.append(P(
        'Pricing is configurable via the <code>pricing_rules</code> table and may be overridden by '
        'admin without code changes. The current configuration is:'
    ))
    price_rows = [
        ['Base fare (stage pickup, per seat)', 'KSh 450', 'Applies to all stations regardless of coast'],
        ['Off-stage distance surcharge', 'KSh 50 per km', 'Charged for off-stage pickup, prorated by distance to nearest station'],
        ['Off-stage cap', '3 km', 'Beyond 3km the app says "please meet at nearest stage"'],
        ['Charter multiplier', '1.3 × (base × capacity)', 'Private charter pays for all seats plus 30% privacy premium'],
        ['Nudge discount', '10% off', 'Applied within 60min of cutoff when cab is below 70% fill threshold'],
        ['Peak-hour multiplier', '1.0 × (no surcharge yet)', 'Reserved for future; configurable per pricing_rule row'],
    ]
    story.extend(Table2(
        ['Rule', 'Value', 'Notes'],
        price_rows,
        col_widths=[22*5, 22*3.5, 22*8.5],
        caption='Table A.2 — Pricing rules as currently configured. All values editable via /admin/pricing.',
    ))

    story.append(H2('A.5 Fare Calculation Example'))
    story.extend(Code("""\
-- Pooled, stage pickup, 1 seat
base = 450
surcharge = 0  (stage pickup)
perSeat = 450 + 0 = 450
seats = 1  (pooled)
subtotal = 450 * 1 = 450
charterPremium = 0  (pooled)
TOTAL = 450

-- Pooled, off-stage 2.4km, 1 seat
base = 450
surcharge = 50 * 2.4 = 120
perSeat = 450 + 120 = 570
seats = 1
subtotal = 570
TOTAL = 570

-- Charter, stage pickup, 4-seater (whole vehicle)
base = 450
surcharge = 0
perSeat = 450
seats = 4  (whole vehicle)
subtotal = 450 * 4 = 1800
charterPremium = 1800 * 0.30 = 540
TOTAL = 2340

-- Charter, off-stage 1.5km, 7-seater
base = 450
surcharge = 50 * 1.5 = 75
perSeat = 525
seats = 7
subtotal = 525 * 7 = 3675
charterPremium = 3675 * 0.30 = 1102  (rounded)
TOTAL = 4777
"""))

    return story
