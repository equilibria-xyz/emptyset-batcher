import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import HRE from 'hardhat'
import { utils } from 'ethers'

import { time, impersonate } from '../testutil'
import {
  IERC20Metadata,
  IERC20Metadata__factory,
  EmptySetReserve,
  EmptySetReserve__factory,
} from '../../types/generated'
import { getContracts } from './constant'

const { config, ethers } = HRE

export interface InstanceVars {
  timelock: SignerWithAddress
  deployer: SignerWithAddress
  user: SignerWithAddress
  user2: SignerWithAddress
  usdcHolder: SignerWithAddress
  reserve: EmptySetReserve
  dsu: IERC20Metadata
  usdc: IERC20Metadata
  cUsdc: IERC20Metadata
}

export async function deployProtocol(): Promise<InstanceVars> {
  await time.reset(config)
  const [deployer, user, user2] = await ethers.getSigners()
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const contracts = getContracts('mainnet')!

  // Deploy external deps
  const timelock = await impersonate.impersonateWithBalance(contracts.TIMELOCK, utils.parseEther('10'))
  const dsu = await IERC20Metadata__factory.connect(contracts.DSU, deployer)
  const usdc = await IERC20Metadata__factory.connect(contracts.USDC, deployer)
  const cUsdc = await IERC20Metadata__factory.connect(contracts.C_USDC, deployer)
  const reserve = await EmptySetReserve__factory.connect(contracts.RESERVE, deployer)

  // Set state
  const usdcHolder = await impersonate.impersonateWithBalance(contracts.USDC_HOLDER, utils.parseEther('10'))
  await usdc.connect(usdcHolder).approve(reserve.address, 1_000_000_000_000)
  await reserve.connect(usdcHolder).mint(utils.parseEther('1000000'))

  await usdc.connect(usdcHolder).transfer(user.address, 1_000_000_000_000)
  await usdc.connect(usdcHolder).transfer(user2.address, 1_000_000_000_000)

  return {
    timelock,
    deployer,
    user,
    user2,
    usdcHolder,
    reserve,
    dsu,
    usdc,
    cUsdc,
  }
}
