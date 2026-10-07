// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title USDCCheckout
/// @notice A storefront's onchain register. The owner lists products priced in the payment token,
/// buyers pay for an order, and every order is recorded so the store can fulfil or refund it.
/// Funds stay in the contract until the owner withdraws them, which is what makes refunds possible.
contract USDCCheckout is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum OrderStatus {
        None,
        Paid,
        Refunded
    }

    struct Product {
        string name;
        /// @dev In the payment token's base units: 25 USDC is 25_000000.
        uint256 price;
        bool active;
    }

    struct Order {
        address buyer;
        uint64 paidAt;
        OrderStatus status;
        uint256 productId;
        uint256 quantity;
        uint256 amount;
        /// @dev The storefront's own id for the cart or session, echoed for reconciliation.
        bytes32 orderRef;
    }

    uint256 public constant MAX_QUANTITY = 1_000;

    IERC20 public immutable paymentToken;
    uint256 public nextOrderId = 1;

    mapping(uint256 => Product) private _products;
    mapping(uint256 => Order) private _orders;

    event ProductSet(uint256 indexed productId, string name, uint256 price, bool active);
    event OrderPaid(
        uint256 indexed orderId,
        address indexed buyer,
        uint256 indexed productId,
        uint256 quantity,
        uint256 amount,
        bytes32 orderRef
    );
    event OrderRefunded(uint256 indexed orderId, address indexed buyer, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    error ZeroAddress();
    error InvalidPrice();
    error ProductUnavailable(uint256 productId);
    error InvalidQuantity(uint256 quantity);
    error NotRefundable(uint256 orderId);

    constructor(IERC20 paymentToken_, address owner_) Ownable(owner_) {
        if (address(paymentToken_) == address(0)) revert ZeroAddress();
        paymentToken = paymentToken_;
    }

    function setProduct(uint256 productId, string calldata name, uint256 price, bool active) external onlyOwner {
        if (price == 0) revert InvalidPrice();
        _products[productId] = Product({name: name, price: price, active: active});
        emit ProductSet(productId, name, price, active);
    }

    /// @notice Pays for an order. The buyer approves `priceOf(productId, quantity)` first.
    function purchase(uint256 productId, uint256 quantity, bytes32 orderRef)
        external
        whenNotPaused
        nonReentrant
        returns (uint256 orderId)
    {
        return _purchase(productId, quantity, orderRef);
    }

    /// @notice Pays in one transaction with an EIP-2612 permit signature, which USDC supports.
    function purchaseWithPermit(
        uint256 productId,
        uint256 quantity,
        bytes32 orderRef,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external whenNotPaused nonReentrant returns (uint256 orderId) {
        uint256 amount = priceOf(productId, quantity);
        // If someone front-runs the permit, the allowance it grants still exists, so a revert here is not fatal.
        try IERC20Permit(address(paymentToken)).permit(msg.sender, address(this), amount, deadline, v, r, s) {} catch {}
        return _purchase(productId, quantity, orderRef);
    }

    function refund(uint256 orderId) external onlyOwner nonReentrant {
        Order storage paid = _orders[orderId];
        if (paid.status != OrderStatus.Paid) revert NotRefundable(orderId);
        paid.status = OrderStatus.Refunded;
        paymentToken.safeTransfer(paid.buyer, paid.amount);
        emit OrderRefunded(orderId, paid.buyer, paid.amount);
    }

    function withdraw(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        paymentToken.safeTransfer(to, amount);
        emit Withdrawn(to, amount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Total price in base units. Reverts for inactive products and out-of-range quantities.
    function priceOf(uint256 productId, uint256 quantity) public view returns (uint256) {
        Product storage listed = _products[productId];
        if (!listed.active) revert ProductUnavailable(productId);
        if (quantity == 0 || quantity > MAX_QUANTITY) revert InvalidQuantity(quantity);
        return listed.price * quantity;
    }

    function getProduct(uint256 productId) external view returns (Product memory) {
        return _products[productId];
    }

    function getOrder(uint256 orderId) external view returns (Order memory) {
        return _orders[orderId];
    }

    function _purchase(uint256 productId, uint256 quantity, bytes32 orderRef) private returns (uint256 orderId) {
        uint256 amount = priceOf(productId, quantity);
        orderId = nextOrderId++;
        _orders[orderId] = Order({
            buyer: msg.sender,
            paidAt: uint64(block.timestamp),
            status: OrderStatus.Paid,
            productId: productId,
            quantity: quantity,
            amount: amount,
            orderRef: orderRef
        });
        paymentToken.safeTransferFrom(msg.sender, address(this), amount);
        emit OrderPaid(orderId, msg.sender, productId, quantity, amount, orderRef);
    }
}
