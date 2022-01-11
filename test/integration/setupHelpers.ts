import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import HRE from 'hardhat'
import { BigNumber, utils } from 'ethers'

import { time, impersonate } from '../testutil'
import {
  IERC20Metadata,
  IERC20Metadata__factory,
  IEmptySetReserve__factory,
  IEmptySetReserve,
} from '../../types/generated'

const { config, ethers } = HRE

export const DSU_ADDRESS = '0x605D26FBd5be761089281d5cec2Ce86eeA667109'
export const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
export const C_USDC_ADDRESS = '0x39AA39c021dfbaE8faC545936693aC917d5E7563'
export const RESERVE_ADDRESS = '0xD05aCe63789cCb35B9cE71d01e4d632a0486Da4B'
export const TIMELOCK_ADDRESS = '0x1bba92F379375387bf8F927058da14D47464cB7A'
export const USDC_HOLDER = '0x0A59649758aa4d66E25f08Dd01271e891fe52199'

export interface InstanceVars {
  timelock: SignerWithAddress
  deployer: SignerWithAddress
  user: SignerWithAddress
  reserve: IEmptySetReserve
  dsu: IERC20Metadata
  usdc: IERC20Metadata
  cUsdc: IERC20Metadata
}

export async function deployProtocol(): Promise<InstanceVars> {
  await time.reset(config)
  const [deployer, user] = await ethers.getSigners()

  // Deploy external deps
  const timelock = await impersonate.impersonateWithBalance(TIMELOCK_ADDRESS, utils.parseEther('10'))
  const dsu = await IERC20Metadata__factory.connect(DSU_ADDRESS, deployer)
  const usdc = await IERC20Metadata__factory.connect(USDC_ADDRESS, deployer)
  const cUsdc = await IERC20Metadata__factory.connect(C_USDC_ADDRESS, deployer)
  const reserve = await IEmptySetReserve__factory.connect(RESERVE_ADDRESS, deployer)

  // Set state
  const usdcHolder = await impersonate.impersonateWithBalance(USDC_HOLDER, utils.parseEther('10'))
  await usdc.connect(usdcHolder).approve(reserve.address, 1000000_000_000)
  await reserve.connect(usdcHolder).mint(utils.parseEther('1000000'))

  await dsu.connect(usdcHolder).transfer(user.address, utils.parseEther('1000000'))
  await usdc.connect(usdcHolder).transfer(user.address, 1000000_000_000)

  return {
    timelock,
    deployer,
    user,
    reserve,
    dsu,
    usdc,
    cUsdc,
  }
}
