//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.13;

import "@equilibria/root/number/types/UFixed18.sol";
import "@equilibria/root/token/types/Token18.sol";
import "@equilibria/root/token/types/Token6.sol";
import "@equilibria/root/control/unstructured/UReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./Batcher.sol";

contract TwoWayBatcher is UReentrancyGuard, Batcher, ERC20 {
    event Deposit(address indexed account, UFixed18 amount);
    event Withdraw(address indexed account, UFixed18 amount);

    error TwoWayBatcherInvalidTokenAmount(UFixed18 amount);

    constructor(IEmptySetReserve reserve, Token18 dsu, Token6 usdc)
    Batcher(reserve, dsu, usdc)
    ERC20("Batcher Deposit", "BDEP")
    { }

    function deposit(UFixed18 amount) external nonReentrant {
        if (!_validToken6Amount(amount)) revert TwoWayBatcherInvalidTokenAmount(amount);

        rebalance();

        USDC.pull(msg.sender, amount, true);

        _mint(msg.sender, UFixed18.unwrap(amount));

        emit Deposit(msg.sender, amount);
    }

    function withdraw(UFixed18 amount) external nonReentrant {
        if (!_validToken6Amount(amount)) revert TwoWayBatcherInvalidTokenAmount(amount);

        rebalance();

        _burn(msg.sender, UFixed18.unwrap(amount));

        USDC.push(msg.sender, amount);

        emit Withdraw(msg.sender, amount);
    }

    function _rebalance(UFixed18 usdcBalance, UFixed18) override internal {
        UFixed18 totalSupply = UFixed18.wrap(totalSupply());
        uint256 balanceToTarget = usdcBalance.compare(totalSupply);

        // totalUSDCLoans == usdcBalance: Do nothing
        if (balanceToTarget == 1) return;

        // usdcBalance > totalUSDCLoans: deposit excess USDC
        if (balanceToTarget == 2) return RESERVE.mint(usdcBalance.sub(totalSupply));

        // usdcBalance < totalUSDCLoans: pull out more USDC so we have enough to repay loans
        if (balanceToTarget == 0) return RESERVE.redeem(totalSupply.sub(usdcBalance));
    }

    function _close() override internal {
        rebalance();
    }

    function _validToken6Amount(UFixed18 amount) internal pure returns (bool) {
        return UFixed18.unwrap(amount) % 1e12 == 0;
    }
}
