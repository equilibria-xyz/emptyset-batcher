import { reset } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import HRE from 'hardhat'
import { utils, constants, BigNumber } from 'ethers'

import {
  IERC20Metadata,
  IERC20Metadata__factory,
  MockEmptySetReserve,
  MockEmptySetReserve__factory,
  MockTwoWayBatcher,
  MockTwoWayBatcher__factory,
  TwoWayBatcher,
  TwoWayBatcher__factory,
  Wrapper,
  Wrapper__factory,
} from '../../../types/generated'
import { impersonateWithBalance } from '../../testutil/impersonate'
import { getContracts } from '../constant'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { parseEther, parseUnits } from 'ethers/lib/utils'

const { ethers } = HRE

const BATCHER_ADDRESS = '0xAEf566ca7E84d1E736f999765a804687f39D9094'
const RESERVE_ADDRESS = '0xD05aCe63789cCb35B9cE71d01e4d632a0486Da4B'

describe('Wrapper', () => {
  let dsu: IERC20Metadata
  let usdc: IERC20Metadata
  let owner: SignerWithAddress
  let user: SignerWithAddress
  let batcher: TwoWayBatcher
  let wrapper: Wrapper
  let wrapperNoBatcher: Wrapper
  let wrapperInsolvent: Wrapper
  let reserveInsolvent: MockEmptySetReserve
  let batcherInsolvent: MockTwoWayBatcher

  beforeEach(async () => {
    await reset(process.env.MAINNET_NODE_URL || '', 18333333)
    ;[owner, user] = await ethers.getSigners()
    const contracts = getContracts('mainnet')!
    dsu = IERC20Metadata__factory.connect(contracts.DSU, owner)
    usdc = IERC20Metadata__factory.connect(contracts.USDC, owner)

    batcher = TwoWayBatcher__factory.connect(BATCHER_ADDRESS, owner)
    wrapper = await new Wrapper__factory(owner).deploy(RESERVE_ADDRESS, BATCHER_ADDRESS, dsu.address, usdc.address)
    wrapperNoBatcher = await new Wrapper__factory(owner).deploy(
      RESERVE_ADDRESS,
      constants.AddressZero,
      dsu.address,
      usdc.address,
    )

    reserveInsolvent = await new MockEmptySetReserve__factory(owner).deploy(
      dsu.address,
      usdc.address,
      parseEther('0.9'),
      parseEther('0.9'),
    )
    wrapperInsolvent = await new Wrapper__factory(owner).deploy(
      reserveInsolvent.address,
      constants.AddressZero,
      dsu.address,
      usdc.address,
    )
    batcherInsolvent = await new MockTwoWayBatcher__factory(owner).deploy(
      RESERVE_ADDRESS,
      dsu.address,
      usdc.address,
      parseEther('0.9'),
      parseEther('0.9'),
    )
  })

  describe('#constructor', async () => {
    it('sets fields', async () => {
      expect(await wrapper.RESERVE()).to.equal(RESERVE_ADDRESS)
      expect(await wrapper.batcher()).to.equal(BATCHER_ADDRESS)
      expect(await wrapper.DSU()).to.equal(dsu.address)
      expect(await wrapper.USDC()).to.equal(usdc.address)

      expect(await wrapperNoBatcher.RESERVE()).to.equal(RESERVE_ADDRESS)
      expect(await wrapperNoBatcher.batcher()).to.equal(constants.AddressZero)
      expect(await wrapperNoBatcher.DSU()).to.equal(dsu.address)
      expect(await wrapperNoBatcher.USDC()).to.equal(usdc.address)
    })

    it('approves batcher', async () => {
      expect(await dsu.allowance(wrapper.address, BATCHER_ADDRESS)).to.equal(ethers.constants.MaxUint256)
      expect(await usdc.allowance(wrapper.address, BATCHER_ADDRESS)).to.equal(ethers.constants.MaxUint256)
    })
  })

  describe('#setBatcher', async () => {
    let newBatcher: TwoWayBatcher

    beforeEach(async () => {
      newBatcher = await new TwoWayBatcher__factory(owner).deploy(RESERVE_ADDRESS, dsu.address, usdc.address)
    })

    it('sets batcher', async () => {
      await wrapper.setBatcher(newBatcher.address)
      await wrapperNoBatcher.setBatcher(newBatcher.address)
      expect(await wrapper.batcher()).to.equal(newBatcher.address)
      expect(await wrapperNoBatcher.batcher()).to.equal(newBatcher.address)
    })

    it('blocks non-owners from setting batcher', async () => {
      await expect(wrapper.connect(user).setBatcher(newBatcher.address)).to.be.revertedWithCustomError(
        wrapper,
        'UOwnableNotOwnerError',
      )
      await expect(wrapperNoBatcher.connect(user).setBatcher(newBatcher.address)).to.be.revertedWithCustomError(
        wrapperNoBatcher,
        'UOwnableNotOwnerError',
      )
    })
  })

  describe('#wrap', async () => {
    const usdcBalance = '1000'
    const highUsdcBalance = '2000000'
    let usdcHolder: SignerWithAddress
    let originalDsuBalance: BigNumber

    beforeEach(async () => {
      usdcHolder = await impersonateWithBalance(getContracts('mainnet')!.USDC_HOLDER, utils.parseEther('10'))
      await usdc.connect(usdcHolder).transfer(user.address, parseUnits(usdcBalance, 6))
      originalDsuBalance = await dsu.balanceOf(user.address)
    })

    it('wraps with batcher', async () => {
      await usdc.connect(user).transfer(wrapper.address, parseUnits(usdcBalance, 6))
      await expect(wrapper.connect(user).wrap(user.address))
        .to.emit(batcher, 'Wrap')
        .withArgs(wrapper.address, parseEther(usdcBalance))
      expect((await dsu.balanceOf(user.address)).sub(originalDsuBalance)).to.equal(parseEther(usdcBalance))
    })

    it('wraps without batcher (no batcher)', async () => {
      await usdc.connect(user).transfer(wrapperNoBatcher.address, parseUnits(usdcBalance, 6))
      await expect(wrapperNoBatcher.connect(user).wrap(user.address)).to.not.emit(batcher, 'Wrap')
      expect((await dsu.balanceOf(user.address)).sub(originalDsuBalance)).to.equal(parseEther(usdcBalance))
    })

    it('wraps without batcher (fall back)', async () => {
      await usdc.connect(usdcHolder).transfer(user.address, parseUnits(highUsdcBalance, 6))
      await usdc.connect(user).transfer(wrapper.address, parseUnits(highUsdcBalance, 6))
      await expect(wrapper.connect(user).wrap(user.address)).to.not.emit(batcher, 'Wrap')
      expect((await dsu.balanceOf(user.address)).sub(originalDsuBalance)).to.equal(parseEther(highUsdcBalance))
    })

    it('does not wrap if batcher has partial solvency', async () => {
      await wrapperInsolvent.setBatcher(batcherInsolvent.address)

      await usdc.connect(usdcHolder).transfer(wrapperNoBatcher.address, parseUnits('1000', 6))
      await wrapperNoBatcher.wrap(batcherInsolvent.address)

      await usdc.connect(user).transfer(wrapperInsolvent.address, parseUnits('10', 6))
      await expect(wrapperInsolvent.connect(user).wrap(user.address)).to.reverted
    })

    it('does not wrap if reserve has partial solvency', async () => {
      await usdc.connect(usdcHolder).transfer(wrapperNoBatcher.address, parseUnits('1000', 6))
      await wrapperNoBatcher.wrap(reserveInsolvent.address)

      await usdc.connect(user).transfer(wrapperInsolvent.address, parseUnits('10', 6))
      await expect(wrapperInsolvent.connect(user).wrap(user.address)).to.reverted
    })
  })

  describe('#unwrap', async () => {
    const dsuBalance = '1000'
    const highDsuBalance = '2000000'
    let usdcHolder: SignerWithAddress
    let originalUsdcBalance: BigNumber

    beforeEach(async () => {
      usdcHolder = await impersonateWithBalance(getContracts('mainnet')!.USDC_HOLDER, utils.parseEther('10'))
      await usdc.connect(usdcHolder).transfer(wrapperNoBatcher.address, parseUnits(dsuBalance, 6))
      await wrapperNoBatcher.wrap(user.address)
      originalUsdcBalance = await usdc.balanceOf(user.address)
    })

    it('unwraps with batcher', async () => {
      await dsu.connect(user).transfer(wrapper.address, parseEther(dsuBalance))
      await expect(wrapper.connect(user).unwrap(user.address))
        .to.emit(batcher, 'Unwrap')
        .withArgs(wrapper.address, parseEther(dsuBalance))
      expect((await usdc.balanceOf(user.address)).sub(originalUsdcBalance)).to.equal(parseUnits(dsuBalance, 6))
    })

    it('unwraps without batcher (no batcher)', async () => {
      await dsu.connect(user).transfer(wrapperNoBatcher.address, parseEther(dsuBalance))
      await expect(wrapperNoBatcher.connect(user).unwrap(user.address)).to.not.emit(batcher, 'Unwrap')
      expect((await usdc.balanceOf(user.address)).sub(originalUsdcBalance)).to.equal(parseUnits(dsuBalance, 6))
    })

    it('unwraps without batcher (fall back)', async () => {
      await usdc.connect(usdcHolder).transfer(wrapperNoBatcher.address, parseUnits(highDsuBalance, 6))
      await wrapperNoBatcher.wrap(user.address)
      await dsu.connect(user).transfer(wrapperNoBatcher.address, parseEther(highDsuBalance))
      await expect(wrapperNoBatcher.connect(user).unwrap(user.address)).to.not.emit(batcher, 'Unwrap')
      expect((await usdc.balanceOf(user.address)).sub(originalUsdcBalance)).to.equal(parseUnits(highDsuBalance, 6))
    })

    it('does not unwrap if batcher has partial solvency', async () => {
      await wrapperInsolvent.setBatcher(batcherInsolvent.address)

      await usdc.connect(usdcHolder).transfer(batcherInsolvent.address, parseUnits('1000', 6))

      await dsu.connect(user).transfer(wrapperInsolvent.address, parseEther('10'))
      await expect(wrapperInsolvent.connect(user).unwrap(user.address)).to.reverted
    })

    it('does not unwrap if reserve has partial solvency', async () => {
      await usdc.connect(usdcHolder).transfer(reserveInsolvent.address, parseUnits('1000', 6))

      await dsu.connect(user).transfer(wrapperInsolvent.address, parseEther('10'))
      await expect(wrapperInsolvent.connect(user).unwrap(user.address)).to.reverted
    })
  })
})
