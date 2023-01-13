<template>
    <div>
        <NavBar
            :sender="sender"
            :network="network"
            :connection="this.connection"
            @setNetwork="setNetwork"
            @disconnectWallet="disconnectWallet"
            @changeAccount="changeAccount"
            @connectMyAlgo="connectMyAlgo"
            @connectToAlgoSigner="connectToAlgoSigner"
            @connectToWalletConnect="connectToWalletConnect"
            @connectTeam="connectTeam"
            @connectAdvisors="connectAdvisors"
            @connectPrivateInv="connectPrivateInv"
            @connectReserves="connectReserves"
        />
        <div id="home" class="container-sm mt-5">
            <send-asset-form
                v-if="this.sender !== ''"
                :connection="this.connection"
                :network="this.network"
                :sender="this.sender"
                :stakeholder="this.stakeholder"
            />
        </div>
    </div>
</template>

<script>
import MyAlgoConnect from "@randlabs/myalgo-connect";
import WalletConnect from "@walletconnect/client";
import QRCodeModal from "@walletconnect/qrcode-modal";

export default {
    data() {
        return {
            connection: "", // myalgo | walletconnect | algosigner
            connector: null, // wallet connector obj
            network: "Localhost", // Localhost | TestNet
            sender: "", // connected account address
            stakeholder: "", // stakeholder type
        };
    },
    methods: {
        setNetwork(network) {
            this.disconnectWallet();
            this.network = network;
        },
        disconnectWallet() {
            this.connection = ""; 
            this.connector = null;
            this.sender = "";
        },
        changeAccount() {
            this.sender = "";
        },
        async connectMyAlgo() {
            try {
                // force connection to TestNet
                this.network = "TestNet";

                const myAlgoWallet = new MyAlgoConnect();
                const accounts = await myAlgoWallet.connect();
                this.sender = accounts[0].address;
                this.connection = "myalgo";
            } catch (err) {
                console.error(err);
            }
        },
        async connectToAlgoSigner() {
            const AlgoSigner = window.AlgoSigner;

            if (typeof AlgoSigner !== "undefined") {
                await AlgoSigner.connect();

                this.connection = "algosigner";
            }
        },
        async connectTeam() {
            const AlgoSigner = window.AlgoSigner;
            const accounts = await AlgoSigner.accounts({
                ledger: this.network,
            });

            if (this.network === "Localhost") {
                this.sender = accounts[3].address;
            } else {
                this.sender = accounts[0].address;
            }
            this.stakeholder = "Team";
        },
        async connectAdvisors() {
            const AlgoSigner = window.AlgoSigner;
            const accounts = await AlgoSigner.accounts({
                ledger: this.network,
            });

            if (this.network === "Localhost") {
                this.sender = accounts[1].address;
            } else {
                this.sender = accounts[0].address;
            }
            this.stakeholder = "Advisors";
        },
        async connectPrivateInv() {
            const AlgoSigner = window.AlgoSigner;
            const accounts = await AlgoSigner.accounts({
                ledger: this.network,
            });

            if (this.network === "Localhost") {
                this.sender = accounts[2].address;
            } else {
                this.sender = accounts[0].address;
            }
            this.stakeholder = "Investors";
        },
        async connectReserves() {
            const AlgoSigner = window.AlgoSigner;
            const accounts = await AlgoSigner.accounts({
                ledger: this.network,
            });

            this.sender = accounts[0].address;
            this.stakeholder = "Reserves";
        },
        async connectToWalletConnect() {
            // force connection to TestNet
            this.network = "TestNet";

            // Create a connector
            this.connector = new WalletConnect({
                bridge: "https://bridge.walletconnect.org", // Required
                qrcodeModal: QRCodeModal,
            });

            // Kill existing session
            if (this.connector.connected) {
                await this.connector.killSession();
            }

            this.connector.createSession();

            // Subscribe to connection events
            this.connector.on("connect", (error, payload) => {
                if (error) {
                    throw error;
                }

                const { accounts } = payload.params[0];
                this.sender = accounts[0];
                this.connection = "walletconnect";
            });

            this.connector.on("session_update", (error, payload) => {
                if (error) {
                    throw error;
                }

                const { accounts } = payload.params[0];
                this.sender = accounts[0];
                this.connection = "walletconnect";
            });

            this.connector.on("disconnect", (error, payload) => {
                if (error) {
                    throw error;
                }

                // Delete connector
                console.log(payload);
                this.sender = "";
                this.connection = "";
            });
        },
    },
};
</script>
