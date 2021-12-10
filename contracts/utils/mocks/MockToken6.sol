// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "../types/Token6.sol";

contract MockToken6 {
    function push(Token6 self, address recipient) external {
        Token6Lib.push(self, recipient);
    }

    function push(Token6 self, address recipient, UFixed18 amount) external {
        Token6Lib.push(self, recipient, amount);
    }

    function push(Token6 self, address recipient, UFixed18 amount, bool roundUp) external {
        Token6Lib.push(self, recipient, amount, roundUp);
    }

    function pull(Token6 self, address benefactor, UFixed18 amount) external {
        Token6Lib.pull(self, benefactor, amount);
    }

    function pull(Token6 self, address benefactor, UFixed18 amount, bool roundUp) external {
        Token6Lib.pull(self, benefactor, amount, roundUp);
    }

    function pullTo(Token6 self, address benefactor, address recipient, UFixed18 amount) external {
        Token6Lib.pullTo(self, benefactor, recipient, amount);
    }

    function pullTo(Token6 self, address benefactor, address recipient, UFixed18 amount, bool roundUp) external {
        Token6Lib.pullTo(self, benefactor, recipient, amount, roundUp);
    }

    function name(Token6 self) external view returns (string memory) {
        return Token6Lib.name(self);
    }

    function symbol(Token6 self) external view returns (string memory) {
        return Token6Lib.symbol(self);
    }

    function decimals(Token6 self) external pure returns (uint8) {
        return Token6Lib.decimals(self);
    }

    function balanceOf(Token6 self) external view returns (UFixed18) {
        return Token6Lib.balanceOf(self);
    }

    function balanceOf(Token6 self, address account) external view returns (UFixed18) {
        return Token6Lib.balanceOf(self, account);
    }
}