const MEDIA_MAX_BYTES = 5 * 1024 * 1024;
const MEDIA_TYPES = Object.freeze({
  'image/jpeg': Object.freeze({ extension: 'jpg' }),
  'image/png': Object.freeze({ extension: 'png' }),
  'image/webp': Object.freeze({ extension: 'webp' })
});
const MEDIA_PREFIXES = Object.freeze({ homepage:'media/homepage', team:'media/team', article:'media/articles', event:'media/events' });
const GITHUB_API_VERSION = '2022-11-28';

function validateMediaUpload_(input) {
  const value=assertObject_(input,'payload');
  rejectUnknownFields_(value,['usage','entityType','entityId','originalFilename','declaredMimeType','base64Data','altTextRo','altTextEn','altTextDe']);
  const usage=stringValue_(value.usage,'usage',{required:true,max:30});
  if(!MEDIA_PREFIXES[usage])throw apiError_('INVALID_MEDIA_USAGE','Unsupported media usage.');
  const entityType=stringValue_(value.entityType,'entityType',{max:30});
  if(entityType&&['homepage','team','article','event'].indexOf(entityType)===-1)throw apiError_('INVALID_MEDIA_USAGE','Unsupported media entity type.');
  const entityId=value.entityId?idValue_(value.entityId,'entityId',true):'';
  const originalFilename=plainTextValue_(value.originalFilename,'originalFilename',{required:true,max:255});
  if(/[\\/]/.test(originalFilename)||originalFilename==='.'||originalFilename==='..')throw apiError_('INVALID_FILENAME','Filename is invalid.');
  const declaredMimeType=stringValue_(value.declaredMimeType,'declaredMimeType',{required:true,max:100}).toLowerCase();
  if(!MEDIA_TYPES[declaredMimeType])throw apiError_('UNSUPPORTED_MEDIA_TYPE','Only JPEG, PNG, and WebP images are allowed.');
  const base64Data=stringValue_(value.base64Data,'base64Data',{required:true,max:6991000,preserveWhitespace:true});
  if(!/^[A-Za-z0-9+/]+={0,2}$/.test(base64Data)||base64Data.length%4!==0)throw apiError_('MALFORMED_MEDIA','Image data is malformed.');
  let bytes;try{bytes=Utilities.base64Decode(base64Data);}catch(_){throw apiError_('MALFORMED_MEDIA','Image data is malformed.');}
  if(!bytes.length)throw apiError_('MALFORMED_MEDIA','Image data is empty.');
  if(bytes.length>MEDIA_MAX_BYTES)throw apiError_('MEDIA_TOO_LARGE','Image must not exceed 5 MB.');
  const detected=detectMediaType_(bytes);if(!detected)throw apiError_('MALFORMED_MEDIA','Image signature is invalid.');
  if(detected!==declaredMimeType)throw apiError_('MEDIA_TYPE_MISMATCH','Image type does not match the declared MIME type.');
  const extension=originalFilename.toLowerCase().match(/\.([a-z0-9]+)$/),allowed=detected==='image/jpeg'?['jpg','jpeg']:[MEDIA_TYPES[detected].extension];
  if(!extension||allowed.indexOf(extension[1])===-1)throw apiError_('MEDIA_TYPE_MISMATCH','Filename extension does not match the image type.');
  return {usage:usage,entityType:entityType||usage,entityId:entityId,originalFilename:originalFilename,mimeType:detected,bytes:bytes,base64Data:base64Data,size:bytes.length,altTextRo:plainTextValue_(value.altTextRo,'altTextRo',{max:500}),altTextEn:plainTextValue_(value.altTextEn,'altTextEn',{max:500}),altTextDe:plainTextValue_(value.altTextDe,'altTextDe',{max:500})};
}

function unsignedByte_(value){return value<0?value+256:value;}
function bytesMatch_(bytes,offset,expected){if(bytes.length<offset+expected.length)return false;return expected.every(function(value,index){return unsignedByte_(bytes[offset+index])===value;});}
function detectMediaType_(bytes){
  if(bytesMatch_(bytes,0,[0xff,0xd8,0xff])&&bytesMatch_(bytes,bytes.length-2,[0xff,0xd9]))return'image/jpeg';
  if(bytesMatch_(bytes,0,[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])&&bytesMatch_(bytes,bytes.length-12,[0,0,0,0,0x49,0x45,0x4e,0x44,0xae,0x42,0x60,0x82]))return'image/png';
  if(bytesMatch_(bytes,0,[0x52,0x49,0x46,0x46])&&bytesMatch_(bytes,8,[0x57,0x45,0x42,0x50])&&(bytesMatch_(bytes,12,[0x56,0x50,0x38,0x20])||bytesMatch_(bytes,12,[0x56,0x50,0x38,0x4c])||bytesMatch_(bytes,12,[0x56,0x50,0x38,0x58])))return'image/webp';
  return'';
}

function githubMediaConfig_(dependencies){
  if(dependencies&&dependencies.githubConfig)return dependencies.githubConfig;
  const properties=PropertiesService.getScriptProperties(),config={owner:properties.getProperty('GITHUB_MEDIA_OWNER'),repository:properties.getProperty('GITHUB_MEDIA_REPOSITORY'),branch:properties.getProperty('GITHUB_MEDIA_BRANCH'),token:properties.getProperty('GITHUB_MEDIA_TOKEN'),publicBaseUrl:properties.getProperty('GITHUB_MEDIA_PUBLIC_BASE_URL')};
  if(!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(config.owner||'')||!/^[A-Za-z0-9._-]{1,100}$/.test(config.repository||'')||!/^[A-Za-z0-9._/-]{1,200}$/.test(config.branch||'')||!/^https:\/\/[A-Za-z0-9.-]+(?:\/[A-Za-z0-9._~!$&'()*+,;=:@%-]+)*\/?$/.test(config.publicBaseUrl||'')||!config.token){throw apiError_('INTERNAL_CONFIGURATION','Media publishing is not configured.');}
  config.publicBaseUrl=config.publicBaseUrl.replace(/\/+$/,'');return config;
}

function githubRequest_(config,method,path,body,dependencies){
  const url='https://api.github.com/repos/'+encodeURIComponent(config.owner)+'/'+encodeURIComponent(config.repository)+'/contents/'+path.split('/').map(encodeURIComponent).join('/');
  const fetcher=dependencies&&dependencies.githubFetch?dependencies.githubFetch:UrlFetchApp.fetch;
  let response;try{response=fetcher(url,{method:method,muteHttpExceptions:true,headers:{Authorization:'Bearer '+config.token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':GITHUB_API_VERSION,'User-Agent':'ZiNa-CMS-Media'},contentType:'application/json',payload:body?JSON.stringify(body):undefined});}catch(_){throw apiError_('MEDIA_STORAGE_UNAVAILABLE','Media storage is temporarily unavailable.');}
  const status=response.getResponseCode();let data={};try{data=JSON.parse(response.getContentText()||'{}');}catch(_){}
  if(status<200||status>=300){const code=status===401||status===403?'MEDIA_STORAGE_AUTHORIZATION':status===404?'MEDIA_NOT_FOUND':status===409||status===422?'MEDIA_STORAGE_CONFLICT':'MEDIA_STORAGE_FAILED';throw apiError_(code,'Media storage request failed.');}
  return data;
}

function githubMediaRuntime_(dependencies){
  if(dependencies&&dependencies.githubMedia)return dependencies.githubMedia;
  const config=githubMediaConfig_(dependencies);
  return {
    config:config,
    create:function(path,value){const data=githubRequest_(config,'put',path,{message:'Publish ZiNa media',content:value.base64Data,branch:config.branch},dependencies);return {path:path,sha:String(data.content&&data.content.sha||''),size:Number(data.content&&data.content.size)||value.size};},
    inspect:function(path){const data=githubRequest_(config,'get',path,null,dependencies);return {path:String(data.path||''),sha:String(data.sha||''),size:Number(data.size)||0,type:String(data.type||'')};},
    remove:function(path,sha){githubRequest_(config,'delete',path,{message:'Remove ZiNa media',sha:sha,branch:config.branch},dependencies);},
    publicUrl:function(path){return config.publicBaseUrl+'/'+path.split('/').map(encodeURIComponent).join('/');}
  };
}

function repositoryPath_(usage,id,mimeType){return MEDIA_PREFIXES[usage]+'/'+id+'.'+MEDIA_TYPES[mimeType].extension;}
function assertApprovedRepositoryPath_(path,usage){const prefix=MEDIA_PREFIXES[usage];if(!prefix||!new RegExp('^'+prefix.replace('/','\\/')+'\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.(?:jpg|png|webp)$','i').test(path))throw apiError_('MEDIA_PATH_NOT_OWNED','Media path is outside the approved repository prefix.');}
function mediaFromRow_(row){return{id:String(row.id),entityType:String(row.entity_type||''),entityId:String(row.entity_id||''),usage:String(row.usage||''),repositoryPath:String(row.repository_path||''),repositorySha:String(row.github_blob_sha||''),originalFilename:String(row.filename||''),storedFilename:String(row.stored_filename||''),mimeType:String(row.mime_type||''),size:Number(row.file_size)||0,publicUrl:String(row.public_url||''),altTextRo:String(row.alt_text_ro||''),altTextEn:String(row.alt_text_en||''),altTextDe:String(row.alt_text_de||''),status:String(row.status||'active'),createdAt:isoString_(row.created_at),updatedAt:isoString_(row.updated_at)};}
function listMedia_(){return readRows_('Media').map(mediaFromRow_).sort(function(a,b){return b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id);});}
function mediaRequestFingerprint_(value){const digest=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value.bytes).map(function(b){return('0'+unsignedByte_(b).toString(16)).slice(-2);}).join('');return{usage:value.usage,entityType:value.entityType,entityId:value.entityId,originalFilename:value.originalFilename,mimeType:value.mimeType,size:value.size,bytesHash:digest,altTextRo:value.altTextRo,altTextEn:value.altTextEn,altTextDe:value.altTextDe};}

function appendMediaRecord_(id,value,stored,path,sha,url,now){appendRecord_('Media',{id:id,entity_type:value.entityType,entity_id:value.entityId,usage:value.usage,repository_path:path,github_blob_sha:sha,filename:value.originalFilename,stored_filename:stored,mime_type:value.mimeType,file_size:value.size,public_url:url,alt_text_ro:value.altTextRo,alt_text_en:value.altTextEn,alt_text_de:value.altTextDe,status:'active',created_at:now,updated_at:now});}

function uploadMedia_(value,idempotencyKey,admin,dependencies){
  const proposedId=newId_(),fingerprint=mediaRequestFingerprint_(value),spec=mutationSpec_('uploadMedia','Media','',admin,fingerprint,idempotencyKey);
  return runWriteMutation_(spec,function(runtime){const state=prepareIdempotency_(spec,runtime,proposedId),id=state.resultId||proposedId;spec.recordId=id;const existing=existingById_(listMedia_(),id);if(existing){completeIdempotency_(state,runtime);return{value:existing,replayed:true};}const storage=githubMediaRuntime_(dependencies),path=repositoryPath_(value.usage,id,value.mimeType);assertApprovedRepositoryPath_(path,value.usage);let published;try{published=storage.inspect(path);}catch(error){if(!error||error.apiCode!=='MEDIA_NOT_FOUND')throw error;}if(!published)published=storage.create(path,value);if(published.path!==path||published.size!==value.size||!published.sha)throw apiError_('MEDIA_STORAGE_FAILED','Published media verification failed.');const stored=path.slice(path.lastIndexOf('/')+1),url=storage.publicUrl(path);try{appendMediaRecord_(id,value,stored,path,published.sha,url,runtime.now());}catch(error){try{storage.remove(path,published.sha);}catch(_){}throw error;}completeIdempotency_(state,runtime);return{value:findById_(listMedia_(),id),replayed:state.replay};},dependencies);
}

function replaceMedia_(id,value,expectedUpdatedAt,admin,dependencies){
  const spec=mutationSpec_('replaceMedia','Media',id,admin,mediaRequestFingerprint_(value));
  return runWriteMutation_(spec,function(runtime){const row=recordRowById_('Media',id,false);assertExpectedUpdatedAt_(row,expectedUpdatedAt);if(String(row.status||'active')!=='active')throw apiError_('MEDIA_NOT_ACTIVE','Media record is not active.');const storage=githubMediaRuntime_(dependencies),oldPath=String(row.repository_path),oldSha=String(row.github_blob_sha);assertApprovedRepositoryPath_(oldPath,String(row.usage));const newPath=repositoryPath_(value.usage,newId_(),value.mimeType);assertApprovedRepositoryPath_(newPath,value.usage);const published=storage.create(newPath,value);if(published.path!==newPath||published.size!==value.size||!published.sha){try{storage.remove(newPath,published.sha);}catch(_){}throw apiError_('MEDIA_STORAGE_FAILED','Replacement media verification failed.');}const stored=newPath.slice(newPath.lastIndexOf('/')+1),updatedAt=nextUpdatedAt_(row,runtime);try{updateRecord_('Media',id,{entity_type:value.entityType,entity_id:value.entityId,usage:value.usage,repository_path:newPath,github_blob_sha:published.sha,filename:value.originalFilename,stored_filename:stored,mime_type:value.mimeType,file_size:value.size,public_url:storage.publicUrl(newPath),alt_text_ro:value.altTextRo,alt_text_en:value.altTextEn,alt_text_de:value.altTextDe,status:'active',updated_at:updatedAt});}catch(error){try{storage.remove(newPath,published.sha);}catch(_){}throw error;}let cleanupRequired=false;try{storage.remove(oldPath,oldSha);}catch(_){cleanupRequired=true;}const result=findById_(listMedia_(),id);result.cleanupRequired=cleanupRequired;return result;},dependencies);
}

function deleteMedia_(id,expectedUpdatedAt,idempotencyKey,admin,dependencies){
  const spec=mutationSpec_('deleteMedia','Media',id,admin,{expectedUpdatedAt:expectedUpdatedAt},idempotencyKey);
  return runWriteMutation_(spec,function(runtime){const state=prepareIdempotency_(spec,runtime,''),row=recordRowById_('Media',id,false);if(state.state==='completed')return{value:mediaFromRow_(row),replayed:true};assertExpectedUpdatedAt_(row,expectedUpdatedAt);const path=String(row.repository_path),sha=String(row.github_blob_sha),storage=githubMediaRuntime_(dependencies);assertApprovedRepositoryPath_(path,String(row.usage));const updatedAt=nextUpdatedAt_(row,runtime);updateRecord_('Media',id,{status:'deleted',public_url:'',updated_at:updatedAt});let cleanupRequired=false;try{storage.remove(path,sha);}catch(_){cleanupRequired=true;}completeIdempotency_(state,runtime);const result=findById_(listMedia_(),id);result.cleanupRequired=cleanupRequired;return{value:result,replayed:state.replay};},dependencies);
}
