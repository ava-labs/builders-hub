// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {CCIPReceiver} from "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";

/// @notice A CCIP router stand-in: charges a flat fee, pulls tokens the way the real router does, and
/// delivers messages to receivers as the OffRamp would, releasing tokens before calling ccipReceive.
contract MockCCIPRouter {
    using SafeERC20 for IERC20;

    uint256 public constant FEE = 0.01 ether;
    uint256 public sends;
    Client.EVM2AnyMessage internal _last;

    function getFee(uint64, Client.EVM2AnyMessage memory) external pure returns (uint256) {
        return FEE;
    }

    function isChainSupported(uint64) external pure returns (bool) {
        return true;
    }

    function ccipSend(uint64, Client.EVM2AnyMessage calldata message) external payable returns (bytes32) {
        if (message.feeToken == address(0)) {
            require(msg.value == FEE, "MockCCIPRouter: wrong native fee");
        } else {
            require(msg.value == 0, "MockCCIPRouter: unexpected value");
            IERC20(message.feeToken).safeTransferFrom(msg.sender, address(this), FEE);
        }
        for (uint256 i = 0; i < message.tokenAmounts.length; ++i) {
            IERC20(message.tokenAmounts[i].token).safeTransferFrom(msg.sender, address(this), message.tokenAmounts[i].amount);
        }
        _last = message;
        sends++;
        return keccak256(abi.encode(address(this), sends));
    }

    function lastMessage() external view returns (Client.EVM2AnyMessage memory) {
        return _last;
    }

    function deliver(address receiver, Client.Any2EVMMessage calldata message) external {
        CCIPReceiver(receiver).ccipReceive(message);
    }

    /// @notice Releases `amount` of `token` (held by this router) to the receiver, then calls ccipReceive.
    function deliverWithTokens(address receiver, Client.Any2EVMMessage calldata message, address token, uint256 amount)
        external
    {
        IERC20(token).safeTransfer(receiver, amount);
        CCIPReceiver(receiver).ccipReceive(message);
    }
}
