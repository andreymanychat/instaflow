// Valida a migração e as políticas RLS em um Postgres embutido (PGlite), emulando o ambiente do Supabase.
// Uso: npm run test:db
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { readdirSync } from "node:fs";
const migrationsDir = fileURLToPath(new URL("../supabase/migrations/", import.meta.url));
const migrations = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort().map((f) => readFileSync(migrationsDir + f, "utf8"));
const db = new PGlite();

// ---- Emula o ambiente do Supabase -------------------------------------------
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  create publication supabase_realtime;
`);

for (const sql of migrations) await db.exec(sql);
console.log(`✔ ${migrations.length} migrações aplicadas sem erros`);

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
await db.exec(`
  insert into auth.users (id, email, raw_user_meta_data) values
    ('${A}', 'ana@a.com', '{"full_name":"Ana"}'), ('${B}', 'bruno@b.com', '{"full_name":"Bruno"}');
`);

let failures = 0;
const check = (label, cond, extra = "") => {
  console.log(`${cond ? "✔" : "✖"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!cond) failures++;
};

async function as(user, fn) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}
async function expectError(label, fn) {
  try {
    await fn();
    check(label, false, "não gerou erro");
  } catch (e) {
    check(label, true, e.message.split("\n")[0]);
  }
}

const profiles = await db.query("select id, full_name from public.profiles order by full_name");
check("trigger cria profiles", profiles.rows.length === 2);

const orgA = (await as(A, () => db.query("select * from public.create_organization('Loja da Ana')"))).rows[0];
const orgB = (await as(B, () => db.query("select * from public.create_organization('Bruno & Cia')"))).rows[0];
check("create_organization gera slug", /^loja-da-ana-[0-9a-f]{6}$/.test(orgA.slug), orgA.slug);

const visible = await as(A, () => db.query("select id from public.organizations"));
check("isolamento: Ana vê só a própria organização", visible.rows.length === 1 && visible.rows[0].id === orgA.id);

await as(A, () => db.query(`insert into public.tags (organization_id, name) values ('${orgA.id}', 'lead')`));
check("membro cria tag na própria org", true);
await expectError("membro NÃO cria tag em outra org", () =>
  as(A, () => db.query(`insert into public.tags (organization_id, name) values ('${orgB.id}', 'invasao')`)),
);

await expectError("admin NÃO altera o próprio plano (grant por coluna)", () =>
  as(A, () => db.query(`update public.organizations set plan_id = 'business' where id = '${orgA.id}'`)),
);
await as(A, () => db.query(`update public.organizations set name = 'Loja da Ana 2' where id = '${orgA.id}'`));
check("admin altera o nome da org", (await db.query(`select name from public.organizations where id='${orgA.id}'`)).rows[0].name === "Loja da Ana 2");

await expectError("usuário NÃO executa claim_due_jobs", () => as(A, () => db.query("select * from public.claim_due_jobs(10)")));

// Convite: Ana convida Bruno como admin
const invite = (await as(A, () =>
  db.query(`insert into public.organization_invitations (organization_id, email, role) values ('${orgA.id}', 'bruno@b.com', 'admin') returning token`),
)).rows[0];
check("token de convite com 64 hex", /^[0-9a-f]{64}$/.test(invite.token));
await expectError("Ana não aceita convite de outro email", () => as(A, () => db.query(`select public.accept_invitation('${invite.token}')`)));
await as(B, () => db.query(`select public.accept_invitation('${invite.token}')`));
const brunoOrgs = await as(B, () => db.query("select id from public.organizations"));
check("Bruno entra na org da Ana via convite", brunoOrgs.rows.length === 2);

const demote = await as(B, () => db.query(`update public.organization_members set role = 'member' where organization_id = '${orgA.id}' and user_id = '${A}'`));
check("admin NÃO rebaixa o owner", demote.affectedRows === 0);
const kick = await as(B, () => db.query(`delete from public.organization_members where organization_id = '${orgA.id}' and user_id = '${A}'`));
check("admin NÃO remove o owner", kick.affectedRows === 0);
await expectError("admin NÃO promove ninguém a owner", () =>
  as(B, () => db.query(`update public.organization_members set role = 'owner' where organization_id = '${orgA.id}' and user_id = '${B}'`)),
);

// Conta do Instagram (gravada pelo backend) e proteção do token
await db.exec(`
  insert into public.instagram_accounts (organization_id, ig_user_id, username, access_token_encrypted)
  values ('${orgA.id}', '17841400000000001', 'lojadaana', 'segredo-criptografado');
`);
await expectError("membro NÃO lê o token criptografado", () =>
  as(A, () => db.query("select access_token_encrypted from public.instagram_accounts")),
);
const viewRows = await as(A, () => db.query("select username from public.instagram_accounts_public"));
check("membro lê a conta pela view pública", viewRows.rows[0]?.username === "lojadaana");
const viewB = await as(B, () => db.query(`select username from public.instagram_accounts_public where organization_id = '${orgB.id}'`));
check("view respeita RLS (org B sem contas)", viewB.rows.length === 0);

// Contatos, tags e segmentação
const acc = (await db.query("select id from public.instagram_accounts")).rows[0].id;
await db.exec(`
  insert into public.contacts (organization_id, instagram_account_id, igsid, username, is_follower, last_interaction_at) values
    ('${orgA.id}', '${acc}', '1', 'maria', true, now()),
    ('${orgA.id}', '${acc}', '2', 'joao', false, now() - interval '20 days'),
    ('${orgA.id}', '${acc}', '3', 'carla', true, now() - interval '2 days');
`);
const tagId = (await db.query("select id from public.tags where name='lead'")).rows[0].id;
const maria = (await db.query("select id from public.contacts where username='maria'")).rows[0].id;
await db.exec(`insert into public.contact_tags (contact_id, tag_id, organization_id) values ('${maria}', '${tagId}', '${orgA.id}')`);

const seg = async (filters) =>
  (await as(A, () => db.query(`select username from public.contacts_in_segment('${orgA.id}', $1::jsonb) order by username`, [JSON.stringify(filters)]))).rows.map((r) => r.username);

check("segmento: tem tag", JSON.stringify(await seg({ match: "all", rules: [{ field: "tag", operator: "has", value: tagId }] })) === '["maria"]');
check(
  "segmento: segue E interagiu em 7 dias",
  JSON.stringify(await seg({ match: "all", rules: [{ field: "is_follower", operator: "is_true", value: "" }, { field: "last_interaction", operator: "within_days", value: "7" }] })) === '["carla","maria"]',
);
check(
  "segmento: OU (não segue OU tem tag)",
  JSON.stringify(await seg({ match: "any", rules: [{ field: "is_follower", operator: "is_false", value: "" }, { field: "tag", operator: "has", value: tagId }] })) === '["joao","maria"]',
);
const segB = await as(B, () => db.query(`select count(*)::int as n from public.contacts_in_segment('${orgB.id}', '{"match":"all","rules":[]}')`));
check("segmento respeita a organização", segB.rows[0].n === 0);

// Dashboard e fila
const stats = (await as(A, () => db.query(`select public.dashboard_stats('${orgA.id}') as s`))).rows[0].s;
check("dashboard_stats", stats.contacts === 3 && stats.daily.length === 14, `contatos=${stats.contacts}, dias=${stats.daily.length}`);

await db.exec(`insert into public.scheduled_jobs (type, payload, run_at) values ('resume_run', '{}', now() - interval '1 minute'), ('resume_run', '{}', now() + interval '1 hour')`);
const claimed = await db.query("select * from public.claim_due_jobs(10)");
check("claim_due_jobs pega só jobs vencidos", claimed.rows.length === 1 && claimed.rows[0].status === "processing");
const again = await db.query("select * from public.claim_due_jobs(10)");
check("job já reservado não é pego de novo", again.rows.length === 0);

const code = (await db.query("insert into public.data_deletion_requests (ig_user_id) values ('123') returning confirmation_code")).rows[0].confirmation_code;
check("código de exclusão com 16 hex", /^[0-9a-f]{16}$/.test(code));

console.log(failures === 0 ? "\nTODOS OS TESTES DE BANCO PASSARAM" : `\n${failures} FALHA(S)`);
process.exit(failures ? 1 : 0);
