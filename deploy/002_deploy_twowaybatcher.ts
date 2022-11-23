import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { getContracts } from '../test/integration/constant'
import { TwoWayBatcher__factory } from '../types/generated'

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

  await deploy('TwoWayBatcher', {
    from: deployer,
    args: [contracts.RESERVE, contracts.DSU, contracts.USDC],
    skipIfAlreadyDeployed: true,
    log: true,
    autoMine: true,
  })

  const twoWayBatcher = new TwoWayBatcher__factory(deployerSigner).attach((await get('TwoWayBatcher')).address)

  if ((await twoWayBatcher.pendingOwner()) === contracts.TIMELOCK) {
    console.log('TwoWayBatcher pending owner already initialized.')
  } else {
    process.stdout.write('initializing TwoWayBatcher pending owner... ')
    await (await twoWayBatcher.updatePendingOwner(contracts.TIMELOCK)).wait(2)
    process.stdout.write('complete.\n')
  }
}

export default func
func.tags = ['TwoWayBatcher']
