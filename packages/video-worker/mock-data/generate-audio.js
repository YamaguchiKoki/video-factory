/**
 * Generate a minimal valid WAV file for testing
 * This creates a 120-second silent WAV file at 44.1kHz, 16-bit, mono
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SAMPLE_RATE = 44100;
const DURATION_SECONDS = 120;
const BITS_PER_SAMPLE = 16;
const NUM_CHANNELS = 1;

const numSamples = SAMPLE_RATE * DURATION_SECONDS;
const dataSize = numSamples * NUM_CHANNELS * (BITS_PER_SAMPLE / 8);
const fileSize = 44 + dataSize;

// Create WAV header
const header = Buffer.alloc(44);

// "RIFF" chunk descriptor
header.write('RIFF', 0);
header.writeUInt32LE(fileSize - 8, 4); // File size - 8
header.write('WAVE', 8);

// "fmt " sub-chunk
header.write('fmt ', 12);
header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
header.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
header.writeUInt16LE(NUM_CHANNELS, 22); // NumChannels
header.writeUInt32LE(SAMPLE_RATE, 24); // SampleRate
header.writeUInt32LE(SAMPLE_RATE * NUM_CHANNELS * (BITS_PER_SAMPLE / 8), 28); // ByteRate
header.writeUInt16LE(NUM_CHANNELS * (BITS_PER_SAMPLE / 8), 32); // BlockAlign
header.writeUInt16LE(BITS_PER_SAMPLE, 34); // BitsPerSample

// "data" sub-chunk
header.write('data', 36);
header.writeUInt32LE(dataSize, 40); // Subchunk2Size

// Create silent audio data (all zeros)
const audioData = Buffer.alloc(dataSize);

// Combine header and data
const wavFile = Buffer.concat([header, audioData]);

// Write to file
const outputPath = join(__dirname, 'audio.wav');
writeFileSync(outputPath, wavFile);

console.log(`Generated WAV file: ${outputPath}`);
console.log(`Duration: ${DURATION_SECONDS}s, Sample Rate: ${SAMPLE_RATE}Hz, Channels: ${NUM_CHANNELS}`);
console.log(`File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
