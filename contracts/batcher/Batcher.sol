//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.13;

import "@equilibria/root/number/types/UFixed18.sol";
import "@equilibria/root/token/types/Token18.sol";
import "@equilibria/root/token/types/Token6.sol";
import "@equilibria/root/control/unstructured/UOwnable.sol";
import "../interfaces/IBatcher.sol";
import "../interfaces/IEmptySetReserve.sol";

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

        DSU.approve(address(RESERVE));
        USDC.approve(address(RESERVE));

        __UOwnable__initialize();
    }

    function totalBalance() public view returns (UFixed18) {
        return DSU.balanceOf().add(USDC.balanceOf());
    }

    function wrap(UFixed18 amount, address to) external {
        _wrap(amount, to);
        emit Wrap(to, amount);
    }

    function _wrap(UFixed18 amount, address to) virtual internal {
        USDC.pull(msg.sender, amount, true);
        DSU.push(to, amount);
    }

    function unwrap(UFixed18 amount, address to) external {
        _unwrap(amount, to);
        emit Unwrap(to, amount);
    }

    function _unwrap(UFixed18 amount, address to) virtual internal {
        DSU.pull(msg.sender, amount);
        USDC.push(to, amount);
    }

    function rebalance() public {
        (UFixed18 usdcBalance, UFixed18 dsuBalance) = (USDC.balanceOf(), DSU.balanceOf());

        _rebalance(usdcBalance, dsuBalance);

        UFixed18 newDsuBalance = DSU.balanceOf();
        (UFixed18 oldBalance, UFixed18 newBalance) = (usdcBalance.add(dsuBalance), totalBalance());
        if (oldBalance.gt(newBalance)) revert BatcherBalanceMismatchError(oldBalance, newBalance);

        emit Rebalance(
            newDsuBalance.gt(dsuBalance) ? newDsuBalance.sub(dsuBalance) : UFixed18Lib.ZERO,
            dsuBalance.gt(newDsuBalance) ? dsuBalance.sub(newDsuBalance) : UFixed18Lib.ZERO
        );
    }

    function _rebalance(UFixed18 usdcBalance, UFixed18 dsuBalance) virtual internal;

    function close() external onlyOwner {
        UFixed18 usdcBalance = USDC.balanceOf();

        _close(usdcBalance);

        UFixed18 dsuBalance = DSU.balanceOf();
        UFixed18 repayAmount = UFixed18Lib.min(RESERVE.debt(address(this)), dsuBalance);
        UFixed18 returnAmount = dsuBalance.sub(repayAmount);

        RESERVE.repay(address(this), repayAmount);

        // If there is any excess DSU, redeem it for USDC and send to the owner
        if (!returnAmount.isZero()) {
            RESERVE.redeem(returnAmount);
            USDC.push(owner(), returnAmount);
        }

        emit Close(dsuBalance);
    }

    function _close(UFixed18 usdcBalance) virtual internal;
}
