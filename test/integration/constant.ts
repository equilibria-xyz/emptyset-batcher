export interface Contracts {
  DSU: string
  USDC: string
  C_USDC: string
  RESERVE: string
  TIMELOCK: string
  USDC_HOLDER: string
}

export function getContracts(networkName: string): Contracts | null {
  const networkNameWithFork =
    networkName === 'localhost' && process.env.FORK_ENABLED === 'true' ? process.env.FORK_NETWORK : networkName
  switch (networkNameWithFork) {
    case 'mainnet':
    case 'mainnet-fork':
      return {
        DSU: '0x605D26FBd5be761089281d5cec2Ce86eeA667109',
        USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        C_USDC: '0x39AA39c021dfbaE8faC545936693aC917d5E7563',
        RESERVE: '0xD05aCe63789cCb35B9cE71d01e4d632a0486Da4B',
        TIMELOCK: '0x13b7A79e050ef2C3fDc858EFD5c066c3655be841',
        USDC_HOLDER: '0x0A59649758aa4d66E25f08Dd01271e891fe52199',
      }
    case 'kovan':
      return {
        DSU: '0x1e7d42D73291A9580F1f9b6483928319CE1c3d75',
        USDC: '0xb7a4F3E9097C08dA09517b5aB877F7a917224ede',
        C_USDC: '0x4a92e71227d294f041bd82dd8f78591b75140d63',
        RESERVE: '0xfacb9bfa5b230A7a4df42a8e8865E74FEe148baA',
        TIMELOCK: '0xf6C02E15187c9b466E81B3aC72cCf32569EB19eD',
        USDC_HOLDER: '0xd04fd1cda37f81bc0b46b5dcadfa00c239191988',
      }
    case 'goerli':
      return {
        DSU: '0x237D7a40d3A28aA5dAAb786570d3d8bf8496e497',
        USDC: '0x07865c6E87B9F70255377e024ace6630C1Eaa37F',
        C_USDC: '0x73506770799Eb04befb5AaE4734e58C2C624F493',
        RESERVE: '0xbdA59A4405AD32cF81887B54ef5e6D5cB2177d52',
        TIMELOCK: '0x68F863106ceAD8f615eE023C681aB8eE43e98B9d',
        USDC_HOLDER: '0x797c7ab9a2a29089b643e0b97d70fab7d2a07ddd',
      }
    default:
      return null
  }
}
