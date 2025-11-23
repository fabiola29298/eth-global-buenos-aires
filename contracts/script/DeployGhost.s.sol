// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";

import {EVVMGhostKitchen} from "../src/GhostKitchen.sol";

contract DeployGhost is Script { 
    address constant EVVM_SEPOLIA = 0x9902984d86059234c3B6e11D5eAEC55f9627dD0f; 
    address constant STAKING_SEPOLIA = 0x2FE943eE9bD346aF46d46BD36c9ccb86201Da21A;

    function setUp() public {}

    function run() public { 
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
         
        address deployerAddress = vm.addr(deployerPrivateKey);

        // Iniciamos la transmisión de la transacción
        vm.startBroadcast(deployerPrivateKey);
 
        EVVMGhostKitchen kitchen = new EVVMGhostKitchen(
            EVVM_SEPOLIA,
            STAKING_SEPOLIA,
            deployerAddress
        );

        console.log("--------------------------------------------------");
        console.log("EVVMGhostKitchen deployed successfully!");
        console.log("Address:", address(kitchen));
        console.log("Owner:", deployerAddress);
        console.log("Network: Ethereum Sepolia");
        console.log("--------------------------------------------------");
        console.log("ATENCION: Recuerda enviar MATE Tokens a esta direccion");
        console.log("y ejecutar stake() para activar los rewards.");
        console.log("--------------------------------------------------");

        vm.stopBroadcast();
    }
}