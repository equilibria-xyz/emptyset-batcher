//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.13;

import "@equilibria/root/number/types/UFixed18.sol";
import "@equilibria/root/token/types/Token18.sol";
import "@equilibria/root/token/types/Token6.sol";
import "./Batcher.sol";

contract WrapOnlyBatcher is Batcher {
    constructor(IEmptySetReserve reserve, Token18 dsu, Token6 usdc)
    Batcher(reserve, dsu, usdc)
    { }

    function _unwrap(UFixed18, address) override internal {
        revert BatcherNotImplementedError();
    }

    function _rebalance(UFixed18 usdcBalance, UFixed18) override internal {
        if (usdcBalance.isZero()) return;

        RESERVE.mint(usdcBalance);
    }

    function _close() override internal {
        rebalance();
    }
}
