const { convert } = require("@algo-builder/algob");
const { types } = require("@algo-builder/web");

const initVestingContract = (runtime, creatorAccount, teamAddress, advisorsAddress, privateInvAddress, vestingApprovalFile, vestingClearStateFile, assetId) => {
    // deploy mint contract 
    runtime.deployApp(
        vestingApprovalFile,
        vestingClearStateFile,
        {
            sender: creatorAccount,
            localInts: 0,
            localBytes: 0,
            globalInts: 11,
            globalBytes: 3,
            accounts: [teamAddress, advisorsAddress, privateInvAddress],
            foreignAssets: [assetId]
        },
        { totalFee: 1000 }, //pay flags
        {} // smart contract template params 
    );

    // get vesting info
    const vestingApp = runtime.getAppInfoFromName(vestingApprovalFile, vestingClearStateFile);
    const vestingAppAddress = vestingApp.applicationAccount;

    // fund the contract
    runtime.executeTx({
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.SecretKey,
        fromAccount: creatorAccount,
        toAccountAddr: vestingAppAddress,
        amountMicroAlgos: 5e7, // fund 50 algos
        payFlags: { totalFee: 1000 },
    });
    return vestingApp;
}

const createAsset = (runtime, creatorAccount) => {
    // create Asset
    return runtime.deployASA("VACoin", {
        creator: creatorAccount,
        totalFee: 1000,
        validRounds: 1002,
    });
}

const vestingOptInToAsset = (runtime, creatorAccount, assetId, vestingAppID) => {
    const optInArgs = ["OptIn"].map(convert.stringToBytes)
    return runtime.executeTx({
        type: types.TransactionType.CallApp,
        sign: types.SignType.SecretKey,
        fromAccount: creatorAccount,
        appID: vestingAppID,
        payFlags: { totalFee: 1000 },
        appArgs: optInArgs,
        foreignAssets: [assetId]
    });
}

const stakeholderOptIntToAsset = (runtime, stakeholderAcc, assetId) => {
    return runtime.executeTx({
        type: types.TransactionType.OptInASA,
        sign: types.SignType.SecretKey,
        fromAccount: stakeholderAcc,
        assetID: assetId,
        payFlags: { totalFee: 1000 }
    })
}

const transferAssetsToVesting = (runtime, creatorAcc, vestingAppAddress, assetId, amount) => {
    return runtime.executeTx({
        type: types.TransactionType.TransferAsset,
        sign: types.SignType.SecretKey,
        fromAccount: creatorAcc,
        toAccountAddr: vestingAppAddress,
        amount: amount,
        assetID: assetId,
        payFlags: { totalFee: 1000 },
    });
}

const withdrawAsset = (runtime, stakeholderAcc, vestingAppId, vestingAppAddress, assetsToWithdraw, maxWithdrawal, assetId) => {
    let vestingAssets = runtime.getAccount(vestingAppAddress).assets.get(assetId).amount;
    console.log(`Vesting Asset Holdings Before Withdrawal: ${vestingAssets}`)
    console.log(`Assets withdrawn: ${assetsToWithdraw}`);
    console.log(`AssetId: ${assetId}`);
    console.log(`Max: ${maxWithdrawal}`);

    const withdrawAssetArgs = [convert.stringToBytes("Withdraw"), convert.uint64ToBigEndian(assetsToWithdraw), convert.uint64ToBigEndian(maxWithdrawal)];
    runtime.executeTx([{
        type: types.TransactionType.CallApp,
        sign: types.SignType.SecretKey,
        fromAccount: stakeholderAcc,
        appID: vestingAppId,
        payFlags: { totalFee: 1000 },
        appArgs: withdrawAssetArgs,
        foreignAssets: [assetId],
    }]);
    vestingAssets = runtime.getAccount(vestingAppAddress).assets.get(assetId).amount;
    console.log(`Vesting Asset Holdings After Withdrawal: ${vestingAssets}`)
};

const updateMaxWithdrawal = (stakeholder, currentRound, initialRound, cliffRounds, finalRound, allocatedTokens, totalWithdrawn, periodsPassed)=> {
    if(currentRound >= finalRound) {// if past vesting period, just take total allocated - what has been withdrawn 
        return allocatedTokens - totalWithdrawn;
    } else if (currentRound >= initialRound + cliffRounds){ // else if past cliffing period only, then calcualte based on fraction
        return Math.floor((allocatedTokens * periodsPassed) / 24) - totalWithdrawn;
    } else if (stakeholder === "Reserves") { // else if not past cliffing period yet, only reserves can update 
        return allocatedTokens - totalWithdrawn;
    } else { // other stakeholdrs still cannot withdraw
        return 0;
    }
}

module.exports = {
    initVestingContract,
    createAsset,
    vestingOptInToAsset,
    stakeholderOptIntToAsset,
    transferAssetsToVesting,
    withdrawAsset,
    updateMaxWithdrawal
}



