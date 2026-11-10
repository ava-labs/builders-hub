// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Adapted from Chainlink's Messenger tutorial, https://github.com/smartcontractkit/docs-ccip (MIT).

import {CCIPReceiver} from "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title CCIPMessenger
/// @notice Sends and receives short text messages between EVM chains over Chainlink CCIP, attributed to
/// their author. Deploy one per chain, then allowlist each other: destination chains for sending,
/// (source chain, sender) pairs for receiving.
contract CCIPMessenger is CCIPReceiver, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Received {
        bytes32 messageId;
        uint64 sourceChainSelector;
        uint64 receivedAt;
        address sender;
        address author;
        string text;
    }

    uint256 public constant MAX_TEXT_BYTES = 280;

    mapping(uint64 chainSelector => bool) public allowlistedDestinationChains;
    mapping(uint64 chainSelector => mapping(address sender => bool)) public allowlistedSenders;
    mapping(uint64 chainSelector => bytes4) private _allowedFinalityConfig;

    uint256 public receivedCount;
    Received private _last;

    event DestinationChainSet(uint64 indexed chainSelector, bool allowed);
    event SenderSet(uint64 indexed chainSelector, address indexed sender, bool allowed);
    event AllowedFinalityConfigSet(uint64 indexed chainSelector, bytes4 allowedFinalityConfig);
    event MessageSent(
        bytes32 indexed messageId,
        uint64 indexed destinationChainSelector,
        address indexed author,
        address receiver,
        string text,
        address feeToken,
        uint256 fees
    );
    event MessageReceived(
        bytes32 indexed messageId, uint64 indexed sourceChainSelector, address indexed author, address sender, string text
    );

    error ZeroAddress();
    error InvalidText(uint256 length);
    error DestinationChainNotAllowed(uint64 chainSelector);
    error SenderNotAllowed(uint64 chainSelector, address sender);
    error InsufficientNativeForFees(uint256 provided, uint256 required);
    error UnexpectedNativeValue(uint256 value);
    error NativeTransferFailed(address to, uint256 amount);

    constructor(address router_, address owner_) CCIPReceiver(router_) Ownable(owner_) {}

    function allowlistDestinationChain(uint64 chainSelector, bool allowed) external onlyOwner {
        allowlistedDestinationChains[chainSelector] = allowed;
        emit DestinationChainSet(chainSelector, allowed);
    }

    function allowlistSender(uint64 chainSelector, address sender, bool allowed) external onlyOwner {
        if (sender == address(0)) revert ZeroAddress();
        allowlistedSenders[chainSelector][sender] = allowed;
        emit SenderSet(chainSelector, sender, allowed);
    }

    /// @notice Lets messages from a source chain execute before full finality on CCIP 2.0 lanes.
    /// bytes4(0), the default, accepts only fully finalized messages.
    function setAllowedFinalityConfig(uint64 chainSelector, bytes4 allowedFinalityConfig) external onlyOwner {
        _allowedFinalityConfig[chainSelector] = allowedFinalityConfig;
        emit AllowedFinalityConfigSet(chainSelector, allowedFinalityConfig);
    }

    function getFee(
        uint64 destinationChainSelector,
        address receiver,
        string calldata text,
        address feeToken,
        bytes calldata extraArgs
    ) external view returns (uint256) {
        return IRouterClient(getRouter()).getFee(
            destinationChainSelector, _buildMessage(receiver, msg.sender, text, feeToken, extraArgs)
        );
    }

    /// @notice Sends `text` to a messenger on another chain. With `feeToken` set to the zero address,
    /// send at least getFee(...) as msg.value; the excess is refunded. Otherwise approve the fee first.
    function sendMessage(
        uint64 destinationChainSelector,
        address receiver,
        string calldata text,
        address feeToken,
        bytes calldata extraArgs
    ) external payable nonReentrant returns (bytes32 messageId) {
        if (!allowlistedDestinationChains[destinationChainSelector]) revert DestinationChainNotAllowed(destinationChainSelector);
        if (receiver == address(0)) revert ZeroAddress();
        uint256 length = bytes(text).length;
        if (length == 0 || length > MAX_TEXT_BYTES) revert InvalidText(length);

        IRouterClient router = IRouterClient(getRouter());
        Client.EVM2AnyMessage memory message = _buildMessage(receiver, msg.sender, text, feeToken, extraArgs);
        uint256 fees = router.getFee(destinationChainSelector, message);

        if (feeToken == address(0)) {
            if (msg.value < fees) revert InsufficientNativeForFees(msg.value, fees);
            messageId = router.ccipSend{value: fees}(destinationChainSelector, message);
            uint256 excess = msg.value - fees;
            if (excess > 0) {
                (bool sent,) = msg.sender.call{value: excess}("");
                if (!sent) revert NativeTransferFailed(msg.sender, excess);
            }
        } else {
            if (msg.value != 0) revert UnexpectedNativeValue(msg.value);
            IERC20(feeToken).safeTransferFrom(msg.sender, address(this), fees);
            IERC20(feeToken).forceApprove(address(router), fees);
            messageId = router.ccipSend(destinationChainSelector, message);
        }

        emit MessageSent(messageId, destinationChainSelector, msg.sender, receiver, text, feeToken, fees);
    }

    /// @notice Tells the CCIP 2.0 OffRamp which verifiers and finality this receiver accepts. Rejecting
    /// unknown senders here stops their messages before execution, in addition to the check in _ccipReceive.
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

    function lastMessage() external view returns (Received memory) {
        return _last;
    }

    function _ccipReceive(Client.Any2EVMMessage memory message) internal override {
        address sender = abi.decode(message.sender, (address));
        if (!allowlistedSenders[message.sourceChainSelector][sender]) revert SenderNotAllowed(message.sourceChainSelector, sender);

        (address author, string memory text) = abi.decode(message.data, (address, string));
        _last = Received({
            messageId: message.messageId,
            sourceChainSelector: message.sourceChainSelector,
            receivedAt: uint64(block.timestamp),
            sender: sender,
            author: author,
            text: text
        });
        receivedCount += 1;
        emit MessageReceived(message.messageId, message.sourceChainSelector, author, sender, text);
    }

    function _buildMessage(address receiver, address author, string calldata text, address feeToken, bytes calldata extraArgs)
        private
        pure
        returns (Client.EVM2AnyMessage memory)
    {
        return Client.EVM2AnyMessage({
            receiver: abi.encode(receiver),
            data: abi.encode(author, text),
            tokenAmounts: new Client.EVMTokenAmount[](0),
            extraArgs: extraArgs,
            feeToken: feeToken
        });
    }
}
