// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ITeleporterMessenger, TeleporterFeeInfo, TeleporterMessageInput} from "@teleporter/ITeleporterMessenger.sol";
import {ITeleporterReceiver} from "@teleporter/ITeleporterReceiver.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title ICMMessenger
/// @notice Sends and receives short text messages between Avalanche chains over ICM (Teleporter).
/// Deploy one on each chain, then have each owner trust the other deployment with setTrustedRemote.
contract ICMMessenger is ITeleporterReceiver, Ownable {
    using SafeERC20 for IERC20;

    struct Received {
        bytes32 sourceBlockchainID;
        address sender;
        uint64 receivedAt;
        address author;
        string message;
    }

    uint256 public constant MAX_MESSAGE_BYTES = 280;
    /// @dev About twice the gas of a first delivery of a MAX_MESSAGE_BYTES message.
    uint256 public constant DEFAULT_GAS_LIMIT = 300_000;

    ITeleporterMessenger public immutable teleporterMessenger;

    /// @notice Messenger deployments allowed to exchange messages with this one, by blockchain ID.
    mapping(bytes32 blockchainID => mapping(address remote => bool)) public trustedRemote;
    uint256 public receivedCount;
    Received private _last;

    event TrustedRemoteSet(bytes32 indexed blockchainID, address indexed remote, bool trusted);
    event MessageSent(
        bytes32 indexed messageId,
        bytes32 indexed destinationBlockchainID,
        address indexed author,
        address destination,
        string message
    );
    event MessageReceived(bytes32 indexed sourceBlockchainID, address indexed author, address sender, string message);

    error ZeroAddress();
    error InvalidMessage(uint256 length);
    error UntrustedRemote(bytes32 blockchainID, address remote);
    error UnauthorizedMessenger(address caller);

    constructor(ITeleporterMessenger teleporterMessenger_, address owner_) Ownable(owner_) {
        if (address(teleporterMessenger_) == address(0)) revert ZeroAddress();
        teleporterMessenger = teleporterMessenger_;
    }

    function setTrustedRemote(bytes32 blockchainID, address remote, bool trusted) external onlyOwner {
        if (remote == address(0)) revert ZeroAddress();
        trustedRemote[blockchainID][remote] = trusted;
        emit TrustedRemoteSet(blockchainID, remote, trusted);
    }

    /// @notice Sends `message` to a trusted messenger on another chain, attributed to the caller.
    /// @param feeToken Relayer fee token, or the zero address with a zero fee. With a fee, the caller
    /// approves this contract for `feeAmount` first.
    /// @param requiredGasLimit Gas for delivery on the destination; zero means DEFAULT_GAS_LIMIT.
    function sendMessage(
        bytes32 destinationBlockchainID,
        address destination,
        string calldata message,
        address feeToken,
        uint256 feeAmount,
        uint256 requiredGasLimit
    ) external returns (bytes32 messageId) {
        uint256 length = bytes(message).length;
        if (length == 0 || length > MAX_MESSAGE_BYTES) revert InvalidMessage(length);
        if (!trustedRemote[destinationBlockchainID][destination]) revert UntrustedRemote(destinationBlockchainID, destination);

        if (feeAmount > 0) {
            IERC20(feeToken).safeTransferFrom(msg.sender, address(this), feeAmount);
            IERC20(feeToken).forceApprove(address(teleporterMessenger), feeAmount);
        }

        messageId = teleporterMessenger.sendCrossChainMessage(
            TeleporterMessageInput({
                destinationBlockchainID: destinationBlockchainID,
                destinationAddress: destination,
                feeInfo: TeleporterFeeInfo({feeTokenAddress: feeToken, amount: feeAmount}),
                requiredGasLimit: requiredGasLimit == 0 ? DEFAULT_GAS_LIMIT : requiredGasLimit,
                allowedRelayerAddresses: new address[](0),
                message: abi.encode(msg.sender, message)
            })
        );
        emit MessageSent(messageId, destinationBlockchainID, msg.sender, destination, message);
    }

    /// @inheritdoc ITeleporterReceiver
    function receiveTeleporterMessage(bytes32 sourceBlockchainID, address originSenderAddress, bytes calldata message)
        external
        override
    {
        if (msg.sender != address(teleporterMessenger)) revert UnauthorizedMessenger(msg.sender);
        if (!trustedRemote[sourceBlockchainID][originSenderAddress]) revert UntrustedRemote(sourceBlockchainID, originSenderAddress);

        (address author, string memory text) = abi.decode(message, (address, string));
        _last = Received({
            sourceBlockchainID: sourceBlockchainID,
            sender: originSenderAddress,
            receivedAt: uint64(block.timestamp),
            author: author,
            message: text
        });
        receivedCount += 1;
        emit MessageReceived(sourceBlockchainID, author, originSenderAddress, text);
    }

    function lastMessage() external view returns (Received memory) {
        return _last;
    }
}
