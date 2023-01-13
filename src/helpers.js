import algosdk from "algosdk";
import { getAlgodClient } from "./client.js";
import wallets from "./wallets.js";

const getExplorerURL = (txId, network) => {
    switch (network) {
        case "TestNet":
            return "https://testnet.algoexplorer.io/tx/" + txId;
        default:
            return "http://localhost:8980/v2/transactions/" + txId + "?pretty";
    }
};

const assetOptIn = async (receiver, assetId, network) => {
    console.log("Helpers' opt in function ... ")
    if (!(receiver && assetId)) {
        console.error("error", receiver, assetId);
        return;
    }

    const algodClient = getAlgodClient(network)
    const suggestedParams = await algodClient.getTransactionParams().do();

    // receiver opts in to asset
    let assetOptIn = algosdk.makeAssetTransferTxnWithSuggestedParams(
        receiver,
        receiver,
        undefined,
        undefined,
        0,
        undefined,
        assetId,
        suggestedParams
    );
    return await wallets.sendAlgoSignerTransaction(assetOptIn, algodClient);
};

const withdrawAsset = async (receiver, vestingId, assetId, assetAmount, maxWithdrawal, network) => {
    const algodClient = getAlgodClient(network)

    const suggestedParams = await algodClient.getTransactionParams().do();
    suggestedParams.fee *= 2;

    // make app call to vesting contract
    let appArgs = [];
    appArgs.push(new Uint8Array(Buffer.from("Withdraw")));
    appArgs.push(algosdk.encodeUint64(Number(assetAmount)));
    appArgs.push(algosdk.encodeUint64(Number(maxWithdrawal)));
    let assetTransfer = algosdk.makeApplicationNoOpTxnFromObject({
        from: receiver,
        suggestedParams: suggestedParams,
        appIndex: vestingId,
        appArgs: appArgs,
        foreignAssets: [assetId],
    });

    return await wallets.sendAlgoSignerTransaction(assetTransfer, algodClient);
};

const updateMaxWithdrawal = (stakeholder, currentRound, initialRound, cliffRounds, finalRound, allocatedTokens, totalWithdrawn, periodsPassed)=> {
    if(currentRound >= finalRound) {// if past vesting period, just take total allocated - what has been withdrawn 
        return allocatedTokens - totalWithdrawn;
    } else if (currentRound >= initialRound + cliffRounds && stakeholder !== "Reserves"){ // else if past cliffing period only, then calcualte based on fraction
        console.log(periodsPassed);
        console.log(Math.floor(allocatedTokens / 24));
        return Math.floor((allocatedTokens * periodsPassed) / 24)  - totalWithdrawn;
    } else if (stakeholder === "Reserves") { // else if not past cliffing period yet, only reserves can update 
        return allocatedTokens - totalWithdrawn;
    } else { // other stakeholders still cannot withdraw
        return 0;
    }
}

const getAccountInfo = async (address, network) => {
    const algodClient = getAlgodClient(network);
    console.log(address);
    return await algodClient.accountInformation(address).do();
};

const getAccountAssetInfo = async (address, assetId, network) => {
    const algodClient = getAlgodClient(network);

    return await algodClient.accountAssetInformation(address, assetId).do();
};

export {
    getExplorerURL,
    assetOptIn,
    withdrawAsset,
    updateMaxWithdrawal,
    getAccountInfo,
    getAccountAssetInfo,
};
