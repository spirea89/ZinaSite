const SHEET_FIELDS = Object.freeze({
  Articles: ['id', 'title', 'content', 'title_en', 'content_en', 'title_de', 'content_de', 'category_id', 'status', 'created_at', 'updated_at'],
  ArticleCategories: ['id', 'slug', 'name_ro', 'name_en', 'name_de', 'created_at', 'updated_at'],
  Events: ['id', 'title', 'description', 'title_en', 'description_en', 'title_de', 'description_de', 'start_date', 'end_date', 'location', 'registration_url', 'status', 'created_at', 'updated_at'],
  Admins: ['email', 'google_sub', 'display_name', 'active', 'created_at', 'updated_at'],
  TeamMembers: ['id', 'name', 'role_en', 'role_ro', 'role_de', 'bio_en', 'bio_ro', 'bio_de', 'image_url', 'drive_file_id', 'sort_order', 'created_at', 'updated_at'],
  HomepageContent: ['id', 'content', 'hero_image_url', 'hero_drive_file_id', 'hero_image_position_x', 'hero_image_position_y', 'updated_at', 'updated_by'],
  AuditLog: ['timestamp', 'action', 'google_sub', 'record_type', 'record_id', 'outcome', 'error_code'],
  Idempotency: ['id', 'request_hash', 'action', 'record_type', 'target_id', 'result_id', 'state', 'created_at', 'updated_at']
});

function sheetContext_(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw apiError_('INTERNAL_CONFIGURATION', 'Required worksheet is missing.');
  const lastColumn = sheet.getLastColumn();
  if (!lastColumn) throw apiError_('INTERNAL_CONFIGURATION', 'Required worksheet headers are missing.');
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(function (v) { return v.trim(); });
  const map = {};
  headers.forEach(function (header, index) {
    if (!header || map[header] !== undefined) throw apiError_('INTERNAL_CONFIGURATION', 'Worksheet headers are invalid.');
    map[header] = index;
  });
  SHEET_FIELDS[sheetName].forEach(function (header) {
    if (map[header] === undefined) throw apiError_('INTERNAL_CONFIGURATION', 'A required worksheet header is missing.');
  });
  return { sheet: sheet, headers: headers, map: map };
}

function readRows_(sheetName) {
  const context = sheetContext_(sheetName);
  if (context.sheet.getLastRow() < 2) return [];
  return context.sheet.getRange(2, 1, context.sheet.getLastRow() - 1, context.headers.length).getValues().map(function (values, offset) {
    const row = { _row: offset + 2 };
    context.headers.forEach(function (header, index) { row[header] = values[index]; });
    return row;
  }).filter(function (row) { return context.headers.some(function (header) { return row[header] !== ''; }); });
}

function appendRecord_(sheetName, record, htmlFields) {
  const context = sheetContext_(sheetName);
  const row = context.headers.map(function (header) {
    const value = Object.prototype.hasOwnProperty.call(record, header) ? record[header] : '';
    return safePlainCell_((htmlFields || []).indexOf(header) !== -1 ? String(value || '') : value);
  });
  const target = context.sheet.getRange(context.sheet.getLastRow() + 1, 1, 1, row.length);
  target.setNumberFormat('@');
  target.setValues([row]);
}

function updateRecord_(sheetName, id, changes, htmlFields) {
  const context = sheetContext_(sheetName);
  const matches = readRows_(sheetName).filter(function (row) { return String(row.id) === id; });
  if (!matches.length) throw apiError_('NOT_FOUND', 'Record not found.');
  if (matches.length > 1) throw apiError_('INTERNAL_CONFIGURATION', 'Duplicate record IDs exist.');
  Object.keys(changes).forEach(function (header) {
    if (context.map[header] === undefined) throw apiError_('INTERNAL_CONFIGURATION', 'A required worksheet header is missing.');
    const cell = context.sheet.getRange(matches[0]._row, context.map[header] + 1);
    cell.setNumberFormat('@');
    cell.setValue(safePlainCell_((htmlFields || []).indexOf(header) !== -1 ? String(changes[header] || '') : changes[header]));
  });
}

function deleteRecord_(sheetName, id) {
  const rows = readRows_(sheetName).filter(function (row) { return String(row.id) === id; });
  if (!rows.length) throw apiError_('NOT_FOUND', 'Record not found.');
  if (rows.length > 1) throw apiError_('INTERNAL_CONFIGURATION', 'Duplicate record IDs exist.');
  sheetContext_(sheetName).sheet.deleteRow(rows[0]._row);
}

function newId_() { return Utilities.getUuid(); }
function nowIso_() { return new Date().toISOString(); }

function articleFromRow_(row, categories) {
  const category = categories ? categories.filter(function (item) { return item.id === String(row.category_id || ''); })[0] || null : null;
  return { id: String(row.id), title: String(row.title || ''), content: String(row.content || ''), titleEn: String(row.title_en || ''), contentEn: String(row.content_en || ''), titleDe: String(row.title_de || ''), contentDe: String(row.content_de || ''), categoryId: row.category_id ? String(row.category_id) : null, category: category, status: String(row.status), createdAt: isoString_(row.created_at), updatedAt: isoString_(row.updated_at) };
}
function categoryFromRow_(row) { return { id: String(row.id), slug: String(row.slug), name_ro: String(row.name_ro), name_en: String(row.name_en), name_de: String(row.name_de), created_at: isoString_(row.created_at), updated_at: isoString_(row.updated_at || row.created_at) }; }
function eventFromRow_(row) { return { id: String(row.id), title: String(row.title || ''), description: String(row.description || ''), titleEn: String(row.title_en || ''), descriptionEn: String(row.description_en || ''), titleDe: String(row.title_de || ''), descriptionDe: String(row.description_de || ''), startDate: isoString_(row.start_date), endDate: row.end_date ? isoString_(row.end_date) : '', location: String(row.location || ''), registrationUrl: String(row.registration_url || ''), status: String(row.status), createdAt: isoString_(row.created_at), updatedAt: isoString_(row.updated_at) }; }
function teamFromRow_(row) { return { id: String(row.id), name: String(row.name || ''), roleEn: String(row.role_en || ''), roleRo: String(row.role_ro || ''), roleDe: String(row.role_de || ''), bioEn: String(row.bio_en || ''), bioRo: String(row.bio_ro || ''), bioDe: String(row.bio_de || ''), imageUrl: String(row.image_url || ''), driveFileId: String(row.drive_file_id || ''), sortOrder: Number(row.sort_order) || 0, createdAt: isoString_(row.created_at), updatedAt: isoString_(row.updated_at) }; }
function isoString_(value) { return value instanceof Date ? value.toISOString() : String(value || ''); }

function listCategories_() { return readRows_('ArticleCategories').map(categoryFromRow_).sort(function (a, b) { return a.name_ro.localeCompare(b.name_ro); }); }
function isPublishedRecord_(record) { return record && record.status === 'published'; }
function listArticles_(publishedOnly) { const categories = listCategories_(); return readRows_('Articles').filter(function (r) { return !publishedOnly || isPublishedRecord_(r); }).map(function (r) { return articleFromRow_(r, categories); }).sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id); }); }
function listEvents_(publishedOnly) { return readRows_('Events').filter(function (r) { return !publishedOnly || isPublishedRecord_(r); }).map(eventFromRow_).sort(function (a, b) { return (publishedOnly ? a.startDate.localeCompare(b.startDate) : b.startDate.localeCompare(a.startDate)) || a.id.localeCompare(b.id); }); }
function listTeam_() { return readRows_('TeamMembers').map(teamFromRow_).sort(function (a, b) { return a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id); }); }

function adminFromRows_(rows, email) {
  const matches = rows.filter(function (row) { return String(row.email || '').trim().toLowerCase() === email; });
  if (matches.length !== 1) return null;
  const active = matches[0].active;
  return {
    email: String(matches[0].email || '').trim().toLowerCase(),
    googleSub: String(matches[0].google_sub || '').trim(),
    active: active === true || String(active).toLowerCase() === 'true'
  };
}

function findAdminByEmail_(email) {
  return adminFromRows_(readRows_('Admins'), email);
}

function paginateRecords_(records, pageInfo) { const start = (pageInfo.page - 1) * pageInfo.limit; return { items: records.slice(start, start + pageInfo.limit), total: records.length, page: pageInfo.page, limit: pageInfo.limit }; }
function findById_(records, id) { const item = records.filter(function (record) { return record.id === id; })[0]; if (!item) throw apiError_('NOT_FOUND', 'Record not found.'); return item; }

function homepageContent_() {
  const rows = readRows_('HomepageContent').filter(function (row) { return String(row.id) === 'home'; });
  if (!rows.length) return null;
  if (rows.length > 1) throw apiError_('INTERNAL_CONFIGURATION', 'Duplicate homepage rows exist.');
  let content = {};
  try { content = rows[0].content ? JSON.parse(String(rows[0].content)) : {}; } catch (_) { throw apiError_('INTERNAL_CONFIGURATION', 'Homepage content JSON is invalid.'); }
  return { content: content, heroImageUrl: String(rows[0].hero_image_url || ''), heroDriveFileId: String(rows[0].hero_drive_file_id || ''), heroImagePosition: { x: Number(rows[0].hero_image_position_x) || 0, y: Number(rows[0].hero_image_position_y) || 0 }, updatedAt: isoString_(rows[0].updated_at) };
}

function ensureCategoryExists_(categoryId) { if (categoryId && !listCategories_().some(function(category){return category.id===categoryId;})) throw apiError_('VALIDATION_ERROR','categoryId does not reference an existing category.'); }
function nextUpdatedAt_(row, runtime, fallbackField) { const now=runtime.now(),previous=storedUpdatedAt_(row,fallbackField); return previous&&now<=previous?new Date(new Date(previous).getTime()+1).toISOString():now; }
function mutationSpec_(action,recordType,recordId,admin,payload,idempotencyKey){return {action:action,recordType:recordType,recordId:recordId||'',adminSub:admin.sub,payload:payload||null,idempotencyKey:idempotencyKey||''};}
function existingById_(records,id){return records.filter(function(record){return record.id===id;})[0]||null;}

function createArticle_(value,idempotencyKey,admin,dependencies){const proposedId=newId_(),spec=mutationSpec_('createArticle','Article','',admin,value,idempotencyKey);return runWriteMutation_(spec,function(runtime){ensureCategoryExists_(value.categoryId);const state=prepareIdempotency_(spec,runtime,proposedId),id=state.resultId||proposedId;spec.recordId=id;const existing=existingById_(listArticles_(false),id);if(state.state==='completed'&&!existing)throw apiError_('IDEMPOTENCY_REPLAY_UNAVAILABLE','The original idempotent result is no longer available.');if(existing){completeIdempotency_(state,runtime);return {value:existing,replayed:true};}const now=runtime.now();appendRecord_('Articles',{id:id,title:value.title,content:value.content,title_en:value.titleEn,content_en:value.contentEn,title_de:value.titleDe,content_de:value.contentDe,category_id:value.categoryId,status:value.status,created_at:now,updated_at:now},['content','content_en','content_de']);completeIdempotency_(state,runtime);return {value:findById_(listArticles_(false),id),replayed:state.replay};},dependencies);}
function updateArticle_(id,value,expectedUpdatedAt,admin,dependencies,action){const actionName=action||'updateArticle',spec=mutationSpec_(actionName,'Article',id,admin,value);return runWriteMutation_(spec,function(runtime){const row=recordRowById_('Articles',id,false);assertExpectedUpdatedAt_(row,expectedUpdatedAt);if(Object.prototype.hasOwnProperty.call(value,'categoryId'))ensureCategoryExists_(value.categoryId);const map={title:'title',content:'content',titleEn:'title_en',contentEn:'content_en',titleDe:'title_de',contentDe:'content_de',categoryId:'category_id',status:'status'},changes={updated_at:nextUpdatedAt_(row,runtime)};Object.keys(value).forEach(function(k){changes[map[k]]=value[k];});updateRecord_('Articles',id,changes,['content','content_en','content_de']);return findById_(listArticles_(false),id);},dependencies);}
function createCategory_(value,idempotencyKey,admin,dependencies){const proposedId=newId_(),spec=mutationSpec_('createArticleCategory','ArticleCategory','',admin,value,idempotencyKey);return runWriteMutation_(spec,function(runtime){const state=prepareIdempotency_(spec,runtime,proposedId),id=state.resultId||proposedId;spec.recordId=id;const existing=existingById_(listCategories_(),id);if(state.state==='completed'&&!existing)throw apiError_('IDEMPOTENCY_REPLAY_UNAVAILABLE','The original idempotent result is no longer available.');if(existing){completeIdempotency_(state,runtime);return {value:existing,replayed:true};}if(listCategories_().some(function(c){return c.slug===value.slug;}))throw apiError_('VALIDATION_ERROR','Category slug already exists.');const now=runtime.now();appendRecord_('ArticleCategories',{id:id,slug:value.slug,name_ro:value.nameRo,name_en:value.nameEn,name_de:value.nameDe,created_at:now,updated_at:now});completeIdempotency_(state,runtime);return {value:findById_(listCategories_(),id),replayed:state.replay};},dependencies);}
function updateCategory_(id,value,expectedUpdatedAt,admin,dependencies){const spec=mutationSpec_('updateArticleCategory','ArticleCategory',id,admin,value);return runWriteMutation_(spec,function(runtime){const row=recordRowById_('ArticleCategories',id,false);assertExpectedUpdatedAt_(row,expectedUpdatedAt,'created_at');if(value.slug&&listCategories_().some(function(c){return c.slug===value.slug&&c.id!==id;}))throw apiError_('VALIDATION_ERROR','Category slug already exists.');const map={slug:'slug',nameRo:'name_ro',nameEn:'name_en',nameDe:'name_de'},changes={updated_at:nextUpdatedAt_(row,runtime,'created_at')};Object.keys(value).forEach(function(k){changes[map[k]]=value[k];});updateRecord_('ArticleCategories',id,changes);return findById_(listCategories_(),id);},dependencies);}
function createEvent_(value,idempotencyKey,admin,dependencies){const proposedId=newId_(),spec=mutationSpec_('createEvent','Event','',admin,value,idempotencyKey);return runWriteMutation_(spec,function(runtime){const state=prepareIdempotency_(spec,runtime,proposedId),id=state.resultId||proposedId;spec.recordId=id;const existing=existingById_(listEvents_(false),id);if(state.state==='completed'&&!existing)throw apiError_('IDEMPOTENCY_REPLAY_UNAVAILABLE','The original idempotent result is no longer available.');if(existing){completeIdempotency_(state,runtime);return {value:existing,replayed:true};}const now=runtime.now();appendRecord_('Events',{id:id,title:value.title,description:value.description,title_en:value.titleEn,description_en:value.descriptionEn,title_de:value.titleDe,description_de:value.descriptionDe,start_date:value.startDate,end_date:value.endDate,location:value.location,registration_url:value.registrationUrl,status:value.status,created_at:now,updated_at:now},['description','description_en','description_de']);completeIdempotency_(state,runtime);return {value:findById_(listEvents_(false),id),replayed:state.replay};},dependencies);}
function updateEvent_(id,value,expectedUpdatedAt,admin,dependencies,action){const actionName=action||'updateEvent',spec=mutationSpec_(actionName,'Event',id,admin,value);return runWriteMutation_(spec,function(runtime){const row=recordRowById_('Events',id,false);assertExpectedUpdatedAt_(row,expectedUpdatedAt);const map={title:'title',description:'description',titleEn:'title_en',descriptionEn:'description_en',titleDe:'title_de',descriptionDe:'description_de',startDate:'start_date',endDate:'end_date',location:'location',registrationUrl:'registration_url',status:'status'},changes={updated_at:nextUpdatedAt_(row,runtime)};Object.keys(value).forEach(function(k){changes[map[k]]=value[k];});updateRecord_('Events',id,changes,['description','description_en','description_de']);return findById_(listEvents_(false),id);},dependencies);}
function createTeam_(value,idempotencyKey,admin,dependencies){const proposedId=newId_(),spec=mutationSpec_('createTeamMember','TeamMember','',admin,value,idempotencyKey);return runWriteMutation_(spec,function(runtime){const state=prepareIdempotency_(spec,runtime,proposedId),id=state.resultId||proposedId;spec.recordId=id;const existing=existingById_(listTeam_(),id);if(state.state==='completed'&&!existing)throw apiError_('IDEMPOTENCY_REPLAY_UNAVAILABLE','The original idempotent result is no longer available.');if(existing){completeIdempotency_(state,runtime);return {value:existing,replayed:true};}const now=runtime.now();appendRecord_('TeamMembers',{id:id,name:value.name,role_en:value.roleEn,role_ro:value.roleRo,role_de:value.roleDe,bio_en:value.bioEn,bio_ro:value.bioRo,bio_de:value.bioDe,image_url:value.imageUrl,drive_file_id:value.driveFileId,sort_order:value.sortOrder,created_at:now,updated_at:now});completeIdempotency_(state,runtime);return {value:findById_(listTeam_(),id),replayed:state.replay};},dependencies);}
function updateTeam_(id,value,expectedUpdatedAt,admin,dependencies,action){const actionName=action||'updateTeamMember',spec=mutationSpec_(actionName,'TeamMember',id,admin,value);return runWriteMutation_(spec,function(runtime){const row=recordRowById_('TeamMembers',id,false);assertExpectedUpdatedAt_(row,expectedUpdatedAt);const map={name:'name',roleEn:'role_en',roleRo:'role_ro',roleDe:'role_de',bioEn:'bio_en',bioRo:'bio_ro',bioDe:'bio_de',imageUrl:'image_url',driveFileId:'drive_file_id',sortOrder:'sort_order'},changes={updated_at:nextUpdatedAt_(row,runtime)};Object.keys(value).forEach(function(k){changes[map[k]]=value[k];});updateRecord_('TeamMembers',id,changes);return findById_(listTeam_(),id);},dependencies);}

function deleteWithSafety_(sheetName,recordType,action,id,expectedUpdatedAt,idempotencyKey,admin,dependencies,beforeDelete,fallbackField){const spec=mutationSpec_(action,recordType,id,admin,{expectedUpdatedAt:expectedUpdatedAt},idempotencyKey);return runWriteMutation_(spec,function(runtime){const state=prepareIdempotency_(spec,runtime,''),row=recordRowById_(sheetName,id,true);if(state.state==='completed')return {value:true,replayed:true};if(!row){if(state.replay){completeIdempotency_(state,runtime);return {value:true,replayed:true};}deleteRecord_('Idempotency',state.id);throw apiError_('NOT_FOUND','Record not found.');}assertExpectedUpdatedAt_(row,expectedUpdatedAt,fallbackField);if(beforeDelete)beforeDelete();deleteRecord_(sheetName,id);completeIdempotency_(state,runtime);return {value:true,replayed:state.replay};},dependencies);}
function deleteArticle_(id,expectedUpdatedAt,idempotencyKey,admin,dependencies){return deleteWithSafety_('Articles','Article','deleteArticle',id,expectedUpdatedAt,idempotencyKey,admin,dependencies);}
function deleteCategory_(id,expectedUpdatedAt,idempotencyKey,admin,dependencies){return deleteWithSafety_('ArticleCategories','ArticleCategory','deleteArticleCategory',id,expectedUpdatedAt,idempotencyKey,admin,dependencies,function(){if(readRows_('Articles').some(function(r){return String(r.category_id)===id;}))throw apiError_('CATEGORY_IN_USE','Category is referenced by an article.');},'created_at');}
function deleteEvent_(id,expectedUpdatedAt,idempotencyKey,admin,dependencies){return deleteWithSafety_('Events','Event','deleteEvent',id,expectedUpdatedAt,idempotencyKey,admin,dependencies);}
function deleteTeam_(id,expectedUpdatedAt,idempotencyKey,admin,dependencies){return deleteWithSafety_('TeamMembers','TeamMember','deleteTeamMember',id,expectedUpdatedAt,idempotencyKey,admin,dependencies);}

function updateHomepage_(value,expectedUpdatedAt,admin,dependencies){const spec=mutationSpec_('updateHomepageContent','HomepageContent','home',admin,value);return runWriteMutation_(spec,function(runtime){const rows=readRows_('HomepageContent').filter(function(r){return String(r.id)==='home';});if(rows.length>1)throw apiError_('INTERNAL_CONFIGURATION','Duplicate homepage rows exist.');const row=rows[0]||null;if(row){assertExpectedUpdatedAt_(row,expectedUpdatedAt);}else if(expectedUpdatedAt!==null){throw apiError_('CONFLICT','Record was modified by another administrator.');}const changes={content:value.content,hero_image_url:value.heroImageUrl,hero_drive_file_id:value.heroDriveFileId,hero_image_position_x:value.heroImagePositionX,hero_image_position_y:value.heroImagePositionY,updated_at:nextUpdatedAt_(row,runtime),updated_by:admin.sub};if(row)updateRecord_('HomepageContent','home',changes,['content']);else appendRecord_('HomepageContent',Object.assign({id:'home'},changes),['content']);return homepageContent_();},dependencies);}
