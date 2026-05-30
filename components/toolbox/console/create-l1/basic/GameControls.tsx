'use client';

import { GameExitButton } from './GameExitButton';
import { GameMuteButton } from './GameMuteButton';

/**
 * Top-left overlay row on every mini-game. Wraps the exit button (if the
 * game has an exit handler) and the mute button in a flex row so neither
 * has to know about the other's width — fixes the overlap that arose when
 * each was self-positioned.
 *
 * Kept here rather than in each game so a future change to the control
 * layout (e.g. adding a volume slider) is one file edit, not six.
 */
export function GameControls({ onExit }: { onExit?: () => void }) {
  return (
    <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5">
      {onExit && <GameExitButton onExit={onExit} />}
      <GameMuteButton />
    </div>
  );
}
