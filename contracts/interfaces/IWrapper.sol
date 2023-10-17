//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

interface IWrapper {
    function wrap(address to) external;
    function unwrap(address to) external;
}
