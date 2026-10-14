// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title CreatorTips
/// @notice Creators claim a handle and publish a profile; fans tip them in the tip token with a message.
/// Tips move straight from the fan to the creator, so the contract never holds funds.
contract CreatorTips {
    using SafeERC20 for IERC20;

    struct Profile {
        string handle;
        string displayName;
        string bio;
        string avatarURI;
        uint64 createdAt;
        uint256 tipsReceived;
        uint256 tipCount;
    }

    uint256 public constant MIN_HANDLE_BYTES = 3;
    uint256 public constant MAX_HANDLE_BYTES = 32;
    uint256 public constant MAX_TEXT_BYTES = 280;

    IERC20 public immutable tipToken;

    mapping(address => Profile) private _profiles;
    mapping(bytes32 => address) private _creatorByHandle;

    event ProfileCreated(address indexed creator, string handle);
    event ProfileUpdated(address indexed creator);
    event Tipped(address indexed creator, address indexed from, uint256 amount, string message);

    error ZeroAddress();
    error InvalidHandle(string handle);
    error HandleTaken(string handle);
    error AlreadyRegistered(address creator);
    error NotRegistered(address creator);
    error UnknownHandle(string handle);
    error TextTooLong(uint256 length, uint256 maxLength);
    error InvalidAmount();
    error SelfTip();

    constructor(IERC20 tipToken_) {
        if (address(tipToken_) == address(0)) revert ZeroAddress();
        tipToken = tipToken_;
    }

    /// @notice Claims a handle of 3 to 32 characters from a-z, 0-9 and underscore. One profile per address.
    function register(
        string calldata handle,
        string calldata displayName,
        string calldata bio,
        string calldata avatarURI
    ) external {
        if (_profiles[msg.sender].createdAt != 0) revert AlreadyRegistered(msg.sender);
        _checkHandle(handle);
        bytes32 key = keccak256(bytes(handle));
        if (_creatorByHandle[key] != address(0)) revert HandleTaken(handle);
        _checkText(displayName);
        _checkText(bio);
        _checkText(avatarURI);

        _creatorByHandle[key] = msg.sender;
        _profiles[msg.sender] = Profile({
            handle: handle,
            displayName: displayName,
            bio: bio,
            avatarURI: avatarURI,
            createdAt: uint64(block.timestamp),
            tipsReceived: 0,
            tipCount: 0
        });
        emit ProfileCreated(msg.sender, handle);
    }

    function updateProfile(string calldata displayName, string calldata bio, string calldata avatarURI) external {
        Profile storage profile = _profiles[msg.sender];
        if (profile.createdAt == 0) revert NotRegistered(msg.sender);
        _checkText(displayName);
        _checkText(bio);
        _checkText(avatarURI);

        profile.displayName = displayName;
        profile.bio = bio;
        profile.avatarURI = avatarURI;
        emit ProfileUpdated(msg.sender);
    }

    /// @notice Sends `amount` base units to the creator. The fan approves this contract for `amount` first.
    function tip(string calldata handle, uint256 amount, string calldata message) external {
        address creator = _creatorByHandle[keccak256(bytes(handle))];
        if (creator == address(0)) revert UnknownHandle(handle);
        if (creator == msg.sender) revert SelfTip();
        if (amount == 0) revert InvalidAmount();
        _checkText(message);

        Profile storage profile = _profiles[creator];
        profile.tipsReceived += amount;
        profile.tipCount += 1;
        tipToken.safeTransferFrom(msg.sender, creator, amount);
        emit Tipped(creator, msg.sender, amount, message);
    }

    function profileOf(address creator) external view returns (Profile memory) {
        return _profiles[creator];
    }

    function creatorOf(string calldata handle) external view returns (address) {
        return _creatorByHandle[keccak256(bytes(handle))];
    }

    function _checkHandle(string calldata handle) private pure {
        bytes calldata raw = bytes(handle);
        if (raw.length < MIN_HANDLE_BYTES || raw.length > MAX_HANDLE_BYTES) revert InvalidHandle(handle);
        for (uint256 i = 0; i < raw.length; ++i) {
            bytes1 char = raw[i];
            bool allowed = (char >= 0x61 && char <= 0x7a) || (char >= 0x30 && char <= 0x39) || char == 0x5f;
            if (!allowed) revert InvalidHandle(handle);
        }
    }

    function _checkText(string calldata text) private pure {
        uint256 length = bytes(text).length;
        if (length > MAX_TEXT_BYTES) revert TextTooLong(length, MAX_TEXT_BYTES);
    }
}
