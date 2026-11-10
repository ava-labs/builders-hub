// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {
    IERC20,
    SafeERC20,
    Ownable,
    Initializable,
    UUPSUpgradeable,
    Client,
    CCIPReceiver,
    AggregatorV3Interface,
    IUniswapV2Pair
} from "./Stubs.sol";

// One contract per detector, named after the detector it must trigger.

contract UnprotectedInitializer {
    address public owner;

    function initialize(address newOwner) external {
        owner = newOwner;
    }
}

contract UnprotectedUpgrade is UUPSUpgradeable, Initializable {
    constructor() {
        _disableInitializers();
    }

    function _authorizeUpgrade(address) internal override {}
}

contract UninitializedImplementation is Initializable {
    address public owner;

    function initialize(address newOwner) external initializer {
        owner = newOwner;
    }
}

contract DelegatecallUntrusted {
    function execute(address target, bytes calldata data) external {
        (bool ok,) = target.delegatecall(data);
        require(ok, "failed");
    }
}

contract UnprotectedMint {
    mapping(address => uint256) public balanceOf;
    uint256 public totalSupply;

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _mint(address to, uint256 amount) internal {
        balanceOf[to] += amount;
        totalSupply += amount;
    }
}

contract UnprotectedWithdrawal {
    receive() external payable {}

    function sweep(address payable to) external {
        (bool ok,) = to.call{value: address(this).balance}("");
        require(ok, "failed");
    }
}

contract ArbitraryFromTransfer {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;

    constructor(IERC20 token_) {
        token = token_;
    }

    function pull(address from, uint256 amount) external {
        token.safeTransferFrom(from, address(this), amount);
    }
}

contract ArbitraryExternalCall {
    function forward(address target, bytes calldata data) external returns (bytes memory) {
        (bool ok, bytes memory result) = target.call(data);
        require(ok, "failed");
        return result;
    }
}

contract TxOriginAuth {
    address public immutable owner;
    uint256 public value;

    constructor() {
        owner = msg.sender;
    }

    function set(uint256 newValue) external {
        require(tx.origin == owner, "not owner");
        value = newValue;
    }
}

contract Selfdestruct {
    function close() external {
        selfdestruct(payable(msg.sender));
    }
}

contract CcipUncheckedSource is CCIPReceiver {
    bytes public lastData;

    constructor(address router) CCIPReceiver(router) {}

    function _ccipReceive(Client.Any2EVMMessage memory message) internal override {
        lastData = message.data;
    }
}

contract TeleporterUncheckedSource {
    bytes public lastMessage;

    function receiveTeleporterMessage(bytes32, address, bytes calldata message) external {
        lastMessage = message;
    }
}

contract SingleStepOwnership is Ownable {
    uint256 public value;

    constructor() Ownable(msg.sender) {}

    function set(uint256 newValue) external onlyOwner {
        value = newValue;
    }
}

contract OracleStalePrice {
    AggregatorV3Interface public immutable feed;

    constructor(AggregatorV3Interface feed_) {
        feed = feed_;
    }

    function price() external view returns (uint256) {
        (, int256 answer,,,) = feed.latestRoundData();
        return uint256(answer);
    }
}

contract SpotPriceOracle {
    IUniswapV2Pair public immutable pair;

    constructor(IUniswapV2Pair pair_) {
        pair = pair_;
    }

    function price() external view returns (uint256) {
        (uint112 reserve0, uint112 reserve1,) = pair.getReserves();
        return (uint256(reserve1) * 1e18) / reserve0;
    }
}

contract EcrecoverRaw {
    function signer(bytes32 digest, uint8 v, bytes32 r, bytes32 s) external pure returns (address) {
        return ecrecover(digest, v, r, s);
    }
}

contract HardcodedAddress {
    address public constant TREASURY = 0x1111111111111111111111111111111111111111;
}

contract UncheckedLowLevelCall {
    function ping(address target) external {
        target.call("");
    }
}

contract UncheckedErc20Transfer {
    IERC20 public immutable token;
    address public immutable admin;

    constructor(IERC20 token_) {
        token = token_;
        admin = msg.sender;
    }

    function pay(address to, uint256 amount) external {
        require(msg.sender == admin, "not admin");
        token.transfer(to, amount);
    }
}

contract PushPaymentLoop {
    address payable[] public payees;
    address public immutable admin;

    constructor() {
        admin = msg.sender;
    }

    receive() external payable {}

    function addPayee(address payable payee) external {
        require(msg.sender == admin, "not admin");
        payees.push(payee);
    }

    function payAll() external {
        require(msg.sender == admin, "not admin");
        for (uint256 i = 0; i < payees.length; ++i) {
            (bool ok,) = payees[i].call{value: 1 ether}("");
            require(ok, "failed");
        }
    }
}

contract TransferStipend {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) external {
        balances[msg.sender] -= amount;
        payable(msg.sender).transfer(amount);
    }
}

contract DivideBeforeMultiply {
    function share(uint256 amount, uint256 total, uint256 part) external pure returns (uint256) {
        return (amount / total) * part;
    }
}

contract StrictBalanceEquality {
    function isFunded() external view returns (bool) {
        return address(this).balance == 10 ether;
    }
}

contract WeakRandomness {
    function roll() external view returns (uint256) {
        return uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, msg.sender))) % 6;
    }
}

contract EncodePackedCollision {
    function key(string calldata a, string calldata b) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(a, b));
    }
}

contract LockedEther {
    mapping(address => uint256) public paid;

    function pay() external payable {
        paid[msg.sender] += msg.value;
    }
}

contract UnboundedLoop {
    uint256[] public items;
    uint256 public total;

    function add(uint256 item) external {
        items.push(item);
    }

    function recompute() external {
        uint256 sum;
        for (uint256 i = 0; i < items.length; ++i) {
            sum += items[i];
        }
        total = sum;
    }
}

contract Reentrancy {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw() external {
        uint256 amount = balances[msg.sender];
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "failed");
        balances[msg.sender] = 0;
    }
}

contract UncheckedArithmetic {
    function add(uint256 a, uint256 b) external pure returns (uint256) {
        unchecked {
            return a + b;
        }
    }
}

contract UnsafeDowncast {
    function narrow(uint256 value) external pure returns (uint64) {
        return uint64(value);
    }
}
