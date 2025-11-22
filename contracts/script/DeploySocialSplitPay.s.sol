// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";

import {SocialSplitPay} from "../src/SocialSplitPay.sol";

contract DeploySocialSplitPay is Script {
    // Direcciones Oficiales EVVM en ETHEREUM SEPOLIA (Chain ID: 11155111)
    // Fuente: Documentación Oficial / EVVM Frontend Constants
    address constant EVVM_SEPOLIA = 0x9902984d86059234c3B6e11D5eAEC55f9627dD0f;
    address constant NAMESERVICE_SEPOLIA = 0x93DFFaEd15239Ec77aaaBc79DF3b9818dD3E406A;
    address constant STAKING_SEPOLIA = 0x2FE943eE9bD346aF46d46BD36c9ccb86201Da21A;

    function setUp() public {}

    function run() public {
        // Recuperamos la Private Key del archivo .env
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Iniciamos la transmisión de la transacción
        vm.startBroadcast(deployerPrivateKey);

        // Desplegamos el contrato
        SocialSplitPay service = new SocialSplitPay(
            EVVM_SEPOLIA,
            NAMESERVICE_SEPOLIA,
            STAKING_SEPOLIA
        );

        console.log("--------------------------------------------------");
        console.log("SocialSplitPay deployed successfully!");
        console.log("Address:", address(service));
        console.log("Network: Ethereum Sepolia");
        console.log("--------------------------------------------------");
        console.log("ATENCION: Recuerda enviar MATE Tokens a esta direccion");
        console.log("y ejecutar stakeService() para activar los rewards.");
        console.log("--------------------------------------------------");

        vm.stopBroadcast();
    }
}