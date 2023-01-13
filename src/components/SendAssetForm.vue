<template>
    <div id="withdrawasset" class="mb-5">
        <h3>Withdraw Assets</h3>
        <p>You are allocated a total of {{ this.total_allocated }} VACoins</p>
        <div
            v-if="this.acsTxId !== ''"
            class="alert alert-success"
            role="alert"
        >
            Txn Ref:
            <a :href="explorerURL" target="_blank">{{ this.acsTxId }}</a>
        </div>
        <p>Maximum Withdrawable VACoins: {{ this.max_withdrawal}}</p>
        <form
            action="#"
            @submit.prevent="handleWithdrawAsset"
        >
            <div class="mb-3">
                <label for="asset_amount" class="form-label"
                    >Withdraw amount</label
                >
                <input
                    type="number"
                    class="form-control"
                    id="asset_amount"
                    v-model="asset_amount" placeholder="Input amount to withdraw"
                />
            </div>
            <button type="submit" class="btn btn-primary">Withdraw</button>
        </form>
    </div>
</template>

<script>
import * as helpers from '../helpers';
import asset from "../artifacts/0-deploy-vesting.js.cp.yaml";
import { getAlgodClient } from "../client.js";

export default {
    props: {
        connection: String,
        network: String,
        sender: String,
        stakeholder: String,
    },
    data() {
        return {
            acsTxId: "",
            total_allocated: 0, // constant value
            max_withdrawal: 0, 
            asset_amount: 0, 
            explorerURL: "",
            appAddr: asset.default.metadata.vestingAppAddress,
            appId: asset.default.metadata.vestingAppID,
            assetId: asset.default.asa.VACoin.assetIndex,
            creator: process.env.APP_CREATOR_ADDR
        };
    },
    methods: {
        async updateTxn(value) {
            this.acsTxId = value;
            this.explorerURL = helpers.getExplorerURL(this.acsTxId, this.network);
        },
        async handleWithdrawAsset() {
            // write code here

            console.log("Opting Stakeholder into Asset...");
            await this.doAssetOptIn(this.sender, this.assetId);
            console.log("Withdrawing Asset...");
            
            const response = await helpers.withdrawAsset(
                this.sender,
                this.appId,
                this.assetId,
                this.asset_amount,
                this.max_withdrawal,
                this.network
            );

            if (response !== undefined) {
                this.acsTxId = response.txId;
                this.setExplorerURL(response.txId);
                this.max_withdrawal -= this.asset_amount;
            }
        },

        async doAssetOptIn(receiver, assetId) {
            // clear notification
            this.acsTxId = "";

            // do asset opt in if receiver hasn't opted in to receive asset
            const receiverInfo = await helpers.getAccountInfo(
                receiver,
                this.network
            );
            const optedInAsset = receiverInfo.assets.find((asset) => {
                return asset["asset-id"] === assetId;
            });

            let optedIn = false;
            if (optedInAsset === undefined) {
                const optInResponse = await helpers.assetOptIn(
                    receiver,
                    assetId,
                    this.network
                );
                if (optInResponse.txId !== undefined) {
                    optedIn = true;
                }
            } else {
                optedIn = true;
            }

            if (!optedIn) {
                console.error("Receiver hasn't opted in to receive the asset.");
            }
        },

        async readGlobalState(appId, network) {
            const app = await getAlgodClient(network).getApplicationByID(appId).do();
            
            // global state is a key value array
            const globalState = app.params["global-state"];
            const formattedGlobalState = globalState.map(item => {
                // decode from base64 and utf8
                const formattedKey = decodeURIComponent(Buffer.from(item.key, "base64"));
            
                let formattedValue;
                if (item.value.type === 1) {
                    formattedValue = item.value.bytes;
                } else {
                    formattedValue = item.value.uint;
                }
                
                return {
                    key: formattedKey,
                    value: formattedValue
                }
            });
            let result = new Map(formattedGlobalState.map(i => [i.key, i.value]));

            console.log(result);
            return result;
        },

        async getTotalAllocated(stakeholder) {
            let globalState = (await this.readGlobalState(this.appId, this.network));
            let key = `${stakeholder} Allocated Tokens`;
            return globalState.get(key);
        },

        setExplorerURL(txId) {
            switch (this.network) {
                case "TestNet":
                    this.explorerURL =
                        "https://testnet.algoexplorer.io/tx/" + txId;
                    break;
                default:
                    this.explorerURL =
                        "http://localhost:8980/v2/transactions/" +
                        txId +
                        "?pretty";
                    break;
            }
        },
    },

    async mounted() {
        let total_allocated = await this.getTotalAllocated(this.stakeholder);
        this.total_allocated = total_allocated;

        const algodClient = getAlgodClient(this.network);
        const status = await algodClient.status().do();
        console.log(status);
        let deployedRound = (await this.readGlobalState(this.appId, this.network)).get("Initial Round");
        console.log(`DeployedRound: ${deployedRound}`);
        let finalRound = (await this.readGlobalState(this.appId, this.network)).get("Final Round");
        console.log(`FinalRound: ${finalRound}`);
        let currentRound = status['last-round'];
        console.log(`CurrentRound: ${currentRound}`);
        let totalWithdrawn = (await this.readGlobalState(this.appId, this.network)).get(`Amount ${this.stakeholder} Withdrawn`);
        const incrementRoundPeriod = 13;
        let cliffRounds = 160;
        let periodsPassed = Math.floor((currentRound - deployedRound) / incrementRoundPeriod);
        let max_withdrawal = helpers.updateMaxWithdrawal(this.stakeholder, currentRound, deployedRound, cliffRounds, 
                finalRound, total_allocated, totalWithdrawn, periodsPassed);
        console.log(`Max Withdrawal: ${max_withdrawal}`);
        this.max_withdrawal = max_withdrawal;
    },
};
</script>
