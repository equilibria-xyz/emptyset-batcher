import { utils } from 'ethers'
import { expect, use } from 'chai'
import HRE from 'hardhat'

import { IEmptySetReserve, IERC20, WrapOnlyBatcher, WrapOnlyBatcher__factory } from '../../../types/generated'

import { smock, FakeContract } from '@defi-wonderland/smock'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { nextContractAddress } from '../../testutil/contract'

const { ethers } = HRE
use(smock.matchers)

describe('WrapOnlyBatcher', () => {
  let user: SignerWithAddress
  let owner: SignerWithAddress
  let to: SignerWithAddress
  let reserve: FakeContract<IEmptySetReserve>
  let dsu: FakeContract<IERC20>
  let usdc: FakeContract<IERC20>
  let batcher: WrapOnlyBatcher

  beforeEach(async () => {
    ;[user, owner, to] = await ethers.getSigners()
    reserve = await smock.fake<IEmptySetReserve>('IEmptySetReserve')
    dsu = await smock.fake<IERC20>('IERC20')
    usdc = await smock.fake<IERC20>('IERC20')

    const batcherAddress = await nextContractAddress(owner, 4)
    dsu.allowance.whenCalledWith(batcherAddress, reserve.address).returns(0)
    dsu.approve.whenCalledWith(reserve.address, ethers.constants.MaxUint256).returns(true)
    usdc.allowance.whenCalledWith(batcherAddress, reserve.address).returns(0)
    usdc.approve.whenCalledWith(reserve.address, ethers.constants.MaxUint256).returns(true)

    batcher = await new WrapOnlyBatcher__factory(owner).deploy(reserve.address, dsu.address, usdc.address)
  })

  describe('#constructor', async () => {
    it('sets reserve', async () => {
      expect(await batcher.RESERVE()).to.equal(reserve.address)
      expect(await batcher.reserve()).to.equal(reserve.address)
    })

    it('sets dsu', async () => {
      expect(await batcher.DSU()).to.equal(dsu.address)
      expect(await batcher.dsu()).to.equal(dsu.address)
    })

    it('sets usdc', async () => {
      expect(await batcher.USDC()).to.equal(usdc.address)
      expect(await batcher.usdc()).to.equal(usdc.address)
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
    it('reverts', async () => {
      await expect(batcher.connect(user).unwrap(utils.parseEther('100'), to.address)).to.be.revertedWith(
        'BatcherNotImplementedError()',
      )
    })
  })

  // NOTE: The below tests don't work because of strangeness in smock.
  // describe('#rebalance', async () => {
  //   it('rebalances assets', async () => {
  //     let mintCalled = false

  //     dsu.balanceOf.returns(() => {
  //       return mintCalled ? utils.parseEther('200') : utils.parseEther('100')
  //     })
  //     usdc.balanceOf.returns(() => {
  //       return mintCalled ? 0 : 100_000_000
  //     })

  //     reserve.mint.whenCalledWith(utils.parseEther('100')).returns(() => {
  //       mintCalled = true
  //     })

  //     await expect(batcher.connect(user).rebalance()).to.emit(batcher, 'Rebalance').withArgs(utils.parseEther('100'), 0)
  //   })

  //   it('rebalances assets rounding', async () => {
  //     dsu.balanceOf.whenCalledWith(batcher.address).returns(utils.parseEther('100').add(1))
  //     usdc.balanceOf.whenCalledWith(batcher.address).returns(100_000_000)

  //     reserve.mint.whenCalledWith(utils.parseEther('100')).returns()

  //     await expect(batcher.connect(user).rebalance()).to.emit(batcher, 'Rebalance').withArgs(utils.parseEther('100'), 0)
  //   })

  //   it('rebalances assets zero', async () => {
  //     dsu.balanceOf.whenCalledWith(batcher.address).returns(utils.parseEther('100'))
  //     usdc.balanceOf.whenCalledWith(batcher.address).returns(0)

  //     await expect(batcher.connect(user).rebalance())
  //   })
  // })

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
      dsu.transfer.whenCalledWith(reserve.address, utils.parseEther('200')).returns(true)
      dsu.transfer.whenCalledWith(reserve.address, 1).returns(true)

      await expect(batcher.connect(owner).close()).to.emit(batcher, 'Close').withArgs(utils.parseEther('200').add(1))
    })

    it('closes not owner', async () => {
      await expect(batcher.connect(user).close()).to.be.revertedWith(`UOwnableNotOwnerError("${user.address}")`)
    })
  })
})
