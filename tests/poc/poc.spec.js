// tests/poc/poc.spec.js
/**
 * Point of Contact (POC / SPOC) Tests
 *
 *  TC_POC_001  Add POC → verify toast
 *  TC_POC_002  Edit POC → verify updated toast
 *  TC_POC_003  Delete POC → verify deleted toast
 *  TC_POC_004  Assign SPOC to a job via Edit Job Details → verify save
 */

const { test, expect } = require('../../utils/authFixture');
const { POCPage }       = require('../../pages/POCPage');
const { faker }         = require('@faker-js/faker');
const td = require('../../data/newFeaturesTestData.json');

const POC_DATA = td.poc;

function uniqueContact(seed = '') {
  const suffix = faker.string.alphanumeric(5).toLowerCase();
  return {
    name:        `${seed}POC ${suffix}`,
    designation: `Designation ${suffix}`,
    email:       `poc_${suffix}@yopmail.com`,
    mobile:      faker.string.numeric(10)
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  TC_POC_001 — Add a Point of Contact
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_POC_001 — Add Point of Contact', () => {
  test('Navigate to POC tab and add a new contact', async ({ page, loggedInPage }) => {
    const pocPage = new POCPage(page);
    const contact = uniqueContact('TC1');

    await test.step('Navigate to POC tab', async () => {
      await pocPage.navigateToPOCTab(POC_DATA.companySearchQuery);
    });

    await test.step('Add contact and verify toast', async () => {
      await pocPage.addContact(contact);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_POC_002 — Edit a Point of Contact
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_POC_002 — Edit Point of Contact', () => {
  test('Edit existing contact and verify updated toast', async ({ page, loggedInPage }) => {
    const pocPage = new POCPage(page);

    await test.step('Navigate to POC tab', async () => {
      await pocPage.navigateToPOCTab(POC_DATA.companySearchQuery);
    });

    const contact = uniqueContact('TC2');

    await test.step('Add a contact first (prerequisite)', async () => {
      await pocPage.addContact(contact);
    });

    await test.step('Edit the contact', async () => {
      await pocPage.editContact({
        ...POC_DATA.editContact,
        name: `${contact.name} updated`,
        email: `updated_${contact.email}`
      });
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_POC_003 — Delete a Point of Contact
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_POC_003 — Delete Point of Contact', () => {
  test('Delete a contact and verify deleted toast', async ({ page, loggedInPage }) => {
    const pocPage = new POCPage(page);

    await test.step('Navigate to POC tab', async () => {
      await pocPage.navigateToPOCTab(POC_DATA.companySearchQuery);
    });

    const contact = uniqueContact('TC3');

    await test.step('Add a contact first (prerequisite)', async () => {
      await pocPage.addContact(contact);
    });

    await test.step('Delete the contact', async () => {
      await pocPage.deleteContact();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  TC_POC_004 — Assign SPOC to a job via Edit Job Details
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC_POC_004 — Assign SPOC to Job', () => {
  test('Search job → Edit Job Details → assign SPOC → save', async ({ page, loggedInPage }) => {
    const pocPage = new POCPage(page);
    const contact = uniqueContact('TC4');
    const { jobSearchQuery } = POC_DATA.spocAssignment;

    await test.step('Create a fresh POC to assign', async () => {
      await pocPage.navigateToPOCTab(POC_DATA.companySearchQuery);
      await pocPage.addContact(contact);
    });

    await test.step('Navigate to dashboard', async () => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
    });

    await test.step('Assign SPOC to job and verify save', async () => {
      await pocPage.assignSPOCToJob({
        companyName:    POC_DATA.companySearchQuery,
        jobSearchQuery,
        spocSearchQuery: contact.name,
        spocOptionText:  contact.name,
      });
    });
  });
});