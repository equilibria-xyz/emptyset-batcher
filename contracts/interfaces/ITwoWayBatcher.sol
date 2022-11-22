//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "./IBatcher.sol";

interface ITwoWayBatcher is IBatcher, IERC20 {
    function deposit(UFixed18 amount) external;
    function withdraw(UFixed18 amount) external;
}
