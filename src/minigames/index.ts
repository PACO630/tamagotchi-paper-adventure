/** Mini-game entry point used by the `minigame` script step. Resolves once the player wins. */
import type Phaser from 'phaser';
import { dialogue } from '../ui/dialogueBox';
import { cinema } from '../ui/cinema';
import { playAssembly } from './assembly';
import type { SkyBattleScene } from './skyBattle';

export async function playMinigame(world: Phaser.Scene, id: string): Promise<void> {
  dialogue.hide();
  const wasCinema = cinema.active;
  if (id === 'sky') {
    await new Promise<void>((resolve) => {
      const sc = world.scene.get('SkyBattle') as SkyBattleScene;
      sc.onDone = () => { world.scene.stop('SkyBattle'); world.scene.resume(); resolve(); };
      world.scene.pause();
      world.scene.run('SkyBattle');
    });
  } else if (id === 'assembly') {
    cinema.off();
    await playAssembly();
  }
  if (wasCinema) cinema.on();
}
