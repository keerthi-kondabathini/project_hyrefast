#!/bin/bash
cd "c:\Users\konda\Downloads\hyrefast-automation_10\hyrefast-automation"
npx playwright test tests/jd/jdCreation.spec.js:135:3 --project=chromium --reporter=dot
