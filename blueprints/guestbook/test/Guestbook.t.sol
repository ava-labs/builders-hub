// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test} from "forge-std/Test.sol";
import {Guestbook} from "../contracts/Guestbook.sol";

contract GuestbookTest is Test {
    Guestbook internal book;

    function setUp() public {
        book = new Guestbook();
    }

    function test_SignAndPageNewestFirst() public {
        vm.prank(address(1));
        book.sign("first");
        vm.prank(address(2));
        book.sign("second");

        assertEq(book.count(), 2);
        Guestbook.Entry[] memory page = book.latest(0, 10);
        assertEq(page.length, 2);
        assertEq(page[0].message, "second");
        assertEq(page[1].author, address(1));
        assertEq(book.latest(1, 10).length, 1);
        assertEq(book.latest(5, 10).length, 0);
        assertEq(book.getEntry(0).message, "first");
    }

    function test_RevertWhen_MessageEmptyOrTooLong() public {
        vm.expectRevert(Guestbook.EmptyMessage.selector);
        book.sign("");
        vm.expectRevert(abi.encodeWithSelector(Guestbook.MessageTooLong.selector, 281, 280));
        book.sign(string(new bytes(281)));
        vm.expectRevert(abi.encodeWithSelector(Guestbook.UnknownEntry.selector, 0));
        book.getEntry(0);
    }

    function testFuzz_PagesNeverExceedTheCap(uint8 entries, uint256 offset, uint256 limit) public {
        entries = uint8(bound(entries, 0, 60));
        for (uint256 i = 0; i < entries; ++i) {
            book.sign("x");
        }
        Guestbook.Entry[] memory page = book.latest(offset, limit);
        assertLe(page.length, book.MAX_PAGE_SIZE());
        assertLe(page.length, limit);
        if (offset >= entries) assertEq(page.length, 0);
    }
}
