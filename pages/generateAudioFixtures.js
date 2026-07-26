/**
 * scripts/generateAudioFixtures.js
 *
 * Generates the three WAV files needed for audio validation tests.
 * Requires: ffmpeg installed on your machine.
 *
 * Run: node scripts/generateAudioFixtures.js
 */
const { execSync } = require('child_process');
const path  = require('path');
const fs    = require('fs');

const OUT_DIR = path.resolve(__dirname, '../fixtures/audio');
fs.mkdirSync(OUT_DIR, { recursive: true });

const files = [
  {
    name: 'normal_audio.wav',
    cmd:  `ffmpeg -y -f lavfi -i "sine=frequency=440:duration=5" "${path.join(OUT_DIR, 'normal_audio.wav')}"`,
    desc: 'Clear 440Hz tone — simulates normal speech level',
  },
  {
    name: 'silent_audio.wav',
    cmd:  `ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=mono -t 5 "${path.join(OUT_DIR, 'silent_audio.wav')}"`,
    desc: 'Complete silence — should block submission',
  },
  {
    name: 'low_audio.wav',
    cmd:  `ffmpeg -y -f lavfi -i "sine=frequency=440:duration=5" -af "volume=0.01" "${path.join(OUT_DIR, 'low_audio.wav')}"`,
    desc: 'Very low volume tone — should trigger low-audio warning',
  },
];

console.log('Generating audio fixtures...\n');
for (const f of files) {
  process.stdout.write(`  ${f.name} — ${f.desc} ... `);
  try {
    execSync(f.cmd, { stdio: 'pipe' });
    console.log('✓');
  } catch (e) {
    console.log('✗  (ffmpeg not found — install ffmpeg and retry)');
  }
}
console.log('\nDone. Files written to fixtures/audio/');