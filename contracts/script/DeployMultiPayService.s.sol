// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import {MultiPayService} from "../src/MultiPayService.sol";

contract DeployMultiPayService is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY"); // Asegúrate de que esta variable esté en .env
        address evvmAddress = 0xF817e9ad82B4a19F00dA7A248D9e556Ba96e6366; // Dirección de EVVM en Sepolia

        vm.startBroadcast(deployerKey);

        MultiPayService multiPayService = new MultiPayService(evvmAddress);

        vm.stopBroadcast();
    }
}
