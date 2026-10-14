// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {
    IERC20,
    SafeERC20,
    Ownable,
    Ownable2Step,
    ReentrancyGuard,
    Initializable,
    UUPSUpgradeable,
    Client,
    CCIPReceiver,
    AggregatorV3Interface
} from "./Stubs.sol";

// The constructs from Vulnerable.sol, done right. The audit must report nothing here.

contract SafeUpgradeable is UUPSUpgradeable, Initializable, Ownable2Step {
    uint256 public value;

    constructor() Ownable(msg.sender) {
        _disableInitializers();
    }

    function initialize(uint256 initialValue) external initializer {
        value = initialValue;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}

contract SafeToken is Ownable2Step {
    mapping(address => uint256) public balanceOf;
    uint256 public totalSupply;

    constructor() Ownable(msg.sender) {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function _mint(address to, uint256 amount) internal {
        balanceOf[to] += amount;
        totalSupply += amount;
    }
}

contract SafeBank is ReentrancyGuard {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw() external nonReentrant {
        uint256 amount = balances[msg.sender];
        balances[msg.sender] = 0;
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "send failed");
    }
}

contract SafeVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    mapping(address => uint256) public deposits;

    constructor(IERC20 token_) {
        token = token_;
    }

    function deposit(uint256 amount) external nonReentrant {
        deposits[msg.sender] += amount;
        token.safeTransferFrom(msg.sender, address(this), amount);
    }

    function withdraw(uint256 amount) external nonReentrant {
        deposits[msg.sender] -= amount;
        token.safeTransfer(msg.sender, amount);
    }
}

contract SafeOracle {
    AggregatorV3Interface public immutable feed;
    uint256 public immutable maxAge;

    constructor(AggregatorV3Interface feed_, uint256 maxAge_) {
        feed = feed_;
        maxAge = maxAge_;
    }

    function price() external view returns (uint256) {
        (, int256 answer,, uint256 updatedAt,) = feed.latestRoundData();
        require(answer > 0, "bad answer");
        require(block.timestamp - updatedAt <= maxAge, "stale");
        return uint256(answer);
    }
}

contract SafeCcipReceiver is CCIPReceiver, Ownable2Step {
    mapping(uint64 => mapping(address => bool)) public allowed;
    bytes public lastData;

    constructor(address router) CCIPReceiver(router) Ownable(msg.sender) {}

    function allow(uint64 chainSelector, address sender, bool isAllowed) external onlyOwner {
        allowed[chainSelector][sender] = isAllowed;
    }

    function _ccipReceive(Client.Any2EVMMessage memory message) internal override {
        require(allowed[message.sourceChainSelector][abi.decode(message.sender, (address))], "sender not allowed");
        lastData = message.data;
    }
}

contract SafeTeleporterReceiver {
    address public immutable messenger;
    bytes32 public immutable peerChain;
    address public immutable peer;
    bytes public lastMessage;

    constructor(address messenger_, bytes32 peerChain_, address peer_) {
        messenger = messenger_;
        peerChain = peerChain_;
        peer = peer_;
    }

    function receiveTeleporterMessage(bytes32 sourceBlockchainID, address originSenderAddress, bytes calldata message)
        external
    {
        require(msg.sender == messenger, "not messenger");
        require(sourceBlockchainID == peerChain && originSenderAddress == peer, "unknown peer");
        lastMessage = message;
    }
}

contract SafePayouts is Ownable2Step, ReentrancyGuard {
    mapping(address => uint256) public owed;

    constructor() Ownable(msg.sender) {}

    function credit(address payee) external payable onlyOwner {
        owed[payee] += msg.value;
    }

    function claim() external nonReentrant {
        uint256 amount = owed[msg.sender];
        owed[msg.sender] = 0;
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "send failed");
    }
}

contract SafeArithmetic {
    uint256 public constant MAX_VALUES = 16;
    uint256[] public values;
    uint256 public total;

    function add(uint256 value) external {
        require(values.length < MAX_VALUES, "full");
        values.push(value);
    }

    function recompute() external {
        uint256 sum;
        for (uint256 i = 0; i < values.length;) {
            sum += values[i];
            unchecked {
                ++i;
            }
        }
        total = sum;
    }

    function share(uint256 amount, uint256 part, uint256 whole) external pure returns (uint256) {
        return (amount * part) / whole;
    }

    function stamp() external view returns (uint64) {
        return uint64(block.timestamp);
    }

    function narrow(uint256 value) external pure returns (uint64) {
        require(value <= type(uint64).max, "too large");
        return uint64(value);
    }

    function isFunded(uint256 target) external view returns (bool) {
        return address(this).balance >= target;
    }

    function key(string calldata a, string calldata b) external pure returns (bytes32) {
        return keccak256(abi.encode(a, b));
    }

    function dayOffset() external view returns (uint256) {
        return block.timestamp % 1 days;
    }
}
