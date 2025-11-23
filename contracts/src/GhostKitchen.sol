// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {IEvvm} from "@evvm/testnet-contracts/interfaces/IEvvm.sol";
import {SignatureRecover} from "@evvm/testnet-contracts/library/SignatureRecover.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {StakingServiceHooks} from "@evvm/testnet-contracts/library/StakingServiceHooks.sol";

contract EVVMGhostKitchen is StakingServiceHooks {
    // ============================================================================
    // ERRORS
    // ============================================================================

    /// @notice Thrown when a provided signature is invalid or verification fails
    error InvalidSignature();

    /// @notice Thrown when attempting to reuse a nonce that has already been consumed
    error NonceAlreadyUsed();

    /// @notice Thrown when an unauthorized action is attempted
    error Unauthorized();

    // ============================================================================
    // STATE VARIABLES
    // ============================================================================

    /// @notice Address of the EVVM virtual blockchain contract for payment processing
    address evvmAddress;

    /// @notice Staking service contract address
    address stakingAddress;

    /// @notice Constant representing ETH in the EVVM virtual blockchain (address(0))
    address constant ETHER_ADDRESS = address(0);

    /// @notice Constant representing the principal token in EVVM virtual blockchain (address(1))
    address constant PRINCIPAL_TOKEN_ADDRESS = address(1);

    /// @notice Address of the ghost kitchen owner who can withdraw funds and rewards
    address ownerOfKitchen;

    /// @notice Mapping to track used nonces per client address to prevent replay attacks
    /// @dev First key: client address, Second key: nonce, Value: whether nonce is used
    mapping(address => mapping(uint256 => bool)) checkAsyncNonce;

    // ============================================================================
    // MODIFIERS
    // ============================================================================

    /// @notice Modifier to restrict function access to only the kitchen owner
    modifier onlyOwner() {
        if (msg.sender != ownerOfKitchen) revert Unauthorized();
        _;
    }

    // ============================================================================
    // CONSTRUCTOR
    // ============================================================================

    /**
     * @notice Initializes the ghost kitchen contract with EVVM integration
     * @param _evvmAddress Address of the EVVM virtual blockchain contract for payment processing
     * @param _ownerOfKitchen Address that will have administrative privileges over the kitchen
     */
    constructor(
        address _evvmAddress,
        address _stakingAddress,
        address _ownerOfKitchen
    ) StakingServiceHooks(_stakingAddress) {
        evvmAddress = _evvmAddress;
        ownerOfKitchen = _ownerOfKitchen;
        stakingAddress = _stakingAddress;
    }

    // ============================================================================
    // EXTERNAL FUNCTIONS
    // ============================================================================

    /**
     * @notice Processes a food order with payment through EVVM
     *
     * @param clientAddress Address of the customer placing the order
     * @param menuItem Name of the food item being ordered (e.g., "Burger", "Pizza")
     * @param quantity Number of items being ordered
     * @param totalPrice Total price to be paid in ETH (in wei)
     * @param nonce Unique number to prevent replay attacks (must not be reused)
     * @param signature Client's signature authorizing the food order
     * @param priorityFee_EVVM Fee paid for transaction priority in EVVM
     * @param nonce_EVVM Unique nonce for the EVVM payment transaction
     * @param priorityFlag_EVVM Boolean flag indicating the type of nonce we are using
     *                          (true for async nonce, false for sync nonce)
     * @param signature_EVVM Signature authorizing the EVVM payment transaction
     *
     * @dev Signature format for client authorization:
     *      "<evvmID>,orderFood,<menuItem>,<quantity>,<totalPrice>,<nonce>"
     */
    function orderFood(
        address clientAddress,
        string memory menuItem,
        uint256 quantity,
        uint256 totalPrice,
        uint256 nonce,
        bytes memory signature,
        uint256 priorityFee_EVVM,
        uint256 nonce_EVVM,
        bool priorityFlag_EVVM,
        bytes memory signature_EVVM
    ) external {
        /**
         * Verify client's signature for ordering food
         * The signed message format is:
         * "<evvmID>,orderFood,<menuItem>,<quantity>,<totalPrice>,<nonce>"
         */
        if (
            !SignatureRecover.signatureVerification(
                Strings.toString(IEvvm(evvmAddress).getEvvmID()),
                "orderFood",
                string.concat(
                    menuItem,
                    ",",
                    Strings.toString(quantity),
                    ",",
                    Strings.toString(totalPrice),
                    ",",
                    Strings.toString(nonce)
                ),
                signature,
                clientAddress
            )
        ) revert InvalidSignature();

        // Prevent replay attacks by checking if nonce has been used before
        if (checkAsyncNonce[clientAddress][nonce]) revert NonceAlreadyUsed();

        /**
         * Pay for the food using EVVM virtual blockchain's pay function
         */
        IEvvm(evvmAddress).pay(
            clientAddress,
            address(this),
            "",
            ETHER_ADDRESS,
            totalPrice,
            priorityFee_EVVM,
            nonce_EVVM,
            priorityFlag_EVVM,
            address(this),
            signature_EVVM
        );

        /**
         * FISHER INCENTIVE SYSTEM:
         * Distribute rewards to the fisher if contract is a staker.
         */
        if (IEvvm(evvmAddress).isAddressStaker(address(this))) {
            // Transfer the priority fee to the fisher as immediate incentive
            IEvvm(evvmAddress).caPay(
                msg.sender,
                ETHER_ADDRESS,
                priorityFee_EVVM
            );

            // Transfer half of the reward (on principal tokens) to the fisher
            IEvvm(evvmAddress).caPay(
                msg.sender,
                PRINCIPAL_TOKEN_ADDRESS,
                IEvvm(evvmAddress).getRewardAmount() / 2
            );
        }

        // Mark nonce as used to prevent future reuse
        checkAsyncNonce[clientAddress][nonce] = true;
    }

    /**
     * @notice Stakes a specified amount of staking tokens for the kitchen service
     * @dev Only callable by the kitchen owner
     * @param amountToStake Number of staking tokens to stake
     */
    function stake(uint256 amountToStake) external onlyOwner {
        _makeStakeService(amountToStake);
    }

    /**
     * @notice Unstakes a specified amount of staking tokens for the kitchen service
     * @dev Only callable by the kitchen owner
     * @param amountToUnstake Number of staking tokens to unstake
     */
    function unstake(uint256 amountToUnstake) external onlyOwner {
        _makeUnstakeService(amountToUnstake);
    }

    /**
     * @notice Withdraws accumulated virtual blockchain reward tokens from the contract
     * @dev Only callable by the kitchen owner
     * @param to Address where the withdrawn reward tokens will be sent
     */
    function withdrawRewards(address to) external onlyOwner {
        uint256 balance = IEvvm(evvmAddress).getBalance(
            address(this),
            PRINCIPAL_TOKEN_ADDRESS
        );
        IEvvm(evvmAddress).caPay(to, PRINCIPAL_TOKEN_ADDRESS, balance);
    }

    /**
     * @notice Withdraws accumulated ETH funds from food sales
     * @dev Only callable by the kitchen owner
     * @param to Address where the withdrawn ETH will be sent
     */
    function withdrawFunds(address to) external onlyOwner {
        uint256 balance = IEvvm(evvmAddress).getBalance(
            address(this),
            ETHER_ADDRESS
        );
        IEvvm(evvmAddress).caPay(to, ETHER_ADDRESS, balance);
    }

    function isThisNonceUsed(
        address clientAddress,
        uint256 nonce
    ) external view returns (bool) {
        return checkAsyncNonce[clientAddress][nonce];
    }

    function getOwnerOfKitchen() external view returns (address) {
        return ownerOfKitchen;
    }

    function getPrincipalTokenAddress() external pure returns (address) {
        return PRINCIPAL_TOKEN_ADDRESS;
    }

    function getEtherAddress() external pure returns (address) {
        return ETHER_ADDRESS;
    }

    function getAmountOfPrincipalTokenInKitchen() external view returns (uint256) {
        return
            IEvvm(evvmAddress).getBalance(
                address(this),
                PRINCIPAL_TOKEN_ADDRESS
            );
    }

    function getEvvmAddress() external view returns (address) {
        return evvmAddress;
    }

    function getAmountOfEtherInKitchen() external view returns (uint256) {
        return IEvvm(evvmAddress).getBalance(address(this), ETHER_ADDRESS);
    }
}