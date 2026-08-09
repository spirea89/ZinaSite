const WRITE_LOCK_TIMEOUT_MILLISECONDS = 5000;

function canonicalJson_(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJson_).join(',') + ']';
  return '{' + Object.keys(value).sort().map(function (key) { return JSON.stringify(key) + ':' + canonicalJson_(value[key]); }).join(',') + '}';
}

function sha256Hex_(value) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8);
  return bytes.map(function (item) { return ('0' + ((item + 256) % 256).toString(16)).slice(-2); }).join('');
}

function writeRuntime_(dependencies) {
  const supplied = dependencies || {};
  return {
    lock: supplied.writeLock || LockService.getScriptLock(),
    now: supplied.nowIso || nowIso_,
    hash: supplied.hashValue || sha256Hex_,
    appendAudit: supplied.appendAudit || appendAuditRecord_
  };
}

function auditRecord_(spec, outcome, errorCode, timestamp) {
  return {
    timestamp: timestamp,
    action: spec.action,
    google_sub: spec.adminSub,
    record_type: spec.recordType,
    record_id: spec.recordId || '',
    outcome: outcome,
    error_code: errorCode || ''
  };
}

function appendAuditRecord_(record) {
  appendRecord_('AuditLog', record);
}

function runWriteMutation_(spec, operation, dependencies) {
  const runtime = writeRuntime_(dependencies);
  if (!runtime.lock.tryLock(WRITE_LOCK_TIMEOUT_MILLISECONDS)) throw apiError_('WRITE_LOCK_TIMEOUT', 'The CMS is busy. Try again shortly.');
  try {
    let result;
    try {
      result = operation(runtime);
    } catch (error) {
      try { runtime.appendAudit(auditRecord_(spec, 'failed', error && error.apiCode ? error.apiCode : 'INTERNAL_ERROR', runtime.now())); } catch (_) {}
      throw error;
    }
    try {
      runtime.appendAudit(auditRecord_(spec, result && result.replayed ? 'replayed' : 'succeeded', '', runtime.now()));
    } catch (_) {
      throw apiError_('WRITE_STATE_UNCERTAIN', 'The write may have completed. Reload before retrying.');
    }
    return result && Object.prototype.hasOwnProperty.call(result, 'value') ? result.value : result;
  } finally {
    runtime.lock.releaseLock();
  }
}

function recordRowById_(sheetName, id, allowMissing) {
  const matches = readRows_(sheetName).filter(function (row) { return String(row.id) === id; });
  if (matches.length > 1) throw apiError_('INTERNAL_CONFIGURATION', 'Duplicate record IDs exist.');
  if (!matches.length && !allowMissing) throw apiError_('NOT_FOUND', 'Record not found.');
  return matches.length ? matches[0] : null;
}

function storedUpdatedAt_(row, fallbackField) {
  if (!row) return null;
  return isoString_(row.updated_at || (fallbackField ? row[fallbackField] : ''));
}

function assertExpectedUpdatedAt_(row, expectedUpdatedAt, fallbackField) {
  const stored = storedUpdatedAt_(row, fallbackField);
  if (!stored || stored !== expectedUpdatedAt) throw apiError_('CONFLICT', 'Record was modified by another administrator.');
}

function idempotencyRequestHash_(spec, runtime) {
  return runtime.hash(canonicalJson_({ action: spec.action, recordType: spec.recordType, targetId: spec.recordId || '', payload: spec.payload || null }));
}

function prepareIdempotency_(spec, runtime, resultId) {
  const keyHash = runtime.hash(spec.idempotencyKey);
  const requestHash = idempotencyRequestHash_(spec, runtime);
  const matches = readRows_('Idempotency').filter(function (row) { return String(row.id) === keyHash; });
  const resolved = resolveIdempotencyRecord_(matches, spec, keyHash, requestHash, resultId);
  if (resolved.replay) return resolved;
  const now = runtime.now();
  appendRecord_('Idempotency', {
    id: keyHash,
    request_hash: requestHash,
    action: spec.action,
    record_type: spec.recordType,
    target_id: spec.recordId || '',
    result_id: resultId || '',
    state: 'started',
    created_at: now,
    updated_at: now
  });
  return resolved;
}

function resolveIdempotencyRecord_(matches, spec, keyHash, requestHash, resultId) {
  if (matches.length > 1) throw apiError_('INTERNAL_CONFIGURATION', 'Duplicate idempotency records exist.');
  if (!matches.length) return { id: keyHash, state: 'started', resultId: resultId || '', replay: false };
  const existing = matches[0];
  if (String(existing.request_hash) !== requestHash || String(existing.action) !== spec.action || String(existing.record_type) !== spec.recordType || String(existing.target_id || '') !== String(spec.recordId || '')) {
    throw apiError_('IDEMPOTENCY_CONFLICT', 'The idempotency key was already used for a different request.');
  }
  const state = String(existing.state);
  if (state !== 'started' && state !== 'completed') throw apiError_('INTERNAL_CONFIGURATION', 'Idempotency state is invalid.');
  return { id: keyHash, state: state, resultId: String(existing.result_id || ''), replay: true };
}

function completeIdempotency_(state, runtime) {
  updateRecord_('Idempotency', state.id, { state: 'completed', updated_at: runtime.now() });
}
