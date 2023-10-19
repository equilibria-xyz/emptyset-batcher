//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

import "@equilibria/root/token/types/Token6.sol";
import "@equilibria/root/token/types/Token18.sol";

interface IWrapper {
    function USDC() external view returns (Token6); // solhint-disable-line func-name-mixedcase
    function DSU() external view returns (Token18); // solhint-disable-line func-name-mixedcase

    function wrap(address to) external;
    function unwrap(address to) external;
}
