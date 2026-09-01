// tests/report-templates/reportTemplates.spec.js
const { test, expect }        = require('../../utils/authFixture');
const { ReportTemplatePage }  = require('../../pages/ReportTemplatePage');
const { faker }               = require('@faker-js/faker');
const td = require('../../data/newFeaturesTestData.json');

const RT = td.reportTemplate;

test.describe('TC_RT_001 — Create Report Template', () => {
  test('Create template with multiple columns → verify created toast', async ({ page, loggedInPage }) => {
    const rtPage = new ReportTemplatePage(page);
    const templateName = `tmpl_${faker.string.alphanumeric(5).toLowerCase()}`;

    await rtPage.navigateToReportTemplatesTab(RT.companySearchQuery);
    await rtPage.createTemplate({
      name:       templateName,
      setDefault: RT.template.setDefault,
      columns:    RT.template.columns,
    });
    test.info().annotations.push({ type: 'Template Name', description: templateName });
  });
});

test.describe('TC_RT_002 — Edit Report Template', () => {
  test('Edit template (add column) → verify updated toast', async ({ page, loggedInPage }) => {
    const rtPage = new ReportTemplatePage(page);
    const templateName = `tmpl_${faker.string.alphanumeric(5).toLowerCase()}`;

    await rtPage.navigateToReportTemplatesTab(RT.companySearchQuery);
    await rtPage.createTemplate({ name: templateName, columns: RT.template.columns });
    await rtPage.editTemplate({ columns: RT.editColumns });
  });
});

test.describe('TC_RT_003 — Delete Report Template', () => {
  test('Open delete option → Delete Template button visible', async ({ page, loggedInPage }) => {
    const rtPage = new ReportTemplatePage(page);
    const templateName = `tmpl_${faker.string.alphanumeric(5).toLowerCase()}`;

    await rtPage.navigateToReportTemplatesTab(RT.companySearchQuery);
    await rtPage.createTemplate({ name: templateName, columns: RT.template.columns });
    await rtPage.deleteTemplate();
    await expect(page.getByRole('button', { name: 'Delete Template' })).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('TC_RT_004 — Use Template in Reports & Trackers', () => {
  test('Select template in Reports & Trackers after creation', async ({ page, loggedInPage }) => {
    const rtPage = new ReportTemplatePage(page);
    const templateName = `tmpl_${faker.string.alphanumeric(5).toLowerCase()}`;
    const rConfig = { ...RT.reportsAndTrackers, templateOptionText: `✨ ${templateName}` };

    await rtPage.navigateToReportTemplatesTab(RT.companySearchQuery);
    await rtPage.createTemplate({ name: templateName, setDefault: true, columns: RT.template.columns });
    await rtPage.openInReportsAndTrackers(rConfig);
  });
});