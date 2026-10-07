// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IRouterClient} from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title USDCToL1Sender
/// @notice Lives on any CCIP chain with USDC. Sends USDC over CCIP to the L1Gateway on the Avalanche
/// C-Chain, with the L1 recipient in the message data; the gateway forwards it to the L1 through ICTT.
/// extraArgs are encoded off-chain and must carry enough gas for the gateway's forwarding.
contract USDCToL1Sender is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IRouterClient public immutable router;
    IERC20 public immutable usdc;
    uint64 public immutable hubChainSelector;
    address public immutable gateway;

    event SentToL1(
        bytes32 indexed messageId, address indexed sender, address indexed l1Recipient, uint256 amount, address feeToken, uint256 fees
    );

    error ZeroAddress();
    error InvalidAmount();
    error InsufficientNativeForFees(uint256 provided, uint256 required);
    error UnexpectedNativeValue(uint256 value);
    error NativeTransferFailed(address to, uint256 amount);
    error NothingToWithdraw();

    constructor(address router_, IERC20 usdc_, uint64 hubChainSelector_, address gateway_, address owner_) Ownable(owner_) {
        if (router_ == address(0) || address(usdc_) == address(0) || gateway_ == address(0)) revert ZeroAddress();
        router = IRouterClient(router_);
        usdc = usdc_;
        hubChainSelector = hubChainSelector_;
        gateway = gateway_;
    }

    function getFee(address l1Recipient, uint256 amount, address feeToken, bytes calldata extraArgs)
        external
        view
        returns (uint256)
    {
        return router.getFee(hubChainSelector, _buildMessage(l1Recipient, amount, feeToken, extraArgs));
    }

    /// @notice Sends `amount` USDC to `l1Recipient` on the L1. Approve this contract for `amount` first
    /// (plus the fee when paying in an ERC-20). With a native fee, excess msg.value is refunded.
    function sendToL1(address l1Recipient, uint256 amount, address feeToken, bytes calldata extraArgs)
        external
        payable
        nonReentrant
        returns (bytes32 messageId)
    {
        if (l1Recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();

        Client.EVM2AnyMessage memory message = _buildMessage(l1Recipient, amount, feeToken, extraArgs);
        uint256 fees = router.getFee(hubChainSelector, message);

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        if (feeToken == address(0)) {
            if (msg.value < fees) revert InsufficientNativeForFees(msg.value, fees);
            usdc.forceApprove(address(router), amount);
            messageId = router.ccipSend{value: fees}(hubChainSelector, message);
            uint256 excess = msg.value - fees;
            if (excess > 0) {
                (bool sent,) = msg.sender.call{value: excess}("");
                if (!sent) revert NativeTransferFailed(msg.sender, excess);
            }
        } else {
            if (msg.value != 0) revert UnexpectedNativeValue(msg.value);
            if (feeToken == address(usdc)) {
                usdc.safeTransferFrom(msg.sender, address(this), fees);
                usdc.forceApprove(address(router), amount + fees);
            } else {
                IERC20(feeToken).safeTransferFrom(msg.sender, address(this), fees);
                IERC20(feeToken).forceApprove(address(router), fees);
                usdc.forceApprove(address(router), amount);
            }
            messageId = router.ccipSend(hubChainSelector, message);
        }

        emit SentToL1(messageId, msg.sender, l1Recipient, amount, feeToken, fees);
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

    function _buildMessage(address l1Recipient, uint256 amount, address feeToken, bytes calldata extraArgs)
        private
        view
        returns (Client.EVM2AnyMessage memory)
    {
        Client.EVMTokenAmount[] memory tokenAmounts = new Client.EVMTokenAmount[](1);
        tokenAmounts[0] = Client.EVMTokenAmount({token: address(usdc), amount: amount});
        return Client.EVM2AnyMessage({
            receiver: abi.encode(gateway),
            data: abi.encode(l1Recipient),
            tokenAmounts: tokenAmounts,
            extraArgs: extraArgs,
            feeToken: feeToken
        });
    }
}
