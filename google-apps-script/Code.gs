/**
 * ZiNa CMS spreadsheet and Drive bootstrap.
 * Run setupZinaCms() from an Apps Script project bound to the ZiNa CMS sheet.
 */

const ZINA_CMS = Object.freeze({
  timezone: 'Europe/Vienna',
  sheets: Object.freeze({
    Articles: {
      headers: ['id', 'title', 'content', 'title_en', 'content_en', 'title_de', 'content_de', 'category_id', 'status', 'created_at', 'updated_at'],
      widths: [190, 220, 420, 220, 420, 220, 420, 190, 110, 165, 165],
      wrap: ['title', 'content', 'title_en', 'content_en', 'title_de', 'content_de'],
      timestamps: ['created_at', 'updated_at'],
      status: ['status'],
      filter: true
    },
    ArticleCategories: {
      headers: ['id', 'slug', 'name_ro', 'name_en', 'name_de', 'created_at', 'updated_at'],
      widths: [190, 160, 200, 200, 200, 165, 165],
      wrap: ['name_ro', 'name_en', 'name_de'],
      timestamps: ['created_at', 'updated_at'],
      filter: true
    },
    Events: {
      headers: ['id', 'title', 'description', 'title_en', 'description_en', 'title_de', 'description_de', 'start_date', 'end_date', 'location', 'registration_url', 'status', 'created_at', 'updated_at'],
      widths: [190, 220, 360, 220, 360, 220, 360, 165, 165, 220, 280, 110, 165, 165],
      wrap: ['title', 'description', 'title_en', 'description_en', 'title_de', 'description_de', 'location', 'registration_url'],
      dates: ['start_date', 'end_date'],
      timestamps: ['created_at', 'updated_at'],
      status: ['status'],
      filter: true
    },
    Admins: {
      headers: ['email', 'google_sub', 'display_name', 'active', 'created_at', 'updated_at'],
      widths: [260, 240, 220, 90, 165, 165],
      wrap: ['display_name'],
      timestamps: ['created_at', 'updated_at'],
      booleans: ['active'],
      filter: true
    },
    TeamMembers: {
      headers: ['id', 'name', 'role_en', 'role_ro', 'role_de', 'bio_en', 'bio_ro', 'bio_de', 'image_url', 'drive_file_id', 'sort_order', 'created_at', 'updated_at'],
      widths: [190, 220, 220, 220, 220, 360, 360, 360, 280, 190, 100, 165, 165],
      wrap: ['name', 'role_en', 'role_ro', 'role_de', 'bio_en', 'bio_ro', 'bio_de', 'image_url'],
      timestamps: ['created_at', 'updated_at'],
      filter: true
    },
    HomepageContent: {
      headers: ['id', 'content', 'hero_image_url', 'hero_drive_file_id', 'hero_image_position_x', 'hero_image_position_y', 'updated_at', 'updated_by'],
      widths: [120, 520, 280, 190, 155, 155, 165, 220],
      wrap: ['content', 'hero_image_url'],
      timestamps: ['updated_at'],
      filter: false
    },
    Media: {
      headers: ['id', 'entity_type', 'entity_id', 'usage', 'repository_path', 'github_blob_sha', 'filename', 'stored_filename', 'mime_type', 'file_size', 'public_url', 'alt_text_ro', 'alt_text_en', 'alt_text_de', 'status', 'created_at', 'updated_at'],
      widths: [190, 140, 190, 160, 300, 320, 240, 240, 150, 110, 300, 240, 240, 240, 110, 165, 165],
      wrap: ['repository_path', 'filename', 'stored_filename', 'public_url', 'alt_text_ro', 'alt_text_en', 'alt_text_de'],
      timestamps: ['created_at', 'updated_at'],
      filter: true
    },
    Settings: {
      headers: ['key', 'value', 'description', 'updated_at'],
      widths: [230, 260, 440, 165],
      wrap: ['value', 'description'],
      timestamps: ['updated_at'],
      filter: true
    },
    AuditLog: {
      headers: ['timestamp', 'action', 'google_sub', 'record_type', 'record_id', 'outcome', 'error_code'],
      widths: [165, 220, 240, 150, 190, 120, 200],
      timestamps: ['timestamp'],
      filter: true
    },
    Idempotency: {
      headers: ['id', 'request_hash', 'action', 'record_type', 'target_id', 'result_id', 'state', 'created_at', 'updated_at'],
      widths: [320, 320, 220, 150, 190, 190, 120, 165, 165],
      timestamps: ['created_at', 'updated_at'],
      filter: true
    }
  })
});

function setupZinaCms() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error('No active spreadsheet. Bind this Apps Script project to the ZiNa CMS spreadsheet and try again.');
  }

  spreadsheet.setSpreadsheetTimeZone(ZINA_CMS.timezone);
  const configuredSheets = {};
  Object.keys(ZINA_CMS.sheets).forEach(function (sheetName) {
    configuredSheets[sheetName] = ensureWorksheet_(spreadsheet, sheetName, ZINA_CMS.sheets[sheetName]);
  });

  SpreadsheetApp.flush();
  Logger.log('ZiNa CMS setup complete. Worksheets are ready.');
  return { spreadsheetId: spreadsheet.getId() };
}

function ensureWorksheet_(spreadsheet, sheetName, config) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) sheet = spreadsheet.insertSheet(sheetName);

  ensureHeaders_(sheet, config.headers);
  const headerMap = getHeaderMap_(sheet);
  sheet.setFrozenRows(1);

  const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  headerRange
    .setBackground('#1f4e78')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  config.headers.forEach(function (header, index) {
    const column = headerMap[header];
    sheet.setColumnWidth(column, config.widths[index] || 160);
    if ((config.wrap || []).indexOf(header) !== -1 && sheet.getMaxRows() > 1) {
      sheet.getRange(2, column, sheet.getMaxRows() - 1, 1).setWrap(true).setVerticalAlignment('top');
    }
  });

  applyColumnFormatting_(sheet, config, headerMap);
  if (config.filter && !sheet.getFilter()) {
    sheet.getRange(1, 1, Math.max(1, sheet.getLastRow()), sheet.getLastColumn()).createFilter();
  }
  return sheet;
}

function ensureHeaders_(sheet, expectedHeaders) {
  const lastColumn = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();
  if (lastColumn === 0 && lastRow === 0) {
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    return;
  }

  const existing = lastColumn > 0
    ? sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(function (value) { return value.trim(); })
    : [];
  if (lastRow > 0 && existing.every(function (value) { return value === ''; })) {
    throw new Error('Worksheet "' + sheet.getName() + '" contains rows but has no headers. Resolve it manually; setup stopped without overwriting data.');
  }

  const exact = {};
  const normalized = {};
  existing.forEach(function (header, index) {
    if (!header) {
      throw new Error('Worksheet "' + sheet.getName() + '" has a blank header in column ' + (index + 1) + '. Resolve it manually.');
    }
    const key = header.toLowerCase();
    if (exact[header] || normalized[key]) {
      throw new Error('Worksheet "' + sheet.getName() + '" has a duplicate or conflicting header: "' + header + '".');
    }
    exact[header] = true;
    normalized[key] = header;
  });

  const missing = [];
  expectedHeaders.forEach(function (header) {
    const normalizedMatch = normalized[header.toLowerCase()];
    if (normalizedMatch && normalizedMatch !== header) {
      throw new Error('Worksheet "' + sheet.getName() + '" has conflicting header "' + normalizedMatch + '"; expected exact header "' + header + '".');
    }
    if (!exact[header]) missing.push(header);
  });
  if (missing.length) {
    sheet.getRange(1, lastColumn + 1, 1, missing.length).setValues([missing]);
  }
}

function getHeaderMap_(sheet) {
  const map = {};
  sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].forEach(function (header, index) {
    map[header.trim()] = index + 1;
  });
  return map;
}

function applyColumnFormatting_(sheet, config, headerMap) {
  const rows = Math.max(1, sheet.getMaxRows() - 1);
  config.headers.forEach(function (header) {
    const range = sheet.getRange(2, headerMap[header], rows, 1);
    if ((config.timestamps || []).indexOf(header) !== -1) range.setNumberFormat('yyyy-mm-dd hh:mm:ss');
    if ((config.dates || []).indexOf(header) !== -1) range.setNumberFormat('yyyy-mm-dd hh:mm');
    if ((config.status || []).indexOf(header) !== -1) {
      range.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['draft', 'published'], true).setAllowInvalid(false).build());
    }
    if ((config.booleans || []).indexOf(header) !== -1) {
      range.setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().setAllowInvalid(false).build());
    }
  });
}
