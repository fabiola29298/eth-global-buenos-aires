// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
 
import {IEvvm} from "@evvm/testnet-contracts/interfaces/IEvvm.sol";
import {SignatureRecover} from "@evvm/testnet-contracts/library/SignatureRecover.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {StakingServiceHooks} from "@evvm/testnet-contracts/library/StakingServiceHooks.sol";

contract MultiPayService {
    address public evvmAddress;
    address public owner;

    mapping(address => uint256) public balances;

    constructor(address _evvmAddress) {
        evvmAddress = _evvmAddress;
        owner = msg.sender;
    }

    // Función para realizar pagos múltiples
    function multiPay(
        address[] calldata recipients,
        uint256[] calldata amounts,
        uint256 nonce,
        bytes calldata signature
    ) external {
        require(recipients.length == amounts.length, "Length mismatch");

        // Verificar firma
        require(verifySignature(recipients, amounts, nonce, signature), "Invalid signature");

        for (uint256 i = 0; i < recipients.length; i++) {
            // Enviar el pago a cada destinatario
            balances[recipients[i]] += amounts[i];
        }

        // Llamada a EVVM para ejecutar los pagos (simulado aquí)
        //IEvvm(evvmAddress).pay{value: msg.value}();
    }

    // Función para verificar la firma (esto es solo un ejemplo básico)
    function verifySignature(
        address[] calldata recipients,
        uint256[] calldata amounts,
        uint256 nonce,
        bytes calldata signature
    ) public view returns (bool) {
        // Implementar lógica de verificación de firma aquí
        return true;
    }

    // Función para recibir pagos
    receive() external payable {}
}
