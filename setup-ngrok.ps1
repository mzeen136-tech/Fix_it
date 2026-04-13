#!/bin/bash

# SnapFix - Ngrok Setup and Testing Script
# This script helps you set up ngrok for local testing

echo "🚀 SnapFix - Ngrok Setup Script"
echo "=================================="

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok not found. Installing..."
    npm install -D ngrok
fi

# Check if Next.js project exists
if [ ! -f "package.json" ] || ! grep -q "next" package.json; then
    echo "❌ Next.js project not found. Please run this script from the snapfix directory."
    exit 1
fi

echo "✅ ngrok is installed and Next.js project found."

# Function to check if port is available
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        return 0
    else
        return 1
    fi
}

echo ""
echo "📋 Setup Instructions:"
echo "====================="

echo "1. Start your Next.js development server:"
echo "   npm run dev"
echo ""

echo "2. In a NEW terminal, run ngrok:"
echo "   npx ngrok http 3000"
echo ""

echo "3. Copy the ngrok URL (it will look like: https://abc123.ngrok-free.app)"
echo ""

echo "4. Configure Meta Developer Console:"
echo "   - Callback URL: https://your-ngrok-url.ngrok-free.app/api/whatsapp"
echo "   - Verify Token: snapfix-local-dev-token-change-me"
echo "   - Webhook fields: Check 'messages'"
echo ""

echo "5. Update your .env.local file with Meta values:"
echo "   WHATSAPP_ACCESS_TOKEN=your-token-here"
echo "   WHATSAPP_PHONE_NUMBER_ID=your-phone-id-here"
echo ""

echo "6. Test the system!"
echo ""

echo "🧪 Test Commands:"
echo "================"
echo "Admin:  /add Plumber, Test Tech, 923001234567, Islamabad"
echo "Customer: My bathroom tap is leaking"
echo "Tech: Rs. 1500, 30 minutes" 
echo "Customer: ACCEPT Test Tech"
echo ""

echo "⚠️  Important Notes:"
echo "=================="
echo "- ngrok URLs change every time you restart it"
echo "- Always update the Meta Console URL when ngrok restarts"
echo "- Keep the terminal with ngrok running while testing"
echo "- Use a real WhatsApp number for testing"
echo ""

read -p "Press Enter once you've set up ngrok and Meta Console..."

echo "🔍 Testing ngrok connection..."
echo ""

# Test if ngrok is running on port 3000
if check_port 3000; then
    echo "✅ Port 3000 is active (Next.js running)"
else
    echo "❌ Port 3000 is not active. Please run 'npm run dev' first."
    exit 1
fi

# Try to fetch ngrok status
if command -v curl &> /dev/null; then
    echo "📡 Checking ngrok tunnels..."
    curl -s http://localhost:4040/api/tunnels | grep -o "https://[^\"]*" | head -1
    echo ""
fi

echo "🎉 Setup complete! Start testing with the commands above."