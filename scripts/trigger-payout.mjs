// Trigger releaseAllEligible via the running dev server's tRPC admin endpoint
// We need to call it as an admin user — use a direct DB + service call instead

import { execSync } from 'child_process';

// Call the tRPC endpoint directly via curl with the dev server
const DEV_URL = 'http://localhost:3000';

// First check what lessons are eligible
const result = execSync(`curl -s "${DEV_URL}/api/trpc/admin.pendingPayouts" -H "Content-Type: application/json" --cookie "session=$(cat /tmp/session_cookie 2>/dev/null || echo '')"`, { encoding: 'utf8' });
console.log('Pending payouts response:', result.substring(0, 500));
