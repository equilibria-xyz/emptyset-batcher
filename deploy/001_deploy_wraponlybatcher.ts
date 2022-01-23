import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { TIMELOCK_ADDRESS, DSU_ADDRESS, RESERVE_ADDRESS, USDC_ADDRESS } from '../test/integration/setupHelpers'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { deploy, execute } = deployments
  const { deployer } = await getNamedAccounts()

  await deploy('WrapOnlyBatcher', {
    from: deployer,
    args: [RESERVE_ADDRESS, DSU_ADDRESS, USDC_ADDRESS],
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
    TIMELOCK_ADDRESS,
  )
}

export default func
func.tags = ['WrapOnlyBatcher']
