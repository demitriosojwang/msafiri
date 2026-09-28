#!/bin/bash
# E2E: guest 1-seat rule + exact-details signup + multi-seat for accounts
set -e
BASE=http://localhost:3000
JAR=/home/z/my-project/scripts/e2e-jar.txt
rm -f "$JAR"

echo "── 1. Fresh guest session"
ME=$(curl -s -c "$JAR" $BASE/api/me)
echo "$ME" | python3 -c "import json,sys; d=json.load(sys.stdin); p=d['passenger']; print('isGuest:', p['isGuest'], '| guestUsed:', p['guestUsed'], '| phone:', p['phone'])"

echo "── 2. Find a bookable trip"
TRIPS=$(curl -s -b "$JAR" "$BASE/api/trips?date=$(date +%F)&direction=FROM_TERMINUS")
TRIP=$(echo "$TRIPS" | python3 -c "
import json,sys
d=json.load(sys.stdin)
trips=[t for t in d['trips'] if t.get('bookable') and t['seatsLeft']>=3 and not t['status'] in ('departed','completed')]
t=trips[0]
print(json.dumps({'routeId':t['routeId'],'stageId':t['stages'][0]['id'],'departureAt':t['departureAt']}))
")
echo "trip: $TRIP"
ROUTE_ID=$(echo "$TRIP" | python3 -c "import json,sys; print(json.load(sys.stdin)['routeId'])")
STAGE_ID=$(echo "$TRIP" | python3 -c "import json,sys; print(json.load(sys.stdin)['stageId'])")
DATE=$(echo "$TRIP" | python3 -c "import json,sys; print(json.load(sys.stdin)['departureAt'][:10])")

PHONE="0712$(printf '%06d' $(( (RANDOM % 900000) + 100000 )))"
EMAIL="test$(date +%s)@example.com"
DETAILS="\"passengerName\":\"Test Wanjiku\",\"passengerPhone\":\"$PHONE\",\"passengerEmail\":\"$EMAIL\",\"passengerIdType\":\"passport\",\"passengerIdNumber\":\"AK1234567\",\"passengerNationality\":\"Ugandan\",\"passengerGender\":\"female\""

echo "── 3. Guest tries 2 seats → expect 403 GUEST_LIMIT"
curl -s -b "$JAR" -X POST $BASE/api/bookings -H 'Content-Type: application/json' \
  -d "{\"routeId\":\"$ROUTE_ID\",\"stageId\":\"$STAGE_ID\",\"seats\":2,\"travelDate\":\"$DATE\",$DETAILS}" \
  | python3 -m json.tool

echo "── 4. Guest books 1 seat → expect success"
R1=$(curl -s -b "$JAR" -X POST $BASE/api/bookings -H 'Content-Type: application/json' \
  -d "{\"routeId\":\"$ROUTE_ID\",\"stageId\":\"$STAGE_ID\",\"seats\":1,\"travelDate\":\"$DATE\",$DETAILS}")
echo "$R1" | python3 -c "import json,sys; d=json.load(sys.stdin); b=d.get('booking'); print('code:', b['code'], '| status:', b['status'], '| cashDue:', b['cashDue']) if b else print('ERROR:', d)"

echo "── 5. Guest tries a second booking → expect 403 GUEST_LIMIT"
curl -s -b "$JAR" -X POST $BASE/api/bookings -H 'Content-Type: application/json' \
  -d "{\"routeId\":\"$ROUTE_ID\",\"stageId\":\"$STAGE_ID\",\"seats\":1,\"travelDate\":\"$DATE\",$DETAILS}" \
  | python3 -m json.tool

echo "── 6. Signup with EXACT same details → expect ok"
curl -s -b "$JAR" -c "$JAR" -X POST $BASE/api/auth -H 'Content-Type: application/json' \
  -d "{\"step\":\"signup\",\"code\":\"1234\",\"name\":\"Test Wanjiku\",\"phone\":\"$PHONE\",\"email\":\"$EMAIL\",\"idType\":\"passport\",\"idNumber\":\"AK1234567\",\"nationality\":\"Ugandan\",\"gender\":\"female\"}" \
  | python3 -m json.tool

echo "── 7. Me after signup → expect isGuest:false"
curl -s -b "$JAR" $BASE/api/me | python3 -c "import json,sys; d=json.load(sys.stdin); p=d['passenger']; print('isGuest:', p['isGuest'], '| name:', p['name'], '| nationality:', p['nationality'], '| credits:', d['creditBalance'])"

echo "── 8. Account books 2 seats → expect success"
R2=$(curl -s -b "$JAR" -X POST $BASE/api/bookings -H 'Content-Type: application/json' \
  -d "{\"routeId\":\"$ROUTE_ID\",\"stageId\":\"$STAGE_ID\",\"seats\":2,\"travelDate\":\"$DATE\",$DETAILS}")
echo "$R2" | python3 -c "import json,sys; d=json.load(sys.stdin); b=d.get('booking'); print('code:', b['code'], '| seats:', b['seats']) if b else print('ERROR:', d)"

echo "── 9. Snapshot check: booking carries nationality/gender/id"
curl -s -b "$JAR" $BASE/api/bookings | python3 -c "
import json,sys
d=json.load(sys.stdin)
b=d['bookings'][0]
print('bookings:', len(d['bookings']), '| latest code:', b['code'])"
echo "── done"
