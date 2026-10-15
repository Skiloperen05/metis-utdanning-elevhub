import test from 'node:test';
import assert from 'node:assert/strict';
import { requireSupabaseClient, SupabaseSyncService } from '../src/lib/supabase';
import { emptyDatabase } from '../src/lib/storage';
import type { Student, Material } from '../src/types';

const client = requireSupabaseClient();
(client.auth as any).getUser = async () => ({ data: { user: { id: 'verified-user', email: 'verified@example.test' } }, error: null });
const student = { id: 'student-test', name: 'Test', ownerEmail: 'spoof@example.test' } as Student;
function service() { (SupabaseSyncService as any).instance = null; return SupabaseSyncService.getInstance(); }

test('write errors are surfaced and mark the workspace as unsynced', async () => {
  (client as any).from = () => ({ upsert: async () => ({ error: { message: 'permission denied' } }) });
  const sync = service();
  await assert.rejects(sync.saveStudent(student), /permission denied/);
  assert.equal(sync.hasUnsyncedChanges(), true);
});

test('write ownership comes from the verified session, not imported data', async () => {
  let saved: any;
  (client as any).from = () => ({ upsert: async (row: any) => { saved = row; return { error: null }; } });
  await service().saveStudent(student);
  assert.equal(saved.owner_id, 'verified-user');
  assert.equal(saved.owner_email, 'verified@example.test');
  assert.equal(saved.data.ownerEmail, 'verified@example.test');
});

test('a failed table read rejects instead of replacing the workspace with empty arrays', async () => {
  (client as any).from = () => ({ select: () => ({ eq: () => ({ order: () => ({
    range: async () => ({ data: null, error: new Error('network failure') }),
  }) }) }) });
  await assert.rejects(service().loadAllData(), /network failure/);
});

test('import without file contents fails visibly instead of silently losing the attachment', async () => {
  const material = { id: 'material-test', files: [{ id: 'file-test', name: 'missing.pdf', dataUrl: '' }] } as Material;
  await assert.rejects(service().saveMaterial(material), /mangler filinnhold/);
});

test('an empty successful manual sync clears the unsynced state', async () => {
  (client as any).from = () => ({ upsert: async () => ({ error: new Error('test failure') }) });
  const sync = service();
  await assert.rejects(sync.saveStudent(student));
  await sync.importFullDatabase(emptyDatabase());
  assert.equal(sync.hasUnsyncedChanges(), false);
});
