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
  rejectUnknownFields_(request, ['action','idToken','id','payload']);
  return { action:stringValue_(request.action,'action',{required:true,max:100}), idToken:stringValue_(request.idToken,'idToken',{required:true,max:10000}), id:request.id, payload:request.payload };
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
  return executeAdminAction_(request, admin);
}

function requestId_(request) { return idValue_(request.id, 'id', true); }
function noArguments_(request) { if (request.id !== undefined || request.payload !== undefined) throw apiError_('UNKNOWN_FIELD','id and payload are not allowed for this action.'); }
function idOnly_(request) { if (request.payload !== undefined) throw apiError_('UNKNOWN_FIELD','payload is not allowed for this action.'); return requestId_(request); }
function payloadOnly_(request) { if (request.id !== undefined) throw apiError_('UNKNOWN_FIELD','id is not allowed for this action.'); return request.payload; }
function idAndPayload_(request) { return { id:requestId_(request), payload:request.payload }; }

function executeAdminAction_(request, admin) {
  const action=request.action;
  if(action==='listAllArticles'){noArguments_(request);return listArticles_(false);}
  if(action==='createArticle')return createArticle_(validateArticle_(payloadOnly_(request),false));
  if(action==='updateArticle'){const a=idAndPayload_(request);return updateArticle_(a.id,validateArticle_(a.payload,true));}
  if(action==='deleteArticle'){const id=idOnly_(request);return withWriteLock_(function(){deleteRecord_('Articles',id);return true;});}
  if(action==='setArticleStatus'){const a=idAndPayload_(request),p=assertObject_(a.payload,'payload');rejectUnknownFields_(p,['status']);return updateArticle_(a.id,{status:statusValue_(p.status)});}
  if(action==='listArticleCategories'){noArguments_(request);return listCategories_();}
  if(action==='createArticleCategory')return createCategory_(validateCategory_(payloadOnly_(request),false));
  if(action==='updateArticleCategory'){const a=idAndPayload_(request);return updateCategory_(a.id,validateCategory_(a.payload,true));}
  if(action==='deleteArticleCategory')return deleteCategory_(idOnly_(request));
  if(action==='listAllEvents'){noArguments_(request);return listEvents_(false);}
  if(action==='createEvent')return createEvent_(validateEvent_(payloadOnly_(request),false));
  if(action==='updateEvent'){const a=idAndPayload_(request);return updateEvent_(a.id,validateEvent_(a.payload,true));}
  if(action==='deleteEvent'){const id=idOnly_(request);return withWriteLock_(function(){deleteRecord_('Events',id);return true;});}
  if(action==='setEventStatus'){const a=idAndPayload_(request),p=assertObject_(a.payload,'payload');rejectUnknownFields_(p,['status']);return updateEvent_(a.id,{status:statusValue_(p.status)});}
  if(action==='listTeamMembers'){noArguments_(request);return listTeam_();}
  if(action==='createTeamMember')return createTeam_(validateTeamMember_(payloadOnly_(request),false));
  if(action==='updateTeamMember'){const a=idAndPayload_(request);return updateTeam_(a.id,validateTeamMember_(a.payload,true));}
  if(action==='deleteTeamMember'){const id=idOnly_(request);return withWriteLock_(function(){deleteRecord_('TeamMembers',id);return true;});}
  if(action==='updateTeamMemberSortOrder'){const a=idAndPayload_(request),p=assertObject_(a.payload,'payload');rejectUnknownFields_(p,['sortOrder']);return updateTeam_(a.id,{sortOrder:numberValue_(p.sortOrder,'sortOrder',-100000,100000)});}
  if(action==='getHomepageContent'){noArguments_(request);return homepageContent_();}
  if(action==='updateHomepageContent')return updateHomepage_(validateHomepage_(payloadOnly_(request)),admin);
  throw apiError_('UNKNOWN_ADMIN_ACTION','Unknown API action.');
}
