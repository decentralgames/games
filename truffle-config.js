
const PrivateKeyProvider = require("truffle-privatekey-provider");
const privateKey = '';

module.exports = {
    compilers: {
        solc: {
            version: "0.7.4",
            settings: {
                optimizer: {
                    enabled: true,
                    runs: 300
                }
            },
        }
    },
    networks: {
        development: {
            host: "127.0.0.1",
            port: 9545,
            network_id: 5777
        },
        matic: {
            provider: () => new PrivateKeyProvider(
                privateKey,
                'https://testnetv3.matic.network'
            ),
            network_id: 15001,
            gasPrice: '0x0',
            confirmations: 2,
            timeoutBlocks: 200,
            skipDryRun: true
        },
        mumbai: {
            provider: () => new PrivateKeyProvider(
                privateKey,
                'https://rpc-mumbai.matic.today'
            ),
            network_id: 80001,
            confirmations: 1,
            timeoutBlocks: 300,
            skipDryRun: true
        },
        maticmain: {
            provider: () => new PrivateKeyProvider(
                privateKey,
                'https://rpc-mainnet.matic.network'
            ),
            network_id: 137,
            confirmations: 1,
            timeoutBlocks: 300,
            skipDryRun: true
        }
    },
    mocha: {
        useColors: true,
        reporter: "eth-gas-reporter",
        reporterOptions: {
            currency: "USD",
            gasPrice: 10
        }
    }
};
