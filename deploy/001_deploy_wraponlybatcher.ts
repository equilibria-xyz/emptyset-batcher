import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { getContracts } from '../test/integration/constant'
import { WrapOnlyBatcher, WrapOnlyBatcher__factory } from '../types/generated'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre
  const { deploy, get, getNetworkName } = deployments
  const { deployer } = await getNamedAccounts()
  const deployerSigner: SignerWithAddress = await ethers.getSigner(deployer)
  const networkName = getNetworkName()
  const contracts = getContracts(networkName)
  if (contracts == null) {
    throw `Unsupported network: ${networkName}`
  }

  await deploy('WrapOnlyBatcher', {
    from: deployer,
    args: [contracts.RESERVE, contracts.DSU, contracts.USDC],
    gasLimit: 2000000,
    skipIfAlreadyDeployed: true,
    log: true,
    autoMine: true,
  })

  const wrapOnlyBatcher: WrapOnlyBatcher = new WrapOnlyBatcher__factory(deployerSigner).attach(
    (await get('WrapOnlyBatcher')).address,
  )

  if ((await wrapOnlyBatcher.pendingOwner()) === contracts.TIMELOCK) {
    console.log('WrapOnlyBatcher pending owner already initialized.')
  } else {
    process.stdout.write('initializing WrapOnlyBatcher pending owner... ')
    await (await wrapOnlyBatcher.updatePendingOwner(contracts.TIMELOCK)).wait(2)
    process.stdout.write('complete.\n')
  }
}

export default func
func.tags = ['WrapOnlyBatcher']
