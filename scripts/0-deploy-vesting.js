const { executeTransaction, convert, readAppGlobalState, readAppLocalState } = require("@algo-builder/algob");
const { types } = require("@algo-builder/web");

async function run(runtimeEnv, deployer) {
    // write your code here

    const creator = deployer.accountsByName.get("creator");
    const advisors = deployer.accountsByName.get("advisors");
    const privateInv = deployer.accountsByName.get("privateInv");
    const team = deployer.accountsByName.get("team");
    const vestingApprovalFile = "vesting_approval.py";
    const vestingClearStateFile = "vesting_clearstate.py";

    // create the VACoin asset 
    await deployer.deployASA("VACoin", {
        creator: creator,
        totalFee: 1000,
        validRounds: 1002,
    });   
    const assetId = deployer.asa.get("VACoin").assetIndex;

    // deploy vesting contract
    await deployer.deployApp(
        vestingApprovalFile,
        vestingClearStateFile,
        {
            sender: creator,
            localInts: 0, 
            localBytes: 0,
            globalInts: 11, 
            globalBytes: 3, 
            accounts: [team.addr, advisors.addr, privateInv.addr],
            foreignAssets: [assetId]
        },
        { totalFee: 1000 }
    );

    // get vesting info
    const vestingApp = deployer.getApp(vestingApprovalFile, vestingClearStateFile);
    const vestingAppAddress = vestingApp.applicationAccount;
    console.log("Vesting app account address:", vestingAppAddress);
    await deployer.addCheckpointKV("vestingAppID", vestingApp.appID);
    await deployer.addCheckpointKV("vestingAppAddress", vestingAppAddress);

    // fund vesting escrow account with 50 algos
    await executeTransaction(deployer, {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.SecretKey,
        fromAccount: creator,
        toAccountAddr: vestingAppAddress,
        amountMicroAlgos: 5e7, // 50 algos
        payFlags: { totalFee: 1000 },
    });
}

module.exports = { default: run };

