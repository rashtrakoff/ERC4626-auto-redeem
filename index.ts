import "dotenv/config";
import { publicClient, walletClient, account } from "./client";
import { VAULT, SAFE_ADDRESS, ALLOWANCE_MODULE_ADDRESS } from "./constant";
import { erc4626 } from "./abis/erc4626";
import { allowanceModule } from "./abis/allowanceModule";
import { zeroAddress } from "viem";

const INTERVAL_MS = 1000; // Try every 1 second
const MIN_REDEEMABLE_THRESHOLD = 1n; // Minimum shares to trigger redeem

async function attemptRedeem() {
    try {
        const botAddress = account.address;
        console.log(
            `\n[${new Date().toISOString()}] Checking vault for address: ${botAddress}`
        );

        // Read balance and maxRedeem in parallel
        const [balance, botSharesBalance, maxRedeemable] = await Promise.all([
            publicClient.readContract({
                address: VAULT,
                abi: erc4626,
                functionName: "balanceOf",
                args: [SAFE_ADDRESS],
            }) as Promise<bigint>,
            publicClient.readContract({
                address: VAULT,
                abi: erc4626,
                functionName: "balanceOf",
                args: [botAddress],
            }) as Promise<bigint>,
            publicClient.readContract({
                address: VAULT,
                abi: erc4626,
                functionName: "maxRedeem",
                args: [SAFE_ADDRESS],
            }) as Promise<bigint>,
        ]);

        console.log(`Balance: ${balance.toString()}`);
        console.log(`Max Redeemable: ${maxRedeemable.toString()}`);

        // Take minimum of balance and maxRedeemable
        const sharesToRedeem =
            balance < maxRedeemable ? balance : maxRedeemable;

        if (sharesToRedeem >= MIN_REDEEMABLE_THRESHOLD) {
            console.log(
                `\n🎯 Found ${sharesToRedeem.toString()} shares to redeem!`
            );
            console.log(`Attempting to redeem to recipient: ${SAFE_ADDRESS}`);

            // Transfer the shares from the safe to the bot address.
            if (botSharesBalance < sharesToRedeem) {
                const allowanceTxHash = await walletClient.writeContract({
                    address: ALLOWANCE_MODULE_ADDRESS,
                    abi: allowanceModule,
                    functionName: "executeAllowanceTransfer",
                    args: [
                        SAFE_ADDRESS,
                        VAULT,
                        account.address,
                        sharesToRedeem,
                        zeroAddress,
                        0n,
                        account.address, // delegate (bot address)
                        "0x", // empty signature since we're the delegate
                    ],
                });

                console.info(
                    `Allowance transfer sent: ${allowanceTxHash}. Waiting for confirmation...`
                );
                await publicClient.waitForTransactionReceipt({
                    hash: allowanceTxHash,
                });
                console.info(`Allowance transfer confirmed.`);
            }

            // Call redeem function
            const redemptionHash = await walletClient.writeContract({
                address: VAULT,
                abi: erc4626,
                functionName: "redeem",
                args: [sharesToRedeem, SAFE_ADDRESS, botAddress],
            });

            console.log(`✅ Transaction sent! Hash: ${redemptionHash}`);
            console.log(`Waiting for confirmation...`);

            // Wait for transaction receipt
            const redemptionReceipt =
                await publicClient.waitForTransactionReceipt({
                    hash: redemptionHash,
                });

            if (redemptionReceipt.status === "success") {
                console.log(
                    `✅ Transaction confirmed! Block: ${redemptionReceipt.blockNumber}`
                );
            } else {
                console.log(`❌ Transaction failed!`);
            }
        } else {
            console.log("No shares available to redeem at this time.");
        }
    } catch (error) {
        console.error("Error during redeem attempt:", error);
    }
}

async function main() {
    console.log("🚀 Auto-redeem rescue script starting...");
    console.log(`Vault: ${VAULT}`);
    console.log(`Recipient: ${SAFE_ADDRESS}`);
    console.log(`Operator: ${account.address}`);
    console.log(`Check interval: ${INTERVAL_MS}ms\n`);

    // Run immediately
    await attemptRedeem();

    // Then run at intervals
    setInterval(attemptRedeem, INTERVAL_MS);
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
