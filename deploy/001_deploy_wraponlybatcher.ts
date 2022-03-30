import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { getContracts } from '../test/integration/constant'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { deploy, execute, getNetworkName } = deployments
  const { deployer } = await getNamedAccounts()
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

  await execute(
    'WrapOnlyBatcher',
    {
      from: deployer,
      gasLimit: 120000,
      log: true,
      autoMine: true,
    },
    'setPendingOwner',
    contracts.TIMELOCK,
  )
}

export default func
func.tags = ['WrapOnlyBatcher']
