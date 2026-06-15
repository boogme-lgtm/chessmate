// One-shot script: trigger autoReleasePayouts for all eligible lessons
import { releaseAllEligiblePayouts } from "../server/payoutService";

async function main() {
  console.log("[trigger-payout] Running releaseAllEligiblePayouts...");
  const result = await releaseAllEligiblePayouts();
  console.log("[trigger-payout] Result:", JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error("[trigger-payout] Error:", err);
  process.exit(1);
});
