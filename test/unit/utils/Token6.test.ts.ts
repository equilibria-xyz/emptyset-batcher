import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { utils } from 'ethers'
import { expect } from 'chai'
import HRE, { waffle } from 'hardhat'

import { IERC20Metadata__factory, MockToken6, MockToken6__factory } from '../../../types/generated'
import { MockContract } from '@ethereum-waffle/mock-contract'

const { ethers } = HRE

describe('Token6', () => {
  let user: SignerWithAddress
  let recipient: SignerWithAddress
  let token6: MockToken6
  let erc20: MockContract

  beforeEach(async () => {
    ;[user, recipient] = await ethers.getSigners()
    token6 = await new MockToken6__factory(user).deploy()
    erc20 = await waffle.deployMockContract(user, IERC20Metadata__factory.abi)
  })

  describe('#approve', async () => {
    it('approves tokens', async () => {
      await erc20.mock.allowance.withArgs(token6.address, recipient.address).returns(0)
      await erc20.mock.approve.withArgs(recipient.address, 100_000_000).returns(true)

      await token6
        .connect(user)
        ['approve(address,address,uint256)'](erc20.address, recipient.address, utils.parseEther('100'))
    })

    it('approves tokens all', async () => {
      await erc20.mock.allowance.withArgs(token6.address, recipient.address).returns(0)
      await erc20.mock.approve.withArgs(recipient.address, ethers.constants.MaxUint256).returns(true)

      await token6.connect(user)['approve(address,address)'](erc20.address, recipient.address)
    })
  })

  describe('#push', async () => {
    it('transfers tokens', async () => {
      await erc20.mock.transfer.withArgs(recipient.address, 100_000_000).returns(true)

      await token6
        .connect(user)
        ['push(address,address,uint256)'](erc20.address, recipient.address, utils.parseEther('100'))
    })

    it('transfers tokens (round down implicit)', async () => {
      await erc20.mock.transfer.withArgs(recipient.address, 100_000_000).returns(true)

      await token6
        .connect(user)
        ['push(address,address,uint256)'](erc20.address, recipient.address, utils.parseEther('100').add(1))
    })

    it('transfers tokens (round down explicit)', async () => {
      await erc20.mock.transfer.withArgs(recipient.address, 100_000_000).returns(true)

      await token6
        .connect(user)
        ['push(address,address,uint256,bool)'](erc20.address, recipient.address, utils.parseEther('100').add(1), false)
    })

    it('transfers tokens (round up)', async () => {
      await erc20.mock.transfer.withArgs(recipient.address, 100_000_001).returns(true)

      await token6
        .connect(user)
        ['push(address,address,uint256,bool)'](erc20.address, recipient.address, utils.parseEther('100').add(1), true)
    })

    it('transfers tokens (round up when no decimal)', async () => {
      await erc20.mock.transfer.withArgs(recipient.address, 100_000_000).returns(true)

      await token6
        .connect(user)
        ['push(address,address,uint256,bool)'](erc20.address, recipient.address, utils.parseEther('100'), true)
    })

    it('transfers tokens all', async () => {
      await erc20.mock.balanceOf.withArgs(token6.address).returns(100_000_000)
      await erc20.mock.transfer.withArgs(recipient.address, 100_000_000).returns(true)

      await token6.connect(user)['push(address,address)'](erc20.address, recipient.address)
    })
  })

  describe('#pull', async () => {
    it('transfers tokens', async () => {
      await erc20.mock.transferFrom.withArgs(user.address, token6.address, 100_000_000).returns(true)

      await token6.connect(user)['pull(address,address,uint256)'](erc20.address, user.address, utils.parseEther('100'))
    })

    it('transfers tokens (round down implicit)', async () => {
      await erc20.mock.transferFrom.withArgs(user.address, token6.address, 100_000_000).returns(true)

      await token6
        .connect(user)
        ['pull(address,address,uint256)'](erc20.address, user.address, utils.parseEther('100').add(1))
    })

    it('transfers tokens (round down explicit)', async () => {
      await erc20.mock.transferFrom.withArgs(user.address, token6.address, 100_000_000).returns(true)

      await token6
        .connect(user)
        ['pull(address,address,uint256,bool)'](erc20.address, user.address, utils.parseEther('100').add(1), false)
    })

    it('transfers tokens (round up)', async () => {
      await erc20.mock.transferFrom.withArgs(user.address, token6.address, 100_000_001).returns(true)

      await token6
        .connect(user)
        ['pull(address,address,uint256,bool)'](erc20.address, user.address, utils.parseEther('100').add(1), true)
    })

    it('transfers tokens (round up when no decimal)', async () => {
      await erc20.mock.transferFrom.withArgs(user.address, token6.address, 100_000_000).returns(true)

      await token6
        .connect(user)
        ['pull(address,address,uint256,bool)'](erc20.address, user.address, utils.parseEther('100'), true)
    })
  })

  describe('#pullTo', async () => {
    it('transfers tokens', async () => {
      await erc20.mock.transferFrom.withArgs(user.address, recipient.address, 100_000_000).returns(true)

      await token6
        .connect(user)
        ['pullTo(address,address,address,uint256)'](
          erc20.address,
          user.address,
          recipient.address,
          utils.parseEther('100'),
        )
    })

    it('transfers tokens (round down implicit)', async () => {
      await erc20.mock.transferFrom.withArgs(user.address, recipient.address, 100_000_000).returns(true)

      await token6
        .connect(user)
        ['pullTo(address,address,address,uint256)'](
          erc20.address,
          user.address,
          recipient.address,
          utils.parseEther('100').add(1),
        )
    })

    it('transfers tokens (round down explicit)', async () => {
      await erc20.mock.transferFrom.withArgs(user.address, recipient.address, 100_000_000).returns(true)

      await token6
        .connect(user)
        ['pullTo(address,address,address,uint256,bool)'](
          erc20.address,
          user.address,
          recipient.address,
          utils.parseEther('100').add(1),
          false,
        )
    })

    it('transfers tokens (round up)', async () => {
      await erc20.mock.transferFrom.withArgs(user.address, recipient.address, 100_000_001).returns(true)

      await token6
        .connect(user)
        ['pullTo(address,address,address,uint256,bool)'](
          erc20.address,
          user.address,
          recipient.address,
          utils.parseEther('100').add(1),
          true,
        )
    })

    it('transfers tokens (round up when no decimal)', async () => {
      await erc20.mock.transferFrom.withArgs(user.address, recipient.address, 100_000_000).returns(true)

      await token6
        .connect(user)
        ['pullTo(address,address,address,uint256,bool)'](
          erc20.address,
          user.address,
          recipient.address,
          utils.parseEther('100'),
          true,
        )
    })
  })

  describe('#name', async () => {
    it('returns name', async () => {
      await erc20.mock.name.withArgs().returns('Token Name')
      expect(await token6.connect(user).name(erc20.address)).to.equal('Token Name')
    })
  })

  describe('#symbol', async () => {
    it('returns symbol', async () => {
      await erc20.mock.symbol.withArgs().returns('TN')
      expect(await token6.connect(user).symbol(erc20.address)).to.equal('TN')
    })
  })

  describe('#decimals', async () => {
    it('returns decimals', async () => {
      expect(await token6.connect(user).decimals(erc20.address)).to.equal(6)
    })
  })

  describe('#balanceOf', async () => {
    it('returns balance', async () => {
      await erc20.mock.balanceOf.withArgs(user.address).returns(100_000_000)
      expect(await token6.connect(user)['balanceOf(address,address)'](erc20.address, user.address)).to.equal(
        utils.parseEther('100'),
      )
    })

    it('returns balance all', async () => {
      await erc20.mock.balanceOf.withArgs(token6.address).returns(100_000_000)
      expect(await token6.connect(user)['balanceOf(address)'](erc20.address)).to.equal(utils.parseEther('100'))
    })
  })
})
