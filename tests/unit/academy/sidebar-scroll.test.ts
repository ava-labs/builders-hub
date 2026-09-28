import { describe, expect, it } from 'vitest';
import { centredScrollTop, isFullyVisible } from '@/components/academy/sidebar/sidebar-scroll';

/** A 500 px tall viewport whose top edge sits 100 px down the window, over a 2000 px list. */
const view = { top: 100, bottom: 600 };
const scroll = (scrollTop: number, scrollHeight = 2000) => ({ scrollTop, scrollHeight, clientHeight: 500 });
/** A 30 px sidebar item whose top edge sits `top` px down the window. */
const item = (top: number) => ({ top, bottom: top + 30 });

describe('isFullyVisible', () => {
  it('is true for an item inside the viewport, edges included', () => {
    expect(isFullyVisible(item(300), view)).toBe(true);
    expect(isFullyVisible(item(100), view)).toBe(true);
    expect(isFullyVisible(item(570), view)).toBe(true);
  });

  it('is false for an item cut by the top or the bottom edge', () => {
    expect(isFullyVisible(item(90), view)).toBe(false);
    expect(isFullyVisible(item(580), view)).toBe(false);
  });

  it('is false for an item entirely above or entirely below the viewport', () => {
    expect(isFullyVisible(item(20), view)).toBe(false);
    expect(isFullyVisible(item(900), view)).toBe(false);
  });

  it('keeps the inset bands at both edges out of the visible area', () => {
    expect(isFullyVisible(item(105), view, 12)).toBe(false);
    expect(isFullyVisible(item(112), view, 12)).toBe(true);
    expect(isFullyVisible(item(558), view, 12)).toBe(true);
    expect(isFullyVisible(item(560), view, 12)).toBe(false);
  });
});

describe('centredScrollTop', () => {
  it('puts the item centre on the viewport centre', () => {
    // The item starts 800 px down the list: 800 + 15 - 250.
    expect(centredScrollTop(item(900), view, scroll(0))).toBe(565);
  });

  it('gives the same position whatever the list is scrolled to when measured', () => {
    expect(centredScrollTop(item(500), view, scroll(400))).toBe(565);
  });

  it('clamps at the top of the scroll range', () => {
    expect(centredScrollTop(item(150), view, scroll(0))).toBe(0);
  });

  it('clamps at the bottom of the scroll range', () => {
    // The item starts 1950 px down the list; the range ends at 2000 - 500.
    expect(centredScrollTop(item(2050), view, scroll(0))).toBe(1500);
    expect(centredScrollTop(item(550), view, scroll(1500))).toBe(1500);
  });

  it('stays at 0 when the list is shorter than the viewport', () => {
    expect(centredScrollTop(item(450), view, scroll(0, 400))).toBe(0);
  });
});
