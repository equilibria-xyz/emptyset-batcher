import { utils } from 'ethers'
import { expect } from 'chai'
import HRE, { waffle } from 'hardhat'

import {
  IEmptySetReserve__factory,
  IERC20__factory,
  TwoWayBatcher,
  TwoWayBatcher__factory,
} from '../../../types/generated'

import { MockContract } from '@ethereum-waffle/mock-contract'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { nextContractAddress } from '../../testutil/contract'

const { ethers } = HRE

describe('TwoWayBatcher', () => {
  let user: SignerWithAddress
  let owner: SignerWithAddress
  let to: SignerWithAddress
  let usdcLoaner: SignerWithAddress
  let usdcLoaner2: SignerWithAddress
  let reserve: MockContract
  let dsu: MockContract
  let usdc: MockContract
  let batcher: TwoWayBatcher

  beforeEach(async () => {
    ;[user, owner, to, usdcLoaner, usdcLoaner2] = await ethers.getSigners()
    reserve = await waffle.deployMockContract(owner, IEmptySetReserve__factory.abi)
    dsu = await waffle.deployMockContract(owner, IERC20__factory.abi)
    usdc = await waffle.deployMockContract(owner, IERC20__factory.abi)

    const batcherAddress = await nextContractAddress(owner, 4)
    await dsu.mock.allowance.withArgs(batcherAddress, reserve.address).returns(0)
    await dsu.mock.approve.withArgs(reserve.address, ethers.constants.MaxUint256).returns(true)
    await usdc.mock.allowance.withArgs(batcherAddress, reserve.address).returns(0)
    await usdc.mock.approve.withArgs(reserve.address, ethers.constants.MaxUint256).returns(true)

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
      await dsu.mock.balanceOf.withArgs(batcher.address).returns(utils.parseEther('0'))
      await usdc.mock.balanceOf.withArgs(batcher.address).returns(100_000_000)

      expect(await batcher.totalBalance()).to.equal(utils.parseEther('100'))
    })

    it('returns sum', async () => {
      await dsu.mock.balanceOf.withArgs(batcher.address).returns(utils.parseEther('100').add(1))
      await usdc.mock.balanceOf.withArgs(batcher.address).returns(0)

      expect(await batcher.totalBalance()).to.equal(utils.parseEther('100').add(1))
    })

    it('returns sum', async () => {
      await dsu.mock.balanceOf.withArgs(batcher.address).returns(utils.parseEther('100').add(1))
      await usdc.mock.balanceOf.withArgs(batcher.address).returns(100_000_000)

      expect(await batcher.totalBalance()).to.equal(utils.parseEther('200').add(1))
    })
  })

  describe('#totalBalance', async () => {
    it('returns sum', async () => {
      await dsu.mock.balanceOf.withArgs(batcher.address).returns(utils.parseEther('0'))
      await usdc.mock.balanceOf.withArgs(batcher.address).returns(100_000_000)

      expect(await batcher.totalBalance()).to.equal(utils.parseEther('100'))
    })

    it('returns sum', async () => {
      await dsu.mock.balanceOf.withArgs(batcher.address).returns(utils.parseEther('100').add(1))
      await usdc.mock.balanceOf.withArgs(batcher.address).returns(0)

      expect(await batcher.totalBalance()).to.equal(utils.parseEther('100').add(1))
    })

    it('returns sum', async () => {
      await dsu.mock.balanceOf.withArgs(batcher.address).returns(utils.parseEther('100').add(1))
      await usdc.mock.balanceOf.withArgs(batcher.address).returns(100_000_000)

      expect(await batcher.totalBalance()).to.equal(utils.parseEther('200').add(1))
    })
  })

  describe('loanUSDC', async () => {
    it('loans token exact', async () => {
      await usdc.mock.transferFrom.withArgs(usdcLoaner.address, batcher.address, 100_000_000).returns(true)

      await expect(batcher.connect(usdcLoaner).loanUSDC(utils.parseEther('100')))
        .to.emit(batcher, 'USDCLoaned')
        .withArgs(usdcLoaner.address, utils.parseEther('100'))

      expect(await batcher.usdcLoansOutstanding()).to.equal(utils.parseEther('100'))
      expect(await batcher.depositorToUSDCLoanAmount(usdcLoaner.address)).to.equal(utils.parseEther('100'))
    })

    it('loans token rounding', async () => {
      await usdc.mock.transferFrom.withArgs(usdcLoaner.address, batcher.address, 100_000_001).returns(true)

      await expect(batcher.connect(usdcLoaner).loanUSDC(utils.parseEther('100').add(1)))
        .to.emit(batcher, 'USDCLoaned')
        .withArgs(usdcLoaner.address, utils.parseEther('100').add(1))

      expect(await batcher.usdcLoansOutstanding()).to.equal(utils.parseEther('100').add(1))
      expect(await batcher.depositorToUSDCLoanAmount(usdcLoaner.address)).to.equal(utils.parseEther('100').add(1))
    })

    it('loans token multiple users', async () => {
      await usdc.mock.transferFrom.withArgs(usdcLoaner.address, batcher.address, 100_000_000).returns(true)
      await usdc.mock.transferFrom.withArgs(usdcLoaner2.address, batcher.address, 200_000_000).returns(true)

      await expect(batcher.connect(usdcLoaner).loanUSDC(utils.parseEther('100')))
        .to.emit(batcher, 'USDCLoaned')
        .withArgs(usdcLoaner.address, utils.parseEther('100'))
      await expect(batcher.connect(usdcLoaner2).loanUSDC(utils.parseEther('200')))
        .to.emit(batcher, 'USDCLoaned')
        .withArgs(usdcLoaner2.address, utils.parseEther('200'))

      expect(await batcher.usdcLoansOutstanding()).to.equal(utils.parseEther('300'))
      expect(await batcher.depositorToUSDCLoanAmount(usdcLoaner.address)).to.equal(utils.parseEther('100'))
      expect(await batcher.depositorToUSDCLoanAmount(usdcLoaner2.address)).to.equal(utils.parseEther('200'))
    })
  })

  describe('repayUSDC', async () => {
    it('repays token exact', async () => {
      // Loan the amount
      await usdc.mock.transferFrom.withArgs(usdcLoaner.address, batcher.address, 100_000_000).returns(true)
      await batcher.connect(usdcLoaner).loanUSDC(utils.parseEther('100'))

      await usdc.mock.balanceOf.withArgs(batcher.address).returns(100_000_000)
      await usdc.mock.transfer.withArgs(usdcLoaner.address, 100_000_000).returns(true)

      await expect(batcher.connect(usdcLoaner).repayUSDC(utils.parseEther('100')))
        .to.emit(batcher, 'USDCRepaid')
        .withArgs(usdcLoaner.address, utils.parseEther('100'))

      expect(await batcher.usdcLoansOutstanding()).to.equal(0)
      expect(await batcher.depositorToUSDCLoanAmount(usdcLoaner.address)).to.equal(0)
    })

    it('repays token rounding', async () => {
      // Loan the amount
      await usdc.mock.transferFrom.withArgs(usdcLoaner.address, batcher.address, 100_000_001).returns(true)
      await batcher.connect(usdcLoaner).loanUSDC(utils.parseEther('100').add(1))

      await usdc.mock.balanceOf.withArgs(batcher.address).returns(100_000_001)
      await usdc.mock.transfer.withArgs(usdcLoaner.address, 100_000_000).returns(true)

      await expect(batcher.connect(usdcLoaner).repayUSDC(utils.parseEther('100').add(1)))
        .to.emit(batcher, 'USDCRepaid')
        .withArgs(usdcLoaner.address, utils.parseEther('100').add(1))

      expect(await batcher.usdcLoansOutstanding()).to.equal(0)
      expect(await batcher.depositorToUSDCLoanAmount(usdcLoaner.address)).to.equal(0)
    })

    it('repays token partial rounding', async () => {
      // Loan the amount
      await usdc.mock.transferFrom.withArgs(usdcLoaner.address, batcher.address, 100_000_001).returns(true)
      await batcher.connect(usdcLoaner).loanUSDC(utils.parseEther('100').add(1))

      await usdc.mock.balanceOf.withArgs(batcher.address).returns(100_000_001)
      await usdc.mock.transfer.withArgs(usdcLoaner.address, 50_000_000).returns(true)

      await expect(batcher.connect(usdcLoaner).repayUSDC(utils.parseEther('50').add(1)))
        .to.emit(batcher, 'USDCRepaid')
        .withArgs(usdcLoaner.address, utils.parseEther('50').add(1))

      expect(await batcher.usdcLoansOutstanding()).to.equal(utils.parseEther('50'))
      expect(await batcher.depositorToUSDCLoanAmount(usdcLoaner.address)).to.equal(utils.parseEther('50'))
    })

    it('repays token multiple users', async () => {
      await usdc.mock.transferFrom.withArgs(usdcLoaner.address, batcher.address, 100_000_000).returns(true)
      await usdc.mock.transferFrom.withArgs(usdcLoaner2.address, batcher.address, 200_000_000).returns(true)
      await batcher.connect(usdcLoaner).loanUSDC(utils.parseEther('100'))
      await batcher.connect(usdcLoaner2).loanUSDC(utils.parseEther('200'))

      await usdc.mock.balanceOf.withArgs(batcher.address).returns(300_000_000)
      await usdc.mock.transfer.withArgs(usdcLoaner.address, 100_000_000).returns(true)
      await usdc.mock.transfer.withArgs(usdcLoaner2.address, 101_000_000).returns(true)
      await expect(batcher.connect(usdcLoaner).repayUSDC(utils.parseEther('100')))
        .to.emit(batcher, 'USDCRepaid')
        .withArgs(usdcLoaner.address, utils.parseEther('100'))
      await expect(batcher.connect(usdcLoaner2).repayUSDC(utils.parseEther('101')))
        .to.emit(batcher, 'USDCRepaid')
        .withArgs(usdcLoaner2.address, utils.parseEther('101'))

      expect(await batcher.usdcLoansOutstanding()).to.equal(utils.parseEther('99'))
      expect(await batcher.depositorToUSDCLoanAmount(usdcLoaner.address)).to.equal(0)
      expect(await batcher.depositorToUSDCLoanAmount(usdcLoaner2.address)).to.equal(utils.parseEther('99'))
    })

    it('repays token rebalance required', async () => {
      // Loan the amount
      await usdc.mock.transferFrom.withArgs(usdcLoaner.address, batcher.address, 100_000_000).returns(true)
      await batcher.connect(usdcLoaner).loanUSDC(utils.parseEther('100'))

      await usdc.mock.balanceOf.withArgs(batcher.address).returns(90_000_000)
      await dsu.mock.balanceOf.withArgs(batcher.address).returns(utils.parseEther('100'))

      await reserve.mock.redeem.withArgs(utils.parseEther('10')).returns()
      await usdc.mock.transfer.withArgs(usdcLoaner.address, 100_000_000).returns(true)

      await expect(batcher.connect(usdcLoaner).repayUSDC(utils.parseEther('100')))
        .to.emit(batcher, 'USDCRepaid')
        .withArgs(usdcLoaner.address, utils.parseEther('100'))

      expect(await batcher.usdcLoansOutstanding()).to.equal(0)
      expect(await batcher.depositorToUSDCLoanAmount(usdcLoaner.address)).to.equal(0)
    })

    it('reverts on excess repayment', async () => {
      // Loan the amount
      await usdc.mock.transferFrom.withArgs(usdcLoaner.address, batcher.address, 100_000_000).returns(true)
      await batcher.connect(usdcLoaner).loanUSDC(utils.parseEther('100'))

      await expect(batcher.connect(usdcLoaner).loanUSDC(utils.parseEther('100').add(1))).to.be.reverted
    })
  })

  describe('#wrap', async () => {
    it('wraps token exact', async () => {
      await dsu.mock.transfer.withArgs(to.address, utils.parseEther('100')).returns(true)
      await usdc.mock.transferFrom.withArgs(user.address, batcher.address, 100_000_000).returns(true)

      await expect(batcher.connect(user).wrap(utils.parseEther('100'), to.address))
        .to.emit(batcher, 'Wrap')
        .withArgs(to.address, utils.parseEther('100'))
    })

    it('wraps token rounding', async () => {
      await dsu.mock.transfer.withArgs(to.address, utils.parseEther('100').add(1)).returns(true)
      await usdc.mock.transferFrom.withArgs(user.address, batcher.address, 100_000_001).returns(true)

      await expect(batcher.connect(user).wrap(utils.parseEther('100').add(1), to.address))
        .to.emit(batcher, 'Wrap')
        .withArgs(to.address, utils.parseEther('100').add(1))
    })
  })

  describe('#unwrap', async () => {
    it('unwraps token exact', async () => {
      await usdc.mock.transfer.withArgs(to.address, 100_000_000).returns(true)
      await dsu.mock.transferFrom.withArgs(user.address, batcher.address, utils.parseEther('100')).returns(true)

      await expect(batcher.connect(user).unwrap(utils.parseEther('100'), to.address))
        .to.emit(batcher, 'Unwrap')
        .withArgs(to.address, utils.parseEther('100'))
    })

    it('unwraps token rounding', async () => {
      await usdc.mock.transfer.withArgs(to.address, 100_000_000).returns(true)
      await dsu.mock.transferFrom.withArgs(user.address, batcher.address, utils.parseEther('100').add(1)).returns(true)

      await expect(batcher.connect(user).unwrap(utils.parseEther('100').add(1), to.address))
        .to.emit(batcher, 'Unwrap')
        .withArgs(to.address, utils.parseEther('100').add(1))
    })
  })

  describe('#rebalance', async () => {
    it('rebalances assets', async () => {
      await dsu.mock.balanceOf.withArgs(batcher.address).returns(utils.parseEther('100'))
      await usdc.mock.balanceOf.withArgs(batcher.address).returns(100_000_000)

      await reserve.mock.mint.withArgs(utils.parseEther('100')).returns()

      await expect(batcher.connect(user).rebalance()).to.emit(batcher, 'Rebalance').withArgs(utils.parseEther('100'), 0)
    })

    it('rebalances assets rounding', async () => {
      await dsu.mock.balanceOf.withArgs(batcher.address).returns(utils.parseEther('100').add(1))
      await usdc.mock.balanceOf.withArgs(batcher.address).returns(100_000_000)

      await reserve.mock.mint.withArgs(utils.parseEther('100')).returns()

      await expect(batcher.connect(user).rebalance()).to.emit(batcher, 'Rebalance').withArgs(utils.parseEther('100'), 0)
    })

    it('rebalances assets zero', async () => {
      await dsu.mock.balanceOf.withArgs(batcher.address).returns(utils.parseEther('100'))
      await usdc.mock.balanceOf.withArgs(batcher.address).returns(0)

      await expect(batcher.connect(user).rebalance())
    })

    it('rebalances loans oustanding, excess usdc', async () => {
      // Loan the amount
      await usdc.mock.transferFrom.withArgs(usdcLoaner.address, batcher.address, 10_000_000).returns(true)
      await batcher.connect(usdcLoaner).loanUSDC(utils.parseEther('10'))

      await dsu.mock.balanceOf.withArgs(batcher.address).returns(utils.parseEther('100'))
      await usdc.mock.balanceOf.withArgs(batcher.address).returns(110_000_000)

      await reserve.mock.mint.withArgs(utils.parseEther('100')).returns()

      await expect(batcher.connect(user).rebalance()).to.emit(batcher, 'Rebalance').withArgs(utils.parseEther('110'), 0)
    })

    it('rebalances loans oustanding, lack of usdc', async () => {
      // Loan the amount
      await usdc.mock.transferFrom.withArgs(usdcLoaner.address, batcher.address, 10_000_000).returns(true)
      await batcher.connect(usdcLoaner).loanUSDC(utils.parseEther('10'))

      await dsu.mock.balanceOf.withArgs(batcher.address).returns(utils.parseEther('100'))
      await usdc.mock.balanceOf.withArgs(batcher.address).returns(0)

      await reserve.mock.redeem.withArgs(utils.parseEther('10')).returns()

      await expect(batcher.connect(user).rebalance()).to.emit(batcher, 'Rebalance').withArgs(0, 0) // TODO(arjun): fix event args
    })
  })

  describe('#close', async () => {
    it('closes', async () => {
      // Rebalance
      await usdc.mock.balanceOf.withArgs(batcher.address).returns(100_000_000)
      await reserve.mock.mint.withArgs(utils.parseEther('100')).returns()

      // Get balance and debt
      await reserve.mock.debt.withArgs(batcher.address).returns(utils.parseEther('200'))
      await dsu.mock.balanceOf.withArgs(batcher.address).returns(utils.parseEther('200'))

      // repay debt and last of balance
      await reserve.mock.repay.withArgs(batcher.address, utils.parseEther('200')).returns()
      await dsu.mock.transfer.withArgs(reserve.address, utils.parseEther('200')).returns(true)

      await expect(batcher.connect(owner).close()).to.emit(batcher, 'Close').withArgs(utils.parseEther('200'))
    })

    it('closes empty', async () => {
      // Rebalance
      await usdc.mock.balanceOf.withArgs(batcher.address).returns(0)

      // Get balance and debt
      await reserve.mock.debt.withArgs(batcher.address).returns(utils.parseEther('100'))
      await dsu.mock.balanceOf.withArgs(batcher.address).returns(utils.parseEther('100'))

      // repay debt and last of balance
      await reserve.mock.repay.withArgs(batcher.address, utils.parseEther('100')).returns()
      await dsu.mock.transfer.withArgs(reserve.address, utils.parseEther('100')).returns(true)

      await expect(batcher.connect(owner).close()).to.emit(batcher, 'Close').withArgs(utils.parseEther('100'))
    })

    it('closes rounding', async () => {
      // Rebalance
      await usdc.mock.balanceOf.withArgs(batcher.address).returns(100_000_000)
      await reserve.mock.mint.withArgs(utils.parseEther('100')).returns()

      // Get balance and debt
      await reserve.mock.debt.withArgs(batcher.address).returns(utils.parseEther('200'))
      await dsu.mock.balanceOf.withArgs(batcher.address).returns(utils.parseEther('200').add(1))

      // repay debt and last of balance
      await reserve.mock.repay.withArgs(batcher.address, utils.parseEther('200')).returns()
      await dsu.mock.transfer.withArgs(reserve.address, utils.parseEther('200')).returns(true)
      await dsu.mock.transfer.withArgs(reserve.address, 1).returns(true)

      await expect(batcher.connect(owner).close()).to.emit(batcher, 'Close').withArgs(utils.parseEther('200').add(1))
    })

    it('closes outstanding loans', async () => {
      // Loan the amount
      await usdc.mock.transferFrom.withArgs(usdcLoaner.address, batcher.address, 10_000_000).returns(true)
      await batcher.connect(usdcLoaner).loanUSDC(utils.parseEther('10'))

      // Rebalance - keep 10 USDC to repay loans
      await usdc.mock.balanceOf.withArgs(batcher.address).returns(110_000_000)
      await reserve.mock.mint.withArgs(utils.parseEther('100')).returns()

      // Get balance and debt
      await reserve.mock.debt.withArgs(batcher.address).returns(utils.parseEther('200'))
      await dsu.mock.balanceOf.withArgs(batcher.address).returns(utils.parseEther('200'))

      // repay debt and last of balance
      await reserve.mock.repay.withArgs(batcher.address, utils.parseEther('200')).returns()
      await dsu.mock.transfer.withArgs(reserve.address, utils.parseEther('200')).returns(true)

      await expect(batcher.connect(owner).close()).to.emit(batcher, 'Close').withArgs(utils.parseEther('200'))
    })

    it('closes not owner', async () => {
      await expect(batcher.connect(user).close()).to.be.revertedWith(`UOwnableNotOwnerError("${user.address}")`)
    })
  })
})
