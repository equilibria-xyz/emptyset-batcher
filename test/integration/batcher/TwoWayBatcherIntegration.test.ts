import { expect } from 'chai'
import 'hardhat'
import { ethers, Signer, utils } from 'ethers'

import { InstanceVars, deployProtocol } from '../setupHelpers'
import { TwoWayBatcher, TwoWayBatcher__factory } from '../../../types/generated'
import { impersonate } from '../../testutil'

describe('TwoWayBatcher', () => {
  let proto: InstanceVars
  let batcher: TwoWayBatcher
  let reserveImpersonator: Signer

  beforeEach(async () => {
    proto = await deployProtocol()

    batcher = await new TwoWayBatcher__factory(proto.deployer).deploy(
      proto.reserve.address,
      proto.dsu.address,
      proto.usdc.address,
    )
    await batcher.updatePendingOwner(proto.timelock.address)
    reserveImpersonator = await impersonate.impersonateWithBalance(proto.reserve.address, utils.parseEther('10'))
  })

  describe('#constructor', async () => {
    it('sets reserve', async () => {
      expect(await batcher.RESERVE()).to.equal(proto.reserve.address)
    })

    it('sets dsu', async () => {
      expect(await batcher.DSU()).to.equal(proto.dsu.address)
    })

    it('sets usdc', async () => {
      expect(await batcher.USDC()).to.equal(proto.usdc.address)
    })
  })

  context('funded', async () => {
    beforeEach(async () => {
      await proto.dsu.connect(proto.user).transfer(batcher.address, utils.parseEther('1000000'))
    })

    describe('#wrap', async () => {
      beforeEach(async () => {
        await proto.usdc.connect(proto.user).approve(batcher.address, 1_000_000_000_000)
      })

      it('wraps token exact', async () => {
        expect(await batcher.totalBalance()).to.equal(utils.parseEther('1000000'))

        await expect(batcher.connect(proto.user).wrap(utils.parseEther('100'), proto.timelock.address))
          .to.emit(batcher, 'Wrap')
          .withArgs(proto.timelock.address, utils.parseEther('100'))

        expect(await proto.dsu.balanceOf(proto.timelock.address)).to.equal(utils.parseEther('100'))
        expect(await proto.usdc.balanceOf(proto.timelock.address)).to.equal(0)

        expect(await proto.dsu.balanceOf(proto.user.address)).to.equal(0)
        expect(await proto.usdc.balanceOf(proto.user.address)).to.equal(1_000_000_000_000 - 100_000_000)

        expect(await proto.dsu.balanceOf(batcher.address)).to.equal(
          utils.parseEther('1000000').sub(utils.parseEther('100')),
        )
        expect(await proto.usdc.balanceOf(batcher.address)).to.equal(100_000_000)

        expect(await batcher.totalBalance()).to.equal(utils.parseEther('1000000'))
      })

      it('wraps token exact twice (gas)', async () => {
        expect(await batcher.totalBalance()).to.equal(utils.parseEther('1000000'))

        await batcher.connect(proto.user).wrap(utils.parseEther('200'), proto.timelock.address)

        await expect(batcher.connect(proto.user).wrap(utils.parseEther('100'), proto.timelock.address))
          .to.emit(batcher, 'Wrap')
          .withArgs(proto.timelock.address, utils.parseEther('100'))

        expect(await proto.dsu.balanceOf(proto.timelock.address)).to.equal(utils.parseEther('300'))
        expect(await proto.usdc.balanceOf(proto.timelock.address)).to.equal(0)

        expect(await proto.dsu.balanceOf(proto.user.address)).to.equal(0)
        expect(await proto.usdc.balanceOf(proto.user.address)).to.equal(1_000_000_000_000 - 300_000_000)

        expect(await proto.dsu.balanceOf(batcher.address)).to.equal(
          utils.parseEther('1000000').sub(utils.parseEther('300')),
        )
        expect(await proto.usdc.balanceOf(batcher.address)).to.equal(300_000_000)

        expect(await batcher.totalBalance()).to.equal(utils.parseEther('1000000'))
      })

      it('wraps token exact twice to user (gas)', async () => {
        expect(await batcher.totalBalance()).to.equal(utils.parseEther('1000000'))

        await batcher.connect(proto.user).wrap(utils.parseEther('200'), proto.user.address)

        await expect(batcher.connect(proto.user).wrap(utils.parseEther('100'), proto.timelock.address))
          .to.emit(batcher, 'Wrap')
          .withArgs(proto.timelock.address, utils.parseEther('100'))

        expect(await proto.dsu.balanceOf(proto.timelock.address)).to.equal(utils.parseEther('100'))
        expect(await proto.usdc.balanceOf(proto.timelock.address)).to.equal(0)

        expect(await proto.dsu.balanceOf(proto.user.address)).to.equal(utils.parseEther('200'))
        expect(await proto.usdc.balanceOf(proto.user.address)).to.equal(1_000_000_000_000 - 300_000_000)

        expect(await proto.dsu.balanceOf(batcher.address)).to.equal(
          utils.parseEther('1000000').sub(utils.parseEther('300')),
        )
        expect(await proto.usdc.balanceOf(batcher.address)).to.equal(300_000_000)

        expect(await batcher.totalBalance()).to.equal(utils.parseEther('1000000'))
      })

      it('wraps token rounding', async () => {
        expect(await batcher.totalBalance()).to.equal(utils.parseEther('1000000'))

        await expect(batcher.connect(proto.user).wrap(utils.parseEther('100').add(1), proto.timelock.address))
          .to.emit(batcher, 'Wrap')
          .withArgs(proto.timelock.address, utils.parseEther('100').add(1))

        expect(await proto.dsu.balanceOf(proto.timelock.address)).to.equal(utils.parseEther('100').add(1))
        expect(await proto.usdc.balanceOf(proto.timelock.address)).to.equal(0)

        expect(await proto.dsu.balanceOf(proto.user.address)).to.equal(0)
        expect(await proto.usdc.balanceOf(proto.user.address)).to.equal(1_000_000_000_000 - 100_000_001)

        expect(await proto.dsu.balanceOf(batcher.address)).to.equal(
          utils.parseEther('1000000').sub(utils.parseEther('100')).sub(1),
        )
        expect(await proto.usdc.balanceOf(batcher.address)).to.equal(100_000_001)

        expect(await batcher.totalBalance()).to.equal(
          utils.parseEther('1000000').add(utils.parseEther('0.000001')).sub(1),
        )
      })
    })

    describe('#unwrap', async () => {
      beforeEach(async () => {
        await proto.usdc.connect(proto.user).approve(batcher.address, 1_000_000_000_000)
        await proto.dsu.connect(proto.user).approve(batcher.address, utils.parseEther('300'))

        await batcher.connect(proto.user).wrap(utils.parseEther('100'), proto.user.address)
      })

      it('unwraps token exact', async () => {
        expect(await batcher.totalBalance()).to.equal(utils.parseEther('1000000'))

        await expect(batcher.connect(proto.user).unwrap(utils.parseEther('100'), proto.timelock.address))
          .to.emit(batcher, 'Unwrap')
          .withArgs(proto.timelock.address, utils.parseEther('100'))

        expect(await proto.dsu.balanceOf(proto.timelock.address)).to.equal(0)
        expect(await proto.usdc.balanceOf(proto.timelock.address)).to.equal(100_000_000)

        expect(await proto.dsu.balanceOf(proto.user.address)).to.equal(0)
        expect(await proto.usdc.balanceOf(proto.user.address)).to.equal(1_000_000_000_000 - 100_000_000)

        expect(await proto.dsu.balanceOf(batcher.address)).to.equal(utils.parseEther('1000000'))
        expect(await proto.usdc.balanceOf(batcher.address)).to.equal(0)

        expect(await batcher.totalBalance()).to.equal(utils.parseEther('1000000'))
      })

      it('unwraps token exact twice (gas)', async () => {
        expect(await batcher.totalBalance()).to.equal(utils.parseEther('1000000'))

        await batcher.connect(proto.user).wrap(utils.parseEther('200'), proto.user.address)
        await expect(batcher.connect(proto.user).unwrap(utils.parseEther('200'), proto.timelock.address))
          .to.emit(batcher, 'Unwrap')
          .withArgs(proto.timelock.address, utils.parseEther('200'))
        await expect(batcher.connect(proto.user).unwrap(utils.parseEther('100'), proto.timelock.address))
          .to.emit(batcher, 'Unwrap')
          .withArgs(proto.timelock.address, utils.parseEther('100'))

        expect(await proto.dsu.balanceOf(proto.timelock.address)).to.equal(0)
        expect(await proto.usdc.balanceOf(proto.timelock.address)).to.equal(300_000_000)

        expect(await proto.dsu.balanceOf(proto.user.address)).to.equal(0)
        expect(await proto.usdc.balanceOf(proto.user.address)).to.equal(1_000_000_000_000 - 300_000_000)

        expect(await proto.dsu.balanceOf(batcher.address)).to.equal(utils.parseEther('1000000'))
        expect(await proto.usdc.balanceOf(batcher.address)).to.equal(0)

        expect(await batcher.totalBalance()).to.equal(utils.parseEther('1000000'))
      })

      it('unwraps token exact twice to user (gas)', async () => {
        expect(await batcher.totalBalance()).to.equal(utils.parseEther('1000000'))

        await batcher.connect(proto.user).wrap(utils.parseEther('200'), proto.user.address)
        await expect(batcher.connect(proto.user).unwrap(utils.parseEther('200'), proto.user.address))
          .to.emit(batcher, 'Unwrap')
          .withArgs(proto.user.address, utils.parseEther('200'))
        await expect(batcher.connect(proto.user).unwrap(utils.parseEther('100'), proto.user.address))
          .to.emit(batcher, 'Unwrap')
          .withArgs(proto.user.address, utils.parseEther('100'))

        expect(await proto.dsu.balanceOf(proto.dsu.address)).to.equal(0)
        expect(await proto.usdc.balanceOf(proto.user.address)).to.equal(1_000_000_000_000)

        expect(await proto.dsu.balanceOf(batcher.address)).to.equal(utils.parseEther('1000000'))
        expect(await proto.usdc.balanceOf(batcher.address)).to.equal(0)

        expect(await batcher.totalBalance()).to.equal(utils.parseEther('1000000'))
      })

      it('unwraps token rounding', async () => {
        expect(await batcher.totalBalance()).to.equal(utils.parseEther('1000000'))

        // This will take 1e-6 USDC from the user and credit them 1e-18 DSU due to rounding
        await batcher.connect(proto.user).wrap(1, proto.user.address)

        await expect(batcher.connect(proto.user).unwrap(utils.parseEther('100').add(1), proto.timelock.address))
          .to.emit(batcher, 'Unwrap')
          .withArgs(proto.timelock.address, utils.parseEther('100').add(1))

        expect(await proto.dsu.balanceOf(proto.timelock.address)).to.equal(0)
        // Due to rounding, we will only release 100 USDC when unwrapping 100 + 1e-18 DSU
        expect(await proto.usdc.balanceOf(proto.timelock.address)).to.equal(100_000_000)

        expect(await proto.dsu.balanceOf(proto.user.address)).to.equal(0)
        expect(await proto.usdc.balanceOf(proto.user.address)).to.equal(1_000_000_000_000 - 100_000_001)

        expect(await proto.dsu.balanceOf(batcher.address)).to.equal(utils.parseEther('1000000'))
        expect(await proto.usdc.balanceOf(batcher.address)).to.equal(1)

        expect(await batcher.totalBalance()).to.equal(utils.parseEther('1000000.000001'))
      })
    })

    describe('#loanUSDC', async () => {
      beforeEach(async () => {
        await proto.usdc.connect(proto.user).approve(batcher.address, 1_000_000_000_000)
        await proto.usdc.connect(proto.user2).approve(batcher.address, 1_000_000_000_000)
      })

      it('loans token exact', async () => {
        const { user, usdc } = proto
        await expect(batcher.connect(user).loanUSDC(utils.parseEther('100')))
          .to.emit(batcher, 'USDCLoaned')
          .withArgs(user.address, utils.parseEther('100'))

        expect(await usdc.balanceOf(batcher.address)).to.equal(100_000_000)
        expect(await usdc.balanceOf(user.address)).to.equal(1_000_000_000_000 - 100_000_000)

        expect(await batcher.usdcLoansOutstanding()).to.equal(utils.parseEther('100'))
        expect(await batcher.depositorToUSDCLoanAmount(user.address)).to.equal(utils.parseEther('100'))
      })

      it('loans token rounding', async () => {
        const { user, usdc } = proto
        await expect(batcher.connect(user).loanUSDC(utils.parseEther('100').add(1)))
          .to.emit(batcher, 'USDCLoaned')
          .withArgs(user.address, utils.parseEther('100').add(1))

        expect(await usdc.balanceOf(batcher.address)).to.equal(100_000_001)
        expect(await usdc.balanceOf(user.address)).to.equal(1_000_000_000_000 - 100_000_001)

        expect(await batcher.usdcLoansOutstanding()).to.equal(utils.parseEther('100').add(1))
        expect(await batcher.depositorToUSDCLoanAmount(user.address)).to.equal(utils.parseEther('100').add(1))
      })

      it('loans token multiple', async () => {
        const { user, user2, usdc } = proto
        await expect(batcher.connect(user).loanUSDC(utils.parseEther('100')))
          .to.emit(batcher, 'USDCLoaned')
          .withArgs(user.address, utils.parseEther('100'))
        await expect(batcher.connect(user2).loanUSDC(utils.parseEther('200')))
          .to.emit(batcher, 'USDCLoaned')
          .withArgs(user2.address, utils.parseEther('200'))

        expect(await usdc.balanceOf(batcher.address)).to.equal(300_000_000)
        expect(await usdc.balanceOf(user.address)).to.equal(1_000_000_000_000 - 100_000_000)
        expect(await usdc.balanceOf(user2.address)).to.equal(1_000_000_000_000 - 200_000_000)

        expect(await batcher.usdcLoansOutstanding()).to.equal(utils.parseEther('300'))
        expect(await batcher.depositorToUSDCLoanAmount(user.address)).to.equal(utils.parseEther('100'))
        expect(await batcher.depositorToUSDCLoanAmount(user2.address)).to.equal(utils.parseEther('200'))
      })
    })

    describe('#repayUSDC', async () => {
      beforeEach(async () => {
        await proto.usdc.connect(proto.user).approve(batcher.address, 1_000_000_000_000)
        await proto.usdc.connect(proto.user2).approve(batcher.address, 1_000_000_000_000)
        await batcher.connect(proto.user).loanUSDC(utils.parseEther('100'))
      })

      it('repays token exact', async () => {
        const { usdc, user } = proto

        await expect(batcher.connect(user).repayUSDC(utils.parseEther('100')))
          .to.emit(batcher, 'USDCRepaid')
          .withArgs(user.address, utils.parseEther('100'))

        expect(await batcher.usdcLoansOutstanding()).to.equal(0)
        expect(await batcher.depositorToUSDCLoanAmount(user.address)).to.equal(0)

        expect(await usdc.balanceOf(batcher.address)).to.equal(0)
        expect(await usdc.balanceOf(user.address)).to.equal(1_000_000_000_000)
      })

      it('repays token rounding', async () => {
        const { usdc, user } = proto
        await batcher.connect(user).loanUSDC(1)

        await expect(batcher.connect(user).repayUSDC(utils.parseEther('100').add(1)))
          .to.emit(batcher, 'USDCRepaid')
          .withArgs(user.address, utils.parseEther('100').add(1))

        expect(await batcher.usdcLoansOutstanding()).to.equal(0)
        expect(await batcher.depositorToUSDCLoanAmount(user.address)).to.equal(0)

        expect(await usdc.balanceOf(batcher.address)).to.equal(1)
        expect(await usdc.balanceOf(user.address)).to.equal(999_999_999_999) // User lost 1e-6 USDC due to rounding
      })

      it('repays token partial rounding', async () => {
        const { usdc, user } = proto
        await batcher.connect(user).loanUSDC(1)

        await expect(batcher.connect(user).repayUSDC(utils.parseEther('50').add(1)))
          .to.emit(batcher, 'USDCRepaid')
          .withArgs(user.address, utils.parseEther('50').add(1))

        expect(await batcher.usdcLoansOutstanding()).to.equal(utils.parseEther('50'))
        expect(await batcher.depositorToUSDCLoanAmount(user.address)).to.equal(utils.parseEther('50'))

        expect(await usdc.balanceOf(batcher.address)).to.equal(50_000_001)
        expect(await usdc.balanceOf(user.address)).to.equal(999_949_999_999) // User lost 1e-6 USDC due to rounding
      })

      it('repays token multiple users', async () => {
        const { usdc, user, user2 } = proto

        await batcher.connect(user2).loanUSDC(utils.parseEther('200'))

        await expect(batcher.connect(user).repayUSDC(utils.parseEther('100')))
          .to.emit(batcher, 'USDCRepaid')
          .withArgs(user.address, utils.parseEther('100'))
        await expect(batcher.connect(user2).repayUSDC(utils.parseEther('101')))
          .to.emit(batcher, 'USDCRepaid')
          .withArgs(user2.address, utils.parseEther('101'))

        expect(await batcher.usdcLoansOutstanding()).to.equal(utils.parseEther('99'))
        expect(await batcher.depositorToUSDCLoanAmount(user.address)).to.equal(0)
        expect(await batcher.depositorToUSDCLoanAmount(user2.address)).to.equal(utils.parseEther('99'))

        expect(await usdc.balanceOf(batcher.address)).to.equal(99_000_000)
        expect(await usdc.balanceOf(user.address)).to.equal(1_000_000_000_000)
        expect(await usdc.balanceOf(user2.address)).to.equal(999_901_000_000)
      })

      context('rebalance required', () => {
        beforeEach(async () => {
          const { dsu, usdc, reserve, user2 } = proto
          // Get DSU from reserve and unwrap via batcher
          await usdc.connect(user2).approve(reserve.address, 100_000_000)
          await dsu.connect(user2).approve(batcher.address, utils.parseEther('100'))
          await reserve.connect(user2).mint(utils.parseEther('100'))
          await batcher.connect(user2).unwrap(utils.parseEther('100'), user2.address)
        })

        it('repays token full', async () => {
          const { usdc, user } = proto

          await expect(batcher.connect(user).repayUSDC(utils.parseEther('100')))
            .to.emit(batcher, 'USDCRepaid')
            .withArgs(user.address, utils.parseEther('100'))
            .to.emit(batcher, 'Rebalance') // TODO(arjun): assert args

          expect(await batcher.usdcLoansOutstanding()).to.equal(0)
          expect(await batcher.depositorToUSDCLoanAmount(user.address)).to.equal(0)

          expect(await usdc.balanceOf(batcher.address)).to.equal(0)
          expect(await usdc.balanceOf(user.address)).to.equal(1_000_000_000_000)
        })

        it('repays token partial', async () => {
          const { usdc, user } = proto

          await expect(batcher.connect(user).repayUSDC(utils.parseEther('51')))
            .to.emit(batcher, 'USDCRepaid')
            .withArgs(user.address, utils.parseEther('51'))
            .to.emit(batcher, 'Rebalance') // TODO(arjun): assert args

          expect(await batcher.usdcLoansOutstanding()).to.equal(utils.parseEther('49'))
          expect(await batcher.depositorToUSDCLoanAmount(user.address)).to.equal(utils.parseEther('49'))

          expect(await usdc.balanceOf(batcher.address)).to.equal(49_000_000)
          expect(await usdc.balanceOf(user.address)).to.equal(999_951_000_000)
        })
      })

      it('reverts on excess repayment', async () => {
        await expect(batcher.connect(proto.user).repayUSDC(utils.parseEther('101'))).to.be.reverted
      })
    })

    describe('#rebalance', async () => {
      beforeEach(async () => {
        await proto.usdc.connect(proto.user).approve(batcher.address, 1_000_000_000_000)
        await proto.usdc.connect(proto.user2).approve(batcher.address, 1_000_000_000_000)
      })

      it('rebalances assets', async () => {
        expect(await batcher.totalBalance()).to.equal(utils.parseEther('1000000'))

        await batcher.connect(proto.user).wrap(utils.parseEther('100'), proto.timelock.address)

        await expect(batcher.connect(proto.user).rebalance())
          .to.emit(batcher, 'Rebalance')
          .withArgs(utils.parseEther('100'), 0)

        expect(await batcher.totalBalance()).to.equal(utils.parseEther('1000000'))
      })

      it('rebalances assets rounding', async () => {
        expect(await batcher.totalBalance()).to.equal(utils.parseEther('1000000'))

        await batcher.connect(proto.user).wrap(utils.parseEther('100').add(1), proto.timelock.address)

        await expect(batcher.connect(proto.user).rebalance())
          .to.emit(batcher, 'Rebalance')
          .withArgs(utils.parseEther('100.000001'), 0)

        expect(await batcher.totalBalance()).to.equal(
          utils.parseEther('1000000').add(utils.parseEther('0.000001')).sub(1),
        )
      })

      it('rebalances assets zero', async () => {
        await batcher.connect(proto.user).rebalance()
      })

      it('rebalances reserveRatio < 1', async () => {
        expect(await batcher.totalBalance()).to.equal(utils.parseEther('1000000'))

        await batcher.connect(proto.user).wrap(utils.parseEther('100'), proto.timelock.address)

        const reserveCUsdcBalance = await proto.cUsdc.balanceOf(proto.reserve.address)
        await proto.cUsdc
          .connect(reserveImpersonator)
          .transfer(ethers.constants.AddressZero, reserveCUsdcBalance.div(2))

        await expect(batcher.connect(proto.user).rebalance())
          .to.emit(batcher, 'Rebalance')
          .withArgs(utils.parseEther('100'), 0)

        expect(await batcher.totalBalance()).to.equal(utils.parseEther('1000000'))
      })

      it('rebalances loans outstanding, excess usdc', async () => {
        const { usdc, reserve, user, user2 } = proto
        await batcher.connect(user).loanUSDC(utils.parseEther('10'))
        await batcher.connect(user2).wrap(utils.parseEther('100'), user2.address)

        await expect(batcher.connect(user).rebalance())
          .to.emit(batcher, 'Rebalance')
          .withArgs(utils.parseEther('110'), 0) // TODO(arjun): fix event args
          .to.emit(reserve, 'Mint')
          .withArgs(batcher.address, utils.parseEther('100'), 100_000_000)

        // Batcher should have 10 USDC to repay outstanding loans
        expect(await usdc.balanceOf(batcher.address)).to.equal(10_000_000)

        expect(await batcher.totalBalance()).to.equal(utils.parseEther('1000010'))
      })

      it('rebalances loans outstanding, lack of usdc', async () => {
        const { dsu, usdc, reserve, user, user2 } = proto
        await batcher.connect(user).loanUSDC(utils.parseEther('10'))

        // Get DSU from reserve and unwrap via batcher
        await usdc.connect(user2).approve(reserve.address, 10_000_000)
        await dsu.connect(user2).approve(batcher.address, utils.parseEther('10'))
        await reserve.connect(user2).mint(utils.parseEther('10'))
        await batcher.connect(user2).unwrap(utils.parseEther('10'), user2.address)

        await expect(batcher.connect(user).rebalance())
          .to.emit(batcher, 'Rebalance')
          .withArgs(utils.parseEther('110'), 0) // TODO(arjun): fix event args
          .to.emit(reserve, 'Redeem')
          .withArgs(batcher.address, utils.parseEther('10'), 10_000_000)

        // Batcher should have 10 USDC to repay outstanding loans
        expect(await usdc.balanceOf(batcher.address)).to.equal(10_000_000)

        expect(await batcher.totalBalance()).to.equal(utils.parseEther('1000010'))
      })
    })
  })
})
