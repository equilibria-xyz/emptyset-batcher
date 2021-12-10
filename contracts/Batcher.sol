//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.10;

import "./utils/types/UFixed18.sol";
import "./utils/types/Token18.sol";
import "./utils/types/Token6.sol";

//TODO: tests
//TODO: owner
contract Batcher {
    using UFixed18Lib for UFixed18;
    using Token18Lib for Token18;
    using Token6Lib for Token6;

    error BalanceMismatch(UFixed18 oldBalance, UFixed18 newBalance);

    event Wrap(address indexed to, UFixed18 amount);
    event Unwrap(address indexed to, UFixed18 amount);
    event Rebalance(UFixed18 newMinted, UFixed18 newRedeemed);

    IEmptySetReserve public constant RESERVE = IEmptySetReserve(0xD05aCe63789cCb35B9cE71d01e4d632a0486Da4B);
    Token18 public constant DSU = Token18.wrap(address(0x605D26FBd5be761089281d5cec2Ce86eeA667109));
    Token6 public constant USDC = Token6.wrap(address(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48));

    UFixed18 public target;

    // TODO: constructor
    // TODO: param updates

    function totalBalance() public view returns (UFixed18) {
        return DSU.balanceOf().add(USDC.balanceOf());
    }

    function wrap(UFixed18 amount, address to) external {
        USDC.pull(msg.sender, amount, true);
        DSU.push(to, amount);

        emit Wrap(to, amount);
    }

    function unwrap(UFixed18 amount, address to) external {
        DSU.pull(msg.sender, amount);
        USDC.push(to, amount);

        emit Unwrap(to, amount);
    }

    function rebalance() external {
        UFixed18 balance = totalBalance();
        UFixed18 dsuBalance = DSU.balanceOf();
        UFixed18 dsuTarget = balance.mul(target);

        if (dsuBalance.eq(dsuTarget)) return;

        //TODO: mint USDC rounding errors
        if (dsuBalance.gt(dsuTarget)) {
            UFixed18 amount = dsuBalance.sub(dsuTarget);
            RESERVE.redeem(amount);

            emit Rebalance(UFixed18Lib.ZERO, amount);
        } else {
            UFixed18 amount = dsuTarget.sub(dsuBalance);
            RESERVE.mint(amount);

            emit Rebalance(amount, UFixed18Lib.ZERO);
        }

        //TODO: mint USDC rounding errors
        if (!totalBalance().eq(balance)) revert BalanceMismatch(balance, totalBalance());

        //TODO: reward, timelocked
    }

    //TODO: close
}

interface IEmptySetReserve {
    // function redeemPrice() public view returns (Decimal.D256 memory); TODO: needed?
    function mint(UFixed18 amount) external;
    function redeem(UFixed18 amount) external;
}
