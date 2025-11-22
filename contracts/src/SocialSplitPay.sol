// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
// Solo importamos las librerías complejas de lógica
import {SignatureRecover} from "@evvm/testnet-contracts/library/SignatureRecover.sol";
import {StakingServiceHooks} from "@evvm/testnet-contracts/library/StakingServiceHooks.sol";

// --- INTERFACES LOCALES (El secreto para que compile siempre) ---

// 1. Definimos la estructura exacta que espera EVVM para pagos batch
interface IBatchPay {
    struct PayItem {
        uint256 amount;
        address toAddress;
    }
    function disperseCaPay(PayItem[] calldata items, address token, uint256 total) external;
}

// 2. Definimos las funciones básicas de EVVM que necesitamos
interface IEvvmCore {
    function pay(
        address from, address to, string memory id, address token, 
        uint256 amt, uint256 fee, uint256 nonce, bool isAsync, 
        address exec, bytes memory sig
    ) external;
    
    function caPay(address to, address token, uint256 amount) external;
    
    function getEvvmID() external view returns (uint256);
    function isAddressStaker(address user) external view returns (bool);
    function getRewardAmount() external view returns (uint256);
    function getBalance(address user, address token) external view returns (uint256);
}

// 3. Definimos NameService
interface INameServiceLocal {
    function verifyStrictAndGetOwnerOfIdentity(string memory _username) external view returns (address);
}

/**
 * @title SocialSplitPay
 * @notice Divide cuentas y paga nóminas usando Usernames de EVVM.
 */
contract SocialSplitPay is StakingServiceHooks {
    
    // --- Configuración ---
    IEvvmCore public immutable evvm;
    INameServiceLocal public immutable nameService;
    address public owner;

    // Direcciones constantes
    address constant ETHER_ADDRESS = address(0);
    // OJO: La dirección real del token MATE no es address(1), es esta:
    address constant PRINCIPAL_TOKEN_ADDRESS = 0x0000000000000000000000000000000000000001;

    // Anti-Replay
    mapping(address => mapping(uint256 => bool)) public checkAsyncNonce;

    // Estructura de entrada (lo que manda el frontend)
    struct PaymentInstruction {
        uint256 amount;
        string to_identity;
        address to_address;
    }

    event PaymentSplitExecuted(address indexed from, uint256 totalAmount, uint256 recipientsCount);

    constructor(
        address _evvmAddress,
        address _nameServiceAddress,
        address _stakingContractAddress
    ) StakingServiceHooks(_stakingContractAddress) {
        evvm = IEvvmCore(_evvmAddress);
        nameService = INameServiceLocal(_nameServiceAddress);
        owner = msg.sender;
    }

    /**
     * @notice Ejecuta el split payment.
     */
    function executeSplitPayment(
        address client,
        PaymentInstruction[] calldata instructions,
        uint256 totalAmount,
        uint256 nonce,
        bytes calldata clientSignature,
        // Params EVVM
        uint256 priorityFee,
        uint256 nonceEvvm,
        bool isAsync,
        bytes calldata signatureEvvm
    ) external {
        // 1. Validar Replay
        require(!checkAsyncNonce[client][nonce], "Nonce used");

        // 2. Validar Firma del Servicio
        // Reconstruimos el mensaje EIP-191 params
        bytes32 instructionsHash = keccak256(abi.encode(instructions));
        string memory params = string.concat(
            Strings.toHexString(uint256(instructionsHash), 32), ",",
            Strings.toString(totalAmount), ",",
            Strings.toString(nonce)
        );

        require(
            SignatureRecover.signatureVerification(
                Strings.toString(evvm.getEvvmID()),
                "executeSplitPayment",
                params,
                clientSignature,
                client
            ),
            "Invalid signature"
        );

        // 3. Cobrar al Cliente (Pay In)
        evvm.pay(
            client,
            address(this), // Dinero entra al contrato
            "",
            ETHER_ADDRESS,
            totalAmount,
            priorityFee,
            nonceEvvm,
            isAsync,
            msg.sender,
            signatureEvvm
        );

        // 4. Resolver Nombres y Preparar Batch
        // Usamos el struct local IBatchPay.PayItem para evitar errores de importación
        IBatchPay.PayItem[] memory batch = new IBatchPay.PayItem[](instructions.length);
        uint256 calculatedTotal = 0;

        for (uint256 i = 0; i < instructions.length; i++) {
            address target = instructions[i].to_address;

            // Resolver Username
            if (bytes(instructions[i].to_identity).length > 0) {
                target = nameService.verifyStrictAndGetOwnerOfIdentity(instructions[i].to_identity);
            }

            require(target != address(0), "Invalid dest");

            batch[i] = IBatchPay.PayItem({
                amount: instructions[i].amount,
                toAddress: target
            });

            calculatedTotal += instructions[i].amount;
        }

        require(calculatedTotal == totalAmount, "Amount mismatch");

        // 5. Distribuir (Casteamos la dirección EVVM a nuestra interfaz local)
        IBatchPay(address(evvm)).disperseCaPay(
            batch,
            ETHER_ADDRESS,
            totalAmount
        );

        // 6. Incentivos (Service Staking)
        if (evvm.isAddressStaker(address(this))) {
            if (priorityFee > 0) {
                evvm.caPay(msg.sender, ETHER_ADDRESS, priorityFee);
            }
            // Pagar Reward
            evvm.caPay(msg.sender, PRINCIPAL_TOKEN_ADDRESS, evvm.getRewardAmount() / 2);
        }

        checkAsyncNonce[client][nonce] = true;
        emit PaymentSplitExecuted(client, totalAmount, instructions.length);
    }

    // --- Admin ---
    function stake(uint256 amount) external onlyOwner {
        _makeStakeService(amount);
    }

    function unstake(uint256 amount) external onlyOwner {
        _makeUnstakeService(amount);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
}