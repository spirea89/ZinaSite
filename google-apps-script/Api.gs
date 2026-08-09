const PUBLIC_ACTIONS = Object.freeze(['health','listPublishedArticles','getPublishedArticle','listArticleCategories','listPublishedEvents','getPublishedEvent','listPublishedTeamMembers','getPublishedHomepageContent']);
const ADMIN_ACTIONS = Object.freeze(['listAllArticles','createArticle','updateArticle','deleteArticle','setArticleStatus','listArticleCategories','createArticleCategory','updateArticleCategory','deleteArticleCategory','listAllEvents','createEvent','updateEvent','deleteEvent','setEventStatus','listTeamMembers','createTeamMember','updateTeamMember','deleteTeamMember','updateTeamMemberSortOrder','getHomepageContent','updateHomepageContent']);

function doGet(e) {
  try { return jsonOutput_(successEnvelope_(routePublicAction_(e && e.parameter ? e.parameter : {}))); }
  catch (error) { return jsonOutput_(failureEnvelope_(error)); }
}

function doPost(e) {
  try {
    const request = parsePostRequest_(e);
    return jsonOutput_(successEnvelope_(routeProtectedRequest_(request)));
  } catch (error) { return jsonOutput_(failureEnvelope_(error)); }
}

function jsonOutput_(envelope) { return ContentService.createTextOutput(JSON.stringify(envelope)).setMimeType(ContentService.MimeType.JSON); }

function parsePostRequest_(e) {
  if (!e || !e.postData || typeof e.postData.contents !== 'string') throw apiError_('INVALID_REQUEST', 'A request body is required.');
  if (e.postData.contents.length > 250000) throw apiError_('INVALID_REQUEST', 'Request body is too large.');
  let request;
  try { request = JSON.parse(e.postData.contents); } catch (_) { throw apiError_('INVALID_JSON', 'Request body must be valid JSON.'); }
  assertObject_(request, 'request');
  rejectUnknownFields_(request, ['action','idToken','id','payload','expectedUpdatedAt','idempotencyKey']);
  return { action:stringValue_(request.action,'action',{required:true,max:100}), idToken:googleIdTokenValue_(request.idToken), id:request.id, payload:request.payload, expectedUpdatedAt:request.expectedUpdatedAt, idempotencyKey:request.idempotencyKey };
}

function assertAllowedAction_(action, allowlist, publicRoute) {
  if (allowlist.indexOf(action) === -1) throw apiError_(publicRoute ? 'UNKNOWN_PUBLIC_ACTION' : 'UNKNOWN_ADMIN_ACTION', 'Unknown API action.');
}

function routePublicAction_(parameters) {
  const action = stringValue_(parameters.action, 'action', { required: true, max: 100 });
  assertAllowedAction_(action, PUBLIC_ACTIONS, true);
  rejectUnknownFields_(parameters, action.indexOf('list') === 0 ? ['action','page','limit'] : action.indexOf('getPublished') === 0 && action !== 'getPublishedHomepageContent' ? ['action','id'] : ['action']);
  if (action === 'health') return { status:'ok', version:API_VERSION };
  if (action === 'listPublishedArticles') return paginateRecords_(listArticles_(true), pagination_(parameters));
  if (action === 'getPublishedArticle') return findById_(listArticles_(true), idValue_(parameters.id,'id',true));
  if (action === 'listArticleCategories') return paginateRecords_(listCategories_(), pagination_(parameters));
  if (action === 'listPublishedEvents') return paginateRecords_(listEvents_(true), pagination_(parameters));
  if (action === 'getPublishedEvent') return findById_(listEvents_(true), idValue_(parameters.id,'id',true));
  if (action === 'listPublishedTeamMembers') return paginateRecords_(listTeam_(), pagination_(parameters));
  if (action === 'getPublishedHomepageContent') return homepageContent_();
  throw apiError_('UNKNOWN_PUBLIC_ACTION','Unknown API action.');
}

function routeProtectedRequest_(request, dependencies) {
  assertAllowedAction_(request.action, ADMIN_ACTIONS, false);
  const admin = authenticateAdminRequest_(request.idToken, dependencies);
  return executeAdminAction_(request, admin, dependencies);
}

function requestId_(request) { return idValue_(request.id, 'id', true); }
function rejectSafetyMetadata_(request) { if (request.expectedUpdatedAt !== undefined || request.idempotencyKey !== undefined) throw apiError_('UNKNOWN_FIELD','Write-safety metadata is not allowed for this action.'); }
function noArguments_(request) { if (request.id !== undefined || request.payload !== undefined) throw apiError_('UNKNOWN_FIELD','id and payload are not allowed for this action.'); rejectSafetyMetadata_(request); }
function createArguments_(request) { if (request.id !== undefined || request.expectedUpdatedAt !== undefined) throw apiError_('UNKNOWN_FIELD','id and expectedUpdatedAt are not allowed for create actions.'); return {payload:request.payload,idempotencyKey:idempotencyKeyValue_(request.idempotencyKey)}; }
function updateArguments_(request,allowNullExpected) { if (request.idempotencyKey !== undefined) throw apiError_('UNKNOWN_FIELD','idempotencyKey is not allowed for this update action.'); return {id:requestId_(request),payload:request.payload,expectedUpdatedAt:expectedUpdatedAtValue_(request.expectedUpdatedAt,!!allowNullExpected)}; }
function deleteArguments_(request) { if (request.payload !== undefined) throw apiError_('UNKNOWN_FIELD','payload is not allowed for delete actions.'); return {id:requestId_(request),expectedUpdatedAt:expectedUpdatedAtValue_(request.expectedUpdatedAt,false),idempotencyKey:idempotencyKeyValue_(request.idempotencyKey)}; }
function homepageArguments_(request) { if (request.id !== undefined || request.idempotencyKey !== undefined) throw apiError_('UNKNOWN_FIELD','id and idempotencyKey are not allowed for homepage update.'); return {payload:request.payload,expectedUpdatedAt:expectedUpdatedAtValue_(request.expectedUpdatedAt,true)}; }

function executeAdminAction_(request, admin, dependencies) {
  const action=request.action;
  if(action==='listAllArticles'){noArguments_(request);return listArticles_(false);}
  if(action==='createArticle'){const a=createArguments_(request);return createArticle_(validateArticle_(a.payload,false),a.idempotencyKey,admin,dependencies);}
  if(action==='updateArticle'){const a=updateArguments_(request);return updateArticle_(a.id,validateArticle_(a.payload,true),a.expectedUpdatedAt,admin,dependencies);}
  if(action==='deleteArticle'){const a=deleteArguments_(request);return deleteArticle_(a.id,a.expectedUpdatedAt,a.idempotencyKey,admin,dependencies);}
  if(action==='setArticleStatus'){const a=updateArguments_(request),p=assertObject_(a.payload,'payload');rejectUnknownFields_(p,['status']);return updateArticle_(a.id,{status:statusValue_(p.status)},a.expectedUpdatedAt,admin,dependencies,'setArticleStatus');}
  if(action==='listArticleCategories'){noArguments_(request);return listCategories_();}
  if(action==='createArticleCategory'){const a=createArguments_(request);return createCategory_(validateCategory_(a.payload,false),a.idempotencyKey,admin,dependencies);}
  if(action==='updateArticleCategory'){const a=updateArguments_(request);return updateCategory_(a.id,validateCategory_(a.payload,true),a.expectedUpdatedAt,admin,dependencies);}
  if(action==='deleteArticleCategory'){const a=deleteArguments_(request);return deleteCategory_(a.id,a.expectedUpdatedAt,a.idempotencyKey,admin,dependencies);}
  if(action==='listAllEvents'){noArguments_(request);return listEvents_(false);}
  if(action==='createEvent'){const a=createArguments_(request);return createEvent_(validateEvent_(a.payload,false),a.idempotencyKey,admin,dependencies);}
  if(action==='updateEvent'){const a=updateArguments_(request);return updateEvent_(a.id,validateEvent_(a.payload,true),a.expectedUpdatedAt,admin,dependencies);}
  if(action==='deleteEvent'){const a=deleteArguments_(request);return deleteEvent_(a.id,a.expectedUpdatedAt,a.idempotencyKey,admin,dependencies);}
  if(action==='setEventStatus'){const a=updateArguments_(request),p=assertObject_(a.payload,'payload');rejectUnknownFields_(p,['status']);return updateEvent_(a.id,{status:statusValue_(p.status)},a.expectedUpdatedAt,admin,dependencies,'setEventStatus');}
  if(action==='listTeamMembers'){noArguments_(request);return listTeam_();}
  if(action==='createTeamMember'){const a=createArguments_(request);return createTeam_(validateTeamMember_(a.payload,false),a.idempotencyKey,admin,dependencies);}
  if(action==='updateTeamMember'){const a=updateArguments_(request);return updateTeam_(a.id,validateTeamMember_(a.payload,true),a.expectedUpdatedAt,admin,dependencies);}
  if(action==='deleteTeamMember'){const a=deleteArguments_(request);return deleteTeam_(a.id,a.expectedUpdatedAt,a.idempotencyKey,admin,dependencies);}
  if(action==='updateTeamMemberSortOrder'){const a=updateArguments_(request),p=assertObject_(a.payload,'payload');rejectUnknownFields_(p,['sortOrder']);return updateTeam_(a.id,{sortOrder:numberValue_(p.sortOrder,'sortOrder',-100000,100000)},a.expectedUpdatedAt,admin,dependencies,'updateTeamMemberSortOrder');}
  if(action==='getHomepageContent'){noArguments_(request);return homepageContent_();}
  if(action==='updateHomepageContent'){const a=homepageArguments_(request);return updateHomepage_(validateHomepage_(a.payload),a.expectedUpdatedAt,admin,dependencies);}
  throw apiError_('UNKNOWN_ADMIN_ACTION','Unknown API action.');
}
