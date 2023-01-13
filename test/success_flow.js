const { Runtime, AccountStore, ERRORS } = require("@algo-builder/runtime");
const { assert } = require("chai");
const commonfn = require("./commonfn/commonfn");
const algosdk = require("algosdk");


const vestingApprovalFile = "vesting_approval.py";
const vestingClearStateFile = "vesting_clearstate.py";

describe("Success Flow", function () {
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

/*     it("Deploys vesting contract successfully", () => {
        commonfn.createAsset(runtime, creator.account);
        const assetId = runtime.getAssetInfoFromName("VACoin").assetIndex;
        const vestingAppInfo = initVestingContract(assetId);
        const vestingAppID = vestingAppInfo.appID;
        const contractDeploymentRound = vestingAppInfo.confirmedRound;

        // verify app created 
        assert.isDefined(vestingAppID);
        assert.equal(algosdk.encodeAddress(Buffer.from(getGlobal(vestingAppID, "Team Address"), "base64")), team.address);
        assert.equal(algosdk.encodeAddress(Buffer.from(getGlobal(vestingAppID, "Advisor Address"), "base64")), advisors.address);
        assert.equal(algosdk.encodeAddress(Buffer.from(getGlobal(vestingAppID, "PrivateInv Address"), "base64")), privateInv.address);
        assert.equal(getGlobal(vestingAppID, "Initial Round") , contractDeploymentRound);
        assert.equal(getGlobal(vestingAppID, "Final Round"), contractDeploymentRound + firstToLastRound);
        assert.equal(getGlobal(vestingAppID, "Reserves Allocated Tokens"), companyStartingReserves);
        
        // verify app funded
        const vestingAppAccount = runtime.getAccount(vestingAppInfo.applicationAccount);
        assert.equal(vestingAppAccount.amount, 5e7);
    }); 
    
    it("Vesting Contract opts in to asset successfully", () => {
        commonfn.createAsset(runtime, creator.account);
        const assetId = runtime.getAssetInfoFromName("VACoin").assetIndex;
        const vestingAppInfo = initVestingContract(assetId);
        const vestingAppID = vestingAppInfo.appID;
        const vestingAppAddress = vestingAppInfo.applicationAccount;

        // opt contract into asset
        commonfn.vestingOptInToAsset(runtime, creator.account, assetId, vestingAppID);

        // verify that contract is opted into asset
        const asset = runtime.getAccount(vestingAppAddress).assets.get(assetId).amount;
        assert.equal(asset, 0) // should have 0 assets in holding
    });

    it("Opts Team to asset successfully", () => {
        commonfn.createAsset(runtime, creator.account);
        const assetId = runtime.getAssetInfoFromName("VACoin").assetIndex;
        initVestingContract(assetId);

        // team account opts into asset
        commonfn.stakeholderOptIntToAsset(runtime, team.account, assetId);

        // verify that account has opted into asset
        const asset = runtime.getAccount(team.address).assets.get(assetId).amount;
        assert.equal(asset, 0) // should have 0 assets in holding
    });

    it("Opts Advisors to asset successfully", () => {
        commonfn.createAsset(runtime, creator.account);
        const assetId = runtime.getAssetInfoFromName("VACoin").assetIndex;
        initVestingContract(assetId);

        // team account opts into asset
        commonfn.stakeholderOptIntToAsset(runtime, advisors.account, assetId);

        // verify that account has opted into asset
        const asset = runtime.getAccount(advisors.address).assets.get(assetId).amount;
        assert.equal(asset, 0) // should have 0 assets in holding
    });

    it("Opts Private Investors to asset successfully", () => {
        commonfn.createAsset(runtime, creator.account);
        const assetId = runtime.getAssetInfoFromName("VACoin").assetIndex;
        initVestingContract(assetId);
        
        // team account opts into asset
        commonfn.stakeholderOptIntToAsset(runtime, privateInv.account, assetId);

        // verify that account has opted into asset
        const asset = runtime.getAccount(privateInv.address).assets.get(assetId).amount;
        assert.equal(asset, 0) // should have 0 assets in holding
    });

    it("Transfers asset to vesting contract successfully", () => {
        commonfn.createAsset(runtime, creator.account);
        const assetId = runtime.getAssetInfoFromName("VACoin").assetIndex;
        const vestingAppInfo = initVestingContract(assetId);
        const vestingAppID = vestingAppInfo.appID;
        const vestingAppAddress = vestingAppInfo.applicationAccount;
        console.log(`Asset ID: ${assetId}`);
        
        // opt contract into asset
        commonfn.vestingOptInToAsset(runtime, creator.account, assetId, vestingAppID);

        // transfer assest to contract
        commonfn.transferAssetsToVesting(runtime, creator.account, vestingAppAddress, assetId, contractTransferAmount);

        // verify that asset is transferred to asset
        const asset = runtime.getAccount(vestingAppAddress).assets.get(assetId).amount;
        console.log(`Assets in vesting after transfer: ${asset}`);
        assert.equal(asset, contractTransferAmount) // should have 0 assets in holding
    });

    it("Company Reserves withdraws assets successfully anytime", () => {
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

        // set block rounds to be after cliffing period
        let assetsToWithdraw = 100;
        let secsAfterDeployment = 225;
        let roundsAfterDeployment = 50; // 225 / 4.5 = 50
        let setToRounds = contractDeploymentRound + roundsAfterDeployment;
        let setToTimeStamp = contractDeploymentTimeStamp + secsAfterDeployment;
        let periodsPassed = Math.floor(roundsAfterDeployment / incrementRoundPeriod);
        runtime.setRoundAndTimestamp(setToRounds, setToTimeStamp);

        // company reserves withdraws asset for the first time
        let maxWithdrawal = commonfn.updateMaxWithdrawal("Reserves", setToRounds, contractDeploymentRound, cliffRounds, finalRound, 
                companyStartingReserves, totalWithdrawn, periodsPassed);
        console.log(`Reserves Max Withdrawal: ${maxWithdrawal}`);
        let reserveAssets = getGlobal(vestingAppID, "Reserves Allocated Tokens");
        console.log(`Current Reserves' Asset Holdings: ${reserveAssets}`);
        commonfn.withdrawAsset(runtime, creator.account, vestingAppID, vestingAppAddress, assetsToWithdraw, maxWithdrawal, assetId);
        totalWithdrawn += assetsToWithdraw;

        // verify sale
        assert.equal(Number(reserveAssets) - totalWithdrawn, maxWithdrawal - totalWithdrawn) // global state max reserves withdrawal updated
    }); */

    it("Company Reserves withdraws assets successfully twice in a row during vesting period", () => {
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

        // set block rounds to be after cliffing period
        let assetsToWithdraw = 100;
        let secsAfterDeployment = 225;
        let roundsAfterDeployment = 50; // 225 / 4.5 = 50
        let setToRounds = contractDeploymentRound + roundsAfterDeployment;
        let setToTimeStamp = contractDeploymentTimeStamp + secsAfterDeployment;
        let periodsPassed = Math.floor(roundsAfterDeployment / incrementRoundPeriod);
        runtime.setRoundAndTimestamp(setToRounds, setToTimeStamp);

        // company reserves withdraws asset for the first time
        let maxWithdrawal = commonfn.updateMaxWithdrawal("Reserves", setToRounds, contractDeploymentRound, cliffRounds, finalRound, 
                companyStartingReserves, totalWithdrawn, periodsPassed);
        console.log(`Reserves Max Withdrawal: ${maxWithdrawal}`);
        let reserveAssets = getGlobal(vestingAppID, "Reserves Allocated Tokens");
        console.log(`Current Reserves' Asset Holdings: ${reserveAssets}`);
        commonfn.withdrawAsset(runtime, creator.account, vestingAppID, vestingAppAddress, assetsToWithdraw, maxWithdrawal, assetId);
        console.log("Done withdrawing");
        totalWithdrawn += assetsToWithdraw;

        // verify sale
        assert.equal(Number(reserveAssets) - totalWithdrawn, maxWithdrawal - assetsToWithdraw) // global state max reserves withdrawal updated

         // set block rounds to be after cliffing period
         assetsToWithdraw = 100;
         secsAfterDeployment = 234;
         roundsAfterDeployment = 52; // 234 / 4.5 = 52
         setToRounds = contractDeploymentRound + roundsAfterDeployment;
         setToTimeStamp = contractDeploymentTimeStamp + secsAfterDeployment;
         periodsPassed = Math.floor(roundsAfterDeployment / incrementRoundPeriod);
         runtime.setRoundAndTimestamp(setToRounds, setToTimeStamp);
 
         // company reserves withdraws asset for the first time
         maxWithdrawal = commonfn.updateMaxWithdrawal("Reserves", setToRounds, contractDeploymentRound, cliffRounds, finalRound, 
                 companyStartingReserves, totalWithdrawn, periodsPassed);
         console.log(`Reserves Max Withdrawal: ${maxWithdrawal}`);
         reserveAssets = getGlobal(vestingAppID, "Reserves Allocated Tokens");
         console.log(`Current Reserves' Asset Holdings: ${reserveAssets}`);
         commonfn.withdrawAsset(runtime, creator.account, vestingAppID, vestingAppAddress, assetsToWithdraw, maxWithdrawal, assetId);
         totalWithdrawn += assetsToWithdraw;
 
         // verify sale
         assert.equal(Number(reserveAssets) - totalWithdrawn, maxWithdrawal - assetsToWithdraw) // global state max reserves withdrawal updated
    });

    it("Team withdraws assets successfully after cliffing period", () => {
        commonfn.createAsset(runtime, creator.account);
        const assetId = runtime.getAssetInfoFromName("VACoin").assetIndex;
        const vestingAppInfo = initVestingContract(assetId);
        const vestingAppID = vestingAppInfo.appID;
        const vestingAppAddress = vestingAppInfo.applicationAccount;
        const contractDeploymentRound = vestingAppInfo.confirmedRound;
        console.log(contractDeploymentRound);
        const contractDeploymentTimeStamp = vestingAppInfo.timestamp;
        const finalRound = getGlobal(vestingAppID, "Final Round");
        console.log(finalRound);
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
        let roundsAfterDeployment = 222; // 999 / 4.5 = 222
        let setToRounds = contractDeploymentRound + roundsAfterDeployment;
        let setToTimeStamp = contractDeploymentTimeStamp + secsAfterDeployment;
        let periodsPassed = Math.floor(roundsAfterDeployment / incrementRoundPeriod);
        runtime.setRoundAndTimestamp(setToRounds, setToTimeStamp);

        // team withdraws asset for the first time
        let maxWithdrawal = commonfn.updateMaxWithdrawal("Team", setToRounds, contractDeploymentRound, cliffRounds, finalRound, 
                teamTotalAllocated, totalWithdrawn, periodsPassed);
        console.log(`Team Max Withdrawal: ${maxWithdrawal}`);
        let teamAssets = runtime.getAccount(team.address).assets.get(assetId).amount;
        console.log(`Current Team's Asset Holdings: ${teamAssets}`);
        commonfn.withdrawAsset(runtime, team.account, vestingAppID, vestingAppAddress, assetsToWithdraw, maxWithdrawal, assetId);
        console.log("Done withdrawing");
        totalWithdrawn += assetsToWithdraw;

        syncAccounts();
        teamAssets = runtime.getAccount(team.address).assets.get(assetId).amount;
        console.log(`New Team's Asset Holdings: ${teamAssets}`);

        // verify sale
        assert.equal(teamAssets, totalWithdrawn); // team received assets withdrawn
    });

    it("Advisors withdraws assets successfully after cliffing period", () => {
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
                advisorsTotalAllocated, totalWithdrawn, periodsPassed);
        let advisorsAssets = runtime.getAccount(advisors.address).assets.get(assetId).amount;
        console.log(`Current Advisors' Asset Holdings: ${advisorsAssets}`);
        commonfn.withdrawAsset(runtime, advisors.account, vestingAppID, vestingAppAddress, assetsToWithdraw, maxWithdrawal, assetId);
        console.log("Done withdrawing");
        totalWithdrawn += assetsToWithdraw;

        syncAccounts();
        advisorsAssets = runtime.getAccount(advisors.address).assets.get(assetId).amount;
        console.log(`New Advisors' Asset Holdings: ${advisorsAssets}`);

        // verify sale
        assert.equal(advisorsAssets, totalWithdrawn); // advisors received assets withdrawn
    });

    it("Private Investors withdraws assets successfully after cliffing period", () => {
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
                privateInvTotalAllocated, totalWithdrawn, periodsPassed);
        let investorsAssets = runtime.getAccount(privateInv.address).assets.get(assetId).amount;
        console.log(`Current Investors' Asset Holdings: ${investorsAssets}`);
        commonfn.withdrawAsset(runtime, privateInv.account, vestingAppID, vestingAppAddress, assetsToWithdraw, maxWithdrawal, assetId);
        console.log("Done withdrawing");
        totalWithdrawn += assetsToWithdraw;

        syncAccounts();
        investorsAssets = runtime.getAccount(privateInv.address).assets.get(assetId).amount;
        console.log(`New Investors' Asset Holdings: ${investorsAssets}`);

        // verify sale
        assert.equal(investorsAssets, totalWithdrawn); // advisors received assets withdrawn
    });

    it("Private Investors withdraws assets successfully 2 times in succession (before next increment) after cliffing period", () => {
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
                privateInvTotalAllocated, totalWithdrawn, periodsPassed);
        let investorsAssets = runtime.getAccount(privateInv.address).assets.get(assetId).amount;
        console.log(`Current Investors' Asset Holdings: ${investorsAssets}`);
        commonfn.withdrawAsset(runtime, privateInv.account, vestingAppID, vestingAppAddress, assetsToWithdraw, maxWithdrawal, assetId);
        console.log("Done withdrawing");
        totalWithdrawn += assetsToWithdraw;

        syncAccounts();
        investorsAssets = runtime.getAccount(privateInv.address).assets.get(assetId).amount;
        console.log(`New Investors' Asset Holdings: ${investorsAssets}`);

        // verify sale
        assert.equal(investorsAssets, totalWithdrawn); // advisors received assets withdrawn

        // investors withdraws asset for the second time in quick succession
        assetsToWithdraw = 100;
        secsAfterDeployment = 1008;
        roundsAfterDeployment = 224; // 1008 / 4.5 = 224
        setToRounds = contractDeploymentRound + roundsAfterDeployment;
        setToTimeStamp = contractDeploymentTimeStamp + secsAfterDeployment;
        periodsPassed = Math.floor(roundsAfterDeployment / incrementRoundPeriod);

        syncAccounts();
        maxWithdrawal = commonfn.updateMaxWithdrawal("Investors", setToRounds, contractDeploymentRound, cliffRounds, finalRound, 
                privateInvTotalAllocated, totalWithdrawn, periodsPassed);
        investorsAssets = runtime.getAccount(privateInv.address).assets.get(assetId).amount;
        console.log(`Current Investors' Asset Holdings: ${investorsAssets}`);
        commonfn.withdrawAsset(runtime, privateInv.account, vestingAppID, vestingAppAddress, assetsToWithdraw, maxWithdrawal, assetId);
        console.log("Done withdrawing");
        totalWithdrawn += assetsToWithdraw;

        syncAccounts();
        investorsAssets = runtime.getAccount(privateInv.address).assets.get(assetId).amount;
        console.log(`New Investors' Asset Holdings: ${investorsAssets}`);

        // verify sale
        assert.equal(investorsAssets, totalWithdrawn); // advisors received assets withdrawn
    });

    it("Private Investors withdraws assets successfully 2 times (between increments) after cliffing period", () => {
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
                privateInvTotalAllocated, totalWithdrawn, periodsPassed);
        console.log(`Max Withdrawal: ${maxWithdrawal}`)
        let investorsAssets = runtime.getAccount(privateInv.address).assets.get(assetId).amount;
        console.log(`Current Investors' Asset Holdings: ${investorsAssets}`);
        commonfn.withdrawAsset(runtime, privateInv.account, vestingAppID, vestingAppAddress, assetsToWithdraw, maxWithdrawal, assetId);
        console.log("Done withdrawing");
        totalWithdrawn += assetsToWithdraw;

        syncAccounts();
        investorsAssets = runtime.getAccount(privateInv.address).assets.get(assetId).amount;
        console.log(`New Investors' Asset Holdings: ${investorsAssets}`);

        // verify sale
        assert.equal(investorsAssets, totalWithdrawn); // advisors received assets withdrawn

        // investors withdraws asset for the second time in another increment period
        assetsToWithdraw = 100;
        secsAfterDeployment = 1107;
        roundsAfterDeployment = 246; // 1107 / 4.5 = 246
        setToRounds = contractDeploymentRound + roundsAfterDeployment;
        setToTimeStamp = contractDeploymentTimeStamp + secsAfterDeployment;
        periodsPassed = Math.floor(roundsAfterDeployment / incrementRoundPeriod);
        runtime.setRoundAndTimestamp(setToRounds, setToTimeStamp);

        syncAccounts();
        maxWithdrawal = commonfn.updateMaxWithdrawal("Investors", setToRounds, contractDeploymentRound, cliffRounds, finalRound, 
                privateInvTotalAllocated, totalWithdrawn, periodsPassed);
        console.log(`Max Withdrawal: ${maxWithdrawal}`)
        investorsAssets = runtime.getAccount(privateInv.address).assets.get(assetId).amount;
        console.log(`Current Investors' Asset Holdings: ${investorsAssets}`);
        commonfn.withdrawAsset(runtime, privateInv.account, vestingAppID, vestingAppAddress, assetsToWithdraw, maxWithdrawal, assetId);
        console.log("Done withdrawing");
        totalWithdrawn += assetsToWithdraw;

        syncAccounts();
        investorsAssets = runtime.getAccount(privateInv.address).assets.get(assetId).amount;
        console.log(`New Investors' Asset Holdings: ${investorsAssets}`);

        // verify sale
        assert.equal(investorsAssets, totalWithdrawn); // advisors received assets withdrawn
    });

    it("Private Investors withdraws assets successfully after vesting period", () => {
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

        // set block rounds to be after vesting period
        let assetsToWithdraw = 100;
        let secsAfterDeployment = 9999;
        let roundsAfterDeployment = 2222; // 9999 / 4.5 = 2222
        let setToRounds = contractDeploymentRound + roundsAfterDeployment;
        let setToTimeStamp = contractDeploymentTimeStamp + secsAfterDeployment;
        let periodsPassed = Math.floor(roundsAfterDeployment / incrementRoundPeriod);
        runtime.setRoundAndTimestamp(setToRounds, setToTimeStamp);

        // investors withdraws asset for the first time
        let maxWithdrawal = commonfn.updateMaxWithdrawal("Investors", setToRounds, contractDeploymentRound, cliffRounds, finalRound, 
                privateInvTotalAllocated, totalWithdrawn, periodsPassed);
        let investorsAssets = runtime.getAccount(privateInv.address).assets.get(assetId).amount;
        console.log(`Current Investors' Asset Holdings: ${investorsAssets}`);
        commonfn.withdrawAsset(runtime, privateInv.account, vestingAppID, vestingAppAddress, assetsToWithdraw, maxWithdrawal, assetId);
        console.log("Done withdrawing");
        totalWithdrawn += assetsToWithdraw;

        syncAccounts();
        investorsAssets = runtime.getAccount(privateInv.address).assets.get(assetId).amount;
        console.log(`New Investors' Asset Holdings: ${investorsAssets}`);

        // verify sale
        assert.equal(investorsAssets, totalWithdrawn); // advisors received assets withdrawn
    });

    it("Private Investors withdraws assets successfully once during vesting period and another time after vesting period", () => {
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
                privateInvTotalAllocated, totalWithdrawn, periodsPassed);
        let investorsAssets = runtime.getAccount(privateInv.address).assets.get(assetId).amount;
        console.log(`Current Investors' Asset Holdings: ${investorsAssets}`);
        commonfn.withdrawAsset(runtime, privateInv.account, vestingAppID, vestingAppAddress, assetsToWithdraw, maxWithdrawal, assetId);
        console.log("Done withdrawing");
        totalWithdrawn += assetsToWithdraw;

        syncAccounts();
        investorsAssets = runtime.getAccount(privateInv.address).assets.get(assetId).amount;
        console.log(`New Investors' Asset Holdings: ${investorsAssets}`);

        // verify sale
        assert.equal(investorsAssets, totalWithdrawn); // advisors received assets withdrawn

        // investors withdraws asset for the second time after vesting period
        assetsToWithdraw = 100;
        secsAfterDeployment = 9999;
        roundsAfterDeployment = 2222; // 9999 / 4.5 = 2222
        setToRounds = contractDeploymentRound + roundsAfterDeployment;
        setToTimeStamp = contractDeploymentTimeStamp + secsAfterDeployment;
        periodsPassed = Math.floor(roundsAfterDeployment / incrementRoundPeriod);
        runtime.setRoundAndTimestamp(setToRounds, setToTimeStamp);

        // investors withdraws asset for the first time
        maxWithdrawal = commonfn.updateMaxWithdrawal("Investors", setToRounds, contractDeploymentRound, cliffRounds, finalRound, 
                privateInvTotalAllocated, totalWithdrawn, periodsPassed);
        investorsAssets = runtime.getAccount(privateInv.address).assets.get(assetId).amount;
        console.log(`Current Investors' Asset Holdings: ${investorsAssets}`);
        commonfn.withdrawAsset(runtime, privateInv.account, vestingAppID, vestingAppAddress, assetsToWithdraw, maxWithdrawal, assetId);
        totalWithdrawn += assetsToWithdraw;

        syncAccounts();
        investorsAssets = runtime.getAccount(privateInv.address).assets.get(assetId).amount;
        console.log(`New Investors' Asset Holdings: ${investorsAssets}`);

        // verify sale
        assert.equal(investorsAssets, totalWithdrawn); // advisors received assets withdrawn
    });

    it("Private Investors withdraws assets successfully two times, both after vesting period", () => {
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

        // investors withdraws asset for the first time after vesting period
        let assetsToWithdraw = 100;
        let secsAfterDeployment = 9999;
        let roundsAfterDeployment = 2222; // 9999 / 4.5 = 2222
        let setToRounds = contractDeploymentRound + roundsAfterDeployment;
        let setToTimeStamp = contractDeploymentTimeStamp + secsAfterDeployment;
        let periodsPassed = Math.floor(roundsAfterDeployment / incrementRoundPeriod);
        runtime.setRoundAndTimestamp(setToRounds, setToTimeStamp);

        // investors withdraws asset for the first time
        let maxWithdrawal = commonfn.updateMaxWithdrawal("Investors", setToRounds, contractDeploymentRound, cliffRounds, finalRound, 
                privateInvTotalAllocated, totalWithdrawn, periodsPassed);
        let investorsAssets = runtime.getAccount(privateInv.address).assets.get(assetId).amount;
        console.log(`Current Investors' Asset Holdings: ${investorsAssets}`);
        commonfn.withdrawAsset(runtime, privateInv.account, vestingAppID, vestingAppAddress, assetsToWithdraw, maxWithdrawal, assetId);
        console.log("Done withdrawing");
        totalWithdrawn += assetsToWithdraw;

        syncAccounts();
        investorsAssets = runtime.getAccount(privateInv.address).assets.get(assetId).amount;
        console.log(`New Investors' Asset Holdings: ${investorsAssets}`);

        // verify sale
        assert.equal(investorsAssets, totalWithdrawn); // advisors received assets withdrawn

        // investors withdraws asset for the second time after vesting period
        assetsToWithdraw = 100;
        secsAfterDeployment = 10998;
        roundsAfterDeployment = 2444; // 10998 / 4.5 = 2444
        setToRounds = contractDeploymentRound + roundsAfterDeployment;
        setToTimeStamp = contractDeploymentTimeStamp + secsAfterDeployment;
        periodsPassed = Math.floor(roundsAfterDeployment / incrementRoundPeriod);
        runtime.setRoundAndTimestamp(setToRounds, setToTimeStamp);

        // investors withdraws asset for the first time
        maxWithdrawal = commonfn.updateMaxWithdrawal("Investors", setToRounds, contractDeploymentRound, cliffRounds, finalRound, 
                privateInvTotalAllocated, totalWithdrawn, periodsPassed);
        investorsAssets = runtime.getAccount(privateInv.address).assets.get(assetId).amount;
        console.log(`Current Investors' Asset Holdings: ${investorsAssets}`);
        commonfn.withdrawAsset(runtime, privateInv.account, vestingAppID, vestingAppAddress, assetsToWithdraw, maxWithdrawal, assetId);
        console.log("Done withdrawing");
        totalWithdrawn += assetsToWithdraw;

        syncAccounts();
        investorsAssets = runtime.getAccount(privateInv.address).assets.get(assetId).amount;
        console.log(`New Investors' Asset Holdings: ${investorsAssets}`);

        // verify sale
        assert.equal(investorsAssets, totalWithdrawn); // advisors received assets withdrawn
    });
});
