export interface Contracts {
  DSU: string
  USDC: string
  C_USDC: string
  RESERVE: string
  TIMELOCK: string
  USDC_HOLDER: string
}

export function getContracts(networkName: string): Contracts | null {
  switch (networkName) {
    case 'mainnet':
    case 'mainnet-fork':
      return {
        DSU: '0x605D26FBd5be761089281d5cec2Ce86eeA667109',
        USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        C_USDC: '0x39AA39c021dfbaE8faC545936693aC917d5E7563',
        RESERVE: '0xD05aCe63789cCb35B9cE71d01e4d632a0486Da4B',
        TIMELOCK: '0x1bba92F379375387bf8F927058da14D47464cB7A',
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
    default:
      return null
  }
}
