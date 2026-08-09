function runPhase2SelfTests() {
  const results=[];
  function test(name,fn){try{fn();results.push({name:name,passed:true});}catch(error){results.push({name:name,passed:false,message:error.message});}}
  function expectCode(code,fn){try{fn();throw new Error('Expected '+code);}catch(error){if(error.apiCode!==code)throw error;}}
  const now=2000000000;
  const fakeEmail='test'+'@gmail.com';
  const claims={aud:'test-client',iss:'https://accounts.google.com',exp:now+3600,iat:now-10,email:fakeEmail.toUpperCase(),email_verified:true,sub:'subject'};
  test('public routing rejects unknown actions',function(){expectCode('UNKNOWN_PUBLIC_ACTION',function(){assertAllowedAction_('nope',PUBLIC_ACTIONS,true);});});
  test('drafts fail public publication filter',function(){if(isPublishedRecord_({status:'draft'})||!isPublishedRecord_({status:'published'}))throw new Error('Publication filter failed.');});
  test('protected action requires authentication',function(){expectCode('AUTHENTICATION_FAILED',function(){routeProtectedRequest_({action:'listAllArticles',idToken:'x'}, {verifyToken:function(){throw apiError_('AUTHENTICATION_FAILED','required');},findAdmin:function(){return null;}});});});
  test('incorrect audience rejected',function(){expectCode('AUTHENTICATION_FAILED',function(){validateGoogleClaims_(Object.assign({},claims,{aud:'wrong'}),'test-client',now);});});
  test('incorrect issuer rejected',function(){expectCode('AUTHENTICATION_FAILED',function(){validateGoogleClaims_(Object.assign({},claims,{iss:'wrong'}),'test-client',now);});});
  test('expired token rejected',function(){expectCode('AUTHENTICATION_FAILED',function(){validateGoogleClaims_(Object.assign({},claims,{exp:now-1}),'test-client',now);});});
  test('unverified email rejected',function(){expectCode('AUTHENTICATION_FAILED',function(){validateGoogleClaims_(Object.assign({},claims,{email_verified:false}),'test-client',now);});});
  test('inactive administrator rejected',function(){expectCode('FORBIDDEN',function(){authorizeAdmin_({email:fakeEmail},{findAdmin:function(){return {active:false};}});});});
  test('missing administrator rejected',function(){expectCode('FORBIDDEN',function(){authorizeAdmin_({email:fakeEmail},{findAdmin:function(){return null;}});});});
  test('unknown payload fields rejected',function(){expectCode('UNKNOWN_FIELD',function(){validateArticle_({title:'T',content:'C',status:'draft',unexpected:true},false);});});
  test('invalid status rejected',function(){expectCode('INVALID_STATUS',function(){statusValue_('private');});});
  test('invalid ID rejected',function(){expectCode('INVALID_ID',function(){idValue_('bad','id',true);});});
  test('invalid URL rejected',function(){expectCode('INVALID_URL',function(){urlValue_('javascript:alert(1)','url');});});
  test('invalid date rejected',function(){expectCode('INVALID_DATE',function(){dateValue_('not-a-date','date',true);});});
  test('failure responses redact stacks and tokens',function(){const error=apiError_('BAD','safe');error.stack='SECRET_TOKEN';const json=JSON.stringify(failureEnvelope_(error));if(json.indexOf('SECRET_TOKEN')!==-1||json.indexOf('stack')!==-1)throw new Error('Sensitive error data leaked.');});
  test('API response shape is consistent',function(){const success=successEnvelope_({}),failure=failureEnvelope_(apiError_('BAD','safe'));['ok','data','error','version'].forEach(function(key){if(!Object.prototype.hasOwnProperty.call(success,key)||!Object.prototype.hasOwnProperty.call(failure,key))throw new Error('Missing response field.');});});
  const failed=results.filter(function(result){return !result.passed;});
  if(failed.length)throw new Error('Phase 2 self-tests failed: '+failed.map(function(result){return result.name+': '+result.message;}).join('; '));
  Logger.log(JSON.stringify(successEnvelope_({tests:results.length,passed:results.length})));
  return successEnvelope_({tests:results.length,passed:results.length});
}
