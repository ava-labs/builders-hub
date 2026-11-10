// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title USDCEscrow
/// @notice A buyer locks tokens for a seller. The buyer releases them on delivery, or the seller refunds.
/// Before the deadline either party can raise a dispute, which only the deal's arbiter can settle.
/// A deal that is neither released nor disputed by the deadline can be returned to the buyer by anyone.
contract USDCEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Status {
        None,
        Funded,
        Disputed,
        Released,
        Refunded,
        Settled
    }

    struct Deal {
        address buyer;
        address seller;
        address arbiter;
        uint64 deadline;
        Status status;
        uint256 amount;
        string terms;
    }

    uint256 public constant MAX_TERMS_BYTES = 1_000;

    IERC20 public immutable token;
    uint256 public nextDealId = 1;

    mapping(uint256 => Deal) private _deals;

    event DealCreated(
        uint256 indexed dealId,
        address indexed buyer,
        address indexed seller,
        address arbiter,
        uint256 amount,
        uint64 deadline
    );
    event Released(uint256 indexed dealId, uint256 amount);
    event Refunded(uint256 indexed dealId, uint256 amount);
    event Disputed(uint256 indexed dealId, address indexed by);
    event Settled(uint256 indexed dealId, uint256 toSeller, uint256 toBuyer);

    error ZeroAddress();
    error InvalidParties();
    error InvalidTerms();
    error NotBuyer();
    error NotSeller();
    error NotParty();
    error NotArbiter();
    error WrongStatus(Status status);
    error DeadlinePassed(uint64 deadline);
    error DeadlineNotReached(uint64 deadline);
    error InvalidSplit(uint256 toSeller, uint256 amount);

    constructor(IERC20 token_) {
        if (address(token_) == address(0)) revert ZeroAddress();
        token = token_;
    }

    /// @notice Locks `amount` from the caller, who becomes the buyer. Approve this contract for `amount` first.
    function createDeal(address seller, address arbiter, uint256 amount, uint64 deadline, string calldata terms)
        external
        nonReentrant
        returns (uint256 dealId)
    {
        if (seller == address(0) || arbiter == address(0)) revert ZeroAddress();
        if (seller == msg.sender || arbiter == msg.sender || arbiter == seller) revert InvalidParties();
        if (amount == 0 || deadline <= block.timestamp || bytes(terms).length > MAX_TERMS_BYTES) revert InvalidTerms();

        dealId = nextDealId++;
        _deals[dealId] = Deal({
            buyer: msg.sender,
            seller: seller,
            arbiter: arbiter,
            deadline: deadline,
            status: Status.Funded,
            amount: amount,
            terms: terms
        });
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit DealCreated(dealId, msg.sender, seller, arbiter, amount, deadline);
    }

    /// @notice The buyer confirms delivery and pays the seller.
    function release(uint256 dealId) external nonReentrant {
        Deal storage deal = _deals[dealId];
        if (msg.sender != deal.buyer) revert NotBuyer();
        if (deal.status != Status.Funded) revert WrongStatus(deal.status);
        deal.status = Status.Released;
        token.safeTransfer(deal.seller, deal.amount);
        emit Released(dealId, deal.amount);
    }

    /// @notice The seller cancels and the funds go back to the buyer.
    function refund(uint256 dealId) external nonReentrant {
        Deal storage deal = _deals[dealId];
        if (msg.sender != deal.seller) revert NotSeller();
        if (deal.status != Status.Funded) revert WrongStatus(deal.status);
        deal.status = Status.Refunded;
        token.safeTransfer(deal.buyer, deal.amount);
        emit Refunded(dealId, deal.amount);
    }

    /// @notice Either party freezes the deal for the arbiter. Only possible up to the deadline.
    function dispute(uint256 dealId) external {
        Deal storage deal = _deals[dealId];
        if (msg.sender != deal.buyer && msg.sender != deal.seller) revert NotParty();
        if (deal.status != Status.Funded) revert WrongStatus(deal.status);
        if (block.timestamp > deal.deadline) revert DeadlinePassed(deal.deadline);
        deal.status = Status.Disputed;
        emit Disputed(dealId, msg.sender);
    }

    /// @notice The arbiter pays `toSeller` to the seller and the rest to the buyer.
    function settle(uint256 dealId, uint256 toSeller) external nonReentrant {
        Deal storage deal = _deals[dealId];
        if (msg.sender != deal.arbiter) revert NotArbiter();
        if (deal.status != Status.Disputed) revert WrongStatus(deal.status);
        if (toSeller > deal.amount) revert InvalidSplit(toSeller, deal.amount);

        uint256 toBuyer = deal.amount - toSeller;
        deal.status = Status.Settled;
        if (toSeller > 0) token.safeTransfer(deal.seller, toSeller);
        if (toBuyer > 0) token.safeTransfer(deal.buyer, toBuyer);
        emit Settled(dealId, toSeller, toBuyer);
    }

    /// @notice Returns a funded, undisputed deal to the buyer once its deadline has passed. Anyone may call it.
    function reclaim(uint256 dealId) external nonReentrant {
        Deal storage deal = _deals[dealId];
        if (deal.status != Status.Funded) revert WrongStatus(deal.status);
        if (block.timestamp <= deal.deadline) revert DeadlineNotReached(deal.deadline);
        deal.status = Status.Refunded;
        token.safeTransfer(deal.buyer, deal.amount);
        emit Refunded(dealId, deal.amount);
    }

    function getDeal(uint256 dealId) external view returns (Deal memory) {
        return _deals[dealId];
    }
}
