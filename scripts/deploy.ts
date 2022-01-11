import { WrapOnlyBatcher, WrapOnlyBatcher__factory } from '../types/generated'

const DSU_ADDRESS = '0x605D26FBd5be761089281d5cec2Ce86eeA667109'
const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const RESERVE_ADDRESS = '0xD05aCe63789cCb35B9cE71d01e4d632a0486Da4B'
const TIMELOCK_ADDRESS = '0x1bba92F379375387bf8F927058da14D47464cB7A'

async function main(): Promise<void> {
  const wrapOnlyBatcher: WrapOnlyBatcher = await new WrapOnlyBatcher__factory().deploy(
    RESERVE_ADDRESS,
    DSU_ADDRESS,
    USDC_ADDRESS,
  )
  await wrapOnlyBatcher.deployed()
  console.log('WrapOnlyBatcher deployed to: ', wrapOnlyBatcher.address)

  await wrapOnlyBatcher.setPendingOwner(TIMELOCK_ADDRESS)
  console.log('WrapOnlyBatcher set pending owner: ', TIMELOCK_ADDRESS)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error)
    process.exit(1)
  })
