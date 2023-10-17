//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

import "../batcher/TwoWayBatcher.sol";

contract MockTwoWayBatcher is TwoWayBatcher {
    UFixed18 public immutable wrapRatio;
    UFixed18 public immutable unwrapRatio;

    constructor(IEmptySetReserve reserve_, Token18 dsu_, Token6 usdc_, UFixed18 wrapRatio_, UFixed18 unwrapRatio_)
    TwoWayBatcher(reserve_, dsu_, usdc_)
    {
        wrapRatio = wrapRatio_;
        unwrapRatio = unwrapRatio_;
    }

    function _wrap(UFixed18 amount, address to) override internal {
        USDC.pull(msg.sender, amount, true);
        DSU.push(to, amount.mul(wrapRatio));
    }

    function _unwrap(UFixed18 amount, address to) override internal {
        DSU.pull(msg.sender, amount);
        USDC.push(to, amount.mul(unwrapRatio));
    }
}
