/**
 * Original compositions for the game (written for this project).
 * Each melody token is one eighth note: a note name ("E5"), "-" to hold, "." for rest.
 * The melody length must be chords.length * 8 tokens.
 */
export interface Song {
  bpm: number;
  chords: string[];
  melody: string;
  lead: OscillatorType;
  bass: 'pulse' | 'walk' | 'arp' | 'drone' | 'oom';
  drums: 'none' | 'light' | 'march' | 'rock' | 'swing' | 'shuffle';
  arp?: boolean;
  pad?: boolean;
  loop?: boolean;
  gain?: number;
}

export const SONGS: Record<string, Song> = {
  title: {
    bpm: 112, lead: 'square', bass: 'oom', drums: 'light', arp: true,
    chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'Dm', 'G'],
    melody: 'E5 - G5 - C6 - B5 A5 G5 - E5 - C5 - D5 E5 F5 - A5 - G5 F5 E5 - D5 - . . . . . . ' +
      'E5 - G5 - C6 - D6 C6 B5 - A5 - G5 - E5 - F5 - E5 D5 C5 - D5 - G4 - C5 - . . . . ',
  },
  village: {
    bpm: 100, lead: 'triangle', bass: 'oom', drums: 'light', arp: true,
    chords: ['F', 'C', 'Dm', 'Bb', 'F', 'C', 'Bb', 'C'],
    melody: 'A4 - C5 - F5 - E5 - D5 - C5 - G4 - - - A4 - Bb4 - D5 - C5 - A4 - - - - - . . ' +
      'A4 - C5 - F5 - G5 - A5 - G5 - E5 - C5 - D5 - C5 - Bb4 - A4 - G4 - - - . . . . ',
  },
  forest: {
    bpm: 126, lead: 'square', bass: 'walk', drums: 'shuffle', arp: false,
    chords: ['G', 'Em', 'C', 'D', 'G', 'Em', 'Am', 'D'],
    melody: 'D5 G5 B5 G5 D5 - B4 - E5 G5 B5 - A5 G5 E5 - C5 E5 G5 E5 C5 - E5 - F#5 - A5 - D6 - C6 - ' +
      'B5 - A5 G5 - D5 - . E5 - G5 B5 - E6 - D6 C6 A5 - C6 - E6 - A5 - F#5 - E5 - D5 - . ',
  },
  sky: {
    bpm: 92, lead: 'sine', bass: 'arp', drums: 'light', pad: true,
    chords: ['D', 'A', 'Bm', 'G', 'D', 'A', 'G', 'A'],
    melody: 'F#5 - - A5 D6 - C#6 - B5 - - A5 F#5 - - - G5 - - B5 D6 - E6 - F#6 - - - - - . . ' +
      'F#5 - - A5 D6 - E6 - F#6 - E6 - D6 - B5 - B5 - - D6 C#6 - B5 - A5 - - - - - . . ',
  },
  factory: {
    bpm: 132, lead: 'square', bass: 'pulse', drums: 'rock', arp: true,
    chords: ['Am', 'Am', 'F', 'G', 'Am', 'Am', 'Dm', 'E'],
    melody: 'A4 . A4 C5 . E5 D5 C5 A4 . A4 C5 E5 . G5 . F5 . E5 . C5 . A4 . G4 . B4 . D5 . G5 . ' +
      'A4 . A4 C5 . E5 D5 C5 E5 . G5 . A5 . . . F5 . A5 . D6 . C6 . B5 . G#5 . E5 . . . ',
  },
  ocean: {
    bpm: 84, lead: 'sine', bass: 'drone', drums: 'none', arp: true, pad: true,
    chords: ['Em', 'C', 'G', 'D', 'Em', 'C', 'Am', 'B'],
    melody: 'B4 - - E5 - - G5 - F#5 - - E5 - - D5 - D5 - - G5 - - B5 - A5 - - - - - . . ' +
      'B4 - - E5 - - G5 - A5 - - G5 - - E5 - C5 - - E5 - - A5 - F#5 - - D#5 - - . . ',
  },
  castle: {
    bpm: 96, lead: 'triangle', bass: 'walk', drums: 'march', arp: false, pad: true,
    chords: ['Dm', 'A', 'Dm', 'Gm', 'Bb', 'F', 'Gm', 'A'],
    melody: 'D5 - F5 - A5 - - G5 F5 - E5 - C#5 - - - D5 - E5 - F5 - A5 - G5 - - - - - . . ' +
      'D6 - C6 - Bb5 - - A5 F5 - G5 - A5 - - - G5 - F5 - E5 - D5 - C#5 - - - E5 - . . ',
  },
  dark: {
    bpm: 88, lead: 'sawtooth', bass: 'drone', drums: 'light', pad: true, gain: 0.7,
    chords: ['Cm', 'Ab', 'Fm', 'G', 'Cm', 'Ab', 'Bb', 'G'],
    melody: 'C5 - . Eb5 - . G5 - F5 - . Eb5 - . C5 - Ab4 - . C5 - . F5 - D5 - - - B4 - . . ' +
      'C5 - . Eb5 - . G5 - Ab5 - . G5 - . Eb5 - F5 - . D5 - . Bb4 - B4 - - - - - . . ',
  },
  temple: {
    bpm: 104, lead: 'triangle', bass: 'arp', drums: 'march', pad: true, arp: true,
    chords: ['Eb', 'Bb', 'Cm', 'Ab', 'Eb', 'Bb', 'Ab', 'Bb'],
    melody: 'G5 - Bb5 - Eb6 - D6 - C6 - Bb5 - G5 - - - Ab5 - G5 - F5 - Eb5 - F5 - - - - - . . ' +
      'G5 - Bb5 - Eb6 - F6 - G6 - F6 - Eb6 - D6 - C6 - D6 - Eb6 - C6 - D6 - - - - - . . ',
  },
  battle: {
    bpm: 152, lead: 'square', bass: 'pulse', drums: 'rock', arp: true,
    chords: ['Em', 'C', 'D', 'B', 'Em', 'C', 'Am', 'B'],
    melody: 'E5 . E5 G5 . B5 . A5 G5 . E5 . C5 . E5 . F#5 . A5 . D6 . C6 . B5 . D#5 . F#5 . B5 . ' +
      'E5 . G5 . B5 . E6 . D6 C6 B5 . G5 . E5 . A5 . C6 . E6 . D6 . B5 . A5 . F#5 . D#5 . ',
  },
  boss: {
    bpm: 164, lead: 'sawtooth', bass: 'pulse', drums: 'rock', arp: true, gain: 0.8,
    chords: ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Gm', 'A'],
    melody: 'D5 D5 . F5 . A5 . D6 C6 . A5 . F5 . G5 . A5 . . A5 G5 F5 E5 F5 D5 . F5 . A5 . C6 . ' +
      'D6 . C6 A5 . F5 . D5 E5 . F5 . A5 . . . Bb5 . A5 . G5 . D5 . C#5 . E5 . A5 . C#6 . ',
  },
  final: {
    bpm: 172, lead: 'sawtooth', bass: 'pulse', drums: 'rock', arp: true, pad: true, gain: 0.8,
    chords: ['Cm', 'Ab', 'Bb', 'G', 'Cm', 'Ab', 'Fm', 'G'],
    melody: 'C5 . Eb5 . G5 . C6 . Bb5 Ab5 G5 . Eb5 . C5 . D5 . F5 . Bb5 . D6 . B5 . G5 . D5 . G5 . ' +
      'C6 . Eb6 . D6 C6 Bb5 . Ab5 . G5 . Eb5 . C5 . F5 . Ab5 . C6 . Bb5 . G5 . B5 . D6 . G6 . ',
  },
  victory: {
    bpm: 140, lead: 'square', bass: 'oom', drums: 'light', loop: false,
    chords: ['C', 'F', 'G', 'C'],
    melody: 'C5 E5 G5 C6 - - G5 - A5 - C6 - F6 - - - G5 - B5 - D6 - F6 - E6 - - - - - . . ',
  },
  ending: {
    bpm: 88, lead: 'triangle', bass: 'arp', drums: 'light', pad: true, arp: true,
    chords: ['C', 'G', 'Am', 'Em', 'F', 'C', 'Dm', 'G', 'C', 'G', 'Am', 'Em', 'F', 'G', 'C', 'C'],
    melody: 'E5 - - G5 C6 - - - B5 - - D6 G5 - - - C6 - B5 - A5 - E5 - G5 - - - - - . . ' +
      'A5 - G5 - F5 - C5 - E5 - D5 - C5 - - - F5 - E5 - D5 - A4 - B4 - - - - - . . ' +
      'E5 - - G5 C6 - - - D6 - - E6 D6 - - - C6 - D6 - E6 - A5 - B5 - - - - - . . ' +
      'A5 - C6 - F6 - E6 - D6 - - - B5 - - - C6 - - - - - - - - - - - . . . . ',
  },
  lobby: {
    bpm: 118, lead: 'square', bass: 'oom', drums: 'swing', arp: false,
    chords: ['F', 'Dm', 'Gm', 'C', 'F', 'Dm', 'Gm', 'C'],
    melody: 'C5 . F5 . A5 - G5 F5 D5 . F5 . A5 - . . Bb4 . D5 . G5 - F5 E5 C5 . E5 . G5 - . . ' +
      'C5 . F5 . A5 - C6 A5 D6 . C6 . A5 - . . G5 . A5 . Bb5 - A5 G5 E5 . G5 . F5 - . . ',
  },
};
