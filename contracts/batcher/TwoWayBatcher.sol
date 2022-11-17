//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.13;

import "@equilibria/root/number/types/UFixed18.sol";
import "@equilibria/root/token/types/Token18.sol";
import "@equilibria/root/token/types/Token6.sol";
import "@equilibria/root/control/unstructured/UReentrancyGuard.sol";
import "./Batcher.sol";

contract TwoWayBatcher is UReentrancyGuard, Batcher {
    event Deposit(address indexed account, UFixed18 amount);
    event Withdraw(address indexed account, UFixed18 amount);

    error TwoWayBatcherInvalidTokenAmount(UFixed18 amount);

    UFixed18 public totalDeposits;
    mapping(address => UFixed18) public deposits;

    constructor(IEmptySetReserve reserve, Token18 dsu, Token6 usdc)
    Batcher(reserve, dsu, usdc)
    { }

    function deposit(UFixed18 amount) external nonReentrant {
        if (!_validToken6Amount(amount)) revert TwoWayBatcherInvalidTokenAmount(amount);

        rebalance();

        USDC.pull(msg.sender, amount, true);

        totalDeposits = totalDeposits.add(amount);
        deposits[msg.sender] = deposits[msg.sender].add(amount);

        emit Deposit(msg.sender, amount);
    }

    function withdraw(UFixed18 amount) external nonReentrant {
        if (!_validToken6Amount(amount)) revert TwoWayBatcherInvalidTokenAmount(amount);

        rebalance();

        totalDeposits = totalDeposits.sub(amount);
        deposits[msg.sender] = deposits[msg.sender].sub(amount);

        USDC.push(msg.sender, amount);

        emit Withdraw(msg.sender, amount);
    }

    function _rebalance(UFixed18 usdcBalance, UFixed18) override internal {
        uint256 balanceToTarget = usdcBalance.compare(totalDeposits);

        // totalUSDCLoans == usdcBalance: Do nothing
        if (balanceToTarget == 1) return;

        // usdcBalance > totalUSDCLoans: deposit excess USDC
        if (balanceToTarget == 2) return RESERVE.mint(usdcBalance.sub(totalDeposits));

        // usdcBalance < totalUSDCLoans: pull out more USDC so we have enough to repay loans
        if (balanceToTarget == 0) return RESERVE.redeem(totalDeposits.sub(usdcBalance));
    }

    function _close() override internal {
        rebalance();
    }

    function _validToken6Amount(UFixed18 amount) internal pure returns (bool) {
        return UFixed18.unwrap(amount) % 1e12 == 0;
    }
}
