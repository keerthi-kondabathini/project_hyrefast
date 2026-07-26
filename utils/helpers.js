// utils/helpers.js
const { faker } = require('@faker-js/faker');

// ─── Environment ───────────────────────────────────────────────────────────────
function getEnv(key, fallback = '') {
  return process.env[key] || fallback;
}

// ─── Date / Time ───────────────────────────────────────────────────────────────
/**
 * Returns a future date string in YYYY-MM-DD format.
 * @param {number} offsetDays - Number of days from today
 */
function futureDateString(offsetDays = 30) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

/**
 * Returns 'morning' | 'afternoon' | 'evening' based on current local hour.
 */
function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

// ─── Faker helpers ─────────────────────────────────────────────────────────────
/**
 * Generates a random Indian city for location testing.
 */
function randomIndianCity() {
  const cities = [
    { query: 'banglore',  option: 'Makali Karnataka, India' },
    { query: 'mumbai',    option: 'Mumbai Maharashtra, India' },
    { query: 'hyderabad', option: 'Hyderabad Telangana, India' },
    { query: 'chennai',   option: 'Chennai Tamil Nadu, India' },
    { query: 'pune',      option: 'Pune Maharashtra, India' },
  ];
  return cities[Math.floor(Math.random() * cities.length)];
}

/**
 * Generates a unique job title to avoid clashes in test runs.
 */
function uniqueJobTitle(base = 'Developer') {
  return `${base} ${faker.string.alphanumeric(4).toUpperCase()}`;
}

// ─── Counter assertion helper ──────────────────────────────────────────────────
/**
 * Builds the expected dashboard counter string, e.g. "Published Jobs44"
 */
function publishedJobsString(count) {
  return `Published Jobs${count}`;
}

module.exports = {
  generateYopMailUser,
  getEnv,
  futureDateString,
  getTimeOfDay,
  randomIndianCity,
  uniqueJobTitle,
  publishedJobsString,
};

// ─── YopMail helpers ───────────────────────────────────────────────────────────
/**
 * Generates a unique YopMail address for every test run.
 * YopMail requires no signup — any username is a valid inbox instantly.
 *
 * Returns: { email: 'hyrefast_k3xp92mq@yopmail.com', yopUsername: 'hyrefast_k3xp92mq' }
 */
function generateYopMailUser() {
  const username = `hyrefast_${faker.string.alphanumeric(8).toLowerCase()}`;
  return {
    email:       `${username}@yopmail.com`,
    yopUsername: username,
  };
}