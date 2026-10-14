// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Guestbook
/// @notice A permanent, append-only guestbook. Anyone can sign; no one can edit or delete an entry.
contract Guestbook {
    struct Entry {
        address author;
        uint64 signedAt;
        string message;
    }

    uint256 public constant MAX_MESSAGE_BYTES = 280;
    uint256 public constant MAX_PAGE_SIZE = 50;

    Entry[] private _entries;

    event Signed(uint256 indexed id, address indexed author, string message);

    error EmptyMessage();
    error MessageTooLong(uint256 length, uint256 maxLength);
    error UnknownEntry(uint256 id);

    function sign(string calldata message) external returns (uint256 id) {
        uint256 length = bytes(message).length;
        if (length == 0) revert EmptyMessage();
        if (length > MAX_MESSAGE_BYTES) revert MessageTooLong(length, MAX_MESSAGE_BYTES);

        id = _entries.length;
        _entries.push(Entry({author: msg.sender, signedAt: uint64(block.timestamp), message: message}));
        emit Signed(id, msg.sender, message);
    }

    function count() external view returns (uint256) {
        return _entries.length;
    }

    function getEntry(uint256 id) external view returns (Entry memory) {
        if (id >= _entries.length) revert UnknownEntry(id);
        return _entries[id];
    }

    /// @notice Newest entries first; `offset` skips that many of the newest. Pages hold at most MAX_PAGE_SIZE entries.
    function latest(uint256 offset, uint256 limit) external view returns (Entry[] memory page) {
        uint256 total = _entries.length;
        if (offset >= total) return new Entry[](0);

        uint256 size = total - offset;
        if (size > limit) size = limit;
        if (size > MAX_PAGE_SIZE) size = MAX_PAGE_SIZE;

        page = new Entry[](size);
        for (uint256 i = 0; i < size; ++i) {
            page[i] = _entries[total - 1 - offset - i];
        }
    }
}
