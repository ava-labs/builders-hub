// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// Minimal stand-ins named like the OpenZeppelin, Chainlink and CCIP contracts the
// detectors recognise, so the fixtures compile without dependencies.

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function approve(address spender, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

library SafeERC20 {
    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        _call(token, abi.encodeCall(IERC20.transfer, (to, value)));
    }

    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        _call(token, abi.encodeCall(IERC20.transferFrom, (from, to, value)));
    }

    function _call(IERC20 token, bytes memory data) private {
        (bool ok, bytes memory result) = address(token).call(data);
        require(ok && (result.length == 0 || abi.decode(result, (bool))), "SafeERC20: failed");
    }
}

abstract contract Ownable {
    address public owner;

    constructor(address initialOwner) {
        owner = initialOwner;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    function transferOwnership(address newOwner) public virtual onlyOwner {
        owner = newOwner;
    }
}

abstract contract Ownable2Step is Ownable {
    address public pendingOwner;

    function transferOwnership(address newOwner) public virtual override onlyOwner {
        pendingOwner = newOwner;
    }

    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "not pending owner");
        owner = pendingOwner;
        pendingOwner = address(0);
    }
}

abstract contract ReentrancyGuard {
    uint256 private _status = 1;

    modifier nonReentrant() {
        require(_status == 1, "reentrant");
        _status = 2;
        _;
        _status = 1;
    }
}

abstract contract Initializable {
    bool private _initialized;

    modifier initializer() {
        require(!_initialized, "initialized");
        _initialized = true;
        _;
    }

    function _disableInitializers() internal {
        _initialized = true;
    }
}

abstract contract UUPSUpgradeable {
    address public implementation;

    function upgradeTo(address newImplementation) external {
        _authorizeUpgrade(newImplementation);
        implementation = newImplementation;
    }

    function _authorizeUpgrade(address newImplementation) internal virtual;
}

library Client {
    struct EVMTokenAmount {
        address token;
        uint256 amount;
    }

    struct Any2EVMMessage {
        bytes32 messageId;
        uint64 sourceChainSelector;
        bytes sender;
        bytes data;
        EVMTokenAmount[] destTokenAmounts;
    }
}

abstract contract CCIPReceiver {
    address internal immutable i_ccipRouter;

    constructor(address router) {
        i_ccipRouter = router;
    }

    function ccipReceive(Client.Any2EVMMessage calldata message) external virtual {
        require(msg.sender == i_ccipRouter, "not router");
        _ccipReceive(message);
    }

    function _ccipReceive(Client.Any2EVMMessage memory message) internal virtual;
}

interface AggregatorV3Interface {
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

interface IUniswapV2Pair {
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
}
