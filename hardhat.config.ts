import { task } from 'hardhat/config'

import { config as dotenvConfig } from 'dotenv'
import { resolve } from 'path'
dotenvConfig({ path: resolve(__dirname, './.env') })

import { HardhatUserConfig } from 'hardhat/types'
import { NetworkUserConfig } from 'hardhat/types'

import '@typechain/hardhat'
import '@nomiclabs/hardhat-ethers'
import '@nomicfoundation/hardhat-chai-matchers'
import '@nomiclabs/hardhat-etherscan'
import 'solidity-coverage'
import 'hardhat-gas-reporter'
import 'hardhat-deploy'
import 'hardhat-contract-sizer'

const chainIds = {
  ganache: 1337,
  goerli: 5,
  hardhat: 31337,
  kovan: 42,
  mainnet: 1,
  rinkeby: 4,
  ropsten: 3,
}

const PRIVATE_KEY = process.env.PRIVATE_KEY || ''
const PRIVATE_KEY_TESTNET = process.env.PRIVATE_KEY_TESTNET || ''
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || ''
const MAINNET_NODE_URL = process.env.MAINNET_NODE_URL || ''
const GOERLI_NODE_URL = process.env.GOERLI_NODE_URL || ''
const FORK_ENABLED = process.env.FORK_ENABLED === 'true' || false
const FORK_NETWORK = process.env.FORK_NETWORK || 'mainnet'
const NODE_INTERVAL_MINING = process.env.NODE_INTERVAL_MINING ? parseInt(process.env.NODE_INTERVAL_MINING) : undefined
const OPTIMIZER_ENABLED = process.env.OPTIMIZER_ENABLED === 'true' || false

function getUrl(networkName: string): string {
  switch (networkName) {
    case 'mainnet':
    case 'mainnet-fork':
      return MAINNET_NODE_URL
    case 'goerli':
      return GOERLI_NODE_URL
    default:
      return ''
  }
}

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task('accounts', 'Prints the list of accounts', async (args, hre) => {
  const accounts = await hre.ethers.getSigners()

  for (const account of accounts) {
    console.log(await account.address)
  }
})

function createTestnetConfig(network: keyof typeof chainIds): NetworkUserConfig {
  return {
    accounts: PRIVATE_KEY_TESTNET ? [PRIVATE_KEY_TESTNET] : [],
    chainId: chainIds[network],
    url: getUrl(network),
  }
}

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      forking: {
        url: getUrl(FORK_NETWORK),
        enabled: FORK_ENABLED,
        blockNumber: 15970190,
      },
      chainId: chainIds.hardhat,
      mining: NODE_INTERVAL_MINING
        ? {
            interval: NODE_INTERVAL_MINING,
          }
        : undefined,
    },
    goerli: createTestnetConfig('goerli'),
    kovan: createTestnetConfig('kovan'),
    rinkeby: createTestnetConfig('rinkeby'),
    ropsten: createTestnetConfig('ropsten'),
    mainnet: {
      chainId: chainIds.mainnet,
      url: getUrl('mainnet'),
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
  namedAccounts: {
    deployer: 0,
  },
  solidity: {
    compilers: [
      {
        version: '0.8.17',
        settings: {
          optimizer: {
            enabled: OPTIMIZER_ENABLED,
            runs: 1000000, // Max allowed by Etherscan verify
          },
          outputSelection: {
            '*': {
              '*': ['storageLayout'],
            },
          },
        },
      },
    ],
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
  gasReporter: {
    currency: 'USD',
    gasPrice: 100,
    enabled: process.env.REPORT_GAS ? true : false,
  },
  typechain: {
    outDir: 'types/generated',
    target: 'ethers-v5',
    externalArtifacts: ['external/contracts/*.json', 'external/deployments/**/*.json'],
  },
  external: {
    contracts: [{ artifacts: 'external/contracts' }],
    deployments: {
      mainnet: ['external/deployments/mainnet'],
      ropsten: ['external/deployments/ropsten'],
      ganache: ['external/deployments/ganache'],
      hardhat: [FORK_ENABLED ? 'external/deployments/mainnet' : ''],
      localhost: [FORK_ENABLED ? `external/deployments/${FORK_NETWORK}` : ''],
    },
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: false,
  },
}

export default config
