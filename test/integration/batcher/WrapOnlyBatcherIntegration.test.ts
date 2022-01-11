import { expect } from 'chai'
import 'hardhat'
import { ethers, Signer, utils } from 'ethers'

import { InstanceVars, deployProtocol } from '../setupHelpers'
import { WrapOnlyBatcher, WrapOnlyBatcher__factory } from '../../../types/generated'
import { impersonate } from '../../testutil'

describe('WrapOnlyBatcher', () => {
  let proto: InstanceVars
  let batcher: WrapOnlyBatcher
  let reserveImpersonator: Signer

  beforeEach(async () => {
    proto = await deployProtocol()

    batcher = await new WrapOnlyBatcher__factory(proto.deployer).deploy(
      proto.reserve.address,
      proto.dsu.address,
      proto.usdc.address,
    )
    await batcher.setPendingOwner(proto.timelock.address)
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
        await proto.usdc.connect(proto.user).approve(batcher.address, 1000000_000_000)
      })

      it('wraps token exact', async () => {
        expect(await batcher.totalBalance()).to.equal(utils.parseEther('1000000'))

        await expect(batcher.connect(proto.user).wrap(utils.parseEther('100'), proto.timelock.address))
          .to.emit(batcher, 'Wrap')
          .withArgs(proto.timelock.address, utils.parseEther('100'))

        expect(await proto.dsu.balanceOf(proto.timelock.address)).to.equal(utils.parseEther('100'))
        expect(await proto.usdc.balanceOf(proto.timelock.address)).to.equal(0)

        expect(await proto.dsu.balanceOf(proto.user.address)).to.equal(0)
        expect(await proto.usdc.balanceOf(proto.user.address)).to.equal(1000000_000_000 - 100_000_000)

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
        expect(await proto.usdc.balanceOf(proto.user.address)).to.equal(1000000_000_000 - 300_000_000)

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
        expect(await proto.usdc.balanceOf(proto.user.address)).to.equal(1000000_000_000 - 300_000_000)

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
        expect(await proto.usdc.balanceOf(proto.user.address)).to.equal(1000000_000_000 - 100_000_001)

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
      it('reverts', async () => {
        await expect(
          batcher.connect(proto.user).unwrap(utils.parseEther('100'), proto.timelock.address),
        ).to.be.revertedWith('BatcherNotImplementedError()')
      })
    })

    describe('#rebalance', async () => {
      beforeEach(async () => {
        await proto.usdc.connect(proto.user).approve(batcher.address, 1000000_000_000)
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
    })
  })
})
