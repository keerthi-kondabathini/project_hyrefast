// utils/mailTmClient.js

const BASE_URL = 'https://api.mail.tm';

class MailTmClient {
  constructor() {
    this.baseUrl = BASE_URL;
    this.address = null;
    this.password = null;
    this.token = null;
    this.accountId = null;
  }

  async request(path, options = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(this.token
          ? { Authorization: `Bearer ${this.token}` }
          : {}),
        ...(options.headers || {}),
      },
    });

    const text = await response.text();

    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      throw new Error(
        `Mail.tm API error ${response.status}: ${JSON.stringify(data)}`
      );
    }

    return data;
  }

  async getDomain() {
    const data = await this.request('/domains?page=1');

    const domain = data?.['hydra:member']?.find(
      d => d.isActive !== false
    );

    if (!domain) {
      throw new Error('Mail.tm: No active email domain available');
    }

    return domain.domain;
  }

  async createAccount(prefix = 'hyrefast') {
    const domain = await this.getDomain();

    const randomPart =
      `${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
        .toLowerCase();

    const username = `${prefix}_${randomPart}`;

    const password =
      `Test@${Math.random().toString(36).substring(2, 10)}!`;

    const address = `${username}@${domain}`;

    const account = await this.request('/accounts', {
      method: 'POST',
      body: JSON.stringify({
        address,
        password,
      }),
    });

    this.address = address;
    this.password = password;
    this.accountId = account.id;

    const tokenResponse = await this.request('/token', {
      method: 'POST',
      body: JSON.stringify({
        address,
        password,
      }),
    });

    this.token = tokenResponse.token;

    return {
      email: address,
      mailTmAddress: address,
      mailTmPassword: password,
      mailTmToken: this.token,
      mailTmAccountId: this.accountId,
      provider: 'mailtm',
    };
  }

  async getMessages() {
    const data = await this.request('/messages?page=1');
    return data?.['hydra:member'] || [];
  }

  async getMessage(messageId) {
    return this.request(`/messages/${messageId}`);
  }

  async waitForMessage({
    subject,
    timeoutMs = 60000,
    pollIntervalMs = 3000,
  } = {}) {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const messages = await this.getMessages();

      const matchingMessage = messages.find(message => {
        if (!subject) return true;

        return message.subject
          ?.toLowerCase()
          .includes(subject.toLowerCase());
      });

      if (matchingMessage) {
        return this.getMessage(matchingMessage.id);
      }

      await new Promise(resolve =>
        setTimeout(resolve, pollIntervalMs)
      );
    }

    throw new Error(
      `Mail.tm: Email not received within ${timeoutMs}ms` +
      (subject ? `: "${subject}"` : '')
    );
  }

  async waitForMessageByText(text, options = {}) {
    const start = Date.now();
    const timeoutMs = options.timeoutMs || 60000;
    const pollIntervalMs = options.pollIntervalMs || 3000;

    while (Date.now() - start < timeoutMs) {
      const messages = await this.getMessages();

      for (const message of messages) {
        const fullMessage = await this.getMessage(message.id);

        const body = [
          fullMessage.text || '',
          ...(fullMessage.html || []),
        ].join('\n');

        if (
          body.toLowerCase().includes(text.toLowerCase())
        ) {
          return fullMessage;
        }
      }

      await new Promise(resolve =>
        setTimeout(resolve, pollIntervalMs)
      );
    }

    throw new Error(
      `Mail.tm: Email containing "${text}" was not received`
    );
  }

  extractLink(message, linkText) {
    const html = Array.isArray(message.html)
      ? message.html.join('\n')
      : message.html || '';

    if (linkText) {
      const escapedText = linkText.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&'
      );

      const textRegex = new RegExp(
        `<a[^>]+href=["']([^"']+)["'][^>]*>[^<]*${escapedText}[^<]*</a>`,
        'i'
      );

      const textMatch = html.match(textRegex);

      if (textMatch?.[1]) {
        return textMatch[1];
      }
    }

    const hrefMatch = html.match(
      /<a[^>]+href=["']([^"']+)["']/i
    );

    return hrefMatch?.[1] || null;
  }

  async waitForLink({
    subject,
    linkText,
    timeoutMs = 60000,
  } = {}) {
    const message = await this.waitForMessage({
      subject,
      timeoutMs,
    });

    const link = this.extractLink(message, linkText);

    if (!link) {
      throw new Error(
        `Mail.tm: Could not find link "${linkText}" in email`
      );
    }

    return {
      message,
      link,
    };
  }
}

module.exports = { MailTmClient };