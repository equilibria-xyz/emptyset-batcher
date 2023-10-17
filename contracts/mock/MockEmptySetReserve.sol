//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

import "@equilibria/root/token/types/Token18.sol";
import "@equilibria/root/token/types/Token6.sol";
import "../interfaces/IEmptySetReserve.sol";

/// @title MockEmptySetReserve
/// @notice Mock contract that allows the user to simulate the EmptySetReserve having partial solvency.
contract MockEmptySetReserve is IEmptySetReserve {
    /// @dev DSU address
    Token18 public immutable DSU; // solhint-disable-line var-name-mixedcase

    /// @dev USDC address
    Token6 public immutable USDC; // solhint-disable-line var-name-mixedcase

    UFixed18 public immutable mintRatio;
    UFixed18 public immutable redeemRatio;

    constructor(Token18 dsu_, Token6 usdc_, UFixed18 mintRatio_, UFixed18 redeemRatio_) {
        DSU = dsu_;
        USDC = usdc_;

        mintRatio = mintRatio_;
        redeemRatio = redeemRatio_;
    }

    function debt(address) external pure returns (UFixed18) {
        return UFixed18Lib.ZERO;
    }

    function repay(address borrower, UFixed18 amount) external {}

    function mint(UFixed18 amount) external {
        DSU.push(msg.sender, amount.mul(mintRatio));
    }

    function redeem(UFixed18 amount) external {
        USDC.push(msg.sender, amount.mul(redeemRatio));
    }
}
