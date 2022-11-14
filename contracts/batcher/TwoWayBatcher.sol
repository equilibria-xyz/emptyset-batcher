//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.13;

import "@equilibria/root/number/types/UFixed18.sol";
import "@equilibria/root/token/types/Token18.sol";
import "@equilibria/root/token/types/Token6.sol";
import "@equilibria/root/control/unstructured/UReentrancyGuard.sol";
import "./Batcher.sol";

contract TwoWayBatcher is UReentrancyGuard, Batcher {
    using UFixed18Lib for UFixed18;
    using Token18Lib for Token18;
    using Token6Lib for Token6;

    event USDCLoaned(address indexed depositor, UFixed18 amount);
    event USDCRepaid(address indexed depositor, UFixed18 amount);

    UFixed18 usdcLoansOutstanding;
    mapping(address => UFixed18) depositorToUSDCLoanAmount;

    constructor(IEmptySetReserve reserve, Token18 dsu, Token6 usdc)
    Batcher(reserve, dsu, usdc)
    { }

    function loanUSDC(UFixed18 amount) external nonReentrant {
        USDC.pull(msg.sender, amount, true);

        usdcLoansOutstanding = usdcLoansOutstanding.add(amount);
        depositorToUSDCLoanAmount[msg.sender] = depositorToUSDCLoanAmount[msg.sender].add(amount);

        emit USDCLoaned(msg.sender, amount);
    }

    function repayUSDC(UFixed18 amount) external nonReentrant {
        if (USDC.balanceOf().lt(amount)) {
            rebalance();
        }

        usdcLoansOutstanding = usdcLoansOutstanding.sub(amount);
        depositorToUSDCLoanAmount[msg.sender] = depositorToUSDCLoanAmount[msg.sender].sub(amount);

        USDC.push(msg.sender, amount);

        emit USDCRepaid(msg.sender, amount);
    }

    function _rebalance(UFixed18 usdcBalance, UFixed18) override internal {
        uint256 cmpResult = usdcLoansOutstanding.compare(usdcBalance);

        // totalUSDCLoans == usdcBalance: Do nothing
        if (cmpResult == 1) {
            return;

        // totalUSDCLoans > usdcBalance: pull out more USDC so we have enough to repay loans
        } else if (cmpResult == 2) {
            RESERVE.redeem(usdcLoansOutstanding.sub(usdcBalance));

        // totalUSDCLoans < usdcBalance: deposit excess USDC
        } else if (cmpResult == 0) {
            RESERVE.mint(usdcBalance.sub(usdcLoansOutstanding));
        }
    }

    function _close(UFixed18 usdcBalance) override internal {
        // totalUSDCLoans == usdcBalance: Do Nothing
        if (usdcLoansOutstanding.eq(usdcBalance)) {
            return;

        // totalUSDCLoans != usdcBalance: rebalance so we have exactly the amount of USDC needed to repay loans.
        // If we currently have excess USDC, it will be redeemed
        // If we curerntly have too little USDC, it will be minted
        } else {
            rebalance();
        }
    }
}
