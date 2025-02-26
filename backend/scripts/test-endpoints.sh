#!/bin/bash

BASE_URL="http://localhost:3001/api/dexcom"
TODAY=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
YESTERDAY=$(date -u -v-1d +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d "1 day ago" +"%Y-%m-%dT%H:%M:%SZ")

echo "Testing Dexcom API Endpoints..."
echo "================================"

echo "\n1. Testing Data Range Endpoint"
echo "--------------------------------"
echo "Getting all data ranges:"
curl -s "$BASE_URL/dataRange" | json_pp
echo "\nGetting data ranges after sync time:"
curl -s "$BASE_URL/dataRange?lastSyncTime=$YESTERDAY" | json_pp

echo "\n2. Testing EGV Endpoint"
echo "--------------------------------"
curl -s "$BASE_URL/egvs?startDate=$YESTERDAY&endDate=$TODAY" | json_pp

echo "\n3. Testing Alerts Endpoint"
echo "--------------------------------"
echo "Default (24 hours):"
curl -s "$BASE_URL/alerts" | json_pp
echo "\nSpecific hours (12):"
curl -s "$BASE_URL/alerts?hours=12" | json_pp
echo "\nDate range:"
curl -s "$BASE_URL/alerts?startDate=$YESTERDAY&endDate=$TODAY" | json_pp

echo "\n4. Testing Devices Endpoint"
echo "--------------------------------"
curl -s "$BASE_URL/devices" | json_pp

echo "\nTests completed!" 