const { Runtime, AccountStore, ERRORS } = require("@algo-builder/runtime");
const { assert } = require("chai");
const commonfn = require("./commonfn/commonfn");
const algosdk = require("algosdk");


const vestingApprovalFile = "vesting_approval.py";
const vestingClearStateFile = "vesting_clearstate.py";
const RUNTIME_ERR1009 = "RUNTIME_ERR1009: TEAL runtime encountered err opcode"; // rejected by logic


describe("Negative Tests", function () {
    // Write your code here

    let creator;
    let team;
    let advisors;
    let privateInv;
    let runtime;

    // do this before each tets
    this.beforeEach(async function() {
        creator = new AccountStore(100e6);
        team = new AccountStore(100e6);
        advisors = new AccountStore(100e6);
        privateInv = new AccountStore(100e6);
        runtime = new Runtime([creator, team, advisors, privateInv]);
    });

    const getGlobal = (appID, key) => runtime.getGlobalState(appID, key);

    const initVestingContract = (assetId) => {
        return commonfn.initVestingContract(
            runtime, 
            creator.account,
            team.address,
            advisors.address,
            privateInv.address,
            vestingApprovalFile,
            vestingClearStateFile,
            assetId
        )
    };

    const syncAccounts = () => {
		creator = runtime.getAccount(creator.address);
		team = runtime.getAccount(team.address);
        advisors = runtime.getAccount(advisors.address);
        privateInv = runtime.getAccount(privateInv.address);
	}

    const companyStartingReserves = 30000000;
    const teamTotalAllocated = 15000000;
    const privateInvTotalAllocated = 20000000;
    const advisorsTotalAllocated = 10000000;
    const contractTransferAmount = 75000000;
    const firstToLastRound = (24 * 60) / 4.5;
    const cliffRounds = (12 * 60) / 4.5;
    const cliffTimeStamp = 12 * 60;
    const incrementRoundPeriod = 13;

    it("Opting contract into asset more than once fails", () => {
        commonfn.createAsset(runtime, creator.account);
        const assetId = runtime.getAssetInfoFromName("VACoin").assetIndex;
        const vestingAppInfo = initVestingContract(assetId);
        const vestingAppID = vestingAppInfo.appID;

        // opt contract into asset
        commonfn.vestingOptInToAsset(runtime, creator.account, assetId, vestingAppID);

        // opt contract into asset again
        assert.throws(() => { commonfn.vestingOptInToAsset(runtime, creator.account, assetId, vestingAppID) }, RUNTIME_ERR1009);
    });

    it("Company Reserves withdrawing assets anytime but with wrong max withdrawal fails", () => {
        commonfn.createAsset(runtime, creator.account);
        const assetId = runtime.getAssetInfoFromName("VACoin").assetIndex;
        const vestingAppInfo = initVestingContract(assetId);
        const vestingAppID = vestingAppInfo.appID;
        const vestingAppAddress = vestingAppInfo.applicationAccount;
        const contractDeploymentRound = vestingAppInfo.confirmedRound;
        const contractDeploymentTimeStamp = vestingAppInfo.timestamp;

        // opt contract into asset
        commonfn.vestingOptInToAsset(runtime, creator.account, assetId, vestingAppID);

        // transfer assets to contract
        commonfn.transferAssetsToVesting(runtime, creator.account, vestingAppAddress, assetId, contractTransferAmount);

        // set block rounds to be after cliffing period
        let assetsToWithdraw = 100;
        let secsAfterDeployment = 225;
        let roundsAfterDeployment = 50; // 225 / 4.5 = 50
        let setToRounds = contractDeploymentRound + roundsAfterDeployment;
        let setToTimeStamp = contractDeploymentTimeStamp + secsAfterDeployment;
        runtime.setRoundAndTimestamp(setToRounds, setToTimeStamp);

        // company reserves withdraws asset for the first time
        let maxWithdrawal = companyStartingReserves + 1000;
        assert.throws(() => { commonfn.withdrawAsset(runtime, creator.account, vestingAppID, vestingAppAddress, assetsToWithdraw, maxWithdrawal, assetId) }, RUNTIME_ERR1009);
    });

    it("Team withdraws assets before cliffing period ends fails", () => {
        commonfn.createAsset(runtime, creator.account);
        const assetId = runtime.getAssetInfoFromName("VACoin").assetIndex;
        const vestingAppInfo = initVestingContract(assetId);
        const vestingAppID = vestingAppInfo.appID;
        const vestingAppAddress = vestingAppInfo.applicationAccount;
        const contractDeploymentRound = vestingAppInfo.confirmedRound;
        const contractDeploymentTimeStamp = vestingAppInfo.timestamp;
        const finalRound = getGlobal(vestingAppID, "Final Round");
        let totalWithdrawn = 0;

        // opt contract into asset
        commonfn.vestingOptInToAsset(runtime, creator.account, assetId, vestingAppID);

        // transfer assets to contract
        commonfn.transferAssetsToVesting(runtime, creator.account, vestingAppAddress, assetId, contractTransferAmount);

        // team account opts into asset
        commonfn.stakeholderOptIntToAsset(runtime, team.account, assetId);

        // set block rounds to be after cliffing period
        let assetsToWithdraw = 100;
        let secsAfterDeployment = 5;
        let roundsAfterDeployment = 1;
        let setToRounds = contractDeploymentRound + roundsAfterDeployment;
        let setToTimeStamp = contractDeploymentTimeStamp + secsAfterDeployment;
        let periodsPassed = Math.floor(roundsAfterDeployment / incrementRoundPeriod);
        runtime.setRoundAndTimestamp(setToRounds, setToTimeStamp);

        // team withdraws asset for the first time
        let maxWithdrawal = commonfn.updateMaxWithdrawal("Team", setToRounds, contractDeploymentRound, cliffRounds, finalRound, 
                teamTotalAllocated, totalWithdrawn, periodsPassed);
        let teamAssets = runtime.getAccount(team.address).assets.get(assetId).amount;
        console.log(`Current Team's Asset Holdings: ${teamAssets}`);
        assert.throws(() => { commonfn.withdrawAsset(runtime, team.account, vestingAppID, vestingAppAddress, assetsToWithdraw, maxWithdrawal, assetId) }, RUNTIME_ERR1009);
    });

    it("Team withdraws assets after cliffing period but with wrong max withdrawal fails", () => {
        commonfn.createAsset(runtime, creator.account);
        const assetId = runtime.getAssetInfoFromName("VACoin").assetIndex;
        const vestingAppInfo = initVestingContract(assetId);
        const vestingAppID = vestingAppInfo.appID;
        const vestingAppAddress = vestingAppInfo.applicationAccount;
        const contractDeploymentRound = vestingAppInfo.confirmedRound;
        const contractDeploymentTimeStamp = vestingAppInfo.timestamp;
        const finalRound = getGlobal(vestingAppID, "Final Round");
        let totalWithdrawn = 0;

        // opt contract into asset
        commonfn.vestingOptInToAsset(runtime, creator.account, assetId, vestingAppID);

        // transfer assets to contract
        commonfn.transferAssetsToVesting(runtime, creator.account, vestingAppAddress, assetId, contractTransferAmount);

        // team account opts into asset
        commonfn.stakeholderOptIntToAsset(runtime, team.account, assetId);

        // set block rounds to be after cliffing period
        let assetsToWithdraw = 100;
        let secsAfterDeployment = 999;
        let roundsAfterDeployment = 222;
        let setToRounds = contractDeploymentRound + roundsAfterDeployment;
        let setToTimeStamp = contractDeploymentTimeStamp + secsAfterDeployment;
        let periodsPassed = Math.floor(roundsAfterDeployment / incrementRoundPeriod);
        runtime.setRoundAndTimestamp(setToRounds, setToTimeStamp);

        // team withdraws asset for the first time
        let maxWithdrawal = commonfn.updateMaxWithdrawal("Team", setToRounds, contractDeploymentRound, cliffRounds, finalRound, 
                teamTotalAllocated, totalWithdrawn, periodsPassed) + 1000;
        let teamAssets = runtime.getAccount(team.address).assets.get(assetId).amount;
        console.log(`Current Team's Asset Holdings: ${teamAssets}`);
        assert.throws(() => { commonfn.withdrawAsset(runtime, team.account, vestingAppID, vestingAppAddress, assetsToWithdraw, maxWithdrawal, assetId) }, RUNTIME_ERR1009);
    });

    it("Advisors withdraws assets before cliffing period ends fails", () => {
        commonfn.createAsset(runtime, creator.account);
        const assetId = runtime.getAssetInfoFromName("VACoin").assetIndex;
        const vestingAppInfo = initVestingContract(assetId);
        const vestingAppID = vestingAppInfo.appID;
        const vestingAppAddress = vestingAppInfo.applicationAccount;
        const contractDeploymentRound = vestingAppInfo.confirmedRound;
        const contractDeploymentTimeStamp = vestingAppInfo.timestamp;
        const finalRound = getGlobal(vestingAppID, "Final Round");
        let totalWithdrawn = 0;

        // opt contract into asset
        commonfn.vestingOptInToAsset(runtime, creator.account, assetId, vestingAppID);

        // transfer assets to contract
        commonfn.transferAssetsToVesting(runtime, creator.account, vestingAppAddress, assetId, contractTransferAmount);

        // advisors account opts into asset
        commonfn.stakeholderOptIntToAsset(runtime, advisors.account, assetId);

        // set block rounds to be after cliffing period
        let assetsToWithdraw = 100;
        let secsAfterDeployment = 5;
        let roundsAfterDeployment = 1; // 999 / 4.5 = 222
        let setToRounds = contractDeploymentRound + roundsAfterDeployment;
        let setToTimeStamp = contractDeploymentTimeStamp + secsAfterDeployment;
        let periodsPassed = Math.floor(roundsAfterDeployment / incrementRoundPeriod);
        runtime.setRoundAndTimestamp(setToRounds, setToTimeStamp);

        // advisors withdraws asset for the first time
        let maxWithdrawal = commonfn.updateMaxWithdrawal("Advisors", setToRounds, contractDeploymentRound, cliffRounds, finalRound, 
                advisorsTotalAllocated, totalWithdrawn, periodsPassed);
        let advisorsAssets = runtime.getAccount(advisors.address).assets.get(assetId).amount;
        console.log(`Current Advisors' Asset Holdings: ${advisorsAssets}`);
        assert.throws(() => { commonfn.withdrawAsset(runtime, advisors.account, vestingAppID, vestingAppAddress, assetsToWithdraw, maxWithdrawal, assetId) }, RUNTIME_ERR1009);
    });

    it("Advisors withdraws assets after cliffing period but with wrong max withdrawal fails", () => {
        commonfn.createAsset(runtime, creator.account);
        const assetId = runtime.getAssetInfoFromName("VACoin").assetIndex;
        const vestingAppInfo = initVestingContract(assetId);
        const vestingAppID = vestingAppInfo.appID;
        const vestingAppAddress = vestingAppInfo.applicationAccount;
        const contractDeploymentRound = vestingAppInfo.confirmedRound;
        const contractDeploymentTimeStamp = vestingAppInfo.timestamp;
        const finalRound = getGlobal(vestingAppID, "Final Round");
        let totalWithdrawn = 0;

        // opt contract into asset
        commonfn.vestingOptInToAsset(runtime, creator.account, assetId, vestingAppID);

        // transfer assets to contract
        commonfn.transferAssetsToVesting(runtime, creator.account, vestingAppAddress, assetId, contractTransferAmount);

        // advisors account opts into asset
        commonfn.stakeholderOptIntToAsset(runtime, advisors.account, assetId);

        // set block rounds to be after cliffing period
        let assetsToWithdraw = 100;
        let secsAfterDeployment = 999;
        let roundsAfterDeployment = 222; // 999 / 4.5 = 222
        let setToRounds = contractDeploymentRound + roundsAfterDeployment;
        let setToTimeStamp = contractDeploymentTimeStamp + secsAfterDeployment;
        let periodsPassed = Math.floor(roundsAfterDeployment / incrementRoundPeriod);
        runtime.setRoundAndTimestamp(setToRounds, setToTimeStamp);

        // advisors withdraws asset for the first time
        let maxWithdrawal = commonfn.updateMaxWithdrawal("Advisors", setToRounds, contractDeploymentRound, cliffRounds, finalRound, 
                advisorsTotalAllocated, totalWithdrawn, periodsPassed) + 1000;
        let advisorsAssets = runtime.getAccount(advisors.address).assets.get(assetId).amount;
        console.log(`Current Advisors' Asset Holdings: ${advisorsAssets}`);
        assert.throws(() => { commonfn.withdrawAsset(runtime, advisors.account, vestingAppID, vestingAppAddress, assetsToWithdraw, maxWithdrawal, assetId) }, RUNTIME_ERR1009);
    });

    it("Private Investors withdraws assets before cliffing period ends fails", () => {
        commonfn.createAsset(runtime, creator.account);
        const assetId = runtime.getAssetInfoFromName("VACoin").assetIndex;
        const vestingAppInfo = initVestingContract(assetId);
        const vestingAppID = vestingAppInfo.appID;
        const vestingAppAddress = vestingAppInfo.applicationAccount;
        const contractDeploymentRound = vestingAppInfo.confirmedRound;
        const contractDeploymentTimeStamp = vestingAppInfo.timestamp;
        const finalRound = getGlobal(vestingAppID, "Final Round");
        let totalWithdrawn = 0;

        // opt contract into asset
        commonfn.vestingOptInToAsset(runtime, creator.account, assetId, vestingAppID);

        // transfer assets to contract
        commonfn.transferAssetsToVesting(runtime, creator.account, vestingAppAddress, assetId, contractTransferAmount);

        // investors account opts into asset
        commonfn.stakeholderOptIntToAsset(runtime, privateInv.account, assetId);

        // set block rounds to be after cliffing period
        let assetsToWithdraw = 100;
        let secsAfterDeployment = 5;
        let roundsAfterDeployment = 1; // 999 / 4.5 = 222
        let setToRounds = contractDeploymentRound + roundsAfterDeployment;
        let setToTimeStamp = contractDeploymentTimeStamp + secsAfterDeployment;
        let periodsPassed = Math.floor(roundsAfterDeployment / incrementRoundPeriod);
        runtime.setRoundAndTimestamp(setToRounds, setToTimeStamp);

        // investors withdraws asset for the first time
        let maxWithdrawal = commonfn.updateMaxWithdrawal("Investors", setToRounds, contractDeploymentRound, cliffRounds, finalRound, 
                privateInvTotalAllocated, totalWithdrawn, periodsPassed);
        let investorsAssets = runtime.getAccount(privateInv.address).assets.get(assetId).amount;
        console.log(`Current Investors' Asset Holdings: ${investorsAssets}`);
        assert.throws(() => { commonfn.withdrawAsset(runtime, privateInv.account, vestingAppID, vestingAppAddress, assetsToWithdraw, maxWithdrawal, assetId) }, RUNTIME_ERR1009);
    });

    it("Private Investors withdraws assets after cliffing period but with wrong max withdrawal fails", () => {
        commonfn.createAsset(runtime, creator.account);
        const assetId = runtime.getAssetInfoFromName("VACoin").assetIndex;
        const vestingAppInfo = initVestingContract(assetId);
        const vestingAppID = vestingAppInfo.appID;
        const vestingAppAddress = vestingAppInfo.applicationAccount;
        const contractDeploymentRound = vestingAppInfo.confirmedRound;
        const contractDeploymentTimeStamp = vestingAppInfo.timestamp;
        const finalRound = getGlobal(vestingAppID, "Final Round");
        let totalWithdrawn = 0;

        // opt contract into asset
        commonfn.vestingOptInToAsset(runtime, creator.account, assetId, vestingAppID);

        // transfer assets to contract
        commonfn.transferAssetsToVesting(runtime, creator.account, vestingAppAddress, assetId, contractTransferAmount);

        // investors account opts into asset
        commonfn.stakeholderOptIntToAsset(runtime, privateInv.account, assetId);

        // set block rounds to be after cliffing period
        let assetsToWithdraw = 100;
        let secsAfterDeployment = 999;
        let roundsAfterDeployment = 222; // 999 / 4.5 = 222
        let setToRounds = contractDeploymentRound + roundsAfterDeployment;
        let setToTimeStamp = contractDeploymentTimeStamp + secsAfterDeployment;
        let periodsPassed = Math.floor(roundsAfterDeployment / incrementRoundPeriod);
        runtime.setRoundAndTimestamp(setToRounds, setToTimeStamp);

        // investors withdraws asset for the first time
        let maxWithdrawal = commonfn.updateMaxWithdrawal("Investors", setToRounds, contractDeploymentRound, cliffRounds, finalRound, 
                privateInvTotalAllocated, totalWithdrawn, periodsPassed) + 1000;
        let investorsAssets = runtime.getAccount(privateInv.address).assets.get(assetId).amount;
        console.log(`Current Investors' Asset Holdings: ${investorsAssets}`);
        assert.throws(() => { commonfn.withdrawAsset(runtime, privateInv.account, vestingAppID, vestingAppAddress, assetsToWithdraw, maxWithdrawal, assetId) }, RUNTIME_ERR1009);
    });

    it("Advisors withdraws more assets than Max Withdrawal after cliffing period fails", () => {
        commonfn.createAsset(runtime, creator.account);
        const assetId = runtime.getAssetInfoFromName("VACoin").assetIndex;
        const vestingAppInfo = initVestingContract(assetId);
        const vestingAppID = vestingAppInfo.appID;
        const vestingAppAddress = vestingAppInfo.applicationAccount;
        const contractDeploymentRound = vestingAppInfo.confirmedRound;
        const contractDeploymentTimeStamp = vestingAppInfo.timestamp;
        const finalRound = getGlobal(vestingAppID, "Final Round");
        let totalWithdrawn = 0;

        // opt contract into asset
        commonfn.vestingOptInToAsset(runtime, creator.account, assetId, vestingAppID);

        // transfer assets to contract
        commonfn.transferAssetsToVesting(runtime, creator.account, vestingAppAddress, assetId, contractTransferAmount);

        // advisors account opts into asset
        commonfn.stakeholderOptIntToAsset(runtime, advisors.account, assetId);

        // set block rounds to be after cliffing period
        let assetsToWithdraw = 10000000000;
        let secsAfterDeployment = 999;
        let roundsAfterDeployment = 222; // 999 / 4.5 = 222
        let setToRounds = contractDeploymentRound + roundsAfterDeployment;
        let setToTimeStamp = contractDeploymentTimeStamp + secsAfterDeployment;
        let periodsPassed = Math.floor(roundsAfterDeployment / incrementRoundPeriod);
        runtime.setRoundAndTimestamp(setToRounds, setToTimeStamp);

        // advisors withdraws asset for the first time
        let maxWithdrawal = commonfn.updateMaxWithdrawal("Advisors", setToRounds, contractDeploymentRound, cliffRounds, finalRound, 
                advisorsTotalAllocated, totalWithdrawn, periodsPassed);
        let advisorsAssets = runtime.getAccount(advisors.address).assets.get(assetId).amount;
        console.log(`Current Advisors' Asset Holdings: ${advisorsAssets}`);
        assert.throws(() => { commonfn.withdrawAsset(runtime, advisors.account, vestingAppID, vestingAppAddress, assetsToWithdraw, maxWithdrawal, assetId) }, RUNTIME_ERR1009);
    });
});
