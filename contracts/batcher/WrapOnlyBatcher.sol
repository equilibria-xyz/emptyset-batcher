//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.10;

import "../utils/types/UFixed18.sol";
import "../utils/types/Token18.sol";
import "../utils/types/Token6.sol";
import "./Batcher.sol";

contract WrapOnlyBatcher is Batcher {
    using UFixed18Lib for UFixed18;
    using Token18Lib for Token18;
    using Token6Lib for Token6;

    constructor(IEmptySetReserve reserve, Token18 dsu, Token6 usdc)
    Batcher(reserve, dsu, usdc) {
        USDC.approve(address(RESERVE));
    }

    function _wrap(UFixed18 amount, address to) override internal {
        USDC.pull(msg.sender, amount, true);
        DSU.push(to, amount);

        emit Wrap(to, amount);
    }

    function _unwrap(UFixed18 amount, address to) override internal {
        revert BatcherNotImplementedError();
    }

    function _rebalance(UFixed18 usdcBalance, UFixed18 dsuBalance) override internal {
        if (usdcBalance.isZero()) return;

        RESERVE.mint(usdcBalance);
    }
}
