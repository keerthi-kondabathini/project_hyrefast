// utils/emailProvider.js

const { faker } = require('@faker-js/faker');
const { MailTmClient } = require('./mailTmClient');

const YOPMAIL_URL = 'https://yopmail.com/';

let providerCache = null;

/**
 * Checks whether YopMail is reachable.
 *
 * We deliberately use a short timeout so a YopMail outage
 * does not slow down the entire test suite.
 */
async function isYopMailAvailable(timeoutMs = 5000) {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs
  );

  try {
    const response = await fetch(YOPMAIL_URL, {
      method: 'GET',
      signal: controller.signal,
    });

    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Determines the email provider once per test process.
 *
 * YopMail is primary.
 * Mail.tm is fallback.
 */
async function getEmailProvider() {
  if (providerCache) {
    return providerCache;
  }

  const forcedProvider =
    process.env.EMAIL_PROVIDER?.toLowerCase();

  if (forcedProvider === 'mailtm') {
    providerCache = 'mailtm';
    return providerCache;
  }

  if (forcedProvider === 'yopmail') {
    providerCache = 'yopmail';
    return providerCache;
  }

  const yopMailAvailable = await isYopMailAvailable();

  providerCache = yopMailAvailable
    ? 'yopmail'
    : 'mailtm';

  console.log(
    `\n[EMAIL PROVIDER] Using: ${providerCache}\n`
  );

  return providerCache;
}

/**
 * Generates an email address using the available provider.
 *
 * IMPORTANT:
 * This function is async because Mail.tm requires account creation
 * before the email address can be returned.
 */
async function generateTestEmail(prefix = 'hyrefast') {
  const provider = await getEmailProvider();

  if (provider === 'yopmail') {
    const username =
      `${prefix}_${faker.string.alphanumeric(8).toLowerCase()}`;

    return {
      provider: 'yopmail',
      email: `${username}@yopmail.com`,
      yopUsername: username,
      username,
    };
  }

  const mailTm = new MailTmClient();

  const account = await mailTm.createAccount(prefix);

  const username = account.email.split('@')[0];

  return {
    ...account,
    provider: 'mailtm',
    username,

    // Keep this so callers can use one generic object.
    yopUsername: username,

    mailTmClient: mailTm,
  };
}

/**
 * Resets the cached provider.
 *
 * Useful if you want another test/project to perform
 * a fresh provider health check.
 */
function resetEmailProvider() {
  providerCache = null;
}

module.exports = {
  isYopMailAvailable,
  getEmailProvider,
  generateTestEmail,
  resetEmailProvider,
};