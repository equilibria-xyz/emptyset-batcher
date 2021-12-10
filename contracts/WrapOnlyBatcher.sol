//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.10;

import "./utils/types/UFixed18.sol";
import "./utils/types/Token18.sol";
import "./utils/types/Token6.sol";
import "./utils/unstructured/UOwnable.sol";
import "./interfaces/IBatcher.sol";

//TODO: tests
//TODO: owner
contract WrapOnlyBatcher is IBatcher, UOwnable {
    using UFixed18Lib for UFixed18;
    using Token18Lib for Token18;
    using Token6Lib for Token6;

    IEmptySetReserve public constant RESERVE = IEmptySetReserve(0xD05aCe63789cCb35B9cE71d01e4d632a0486Da4B);
    Token18 public constant DSU = Token18.wrap(address(0x605D26FBd5be761089281d5cec2Ce86eeA667109));
    Token6 public constant USDC = Token6.wrap(address(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48));

    constructor() {
        DSU.approve(address(RESERVE));

        UOwnable__initialize();
    }

    function totalBalance() public view returns (UFixed18) {
        return DSU.balanceOf().add(USDC.balanceOf());
    }

    function wrap(UFixed18 amount, address to) external {
        USDC.pull(msg.sender, amount, true);
        DSU.push(to, amount);

        emit Wrap(to, amount);
    }

    function unwrap(UFixed18 amount, address to) external {
        revert BatcherNotImplementedError();
    }

    function rebalance() public {
        UFixed18 usdcBalance = USDC.balanceOf();
        UFixed18 dsuBalance = USDC.balanceOf();

        if (usdcBalance.isZero()) revert BatcherOnTargetError();

        RESERVE.mint(usdcBalance);

        (UFixed18 oldBalance, UFixed18 newBalance) = (usdcBalance.add(dsuBalance), totalBalance());
        if (!oldBalance.eq(newBalance)) revert BatcherBalanceMismatchError(oldBalance, newBalance);
    }

    function close() external onlyOwner {
        rebalance();
        DSU.push(address(RESERVE));
    }
}

interface IEmptySetReserve {
    function mint(UFixed18 amount) external;
    function redeem(UFixed18 amount) external;
}
