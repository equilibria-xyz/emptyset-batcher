//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

import "@equilibria/root/token/types/Token18.sol";
import "@equilibria/root/token/types/Token6.sol";
import "@equilibria/root/control/unstructured/UReentrancyGuard.sol";
import "@equilibria/root/control/unstructured/UOwnable.sol";
import "../interfaces/ITwoWayBatcher.sol";
import "../interfaces/IWrapper.sol";

/// @title Wrapper
/// @notice Helper contract for wrapping and unwrapping USDC and DSU without worrying about approvals or dependences.
/// @dev To wrap USDC, the caller must first send USDC to this contract, then call `wrap`.
///      Similarly, to unwrap DSU, the caller must first send DSU to this contract, then call
///      `unwrap`. This contract can be optionally supplied with a TwoWayBatcher to save gas. It is
///      recommended to only use this contract in contexts where the caller can atomically bundle
///      the USDC/DSU transfer with the `wrap`/`unwrap` call (e.g. if the caller is a contract that
///      can bundle the transfer with the call in a single transaction, or if the caller is an EOA
///      using flashbots-style bundles).
contract Wrapper is IWrapper, UReentrancyGuard, UOwnable {
    /// @dev Reserve address
    IEmptySetReserve public immutable RESERVE; // solhint-disable-line var-name-mixedcase

    /// @dev DSU address
    Token18 public immutable DSU; // solhint-disable-line var-name-mixedcase

    /// @dev USDC address
    Token6 public immutable USDC; // solhint-disable-line var-name-mixedcase

    /// @dev Batcher address
    ITwoWayBatcher public batcher;

    /// @notice Initializes the Wrapper
    /// @param reserve_ EmptySet Reserve address
    /// @param batcher_ Optional TwoWayBatcher address (can be set to address(0) if doesn't exist)
    /// @param dsu_ DSU Token address
    /// @param usdc_ USDC Token Address
    constructor(IEmptySetReserve reserve_, ITwoWayBatcher batcher_, Token18 dsu_, Token6 usdc_) {
        __UReentrancyGuard__initialize();
        __UOwnable__initialize();

        DSU = dsu_;
        USDC = usdc_;
        RESERVE = reserve_;
        DSU.approve(address(RESERVE));
        USDC.approve(address(RESERVE));
        if (address(batcher_) != address(0)) setBatcher(batcher_);
    }

    /// @notice Updates the Batcher address
    /// @param batcher_ TwoWayBatcher address
    function setBatcher(ITwoWayBatcher batcher_) public onlyOwner {
        batcher = batcher_;
        DSU.approve(address(batcher));
        USDC.approve(address(batcher));
    }

    /// @notice Wraps all USDC owned by this contract and sends the DSU to `to`
    /// @dev Falls back on the non-batcher wrapping flow if no batcher is set or the batcher has
    ///      little DSU.
    /// @param to Receiving address of resulting DSU
    function wrap(address to) external nonReentrant {
        UFixed18 usdcBalance = USDC.balanceOf();
        if (address(batcher) != address(0) && DSU.balanceOf(address(batcher)).gte(usdcBalance)) {
            batcher.wrap(usdcBalance, to);
        } else {
            RESERVE.mint(usdcBalance);
            DSU.push(to, usdcBalance);
        }
    }

    /// @notice Unwraps all DSU owned by this contract and sends the USDC to `to`
    /// @dev Falls back on the non-batcher wrapping flow if no batcher is set or the batcher has
    ///      little USDC.
    /// @param to Receiving address of resulting USDC
    function unwrap(address to) external nonReentrant {
        UFixed18 dsuBalance = DSU.balanceOf();
        if (address(batcher) != address(0) && USDC.balanceOf(address(batcher)).gte(dsuBalance)) {
            batcher.unwrap(dsuBalance, to);
        } else {
            RESERVE.redeem(dsuBalance);
            USDC.push(to, dsuBalance);
        }
    }
}
