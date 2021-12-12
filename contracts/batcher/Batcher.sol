//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.10;

import "../utils/types/UFixed18.sol";
import "../utils/types/Token18.sol";
import "../utils/types/Token6.sol";
import "../utils/unstructured/UOwnable.sol";
import "../interfaces/IBatcher.sol";

abstract contract Batcher is IBatcher, UOwnable {
    using UFixed18Lib for UFixed18;
    using Token18Lib for Token18;
    using Token6Lib for Token6;

    IEmptySetReserve public immutable RESERVE;
    Token18 public immutable DSU;
    Token6 public immutable USDC;

    constructor(IEmptySetReserve reserve, Token18 dsu, Token6 usdc) {
        RESERVE = reserve;
        DSU = dsu;
        USDC = usdc;

        UOwnable__initialize();
    }

    function totalBalance() public view returns (UFixed18) {
        return DSU.balanceOf().add(USDC.balanceOf());
    }

    function wrap(UFixed18 amount, address to) external {
        _wrap(amount, to);
        emit Wrap(to, amount);
    }

    function _wrap(UFixed18 amount, address to) virtual internal;

    function unwrap(UFixed18 amount, address to) external {
        _unwrap(amount, to);
        emit Unwrap(to, amount);
    }

    function _unwrap(UFixed18 amount, address to) virtual internal;

    function rebalance() external {
        (UFixed18 usdcBalance, UFixed18 dsuBalance) = (USDC.balanceOf(), DSU.balanceOf());

        _rebalance(USDC.balanceOf(), DSU.balanceOf());

        (UFixed18 oldBalance, UFixed18 newBalance) = (usdcBalance.add(dsuBalance), totalBalance());
        if (!oldBalance.eq(newBalance)) revert BatcherBalanceMismatchError(oldBalance, newBalance);

        emit Rebalance(usdcBalance, UFixed18Lib.ZERO);
    }

    function _rebalance(UFixed18 usdcBalance, UFixed18 dsuBalance) virtual internal;

    function close() external onlyOwner {
        UFixed18 usdcBalance = USDC.balanceOf();
        if (!usdcBalance.isZero()) RESERVE.mint(usdcBalance);

        UFixed18 dsuBalance = DSU.balanceOf();
        DSU.push(address(RESERVE), dsuBalance);

        emit Close(dsuBalance);
    }
}

interface IEmptySetReserve {
    function mint(UFixed18 amount) external;
    function redeem(UFixed18 amount) external;
}
