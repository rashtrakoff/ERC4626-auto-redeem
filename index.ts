import "dotenv/config";
import { publicClient, walletClient, account } from "./client";
import { VAULT, SAFE_ADDRESS, ALLOWANCE_MODULE_ADDRESS } from "./constant";
import { erc4626 } from "./abis/erc4626";

const INTERVAL_MS = 1000; // Try every 1 second

async function attemptRedeem() {
    try {
        const botAddress = account.address;
        console.log(
            `\n[${new Date().toISOString()}] Checking vault for address: ${SAFE_ADDRESS}`
        );

        const [{result: balance}, {result: maxRedeemable}] = await publicClient.multicall({
            contracts: [
                {
                    address: VAULT,
                    abi: erc4626,
                    functionName: "balanceOf",
                    args: [botAddress],
                },
                {
                    address: VAULT,
                    abi: erc4626,
                    functionName: "maxRedeem",
                    args: [botAddress],
                },
            ],
        }) as [{ result: bigint }, { result: bigint }];

        console.log(`Balance: ${balance.toString()}`);
        console.log(`Max Redeemable: ${maxRedeemable.toString()}`);

        // Take minimum of balance and maxRedeemable
        const sharesToRedeem =
            balance < maxRedeemable ? balance : maxRedeemable;

        if (sharesToRedeem) {
            console.log(
                `\n🎯 Found ${sharesToRedeem.toString()} shares to redeem!`
            );
            console.log(`Attempting to redeem to recipient: ${SAFE_ADDRESS}`);

            // const {request} = await publicClient.simulateContract({
                //     address: VAULT,
                //     abi: erc4626,
                //     functionName: "redeem",
                //     args: [sharesToRedeem, SAFE_ADDRESS, botAddress],
                //     account: account.address,
            // });
            // Call redeem function
            const redemptionHash = await walletClient.writeContract({
                address: VAULT,
                abi: erc4626,
                functionName: "redeem",
                args: [sharesToRedeem, SAFE_ADDRESS, botAddress],
                account: account.address,
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
