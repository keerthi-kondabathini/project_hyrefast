// utils/audioFixture.js
const { test: base } = require('@playwright/test');
const path = require('path');

/**
 * Audio scenarios for interview testing.
 * Each scenario maps to a WAV file in fixtures/audio/ and a Playwright
 * browser project that injects it via --use-file-for-fake-audio-capture.
 *
 * Files needed in fixtures/audio/:
 *   normal_audio.wav   — clear speech, passes audio validation
 *   low_audio.wav      — very quiet, triggers low-audio warning
 *   silent_audio.wav   — complete silence, blocks submission
 *
 * Generate them with ffmpeg:
 *   # Normal (440Hz tone, simulates speech level)
 *   ffmpeg -f lavfi -i "sine=frequency=440:duration=5" fixtures/audio/normal_audio.wav
 *   # Silent
 *   ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 5 fixtures/audio/silent_audio.wav
 *   # Low volume (sine at 0.01 amplitude)
 *   ffmpeg -f lavfi -i "sine=frequency=440:duration=5" -af "volume=0.01" fixtures/audio/low_audio.wav
 */

const AUDIO_FILES = {
  normal: path.resolve(__dirname, '../fixtures/audio/normal_audio.wav'),
  low:    path.resolve(__dirname, '../fixtures/audio/low_audio.wav'),
  silent: path.resolve(__dirname, '../fixtures/audio/silent_audio.wav'),
};

/**
 * Extended fixture that provides `audioScenario` to interview tests.
 * Use with the chromium-interview project which already sets fake media flags.
 */
const test = base.extend({
  audioScenario: [
    {
      type:     'normal',
      filePath: AUDIO_FILES.normal,
      label:    'Normal Audio',
      shouldBlock: false,
    },
    { option: true },
  ],
});

module.exports = { test, AUDIO_FILES };