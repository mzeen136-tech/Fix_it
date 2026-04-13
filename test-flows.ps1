#!/bin/bash

# SnapFix - End-to-End Testing Script
# This script helps you test all 4 core flows

echo "🧪 SnapFix - End-to-End Testing Script"
echo "======================================"

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "❌ .env.local not found. Please create it from .env.example and fill in your values."
    exit 1
fi

echo "✅ Environment configuration found."

# Function to test API endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    echo ""
    echo "🔍 Testing: $description"
    echo "Endpoint: $method $endpoint"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -X GET "http://localhost:3000$endpoint" -H "Content-Type: application/json")
    else
        response=$(curl -s -X POST "http://localhost:3000$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    echo "Response: $response"
    
    # Check for success
    if echo "$response" | grep -q "ok\|success\|verified"; then
        echo "✅ Test passed"
        return 0
    else
        echo "❌ Test failed"
        return 1
    fi
}

echo ""
echo "📡 Testing Webhook Endpoints"
echo "============================="

# Test GET (webhook verification)
test_endpoint "GET" "/api/whatsapp?hub.mode=subscribe&hub.verify_token=snapfix-local-dev-token-change-me&hub.challenge=test123" \
    "" \
    "Webhook verification (GET)"

# Test POST with sample message
sample_message='{
    "object": "whatsapp_business_account",
    "entry": [
        {
            "id": "12345",
            "changes": [
                {
                    "value": {
                        "messages": [
                            {
                                "from": "923001234567",
                                "id": "wamid.HBgLMTUwNDAxMzQyNjUwODcxJwIA",
                                "timestamp": "1620000000000",
                                "text": {
                                    "body": "Test message"
                                },
                                "type": "text"
                            }
                        ]
                    }
                }
            ]
        }
    ]
}'

test_endpoint "POST" "/api/whatsapp" \
    "$sample_message" \
    "Sample message processing (POST)"

echo ""
echo "🏠 Testing Flow Scenarios"
echo "==========================="

echo ""
echo "📝 Scenario 1: Admin Adding Technician"
echo "===================================="
echo "Expected: Add technician via /add command"
echo "Command: /add Plumber, Ali, 923001234567, Islamabad"
echo "WhatsApp: Send from admin number to Meta test number"

echo ""
echo "👥 Scenario 2: Customer Request"
echo "================================"
echo "Expected: Create job, notify technicians"
echo "Message: My bathroom tap is leaking badly"
echo "WhatsApp: Send from customer number to Meta test number"

echo ""
echo "🔧 Scenario 3: Technician Bidding"
echo "=================================="
echo "Expected: Parse bid, notify customer"
echo "Message: Rs. 2500, 30 minutes"
echo "WhatsApp: Send from technician number to Meta test number"

echo ""
echo "✅ Scenario 4: Customer Acceptance"
echo "=================================="
echo "Expected: Assign job, send handshake messages"
echo "Message: ACCEPT Ali"
echo "WhatsApp: Send from customer number to Meta test number"

echo ""
echo "📊 Database Validation"
echo "======================"
echo "After testing, check your Supabase database:"
echo ""
echo "1. Check technicians table:"
echo "   SELECT phone_number, name, trade, is_active FROM technicians;"
echo ""
echo "2. Check active_jobs table:"
echo "   SELECT job_id, customer_phone, trade_required, status, bids FROM active_jobs;"
echo ""
echo "3. Check system stats:"
echo "   SELECT * FROM get_system_stats();"

echo ""
echo "🚨 Common Issues"
echo "================"
echo "1. Messages not sending:"
echo "   - Check Meta Console configuration"
echo "   - Verify ngrok URL is accessible"
echo "   - Confirm tokens in .env.local"
echo ""
echo "2. AI not working:"
echo "   - Check Gemini API key"
echo "   - Verify internet connection"
echo ""
echo "3. Database errors:"
echo "   - Run database-setup.sql in Supabase"
echo "   - Check service role key"
echo ""
echo "4. Webhook failing:"
echo "   - Meta callback URL must match ngrok URL"
echo "   - Verify token matches exactly"
echo "   - Check that 'messages' field is selected"

echo ""
echo "🎯 Test Checklist"
echo "================="
echo "□ Admin can add technicians"
echo "□ Customers can create jobs"
echo "□ Technicians can submit bids"
echo "□ Customers can accept bids"
echo "□ All WhatsApp messages send correctly"
echo "□ Database entries are created"
echo "□ Error handling works"
echo "□ Performance is acceptable (<5s response time)"

echo ""
echo "🎉 Testing complete! Check the logs above for any issues."