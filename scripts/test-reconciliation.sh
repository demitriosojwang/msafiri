#!/bin/bash
# Reconciliation demo: booking → STK push initiated but callback "lost" →
# admin simulates the missed webhook → sweep recovers it via Transaction Status.
set -e
BASE=http://localhost:3000
JAR=/tmp/mireli-pass.jar

echo "1. Passenger login"
curl -s -c $JAR -X POST $BASE/api/auth -H "Content-Type: application/json" \
  -d '{"step":"request","identifier":"0712345678"}' > /dev/null
curl -s -b $JAR -c $JAR -X POST $BASE/api/auth -H "Content-Type: application/json" \
  -d '{"step":"verify","identifier":"0712345678","code":"1234","name":"Recon Tester"}' | head -c 120; echo

echo "2. Find a bookable trip"
TRIP=$(curl -s -b $JAR "$BASE/api/trips?date=$(date +%F)&direction=FROM_TERMINUS" | python3 -c "
import sys, json
trips = json.load(sys.stdin)['trips']
t = next(t for t in trips if t['bookable'])
stage = t['stages'][-1]
print(t['id'], t['routeId'], stage['id'])")
read TRIP_ID ROUTE_ID STAGE_ID <<< "$TRIP"
echo "   trip=$TRIP_ID stage=$STAGE_ID"

echo "3. Create booking (no credit)"
BOOKING=$(curl -s -b $JAR -X POST $BASE/api/bookings -H "Content-Type: application/json" \
  -d "{\"routeId\":\"$ROUTE_ID\",\"direction\":\"FROM_TERMINUS\",\"stageId\":\"$STAGE_ID\",\"seats\":1,\"travelDate\":\"$(date +%F)\"}")
BK_ID=$(echo "$BOOKING" | python3 -c "import sys,json; print(json.load(sys.stdin)['booking']['id'])")
BK_CODE=$(echo "$BOOKING" | python3 -c "import sys,json; print(json.load(sys.stdin)['booking']['code'])")
CASH=$(echo "$BOOKING" | python3 -c "import sys,json; print(json.load(sys.stdin)['booking']['cashDue'])")
echo "   booking=$BK_CODE ($BK_ID) cash=$CASH"

echo "4. Initiate STK push (never verified — webhook will be 'lost')"
curl -s -b $JAR -X POST $BASE/api/bookings/$BK_ID -H "Content-Type: application/json" \
  -d '{"action":"pay","phone":"0712345678"}' | head -c 120; echo

echo "5. Admin: simulate missed callback"
ADMIN=$(agent-browser cookies 2>/dev/null | grep "^mireli_admin=" | sed 's/^mireli_admin=//')
curl -s -X POST $BASE/api/admin/reconciliation -H "Content-Type: application/json" \
  -H "Cookie: mireli_admin=$ADMIN" -d '{"action":"simulate_missed_callback"}'; echo

echo "5b. Backdate the transaction past the sweep threshold (demo)"
cd /home/z/my-project && node -e "
const {PrismaClient} = require('@prisma/client');
const db = new PrismaClient();
db.mpesaTransaction.updateMany({ where: { status: 'ambiguous' }, data: { createdAt: new Date(Date.now() - 15*60000) } })
  .then(r => { console.log('   backdated', r.count, 'transaction(s)'); return db.\$disconnect(); });"

echo "6. Admin: run reconciliation sweep"
curl -s -X POST $BASE/api/admin/reconciliation -H "Content-Type: application/json" \
  -H "Cookie: mireli_admin=$ADMIN" -d '{"action":"sweep"}'; echo

echo "7. Verify booking recovered"
curl -s -b $JAR $BASE/api/bookings | python3 -c "
import sys, json
bs = json.load(sys.stdin)['bookings']
b = next(b for b in bs if b['id'] == '$BK_ID')
print(f\"   {b['code']} status={b['status']} ledger={b['ledger']['status'] if b['ledger'] else None} receipt={b['ledger']['receipt'] if b['ledger'] else None}\")"
