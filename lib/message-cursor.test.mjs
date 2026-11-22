import test from 'node:test';
import assert from 'node:assert/strict';
import {isMessageCursorTimestamp} from './message-cursor.ts';
import {nativeInboxCursor,nativeInboxPageURL} from './native-inbox-conversations.ts';
const id='11111111-1111-4111-8111-111111111111';
test('closed cursor grammar accepts raw PostgreSQL precision and offsets without changing a byte',()=>{
 for(const timestamp of ['2026-11-22T16:00:00Z','2026-11-22T16:00:00.1Z','2026-11-22T16:00:00.123456+00:00','2026-11-22T17:00:00.123456+01:00','2026-11-22T12:30:00.000001-03:30','2024-02-29T23:59:59.999999+14:00','2000-02-29T00:00:00-14:00','0001-01-01T00:00:00+00:00','9999-12-31T23:59:59.999999Z']){
  assert.equal(isMessageCursorTimestamp(timestamp),true,timestamp);const cursor={before:timestamp,before_id:id};assert.deepEqual(nativeInboxCursor(cursor),cursor);const query=new URL(nativeInboxPageURL(cursor),'https://fixture.invalid').searchParams;assert.equal(query.get('before'),timestamp);assert.equal(query.get('before_id'),id);
 }
});
test('invalid Gregorian dates, times, fractional precision, offsets and filter-injection syntax are rejected',()=>{
 for(const value of [null,123,'','2026-11-22','2026-11-22 16:00:00Z','2026-11-22T16:00:00z','0000-01-01T00:00:00Z','10000-01-01T00:00:00Z','2026-00-01T00:00:00Z','2026-13-01T00:00:00Z','2026-01-00T00:00:00Z','2026-04-31T00:00:00Z','2026-02-29T00:00:00Z','1900-02-29T00:00:00Z','2100-02-29T00:00:00Z','2026-01-01T24:00:00Z','2026-01-01T00:60:00Z','2026-01-01T00:00:60Z','2026-01-01T00:00:00.Z','2026-01-01T00:00:00.1234567Z','2026-01-01T00:00:00+24:00','2026-01-01T00:00:00+15:00','2026-01-01T00:00:00+14:01','2026-01-01T00:00:00-14:30','2026-01-01T00:00:00+01:60','2026-01-01T00:00:00+0100','2026-01-01T00:00:00Z\n','2026-01-01T00:00:00Z),id.neq.other'])assert.equal(isMessageCursorTimestamp(value),false,String(value));
 for(const before of ['2026-02-29T00:00:00Z','2026-01-01T00:00:00+24:00'])assert.equal(nativeInboxCursor({before,before_id:id}),null);
 for(const suffix of [String.fromCharCode(10),String.fromCharCode(13),String.fromCharCode(13,10)]){
  assert.equal(isMessageCursorTimestamp('2026-01-01T00:00:00Z'+suffix),false);
  assert.equal(nativeInboxCursor({before:'2026-01-01T00:00:00Z',before_id:id+suffix}),null);
 }
});
