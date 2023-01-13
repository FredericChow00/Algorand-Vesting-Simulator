const { executeTransaction, convert, readAppGlobalState } = require("@algo-builder/algob");
const { types } = require("@algo-builder/web");

async function run(runtimeEnv, deployer) {
    // write your code here

    const creator = deployer.accountsByName.get("creator");
    const vestingApprovalFile = "vesting_approval.py";
    const vestingClearStateFile = "vesting_clearstate.py";

    // get vesting info
    const vestingApp = deployer.getApp(vestingApprovalFile, vestingClearStateFile);
    const vestingAppAddress = vestingApp.applicationAccount;
    const assetId = deployer.asa.get("VACoin").assetIndex;

    // opt in vesting contracts into asset
    const optInArgs = ["OptIn"].map(convert.stringToBytes)
    await executeTransaction(deployer, {
        type: types.TransactionType.CallApp,
        sign: types.SignType.SecretKey,
        fromAccount: creator,
        appID: vestingApp.appID,
        payFlags: { totalFee: 1000 },
        appArgs: optInArgs,
        foreignAssets: [assetId]
    });

    // transfer assets to vesting contract
    await executeTransaction(deployer, {
        type: types.TransactionType.TransferAsset,
        sign: types.SignType.SecretKey,
        fromAccount: creator,
        toAccountAddr: vestingAppAddress,
        amount: 75000000,
        assetID: assetId,
        payFlags: { totalFee: 1000 },
    });

    const vestingAppAcc = await deployer.algodClient.accountInformation(vestingAppAddress).do();
    console.log(vestingAppAcc.assets);
}

module.exports = { default: run };

