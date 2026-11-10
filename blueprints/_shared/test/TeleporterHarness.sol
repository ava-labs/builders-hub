// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test, Vm} from "forge-std/Test.sol";
import {ITeleporterMessenger, TeleporterFeeInfo, TeleporterMessage} from "@teleporter/ITeleporterMessenger.sol";
import {ITeleporterReceiver} from "@teleporter/ITeleporterReceiver.sol";

/// @notice Stands in for the Warp precompile. sendWarpMessage burns what subnet-evm charges for it,
/// 41,500 gas plus 8 per input byte, so gas measured through the real TeleporterMessenger is realistic.
contract MockWarp {
    event SendWarpMessage(address indexed sender, bytes32 indexed messageID, bytes message);

    bytes32 public chain;

    function setChain(bytes32 chain_) external {
        chain = chain_;
    }

    function getBlockchainID() external view returns (bytes32) {
        return chain;
    }

    function sendWarpMessage(bytes calldata payload) external returns (bytes32 messageID) {
        uint256 target = 41_500 + 8 * msg.data.length;
        uint256 start = gasleft();
        while (start - gasleft() < target) {}
        messageID = keccak256(payload);
        emit SendWarpMessage(msg.sender, messageID, payload);
    }
}

struct ProtocolRegistryEntry {
    uint256 version;
    address protocolAddress;
}

struct TokenRemoteSettings {
    address teleporterRegistryAddress;
    address teleporterManager;
    uint256 minTeleporterVersion;
    bytes32 tokenHomeBlockchainID;
    address tokenHomeAddress;
    uint8 tokenHomeDecimals;
}

/// @notice Two simulated Avalanche chains in one EVM, running the real TeleporterMessenger,
/// TeleporterRegistry and ICTT bytecode from contracts/icm-contracts/compiled. Messages are captured from
/// SendCrossChainMessage logs and delivered the way Teleporter does: the destination messenger calls
/// the receiver with exactly requiredGasLimit gas.
abstract contract TeleporterHarness is Test {
    address internal constant WARP = 0x0200000000000000000000000000000000000005;
    string internal constant ARTIFACTS = "../contracts/icm-contracts/compiled/";
    bytes32 internal constant CCHAIN = keccak256("c-chain");
    bytes32 internal constant L1 = keccak256("l1");

    ITeleporterMessenger internal cchainTeleporter;
    ITeleporterMessenger internal l1Teleporter;

    function _setUpTeleporters() internal {
        vm.etch(WARP, address(new MockWarp()).code);
        cchainTeleporter = _deployTeleporter(CCHAIN);
        l1Teleporter = _deployTeleporter(L1);
    }

    function _onChain(bytes32 chain) internal {
        MockWarp(WARP).setChain(chain);
    }

    function _deployArtifact(string memory name, bytes memory constructorArgs) internal returns (address deployed) {
        bytes memory code = abi.encodePacked(
            vm.parseJsonBytes(vm.readFile(string.concat(ARTIFACTS, name, ".json")), ".bytecode.object"), constructorArgs
        );
        assembly {
            deployed := create(0, add(code, 0x20), mload(code))
        }
        require(deployed != address(0), string.concat(name, ": deployment failed"));
    }

    function _deployTeleporter(bytes32 chain) internal returns (ITeleporterMessenger messenger) {
        _onChain(chain);
        address deployed = _deployArtifact("TeleporterMessenger", "");
        (bool ok,) = deployed.call(abi.encodeWithSignature("initializeBlockchainID()"));
        require(ok, "TeleporterMessenger: initializeBlockchainID failed");
        messenger = ITeleporterMessenger(deployed);
    }

    function _deployRegistry(bytes32 chain, ITeleporterMessenger messenger) internal returns (address) {
        _onChain(chain);
        ProtocolRegistryEntry[] memory entries = new ProtocolRegistryEntry[](1);
        entries[0] = ProtocolRegistryEntry({version: 1, protocolAddress: address(messenger)});
        return _deployArtifact("TeleporterRegistry", abi.encode(entries));
    }

    function _deployTokenHome(bytes32 chain, address registry, address manager, address token, uint8 decimals)
        internal
        returns (address)
    {
        _onChain(chain);
        return _deployArtifact("ERC20TokenHome", abi.encode(registry, manager, uint256(1), token, decimals));
    }

    function _deployTokenRemote(
        bytes32 chain,
        TokenRemoteSettings memory settings,
        string memory name,
        string memory symbol,
        uint8 decimals
    ) internal returns (address) {
        _onChain(chain);
        return _deployArtifact("ERC20TokenRemote", abi.encode(settings, name, symbol, decimals));
    }

    /// @notice Registers a TokenRemote with its home by relaying the registration message.
    function _registerRemote(address remote, ITeleporterMessenger homeMessenger, bytes32 remoteChain) internal {
        vm.recordLogs();
        (bool ok,) = remote.call(
            abi.encodeWithSignature(
                "registerWithHome((address,uint256))", TeleporterFeeInfo({feeTokenAddress: address(0), amount: 0})
            )
        );
        require(ok, "registerWithHome failed");
        (TeleporterMessage memory registration,) = _lastSent();
        _deliver(homeMessenger, remoteChain, registration);
    }

    /// @notice The most recent Teleporter message in the logs recorded since vm.recordLogs().
    function _lastSent() internal view returns (TeleporterMessage memory message, TeleporterFeeInfo memory fee) {
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i = logs.length; i > 0; --i) {
            if (logs[i - 1].topics[0] == ITeleporterMessenger.SendCrossChainMessage.selector) {
                return abi.decode(logs[i - 1].data, (TeleporterMessage, TeleporterFeeInfo));
            }
        }
        revert("TeleporterHarness: no SendCrossChainMessage recorded");
    }

    /// @notice Every Teleporter message in the logs recorded since vm.recordLogs(), oldest first.
    function _allSent() internal view returns (TeleporterMessage[] memory messages) {
        Vm.Log[] memory logs = vm.getRecordedLogs();
        uint256 count;
        for (uint256 i = 0; i < logs.length; ++i) {
            if (logs[i].topics[0] == ITeleporterMessenger.SendCrossChainMessage.selector) count++;
        }
        messages = new TeleporterMessage[](count);
        uint256 next;
        for (uint256 i = 0; i < logs.length; ++i) {
            if (logs[i].topics[0] == ITeleporterMessenger.SendCrossChainMessage.selector) {
                (messages[next++],) = abi.decode(logs[i].data, (TeleporterMessage, TeleporterFeeInfo));
            }
        }
    }

    /// @notice Delivers as Teleporter does and returns the gas the receiver used.
    function _deliver(ITeleporterMessenger destination, bytes32 sourceChain, TeleporterMessage memory message)
        internal
        returns (uint256 gasUsed)
    {
        vm.prank(address(destination));
        uint256 before = gasleft();
        ITeleporterReceiver(message.destinationAddress).receiveTeleporterMessage{gas: message.requiredGasLimit}(
            sourceChain, message.originSenderAddress, message.message
        );
        gasUsed = before - gasleft();
    }
}
