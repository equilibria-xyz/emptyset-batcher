import { utils } from 'ethers'
import { expect } from 'chai'
import HRE from 'hardhat'

import { IEmptySetReserve, IERC20, TwoWayBatcher, TwoWayBatcher__factory } from '../../../types/generated'

import { smock, FakeContract } from '@defi-wonderland/smock'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { nextContractAddress } from '../../testutil/contract'

const { ethers } = HRE

describe('TwoWayBatcher', () => {
  let user: SignerWithAddress
  let owner: SignerWithAddress
  let to: SignerWithAddress
  let usdcLoaner: SignerWithAddress
  let usdcLoaner2: SignerWithAddress
  let reserve: FakeContract<IEmptySetReserve>
  let dsu: FakeContract<IERC20>
  let usdc: FakeContract<IERC20>
  let batcher: TwoWayBatcher

  beforeEach(async () => {
    ;[user, owner, to, usdcLoaner, usdcLoaner2] = await ethers.getSigners()
    reserve = await smock.fake<IEmptySetReserve>('IEmptySetReserve')
    dsu = await smock.fake<IERC20>('IERC20')
    usdc = await smock.fake<IERC20>('IERC20')

    const batcherAddress = await nextContractAddress(owner, 4)
    dsu.allowance.whenCalledWith(batcherAddress, reserve.address).returns(0)
    dsu.approve.whenCalledWith(reserve.address, ethers.constants.MaxUint256).returns(true)
    usdc.allowance.whenCalledWith(batcherAddress, reserve.address).returns(0)
    usdc.approve.whenCalledWith(reserve.address, ethers.constants.MaxUint256).returns(true)

    batcher = await new TwoWayBatcher__factory(owner).deploy(reserve.address, dsu.address, usdc.address)
  })

  describe('#constructor', async () => {
    it('sets reserve', async () => {
      expect(await batcher.RESERVE()).to.equal(reserve.address)
    })

    it('sets dsu', async () => {
      expect(await batcher.DSU()).to.equal(dsu.address)
    })

    it('sets usdc', async () => {
      expect(await batcher.USDC()).to.equal(usdc.address)
    })
  })

  describe('#totalBalance', async () => {
    it('returns sum', async () => {
      dsu.balanceOf.whenCalledWith(batcher.address).returns(utils.parseEther('0'))
      usdc.balanceOf.whenCalledWith(batcher.address).returns(100_000_000)

      expect(await batcher.totalBalance()).to.equal(utils.parseEther('100'))
    })

    it('returns sum', async () => {
      dsu.balanceOf.whenCalledWith(batcher.address).returns(utils.parseEther('100').add(1))
      usdc.balanceOf.whenCalledWith(batcher.address).returns(0)

      expect(await batcher.totalBalance()).to.equal(utils.parseEther('100').add(1))
    })

    it('returns sum', async () => {
      dsu.balanceOf.whenCalledWith(batcher.address).returns(utils.parseEther('100').add(1))
      usdc.balanceOf.whenCalledWith(batcher.address).returns(100_000_000)

      expect(await batcher.totalBalance()).to.equal(utils.parseEther('200').add(1))
    })
  })

  describe('#totalBalance', async () => {
    it('returns sum', async () => {
      dsu.balanceOf.whenCalledWith(batcher.address).returns(utils.parseEther('0'))
      usdc.balanceOf.whenCalledWith(batcher.address).returns(100_000_000)

      expect(await batcher.totalBalance()).to.equal(utils.parseEther('100'))
    })

    it('returns sum', async () => {
      dsu.balanceOf.whenCalledWith(batcher.address).returns(utils.parseEther('100').add(1))
      usdc.balanceOf.whenCalledWith(batcher.address).returns(0)

      expect(await batcher.totalBalance()).to.equal(utils.parseEther('100').add(1))
    })

    it('returns sum', async () => {
      dsu.balanceOf.whenCalledWith(batcher.address).returns(utils.parseEther('100').add(1))
      usdc.balanceOf.whenCalledWith(batcher.address).returns(100_000_000)

      expect(await batcher.totalBalance()).to.equal(utils.parseEther('200').add(1))
    })
  })

  describe('loanUSDC', async () => {
    it('loans token exact', async () => {
      usdc.transferFrom.whenCalledWith(usdcLoaner.address, batcher.address, 100_000_000).returns(true)

      await expect(batcher.connect(usdcLoaner).deposit(utils.parseEther('100')))
        .to.emit(batcher, 'Deposit')
        .withArgs(usdcLoaner.address, utils.parseEther('100'))
        .to.emit(batcher, 'Rebalance')

      expect(await batcher.totalSupply()).to.equal(utils.parseEther('100'))
      expect(await batcher.balanceOf(usdcLoaner.address)).to.equal(utils.parseEther('100'))
    })

    it('loans token rounding', async () => {
      await expect(batcher.connect(usdcLoaner).deposit(utils.parseEther('100').add(1)))
        .to.be.revertedWithCustomError(batcher, 'TwoWayBatcherInvalidTokenAmount')
        .withArgs(utils.parseEther('100').add(1))
    })

    it('loans token multiple users', async () => {
      usdc.transferFrom.whenCalledWith(usdcLoaner.address, batcher.address, 100_000_000).returns(true)
      usdc.transferFrom.whenCalledWith(usdcLoaner2.address, batcher.address, 200_000_000).returns(true)

      await expect(batcher.connect(usdcLoaner).deposit(utils.parseEther('100')))
        .to.emit(batcher, 'Deposit')
        .withArgs(usdcLoaner.address, utils.parseEther('100'))
      await expect(batcher.connect(usdcLoaner2).deposit(utils.parseEther('200')))
        .to.emit(batcher, 'Deposit')
        .withArgs(usdcLoaner2.address, utils.parseEther('200'))

      expect(await batcher.totalSupply()).to.equal(utils.parseEther('300'))
      expect(await batcher.balanceOf(usdcLoaner.address)).to.equal(utils.parseEther('100'))
      expect(await batcher.balanceOf(usdcLoaner2.address)).to.equal(utils.parseEther('200'))
    })
  })

  describe('repayUSDC', async () => {
    it('repays token exact', async () => {
      // Loan the amount
      usdc.transferFrom.whenCalledWith(usdcLoaner.address, batcher.address, 100_000_000).returns(true)
      await batcher.connect(usdcLoaner).deposit(utils.parseEther('100'))

      usdc.balanceOf.whenCalledWith(batcher.address).returns(100_000_000)
      usdc.transfer.whenCalledWith(usdcLoaner.address, 100_000_000).returns(true)

      await expect(batcher.connect(usdcLoaner).withdraw(utils.parseEther('100')))
        .to.emit(batcher, 'Withdraw')
        .withArgs(usdcLoaner.address, utils.parseEther('100'))
        .to.emit(batcher, 'Rebalance')

      expect(await batcher.totalSupply()).to.equal(0)
      expect(await batcher.balanceOf(usdcLoaner.address)).to.equal(0)
    })

    it('repays token rounding', async () => {
      await expect(batcher.connect(usdcLoaner).withdraw(utils.parseEther('100').add(1)))
        .to.be.revertedWithCustomError(batcher, 'TwoWayBatcherInvalidTokenAmount')
        .withArgs(utils.parseEther('100').add(1))
    })

    it('repays token partial rounding', async () => {
      await expect(batcher.connect(usdcLoaner).withdraw(utils.parseEther('50').add(1)))
        .to.be.revertedWithCustomError(batcher, 'TwoWayBatcherInvalidTokenAmount')
        .withArgs(utils.parseEther('50').add(1))
    })

    it('repays token multiple users', async () => {
      usdc.transferFrom.whenCalledWith(usdcLoaner.address, batcher.address, 100_000_000).returns(true)
      usdc.transferFrom.whenCalledWith(usdcLoaner2.address, batcher.address, 200_000_000).returns(true)
      await batcher.connect(usdcLoaner).deposit(utils.parseEther('100'))
      await batcher.connect(usdcLoaner2).deposit(utils.parseEther('200'))

      usdc.balanceOf.whenCalledWith(batcher.address).returns(300_000_000)
      usdc.transfer.whenCalledWith(usdcLoaner.address, 100_000_000).returns(true)
      usdc.transfer.whenCalledWith(usdcLoaner2.address, 101_000_000).returns(true)
      await expect(batcher.connect(usdcLoaner).withdraw(utils.parseEther('100')))
        .to.emit(batcher, 'Withdraw')
        .withArgs(usdcLoaner.address, utils.parseEther('100'))
      await expect(batcher.connect(usdcLoaner2).withdraw(utils.parseEther('101')))
        .to.emit(batcher, 'Withdraw')
        .withArgs(usdcLoaner2.address, utils.parseEther('101'))

      expect(await batcher.totalSupply()).to.equal(utils.parseEther('99'))
      expect(await batcher.balanceOf(usdcLoaner.address)).to.equal(0)
      expect(await batcher.balanceOf(usdcLoaner2.address)).to.equal(utils.parseEther('99'))
    })

    it('repays token rebalance required', async () => {
      // Loan the amount
      usdc.transferFrom.whenCalledWith(usdcLoaner.address, batcher.address, 100_000_000).returns(true)
      await batcher.connect(usdcLoaner).deposit(utils.parseEther('100'))

      usdc.balanceOf.whenCalledWith(batcher.address).returns(90_000_000)
      dsu.balanceOf.whenCalledWith(batcher.address).returns(utils.parseEther('100'))

      reserve.redeem.whenCalledWith(utils.parseEther('10')).returns()
      usdc.transfer.whenCalledWith(usdcLoaner.address, 100_000_000).returns(true)

      await expect(batcher.connect(usdcLoaner).withdraw(utils.parseEther('100')))
        .to.emit(batcher, 'Withdraw')
        .withArgs(usdcLoaner.address, utils.parseEther('100'))

      expect(await batcher.totalSupply()).to.equal(0)
      expect(await batcher.balanceOf(usdcLoaner.address)).to.equal(0)
    })

    it('reverts on excess repayment', async () => {
      // Loan the amount
      usdc.transferFrom.whenCalledWith(usdcLoaner.address, batcher.address, 100_000_000).returns(true)
      await batcher.connect(usdcLoaner).deposit(utils.parseEther('100'))

      await expect(batcher.connect(usdcLoaner).deposit(utils.parseEther('100').add(1))).to.be.reverted
    })
  })

  describe('#wrap', async () => {
    it('wraps token exact', async () => {
      dsu.transfer.whenCalledWith(to.address, utils.parseEther('100')).returns(true)
      usdc.transferFrom.whenCalledWith(user.address, batcher.address, 100_000_000).returns(true)

      await expect(batcher.connect(user).wrap(utils.parseEther('100'), to.address))
        .to.emit(batcher, 'Wrap')
        .withArgs(to.address, utils.parseEther('100'))
    })

    it('wraps token rounding', async () => {
      dsu.transfer.whenCalledWith(to.address, utils.parseEther('100').add(1)).returns(true)
      usdc.transferFrom.whenCalledWith(user.address, batcher.address, 100_000_001).returns(true)

      await expect(batcher.connect(user).wrap(utils.parseEther('100').add(1), to.address))
        .to.emit(batcher, 'Wrap')
        .withArgs(to.address, utils.parseEther('100').add(1))
    })
  })

  describe('#unwrap', async () => {
    it('unwraps token exact', async () => {
      usdc.transfer.whenCalledWith(to.address, 100_000_000).returns(true)
      dsu.transferFrom.whenCalledWith(user.address, batcher.address, utils.parseEther('100')).returns(true)

      await expect(batcher.connect(user).unwrap(utils.parseEther('100'), to.address))
        .to.emit(batcher, 'Unwrap')
        .withArgs(to.address, utils.parseEther('100'))
    })

    it('unwraps token rounding', async () => {
      usdc.transfer.whenCalledWith(to.address, 100_000_000).returns(true)
      dsu.transferFrom.whenCalledWith(user.address, batcher.address, utils.parseEther('100').add(1)).returns(true)

      await expect(batcher.connect(user).unwrap(utils.parseEther('100').add(1), to.address))
        .to.emit(batcher, 'Unwrap')
        .withArgs(to.address, utils.parseEther('100').add(1))
    })
  })

  describe('#rebalance', async () => {
    it('rebalances assets', async () => {
      dsu.balanceOf.whenCalledWith(batcher.address).returns(utils.parseEther('100'))
      usdc.balanceOf.whenCalledWith(batcher.address).returns(100_000_000)

      reserve.mint.whenCalledWith(utils.parseEther('100')).returns()

      await expect(batcher.connect(user).rebalance()).to.emit(batcher, 'Rebalance')
    })

    it('rebalances assets rounding', async () => {
      dsu.balanceOf.whenCalledWith(batcher.address).returns(utils.parseEther('100').add(1))
      usdc.balanceOf.whenCalledWith(batcher.address).returns(100_000_000)

      reserve.mint.whenCalledWith(utils.parseEther('100')).returns()

      await expect(batcher.connect(user).rebalance()).to.emit(batcher, 'Rebalance')
    })

    it('rebalances assets zero', async () => {
      dsu.balanceOf.whenCalledWith(batcher.address).returns(utils.parseEther('100'))
      usdc.balanceOf.whenCalledWith(batcher.address).returns(0)

      await expect(batcher.connect(user).rebalance())
    })

    it('rebalances loans oustanding, excess usdc', async () => {
      // Loan the amount
      usdc.transferFrom.whenCalledWith(usdcLoaner.address, batcher.address, 10_000_000).returns(true)
      await batcher.connect(usdcLoaner).deposit(utils.parseEther('10'))

      dsu.balanceOf.whenCalledWith(batcher.address).returns(utils.parseEther('100'))
      usdc.balanceOf.whenCalledWith(batcher.address).returns(110_000_000)

      reserve.mint.whenCalledWith(utils.parseEther('100')).returns()

      await expect(batcher.connect(user).rebalance()).to.emit(batcher, 'Rebalance')
    })

    it('rebalances loans oustanding, lack of usdc', async () => {
      // Loan the amount
      usdc.transferFrom.whenCalledWith(usdcLoaner.address, batcher.address, 10_000_000).returns(true)
      await batcher.connect(usdcLoaner).deposit(utils.parseEther('10'))

      dsu.balanceOf.whenCalledWith(batcher.address).returns(utils.parseEther('100'))
      usdc.balanceOf.whenCalledWith(batcher.address).returns(0)

      reserve.redeem.whenCalledWith(utils.parseEther('10')).returns()

      await expect(batcher.connect(user).rebalance()).to.emit(batcher, 'Rebalance').withArgs(0, 0) // TODO(arjun): fix event args
    })
  })

  describe('#close', async () => {
    it('closes', async () => {
      // Rebalance
      usdc.balanceOf.whenCalledWith(batcher.address).returns(100_000_000)
      reserve.mint.whenCalledWith(utils.parseEther('100')).returns()

      // Get balance and debt
      reserve.debt.whenCalledWith(batcher.address).returns(utils.parseEther('200'))
      dsu.balanceOf.whenCalledWith(batcher.address).returns(utils.parseEther('200'))

      // repay debt and last of balance
      reserve.repay.whenCalledWith(batcher.address, utils.parseEther('200')).returns()
      dsu.transfer.whenCalledWith(reserve.address, utils.parseEther('200')).returns(true)

      await expect(batcher.connect(owner).close()).to.emit(batcher, 'Close').withArgs(utils.parseEther('200'))
    })

    it('closes empty', async () => {
      // Rebalance
      usdc.balanceOf.whenCalledWith(batcher.address).returns(0)

      // Get balance and debt
      reserve.debt.whenCalledWith(batcher.address).returns(utils.parseEther('100'))
      dsu.balanceOf.whenCalledWith(batcher.address).returns(utils.parseEther('100'))

      // repay debt and last of balance
      reserve.repay.whenCalledWith(batcher.address, utils.parseEther('100')).returns()
      dsu.transfer.whenCalledWith(reserve.address, utils.parseEther('100')).returns(true)

      await expect(batcher.connect(owner).close()).to.emit(batcher, 'Close').withArgs(utils.parseEther('100'))
    })

    it('closes rounding', async () => {
      // Rebalance
      usdc.balanceOf.whenCalledWith(batcher.address).returns(100_000_000)
      reserve.mint.whenCalledWith(utils.parseEther('100')).returns()

      // Get balance and debt
      reserve.debt.whenCalledWith(batcher.address).returns(utils.parseEther('200'))
      dsu.balanceOf.whenCalledWith(batcher.address).returns(utils.parseEther('200').add(1))

      // repay debt and last of balance
      reserve.repay.whenCalledWith(batcher.address, utils.parseEther('200')).returns()
      reserve.mint.whenCalledWith(1).returns()
      usdc.transfer.whenCalledWith(owner.address, 0).returns(true)

      await expect(batcher.connect(owner).close()).to.emit(batcher, 'Close').withArgs(utils.parseEther('200').add(1))
    })

    it('closes outstanding loans', async () => {
      // Loan the amount
      usdc.transferFrom.whenCalledWith(usdcLoaner.address, batcher.address, 10_000_000).returns(true)
      await batcher.connect(usdcLoaner).deposit(utils.parseEther('10'))

      // Rebalance - keep 10 USDC to repay loans
      usdc.balanceOf.whenCalledWith(batcher.address).returns(110_000_000)
      reserve.mint.whenCalledWith(utils.parseEther('100')).returns()

      // Get balance and debt
      reserve.debt.whenCalledWith(batcher.address).returns(utils.parseEther('200'))
      dsu.balanceOf.whenCalledWith(batcher.address).returns(utils.parseEther('200'))

      // repay debt and last of balance
      reserve.repay.whenCalledWith(batcher.address, utils.parseEther('200')).returns()
      dsu.transfer.whenCalledWith(reserve.address, utils.parseEther('200')).returns(true)

      await expect(batcher.connect(owner).close()).to.emit(batcher, 'Close').withArgs(utils.parseEther('200'))
    })

    it('closes not owner', async () => {
      await expect(batcher.connect(user).close())
        .to.be.revertedWithCustomError(batcher, 'UOwnableNotOwnerError')
        .withArgs(user.address)
    })
  })
})
