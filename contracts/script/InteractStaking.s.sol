// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {EVVMGhostKitchen} from "../src/GhostKitchen.sol";
import {IEvvm} from "@evvm/testnet-contracts/interfaces/IEvvm.sol";

contract InteractStaking is Script {
    // ---------------------------------------------------------
    // CONFIGURACIÓN
    // ---------------------------------------------------------
    
    // 1. Pega aquí la dirección de tu contrato GhostKitchen desplegado
    address constant KITCHEN_ADDRESS = 0x0000000000000000000000000000000000000000; 
    
    // Direcciones EVVM (Sepolia)
    address constant EVVM_SEPOLIA = 0x9902984d86059234c3B6e11D5eAEC55f9627dD0f;
    address constant PRINCIPAL_TOKEN = address(1); // MATE Token

    // Cantidad a stakear (ejemplo: 100 MATE con 18 decimales)
    uint256 constant AMOUNT_TO_STAKE = 100 * 10**18; 

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployerAddress = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);

        EVVMGhostKitchen kitchen = EVVMGhostKitchen(KITCHEN_ADDRESS);
        IEvvm evvm = IEvvm(EVVM_SEPOLIA);

        // ---------------------------------------------------------
        // PASO 1: REVISIÓN INICIAL
        // ---------------------------------------------------------
        uint256 initialBalance = kitchen.getAmountOfPrincipalTokenInKitchen();
        console.log("Balance MATE actual en la Kitchen:", initialBalance);

        // ---------------------------------------------------------
        // PASO 2: ENVIAR FONDOS (Si la kitchen no tiene suficientes)
        // ---------------------------------------------------------
        // Nota: Para que esto funcione, tu wallet (deployer) debe tener MATE.
        // Usamos caPay para simular una transferencia simple dentro del EVVM
        if (initialBalance < AMOUNT_TO_STAKE) {
            console.log("El contrato no tiene suficientes fondos. Intentando enviar MATE...");
            
            // Transferimos MATE desde tu wallet -> contrato Kitchen
            // Nota: En producción esto requiere firmas, pero si eres el owner/staker 
            // y usas la herramienta correcta, caPay o pay funcionarán.
            // Aquí asumimos que tienes permiso o usas la interfaz directa del EVVM para transferir.
            
            try evvm.caPay(KITCHEN_ADDRESS, PRINCIPAL_TOKEN, AMOUNT_TO_STAKE) {
                console.log("Transferencia de MATE al contrato exitosa.");
            } catch {
                console.log("Error enviando fondos. Asegurate de tener MATE en tu wallet.");
                console.log("O envialos manualmente a la address del contrato usando la UI.");
                return; // Detener si no hay fondos
            }
        }

        // ---------------------------------------------------------
        // PASO 3: EJECUTAR STAKING
        // ---------------------------------------------------------
        console.log("Ejecutando stake()...");
        try kitchen.stake(AMOUNT_TO_STAKE) {
            console.log("Stake exitoso!");
        } catch Error(string memory reason) {
            console.log("Fallo el stake:", reason);
        } catch {
            console.log("Fallo el stake (error desconocido)");
        }

        // ---------------------------------------------------------
        // PASO 4: REVISIÓN FINAL
        // ---------------------------------------------------------
        uint256 finalBalance = kitchen.getAmountOfPrincipalTokenInKitchen();
        console.log("-------------------------------------------");
        console.log("Resumen:");
        console.log("Balance MATE Inicial:", initialBalance);
        console.log("Balance MATE Final:  ", finalBalance);
        console.log("Diferencia (Staked): ", initialBalance > finalBalance ? initialBalance - finalBalance : 0);
        console.log("-------------------------------------------");

        vm.stopBroadcast();
    }
}