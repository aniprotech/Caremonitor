import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
export const referenceDirectory = fileURLToPath(new URL('../reference-data/', import.meta.url));
export async function initializeReferenceData(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS node_reference_releases (
    source text PRIMARY KEY, release text NOT NULL, checksum text NOT NULL, record_count integer NOT NULL,
    source_url text NOT NULL, imported_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await db.query(`CREATE TABLE IF NOT EXISTS node_reference_terms (
    source text NOT NULL, code text NOT NULL, kind text NOT NULL CHECK(kind IN ('hospital','medicine')),
    name text NOT NULL, country text, postcode text, concept_type text, release text NOT NULL,
    PRIMARY KEY(source,code))`);
  await db.query('CREATE INDEX IF NOT EXISTS node_reference_terms_kind_name ON node_reference_terms(kind,lower(name))');
}
export function validateSnapshot(snapshot) {
  if (!snapshot || !['ods-hospitals','scotland-hospitals','ni-hospitals','dmd'].includes(snapshot.source) ||
      typeof snapshot.release !== 'string' || !snapshot.release.trim() || !/^https:\/\//.test(snapshot.sourceUrl || '') ||
      !Array.isArray(snapshot.records) || !snapshot.records.length || snapshot.records.length > 1000000) throw new Error('Invalid or empty reference snapshot');
  const seen = new Set();
  for (const row of snapshot.records) {
    if (typeof row.code !== 'string' || !row.code || row.code.length > 200 || seen.has(row.code) ||
        typeof row.name !== 'string' || !row.name.trim() || row.name.length > 1000 ||
        row.kind !== (snapshot.source === 'dmd' ? 'medicine' : 'hospital')) throw new Error('Invalid or duplicate reference record');
    seen.add(row.code);
  }
  return snapshot;
}
export async function importSnapshot(db, snapshot, checksum) {
  validateSnapshot(snapshot);
  return db.transaction(async () => {
    // Serialize refreshes; failed imports preserve the previous complete snapshot.
    await db.query('LOCK TABLE node_reference_releases IN EXCLUSIVE MODE');
    const current = (await db.query('SELECT checksum FROM node_reference_releases WHERE source=$1',[snapshot.source])).rows[0];
    if (current?.checksum === checksum) return { unchanged: true, count: snapshot.records.length };
    await db.query('DELETE FROM node_reference_terms WHERE source=$1',[snapshot.source]);
    for (let offset=0; offset<snapshot.records.length; offset+=500) {
      const rows=snapshot.records.slice(offset,offset+500);
      await db.query(`INSERT INTO node_reference_terms(source,code,kind,name,country,postcode,concept_type,release)
        SELECT $1,r.code,r.kind,r.name,r.country,r.postcode,r."conceptType",$2
        FROM jsonb_to_recordset($3::jsonb) AS r(code text,kind text,name text,country text,postcode text,"conceptType" text)`,
      [snapshot.source,snapshot.release,JSON.stringify(rows)]);
    }
    await db.query(`INSERT INTO node_reference_releases(source,release,checksum,record_count,source_url)
      VALUES($1,$2,$3,$4,$5) ON CONFLICT(source) DO UPDATE SET release=EXCLUDED.release,checksum=EXCLUDED.checksum,
      record_count=EXCLUDED.record_count,source_url=EXCLUDED.source_url,imported_at=CURRENT_TIMESTAMP`,
    [snapshot.source,snapshot.release,checksum,snapshot.records.length,snapshot.sourceUrl]);
    return { unchanged:false,count:snapshot.records.length };
  });
}
export async function importBundledReferences(db, directory=referenceDirectory) {
  for (const name of (await readdir(directory)).filter(name=>name.endsWith('.json')).sort()) {
    const bytes=await readFile(`${directory}/${name}`);
    await importSnapshot(db,JSON.parse(bytes),createHash('sha256').update(bytes).digest('hex'));
  }
}
