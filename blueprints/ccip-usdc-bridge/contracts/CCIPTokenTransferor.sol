// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Adapted from Chainlink's TokenTransferor tutorial, https://github.com/smartcontractkit/docs-ccip (MIT).

import {IRouterClient} from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title CCIPTokenTransferor
/// @notice Sends a token such as USDC to an address on another chain over Chainlink CCIP. The caller
/// approves this contract for the amount, plus the fee when paying in an ERC-20. extraArgs are encoded
/// off-chain, so one deployment works on both CCIP 1.x and CCIP 2.0 lanes.
contract CCIPTokenTransferor is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IRouterClient public immutable router;

    mapping(uint64 chainSelector => bool) public allowlistedDestinationChains;

    event DestinationChainSet(uint64 indexed chainSelector, bool allowed);
    event TokensTransferred(
        bytes32 indexed messageId,
        uint64 indexed destinationChainSelector,
        address indexed sender,
        address receiver,
        address token,
        uint256 amount,
        address feeToken,
        uint256 fees
    );

    error ZeroAddress();
    error InvalidAmount();
    error DestinationChainNotAllowed(uint64 chainSelector);
    error InsufficientNativeForFees(uint256 provided, uint256 required);
    error UnexpectedNativeValue(uint256 value);
    error NativeTransferFailed(address to, uint256 amount);
    error NothingToWithdraw();

    constructor(address router_, address owner_) Ownable(owner_) {
        if (router_ == address(0)) revert ZeroAddress();
        router = IRouterClient(router_);
    }

    function allowlistDestinationChain(uint64 chainSelector, bool allowed) external onlyOwner {
        allowlistedDestinationChains[chainSelector] = allowed;
        emit DestinationChainSet(chainSelector, allowed);
    }

    /// @notice Quotes the CCIP fee in `feeToken` (the zero address for native gas).
    function getFee(
        uint64 destinationChainSelector,
        address receiver,
        address token,
        uint256 amount,
        address feeToken,
        bytes calldata extraArgs
    ) external view returns (uint256) {
        return router.getFee(destinationChainSelector, _buildMessage(receiver, token, amount, feeToken, extraArgs));
    }

    /// @notice Sends `amount` of `token` to `receiver` on the destination chain.
    /// With `feeToken` set to the zero address, send at least getFee(...) as msg.value; the excess is refunded.
    function transferTokens(
        uint64 destinationChainSelector,
        address receiver,
        address token,
        uint256 amount,
        address feeToken,
        bytes calldata extraArgs
    ) external payable nonReentrant returns (bytes32 messageId) {
        if (!allowlistedDestinationChains[destinationChainSelector]) revert DestinationChainNotAllowed(destinationChainSelector);
        if (receiver == address(0) || token == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();

        Client.EVM2AnyMessage memory message = _buildMessage(receiver, token, amount, feeToken, extraArgs);
        uint256 fees = router.getFee(destinationChainSelector, message);

        if (feeToken == address(0)) {
            if (msg.value < fees) revert InsufficientNativeForFees(msg.value, fees);
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
            IERC20(token).forceApprove(address(router), amount);
            messageId = router.ccipSend{value: fees}(destinationChainSelector, message);
            _refund(msg.value - fees);
        } else {
            if (msg.value != 0) revert UnexpectedNativeValue(msg.value);
            if (feeToken == token) {
                IERC20(token).safeTransferFrom(msg.sender, address(this), amount + fees);
                IERC20(token).forceApprove(address(router), amount + fees);
            } else {
                IERC20(feeToken).safeTransferFrom(msg.sender, address(this), fees);
                IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
                IERC20(feeToken).forceApprove(address(router), fees);
                IERC20(token).forceApprove(address(router), amount);
            }
            messageId = router.ccipSend(destinationChainSelector, message);
        }

        emit TokensTransferred(messageId, destinationChainSelector, msg.sender, receiver, token, amount, feeToken, fees);
    }

    /// @notice Recovers native gas sent to the contract directly.
    function withdraw(address to) external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance == 0) revert NothingToWithdraw();
        (bool sent,) = to.call{value: balance}("");
        if (!sent) revert NativeTransferFailed(to, balance);
    }

    /// @notice Recovers tokens sent to the contract directly.
    function withdrawToken(address to, address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance == 0) revert NothingToWithdraw();
        IERC20(token).safeTransfer(to, balance);
    }

    receive() external payable {}

    function _buildMessage(address receiver, address token, uint256 amount, address feeToken, bytes calldata extraArgs)
        private
        pure
        returns (Client.EVM2AnyMessage memory)
    {
        Client.EVMTokenAmount[] memory tokenAmounts = new Client.EVMTokenAmount[](1);
        tokenAmounts[0] = Client.EVMTokenAmount({token: token, amount: amount});
        return Client.EVM2AnyMessage({
            receiver: abi.encode(receiver),
            data: "",
            tokenAmounts: tokenAmounts,
            extraArgs: extraArgs,
            feeToken: feeToken
        });
    }

    function _refund(uint256 amount) private {
        if (amount == 0) return;
        (bool sent,) = msg.sender.call{value: amount}("");
        if (!sent) revert NativeTransferFailed(msg.sender, amount);
    }
}
