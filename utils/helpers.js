// utils/helpers.js

const { faker } = require('@faker-js/faker');
const {
  generateTestEmail: createTestEmail,
} = require('./emailProvider');

// ─── Environment ───────────────────────────────────────────────────────────────

function getEnv(key, fallback = '') {
  return process.env[key] || fallback;
}

// ─── Date / Time ───────────────────────────────────────────────────────────────

function futureDateString(offsetDays = 30) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

function getTimeOfDay() {
  const hour = new Date().getHours();

  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';

  return 'evening';
}

// ─── Faker helpers ─────────────────────────────────────────────────────────────

function randomIndianCity() {
  const cities = [
    {
      query: 'banglore',
      option: 'Makali Karnataka, India',
    },
    {
      query: 'mumbai',
      option: 'Mumbai Maharashtra, India',
    },
    {
      query: 'hyderabad',
      option: 'Hyderabad Telangana, India',
    },
    {
      query: 'chennai',
      option: 'Chennai Tamil Nadu, India',
    },
    {
      query: 'pune',
      option: 'Pune Maharashtra, India',
    },
  ];

  return cities[
    Math.floor(Math.random() * cities.length)
  ];
}

function uniqueJobTitle(base = 'Developer') {
  return `${base} ${faker.string.alphanumeric(4).toUpperCase()}`;
}

// ─── Counter assertion helper ──────────────────────────────────────────────────

function publishedJobsString(count) {
  return `Published Jobs${count}`;
}

// ─── Email ─────────────────────────────────────────────────────────────────────

async function generateYopMailUser(prefix = 'hyrefast') {
  return createTestEmail(prefix);
}

async function generateTestEmail(prefix = 'hyrefast') {
  return createTestEmail(prefix);
}

module.exports = {
  faker,
  generateYopMailUser,
  generateTestEmail,
  getEnv,
  futureDateString,
  getTimeOfDay,
  randomIndianCity,
  uniqueJobTitle,
  publishedJobsString,
};