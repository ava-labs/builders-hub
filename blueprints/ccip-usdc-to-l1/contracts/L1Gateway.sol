// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CCIPReceiver} from "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @dev The part of ICTT's ERC20TokenHome the gateway calls.
interface IERC20TokenHome {
    struct SendTokensInput {
        bytes32 destinationBlockchainID;
        address destinationTokenTransferrerAddress;
        address recipient;
        address primaryFeeTokenAddress;
        uint256 primaryFee;
        uint256 secondaryFee;
        uint256 requiredGasLimit;
        address multiHopFallback;
    }

    function send(SendTokensInput calldata input, uint256 amount) external;
}

/// @title L1Gateway
/// @notice Bridges USDC arriving over CCIP on the Avalanche C-Chain onward to an Avalanche L1 through
/// ICTT, in the same transaction. If the ICTT leg cannot run (the bridge is unregistered, under-
/// collateralized, or paused) the gateway holds the USDC instead of failing the CCIP message, so it can
/// be retried or refunded on the C-Chain.
contract L1Gateway is CCIPReceiver, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Status {
        None,
        Forwarded,
        Held,
        Refunded
    }

    struct Transfer {
        address recipient;
        Status status;
        uint64 sourceChainSelector;
        uint256 amount;
    }

    IERC20 public immutable usdc;
    IERC20TokenHome public immutable tokenHome;
    bytes32 public immutable l1BlockchainID;
    address public immutable tokenRemote;
    /// @notice Gas the L1's TokenRemote gets to credit the recipient.
    uint256 public l1GasLimit;

    mapping(uint64 chainSelector => mapping(address sender => bool)) public allowlistedSenders;
    mapping(uint64 chainSelector => bytes4) private _allowedFinalityConfig;
    mapping(bytes32 ccipMessageId => Transfer) private _transfers;

    event SenderSet(uint64 indexed chainSelector, address indexed sender, bool allowed);
    event L1GasLimitSet(uint256 gasLimit);
    event AllowedFinalityConfigSet(uint64 indexed chainSelector, bytes4 allowedFinalityConfig);
    event ForwardedToL1(bytes32 indexed ccipMessageId, address indexed recipient, uint256 amount);
    event ForwardHeld(bytes32 indexed ccipMessageId, address indexed recipient, uint256 amount, bytes reason);
    event HeldRefunded(bytes32 indexed ccipMessageId, address indexed to, uint256 amount);

    error ZeroAddress();
    error InvalidGasLimit();
    error SenderNotAllowed(uint64 chainSelector, address sender);
    error UnexpectedTokens();
    error AlreadyProcessed(bytes32 ccipMessageId);
    error NotHeld(bytes32 ccipMessageId);
    error NotRecipient(address caller);

    constructor(
        address router_,
        IERC20 usdc_,
        IERC20TokenHome tokenHome_,
        bytes32 l1BlockchainID_,
        address tokenRemote_,
        uint256 l1GasLimit_,
        address owner_
    ) CCIPReceiver(router_) Ownable(owner_) {
        if (address(usdc_) == address(0) || address(tokenHome_) == address(0) || tokenRemote_ == address(0)) {
            revert ZeroAddress();
        }
        if (l1GasLimit_ == 0) revert InvalidGasLimit();
        usdc = usdc_;
        tokenHome = tokenHome_;
        l1BlockchainID = l1BlockchainID_;
        tokenRemote = tokenRemote_;
        l1GasLimit = l1GasLimit_;
    }

    function allowlistSender(uint64 chainSelector, address sender, bool allowed) external onlyOwner {
        if (sender == address(0)) revert ZeroAddress();
        allowlistedSenders[chainSelector][sender] = allowed;
        emit SenderSet(chainSelector, sender, allowed);
    }

    function setL1GasLimit(uint256 gasLimit) external onlyOwner {
        if (gasLimit == 0) revert InvalidGasLimit();
        l1GasLimit = gasLimit;
        emit L1GasLimitSet(gasLimit);
    }

    /// @notice Accepts faster-than-finality messages from a source chain on CCIP 2.0 lanes.
    /// bytes4(0), the default, accepts only fully finalized messages.
    function setAllowedFinalityConfig(uint64 chainSelector, bytes4 allowedFinalityConfig) external onlyOwner {
        _allowedFinalityConfig[chainSelector] = allowedFinalityConfig;
        emit AllowedFinalityConfigSet(chainSelector, allowedFinalityConfig);
    }

    /// @notice Anyone may retry a held transfer, for example once the L1 bridge is registered.
    function retry(bytes32 ccipMessageId) external nonReentrant {
        if (_transfers[ccipMessageId].status != Status.Held) revert NotHeld(ccipMessageId);
        _forward(ccipMessageId);
    }

    /// @notice The recipient, who controls the same address on the C-Chain, or the owner on the
    /// recipient's behalf, takes a held transfer back as USDC on the C-Chain.
    function refundHeld(bytes32 ccipMessageId, address to) external nonReentrant {
        Transfer storage transfer = _transfers[ccipMessageId];
        if (transfer.status != Status.Held) revert NotHeld(ccipMessageId);
        if (msg.sender != transfer.recipient && msg.sender != owner()) revert NotRecipient(msg.sender);
        address payee = msg.sender == transfer.recipient ? to : transfer.recipient;
        if (payee == address(0)) revert ZeroAddress();

        transfer.status = Status.Refunded;
        usdc.safeTransfer(payee, transfer.amount);
        emit HeldRefunded(ccipMessageId, payee, transfer.amount);
    }

    function transferOf(bytes32 ccipMessageId) external view returns (Transfer memory) {
        return _transfers[ccipMessageId];
    }

    function getCCVsAndFinalityConfig(uint64 sourceChainSelector, bytes calldata sender)
        external
        view
        override
        returns (address[] memory requiredCCVs, address[] memory optionalCCVs, uint8 optionalThreshold, bytes4 allowedFinalityConfig)
    {
        address decoded = abi.decode(sender, (address));
        if (!allowlistedSenders[sourceChainSelector][decoded]) revert SenderNotAllowed(sourceChainSelector, decoded);
        return (new address[](0), new address[](0), 0, _allowedFinalityConfig[sourceChainSelector]);
    }

    function _ccipReceive(Client.Any2EVMMessage memory message) internal override {
        address sender = abi.decode(message.sender, (address));
        if (!allowlistedSenders[message.sourceChainSelector][sender]) revert SenderNotAllowed(message.sourceChainSelector, sender);
        if (message.destTokenAmounts.length != 1 || message.destTokenAmounts[0].token != address(usdc)) {
            revert UnexpectedTokens();
        }
        if (_transfers[message.messageId].status != Status.None) revert AlreadyProcessed(message.messageId);

        address recipient = abi.decode(message.data, (address));
        if (recipient == address(0)) revert ZeroAddress();

        _transfers[message.messageId] = Transfer({
            recipient: recipient,
            status: Status.Held,
            sourceChainSelector: message.sourceChainSelector,
            amount: message.destTokenAmounts[0].amount
        });
        _forward(message.messageId);
    }

    function _forward(bytes32 ccipMessageId) private {
        Transfer storage transfer = _transfers[ccipMessageId];
        usdc.forceApprove(address(tokenHome), transfer.amount);
        try tokenHome.send(
            IERC20TokenHome.SendTokensInput({
                destinationBlockchainID: l1BlockchainID,
                destinationTokenTransferrerAddress: tokenRemote,
                recipient: transfer.recipient,
                primaryFeeTokenAddress: address(0),
                primaryFee: 0,
                secondaryFee: 0,
                requiredGasLimit: l1GasLimit,
                multiHopFallback: address(0)
            }),
            transfer.amount
        ) {
            transfer.status = Status.Forwarded;
            emit ForwardedToL1(ccipMessageId, transfer.recipient, transfer.amount);
        } catch (bytes memory reason) {
            usdc.forceApprove(address(tokenHome), 0);
            emit ForwardHeld(ccipMessageId, transfer.recipient, transfer.amount, reason);
        }
    }
}
