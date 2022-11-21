import { expect } from 'chai'
import HRE from 'hardhat'
import { Signer, utils, constants } from 'ethers'

import { InstanceVars, deployProtocol } from '../setupHelpers'
import { TwoWayBatcher, TwoWayBatcher__factory } from '../../../types/generated'
import { impersonate } from '../../testutil'
import { impersonateWithBalance } from '../../testutil/impersonate'

const { ethers } = HRE

const HARDCODED_RESERVE_BORROWER_ADDRESS = '0x0B663CeaCEF01f2f88EB7451C70Aa069f19dB997'

describe('TwoWayBatcher', () => {
  let proto: InstanceVars
  let batcher: TwoWayBatcher
  let reserveImpersonator: Signer

  beforeEach(async () => {
    proto = await deployProtocol()

    // Deploy the batcher to get the correct bytecode
    const deployedBatcher = await new TwoWayBatcher__factory(proto.deployer).deploy(
      proto.reserve.address,
      proto.dsu.address,
      proto.usdc.address,
    )
    // Copy the bytecode into the hardcoded address
    await ethers.provider.send('hardhat_setCode', [
      HARDCODED_RESERVE_BORROWER_ADDRESS,
      await ethers.provider.getCode(deployedBatcher.address),
    ])
    // Attach the new batcher at the hardcoded address
    batcher = await new TwoWayBatcher__factory(proto.deployer).attach(HARDCODED_RESERVE_BORROWER_ADDRESS)
    // The `owner` is set to the 0 address because it wasn't initialized properly, impersonate the 0 address to transfer
    const ZERO_ADDRESS = await impersonateWithBalance(constants.AddressZero, utils.parseEther('10'))
    await batcher.connect(ZERO_ADDRESS).updatePendingOwner(proto.deployer.address)
    await batcher.connect(proto.deployer).acceptOwner()

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

    describe('#deposit', async () => {
      beforeEach(async () => {
        await proto.usdc.connect(proto.user).approve(batcher.address, 1_000_000_000_000)
        await proto.usdc.connect(proto.user2).approve(batcher.address, 1_000_000_000_000)
      })

      it('deposits token exact', async () => {
        const { user, usdc } = proto
        await expect(batcher.connect(user).deposit(utils.parseEther('100')))
          .to.emit(batcher, 'Deposit')
          .withArgs(user.address, utils.parseEther('100'))

        expect(await usdc.balanceOf(batcher.address)).to.equal(100_000_000)
        expect(await usdc.balanceOf(user.address)).to.equal(1_000_000_000_000 - 100_000_000)

        expect(await batcher.totalSupply()).to.equal(utils.parseEther('100'))
        expect(await batcher.balanceOf(user.address)).to.equal(utils.parseEther('100'))
      })

      it('deposits token rounding', async () => {
        const { user } = proto
        await expect(batcher.connect(user).deposit(utils.parseEther('100').add(1)))
          .to.be.revertedWithCustomError(batcher, 'TwoWayBatcherInvalidTokenAmount')
          .withArgs(utils.parseEther('100').add(1))
      })

      it('deposits token multiple', async () => {
        const { user, user2, usdc } = proto
        await expect(batcher.connect(user).deposit(utils.parseEther('100')))
          .to.emit(batcher, 'Deposit')
          .withArgs(user.address, utils.parseEther('100'))
        await expect(batcher.connect(user2).deposit(utils.parseEther('200')))
          .to.emit(batcher, 'Deposit')
          .withArgs(user2.address, utils.parseEther('200'))

        expect(await usdc.balanceOf(batcher.address)).to.equal(300_000_000)
        expect(await usdc.balanceOf(user.address)).to.equal(1_000_000_000_000 - 100_000_000)
        expect(await usdc.balanceOf(user2.address)).to.equal(1_000_000_000_000 - 200_000_000)

        expect(await batcher.totalSupply()).to.equal(utils.parseEther('300'))
        expect(await batcher.balanceOf(user.address)).to.equal(utils.parseEther('100'))
        expect(await batcher.balanceOf(user2.address)).to.equal(utils.parseEther('200'))
      })
    })

    describe('#withdraw', async () => {
      beforeEach(async () => {
        await proto.usdc.connect(proto.user).approve(batcher.address, 1_000_000_000_000)
        await proto.usdc.connect(proto.user2).approve(batcher.address, 1_000_000_000_000)
        await batcher.connect(proto.user).deposit(utils.parseEther('100'))
      })

      it('withdraws token exact', async () => {
        const { usdc, user } = proto

        await expect(batcher.connect(user).withdraw(utils.parseEther('100')))
          .to.emit(batcher, 'Withdraw')
          .withArgs(user.address, utils.parseEther('100'))

        expect(await batcher.totalSupply()).to.equal(0)
        expect(await batcher.balanceOf(user.address)).to.equal(0)

        expect(await usdc.balanceOf(batcher.address)).to.equal(0)
        expect(await usdc.balanceOf(user.address)).to.equal(1_000_000_000_000)
      })

      it('withdraws token rounding', async () => {
        const { user } = proto

        await expect(batcher.connect(user).withdraw(utils.parseEther('100').add(1)))
          .to.be.revertedWithCustomError(batcher, 'TwoWayBatcherInvalidTokenAmount')
          .withArgs(utils.parseEther('100').add(1))
      })

      it('withdraws token partial rounding', async () => {
        const { user } = proto

        await expect(batcher.connect(user).withdraw(utils.parseEther('50').add(1)))
          .to.be.revertedWithCustomError(batcher, 'TwoWayBatcherInvalidTokenAmount')
          .withArgs(utils.parseEther('50').add(1))
      })

      it('withdraws token multiple users', async () => {
        const { usdc, user, user2 } = proto

        await batcher.connect(user2).deposit(utils.parseEther('200'))

        await expect(batcher.connect(user).withdraw(utils.parseEther('100')))
          .to.emit(batcher, 'Withdraw')
          .withArgs(user.address, utils.parseEther('100'))
        await expect(batcher.connect(user2).withdraw(utils.parseEther('101')))
          .to.emit(batcher, 'Withdraw')
          .withArgs(user2.address, utils.parseEther('101'))

        expect(await batcher.totalSupply()).to.equal(utils.parseEther('99'))
        expect(await batcher.balanceOf(user.address)).to.equal(0)
        expect(await batcher.balanceOf(user2.address)).to.equal(utils.parseEther('99'))

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

        it('withdraws token full', async () => {
          const { usdc, user } = proto

          await expect(batcher.connect(user).withdraw(utils.parseEther('100')))
            .to.emit(batcher, 'Withdraw')
            .withArgs(user.address, utils.parseEther('100'))
            .to.emit(batcher, 'Rebalance')
            .withArgs(0, utils.parseEther('100'))

          expect(await batcher.totalSupply()).to.equal(0)
          expect(await batcher.balanceOf(user.address)).to.equal(0)

          expect(await usdc.balanceOf(batcher.address)).to.equal(0)
          expect(await usdc.balanceOf(user.address)).to.equal(1_000_000_000_000)
        })

        it('withdraws token partial', async () => {
          const { usdc, user } = proto

          await expect(batcher.connect(user).withdraw(utils.parseEther('51')))
            .to.emit(batcher, 'Withdraw')
            .withArgs(user.address, utils.parseEther('51'))
            .to.emit(batcher, 'Rebalance')
            .withArgs(0, utils.parseEther('100'))

          expect(await batcher.totalSupply()).to.equal(utils.parseEther('49'))
          expect(await batcher.balanceOf(user.address)).to.equal(utils.parseEther('49'))

          expect(await usdc.balanceOf(batcher.address)).to.equal(49_000_000)
          expect(await usdc.balanceOf(user.address)).to.equal(999_951_000_000)
        })
      })

      it('reverts on excess withdrawal', async () => {
        await expect(batcher.connect(proto.user).withdraw(utils.parseEther('101'))).to.be.reverted
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

      it('rebalances deposits outstanding, excess usdc', async () => {
        const { usdc, reserve, user, user2 } = proto
        await batcher.connect(user).deposit(utils.parseEther('10'))
        await batcher.connect(user2).wrap(utils.parseEther('100'), user2.address)

        await expect(batcher.connect(user).rebalance())
          .to.emit(batcher, 'Rebalance')
          .withArgs(utils.parseEther('100'), 0)
          .to.emit(reserve, 'Mint')
          .withArgs(batcher.address, utils.parseEther('100'), 100_000_000)

        // Batcher should have 10 USDC to cover deposits outstanding
        expect(await usdc.balanceOf(batcher.address)).to.equal(10_000_000)

        expect(await batcher.totalBalance()).to.equal(utils.parseEther('1000010'))
      })

      it('rebalances deposits outstanding, lack of usdc', async () => {
        const { dsu, usdc, reserve, user, user2 } = proto
        await batcher.connect(user).deposit(utils.parseEther('10'))

        // Get DSU from reserve and unwrap via batcher
        await usdc.connect(user2).approve(reserve.address, 10_000_000)
        await dsu.connect(user2).approve(batcher.address, utils.parseEther('10'))
        await reserve.connect(user2).mint(utils.parseEther('10'))
        await batcher.connect(user2).unwrap(utils.parseEther('10'), user2.address)

        await expect(batcher.connect(user).rebalance())
          .to.emit(batcher, 'Rebalance')
          .withArgs(0, utils.parseEther('10'))
          .to.emit(reserve, 'Redeem')
          .withArgs(batcher.address, utils.parseEther('10'), 10_000_000)

        // Batcher should have 10 USDC to cover deposits outstanding
        expect(await usdc.balanceOf(batcher.address)).to.equal(10_000_000)

        expect(await batcher.totalBalance()).to.equal(utils.parseEther('1000010'))
      })

      context('transferred in dsu', () => {
        beforeEach(async () => {
          await batcher.connect(proto.user).deposit(utils.parseEther('10'))
          await proto.dsu.connect(proto.usdcHolder).transfer(batcher.address, utils.parseEther('200'))
        })

        it('rebalances deposits outstanding, excess usdc', async () => {
          const { usdc, reserve, user, user2 } = proto
          await batcher.connect(user2).wrap(utils.parseEther('100'), user2.address)

          await expect(batcher.connect(user).rebalance())
            .to.emit(batcher, 'Rebalance')
            .withArgs(utils.parseEther('100'), 0)
            .to.emit(reserve, 'Mint')
            .withArgs(batcher.address, utils.parseEther('100'), 100_000_000)

          // Batcher should have 10 USDC to cover deposits outstanding
          expect(await usdc.balanceOf(batcher.address)).to.equal(10_000_000)

          expect(await batcher.totalBalance()).to.equal(utils.parseEther('1000210'))
        })

        it('rebalances deposits outstanding, lack of usdc', async () => {
          const { dsu, usdc, reserve, user, user2 } = proto

          // Get DSU from reserve and unwrap via batcher
          await usdc.connect(user2).approve(reserve.address, 10_000_000)
          await dsu.connect(user2).approve(batcher.address, utils.parseEther('10'))
          await reserve.connect(user2).mint(utils.parseEther('10'))
          await batcher.connect(user2).unwrap(utils.parseEther('10'), user2.address)

          await expect(batcher.connect(user).rebalance())
            .to.emit(batcher, 'Rebalance')
            .withArgs(0, utils.parseEther('10'))
            .to.emit(reserve, 'Redeem')
            .withArgs(batcher.address, utils.parseEther('10'), 10_000_000)

          // Batcher should have 10 USDC to cover deposits outstanding
          expect(await usdc.balanceOf(batcher.address)).to.equal(10_000_000)

          expect(await batcher.totalBalance()).to.equal(utils.parseEther('1000210'))
        })
      })

      context('transferred in usdc', () => {
        beforeEach(async () => {
          await batcher.connect(proto.user).deposit(utils.parseEther('10'))
          await proto.usdc.connect(proto.usdcHolder).transfer(batcher.address, 5_000_000)
        })

        it('rebalances deposits outstanding, excess usdc', async () => {
          const { usdc, reserve, user, user2 } = proto
          await batcher.connect(user2).wrap(utils.parseEther('100'), user2.address)

          await expect(batcher.connect(user).rebalance())
            .to.emit(batcher, 'Rebalance')
            .withArgs(utils.parseEther('105'), 0)
            .to.emit(reserve, 'Mint')
            .withArgs(batcher.address, utils.parseEther('105'), 105_000_000)

          // Batcher should have 10 USDC to cover deposits outstanding
          expect(await usdc.balanceOf(batcher.address)).to.equal(10_000_000)

          expect(await batcher.totalBalance()).to.equal(utils.parseEther('1000015'))
        })

        it('rebalances deposits outstanding, lack of usdc', async () => {
          const { dsu, usdc, reserve, user, user2 } = proto

          // Get DSU from reserve and unwrap via batcher
          await usdc.connect(user2).approve(reserve.address, 10_000_000)
          await dsu.connect(user2).approve(batcher.address, utils.parseEther('10'))
          await reserve.connect(user2).mint(utils.parseEther('10'))
          await batcher.connect(user2).unwrap(utils.parseEther('10'), user2.address)

          await expect(batcher.connect(user).rebalance())
            .to.emit(batcher, 'Rebalance')
            .withArgs(0, utils.parseEther('5'))
            .to.emit(reserve, 'Redeem')
            .withArgs(batcher.address, utils.parseEther('5'), 5_000_000)

          // Batcher should have 10 USDC to cover deposits outstanding
          expect(await usdc.balanceOf(batcher.address)).to.equal(10_000_000)

          expect(await batcher.totalBalance()).to.equal(utils.parseEther('1000015'))
        })
      })
    })

    describe('#close', async () => {
      beforeEach(async () => {
        await proto.usdc.connect(proto.user).approve(batcher.address, utils.parseEther('1000000'))
        await proto.usdc.connect(proto.user2).approve(batcher.address, utils.parseEther('1000000'))
      })

      it('closes', async () => {
        const { reserve, deployer, user } = proto
        await batcher.connect(user).wrap(utils.parseEther('1000'), user.address)

        await expect(batcher.connect(deployer).close())
          .to.emit(batcher, 'Close')
          .withArgs(utils.parseEther('1000000'))
          .to.emit(reserve, 'Mint')
          .withArgs(batcher.address, utils.parseEther('1000'), 1_000_000_000)
          .to.emit(reserve, 'Repay')
          .withArgs(batcher.address, utils.parseEther('1000000'))

        expect(await reserve.debt(batcher.address)).to.equal(0)
      })

      it('closes empty', async () => {
        const { reserve, deployer } = proto
        await expect(batcher.connect(deployer).close()).to.emit(batcher, 'Close').withArgs(utils.parseEther('1000000'))

        expect(await reserve.debt(batcher.address)).to.equal(0)
      })

      it('closes rounding', async () => {
        const { usdc, reserve, deployer, user } = proto
        await batcher.connect(user).wrap(utils.parseEther('1000').add(1), user.address)

        // When wrapping 1000 + 1e-18, the user is debited 1000 + 1e-6 USDC due to rounding
        // The batcher therefore has a USDC balance of 1000 + 1e-6 which represents an excess of
        // 1e-6 - 1e-18 = 1e-12. When that amount is minted with the Reserve during close, it will take 1e-6 USDC from
        // the Batcher due to rounding, resulting in a total DSU balance of 1_000_000 + 1e12 - 1
        await expect(batcher.connect(deployer).close())
          .to.emit(reserve, 'Mint')
          .withArgs(batcher.address, utils.parseEther('1000').add(1e12), 1_000_000_001)
          .to.emit(reserve, 'Repay')
          .withArgs(batcher.address, utils.parseEther('1000000'))
          .to.emit(reserve, 'Redeem') // Redeem the excess amount (due to rounding this is 0)
          .withArgs(batcher.address, 1e12 - 1, 0)
          .to.emit(usdc, 'Transfer') // Transfer the 'excess' USDC amount
          .withArgs(batcher.address, deployer.address, 0)
          .to.emit(batcher, 'Close')
          .withArgs(utils.parseEther('1000000').add(1e12 - 1))

        expect(await reserve.debt(batcher.address)).to.equal(0)
      })

      it('closes DSU excess', async () => {
        const { usdc, dsu, reserve, deployer, user } = proto
        await batcher.connect(user).wrap(utils.parseEther('1000'), user.address)
        await dsu.connect(user).transfer(batcher.address, utils.parseEther('10')) // Give the batcher excess DSU

        await expect(batcher.connect(deployer).close())
          .to.emit(reserve, 'Repay')
          .withArgs(batcher.address, utils.parseEther('1000000'))
          .to.emit(reserve, 'Redeem') // Redeem the excess amount
          .withArgs(batcher.address, utils.parseEther('10'), 10_000_000)
          .to.emit(usdc, 'Transfer') // Transfer the 'excess' USDC amount
          .withArgs(batcher.address, deployer.address, 10_000_000)
          .to.emit(batcher, 'Close')
          .withArgs(utils.parseEther('1000010'))

        expect(await reserve.debt(batcher.address)).to.equal(0)
      })

      it('closes deposits outstanding, excess usdc', async () => {
        const { reserve, deployer, user, user2 } = proto

        await batcher.connect(user).deposit(utils.parseEther('10'))
        await batcher.connect(user2).wrap(utils.parseEther('20'), user2.address)

        await expect(batcher.connect(deployer).close())
          .to.emit(reserve, 'Mint')
          .withArgs(batcher.address, utils.parseEther('20'), 20_000_000)
          .to.emit(reserve, 'Repay')
          .withArgs(batcher.address, utils.parseEther('1000000'))
          .to.emit(batcher, 'Close')
          .withArgs(utils.parseEther('1000000'))

        expect(await reserve.debt(batcher.address)).to.equal(0)
      })

      it('closes deposits outstanding, lack of usdc', async () => {
        const { reserve, usdc, dsu, deployer, user, user2 } = proto

        // Deposit USDC
        await batcher.connect(user).deposit(utils.parseEther('10'))

        // User2 mints directly and unwraps via Batcher
        await usdc.connect(user2).approve(reserve.address, 5_000_000)
        await reserve.connect(user2).mint(utils.parseEther('5'))
        await dsu.connect(user2).approve(batcher.address, utils.parseEther('5'))
        await batcher.connect(user2).unwrap(utils.parseEther('5'), user2.address)

        await expect(batcher.connect(deployer).close())
          .to.emit(reserve, 'Redeem')
          .withArgs(batcher.address, utils.parseEther('5'), 5_000_000)
          .to.emit(reserve, 'Repay')
          .withArgs(batcher.address, utils.parseEther('1000000'))
          .to.emit(batcher, 'Close')
          .withArgs(utils.parseEther('1000000'))

        expect(await reserve.debt(batcher.address)).to.equal(0)
        expect(await usdc.balanceOf(batcher.address)).to.equal(10_000_000)
      })

      it('closes not owner', async () => {
        await expect(batcher.connect(proto.user).close())
          .to.be.revertedWithCustomError(batcher, 'UOwnableNotOwnerError')
          .withArgs(proto.user.address)
      })

      context('transferred in dsu', () => {
        beforeEach(async () => {
          await batcher.connect(proto.user).deposit(utils.parseEther('10'))
          await proto.dsu.connect(proto.usdcHolder).transfer(batcher.address, utils.parseEther('200'))
        })

        it('closes oustanding deposits, excess usdc', async () => {
          const { usdc, reserve, deployer, user2 } = proto
          await batcher.connect(user2).wrap(utils.parseEther('100'), user2.address)

          await expect(batcher.connect(deployer).close())
            .to.emit(reserve, 'Mint')
            .withArgs(batcher.address, utils.parseEther('100'), 100_000_000)
            .to.emit(reserve, 'Repay')
            .withArgs(batcher.address, utils.parseEther('1000000'))
            .to.emit(usdc, 'Transfer')
            .withArgs(batcher.address, deployer.address, 200_000_000)
            .to.emit(batcher, 'Close')
            .withArgs(utils.parseEther('1000200'))

          // Batcher should have 10 USDC to cover deposits outstanding
          expect(await usdc.balanceOf(batcher.address)).to.equal(10_000_000)

          expect(await reserve.debt(batcher.address)).to.equal(0)
        })

        it('rebalances deposits outstanding, lack of usdc', async () => {
          const { dsu, usdc, reserve, deployer, user2 } = proto

          // Get DSU from reserve and unwrap via batcher
          await usdc.connect(user2).approve(reserve.address, 10_000_000)
          await dsu.connect(user2).approve(batcher.address, utils.parseEther('10'))
          await reserve.connect(user2).mint(utils.parseEther('10'))
          await batcher.connect(user2).unwrap(utils.parseEther('10'), user2.address)

          await expect(batcher.connect(deployer).close())
            .to.emit(reserve, 'Redeem')
            .withArgs(batcher.address, utils.parseEther('10'), 10_000_000)
            .to.emit(reserve, 'Repay')
            .withArgs(batcher.address, utils.parseEther('1000000'))
            .to.emit(batcher, 'Close')
            .withArgs(utils.parseEther('1000200'))

          // Batcher should have 10 USDC to cover deposits outstanding
          expect(await usdc.balanceOf(batcher.address)).to.equal(10_000_000)

          expect(await reserve.debt(batcher.address)).to.equal(0)
        })
      })

      context('transferred in usdc', () => {
        beforeEach(async () => {
          await batcher.connect(proto.user).deposit(utils.parseEther('10'))
          await proto.usdc.connect(proto.usdcHolder).transfer(batcher.address, 5_000_000)
        })

        it('close deposits outstanding, excess usdc', async () => {
          const { usdc, reserve, deployer, user2 } = proto
          await batcher.connect(user2).wrap(utils.parseEther('100'), user2.address)

          await expect(batcher.connect(deployer).close())
            .to.emit(reserve, 'Mint')
            .withArgs(batcher.address, utils.parseEther('105'), 105_000_000)
            .to.emit(reserve, 'Repay')
            .withArgs(batcher.address, utils.parseEther('1000000'))
            .to.emit(usdc, 'Transfer')
            .withArgs(batcher.address, deployer.address, 5_000_000)
            .to.emit(batcher, 'Close')
            .withArgs(utils.parseEther('1000005'))

          // Batcher should have 10 USDC to cover deposits outstanding
          expect(await usdc.balanceOf(batcher.address)).to.equal(10_000_000)

          expect(await reserve.debt(batcher.address)).to.equal(0)
        })

        it('rebalances deposits outstanding, lack of usdc', async () => {
          const { dsu, usdc, reserve, deployer, user2 } = proto

          // Get DSU from reserve and unwrap via batcher
          await usdc.connect(user2).approve(reserve.address, 10_000_000)
          await dsu.connect(user2).approve(batcher.address, utils.parseEther('10'))
          await reserve.connect(user2).mint(utils.parseEther('10'))
          await batcher.connect(user2).unwrap(utils.parseEther('10'), user2.address)

          await expect(batcher.connect(deployer).close())
            .to.emit(reserve, 'Redeem')
            .withArgs(batcher.address, utils.parseEther('5'), 5_000_000)
            .to.emit(reserve, 'Repay')
            .withArgs(batcher.address, utils.parseEther('1000000'))
            .to.emit(batcher, 'Close')
            .withArgs(utils.parseEther('1000005'))
          // Batcher should have 10 USDC to cover deposits outstanding
          expect(await usdc.balanceOf(batcher.address)).to.equal(10_000_000)

          expect(await reserve.debt(batcher.address)).to.equal(0)
        })
      })
    })
  })
})
