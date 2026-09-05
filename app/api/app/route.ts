import { env } from 'cloudflare:workers';

type UserRow = { id: number; name: string; email: string; role: 'student' | 'profesor'; study: string };
type QuestionInput = { id?: number; type: 'mcq' | 'short' | 'code'; prompt: string; options?: string[]; correctAnswer: string; points: number };

function json(data: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(data, { status, headers });
}

async function hashPassword(password: string, salt: string) {
  const bytes = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function cookieValue(request: Request, name: string) {
  const match = request.headers.get('cookie')?.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function ensureSeed() {
  const count = await env.DB.prepare('SELECT COUNT(*) AS count FROM users').first<{ count: number }>();
  if (!count?.count) {
    const profesorSalt = crypto.randomUUID();
    await env.DB.prepare('INSERT INTO users (name,email,password_hash,password_salt,role,study,created_at) VALUES (?,?,?,?,?,?,?)').bind('Ivana Horvat', 'profesor@znanjeplus.hr', await hashPassword('Profesor123!', profesorSalt), profesorSalt, 'profesor', 'Informatika', new Date().toISOString()).run();
  }
  await env.DB.batch([
    env.DB.prepare("DELETE FROM answers WHERE attempt_id IN (SELECT a.id FROM attempts a JOIN users u ON u.id=a.student_id WHERE u.email IN ('student@znanjeplus.hr','petra@znanjeplus.hr','luka@znanjeplus.hr'))"),
    env.DB.prepare("DELETE FROM attempts WHERE student_id IN (SELECT id FROM users WHERE email IN ('student@znanjeplus.hr','petra@znanjeplus.hr','luka@znanjeplus.hr'))"),
    env.DB.prepare("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email IN ('student@znanjeplus.hr','petra@znanjeplus.hr','luka@znanjeplus.hr'))"),
    env.DB.prepare("DELETE FROM users WHERE email IN ('student@znanjeplus.hr','petra@znanjeplus.hr','luka@znanjeplus.hr')"),
  ]);
  const testCount = await env.DB.prepare('SELECT COUNT(*) AS count FROM tests').first<{ count: number }>();
  if (!testCount?.count) {
    const profesor = await env.DB.prepare("SELECT id FROM users WHERE role='profesor' ORDER BY id LIMIT 1").first<{ id: number }>();
    if (!profesor) return;
    const specs = [
      { title: 'Osnove JavaScripta', subject: 'Programiranje', desc: 'Temeljni koncepti JavaScripta.', duration: 15, qs: [
        ['mcq','Koja ključna riječ deklarira varijablu blokovskog dosega u JavaScriptu?','["var","let","define","static"]','let',2],
        ['short','Kako se zove metoda koja pretvara JSON tekst u JavaScript objekt?',null,'JSON.parse',2],
        ['mcq','Koji operator provjerava i vrijednost i tip podatka?','["==","===","=","!="]','===',2],
        ['code','Napiši JavaScript funkciju zbroji(a, b) koja vraća zbroj dvaju brojeva.',null,'return a + b',4],
      ]},
      { title: 'SQL i relacijski model', subject: 'Baze podataka', desc: 'Upiti, ključevi i relacijski model.', duration: 20, qs: [
        ['mcq','Koja SQL naredba dohvaća podatke iz tablice?','["SELECT","UPDATE","DELETE","DROP"]','SELECT',2],
        ['short','Kako se zove ključ koji jedinstveno identificira redak?',null,'primarni ključ',2],
        ['mcq','Koja klauzula filtrira retke rezultata?','["ORDER BY","WHERE","GROUP BY","JOIN"]','WHERE',2],
        ['mcq','Koja veza omogućuje više zapisa s obje strane?','["1:1","1:N","N:M","0:1"]','N:M',2],
        ['short','Koja SQL funkcija broji retke?',null,'COUNT',2],
      ]},
      { title: 'HTML i web dizajn', subject: 'Web dizajn', desc: 'Semantika, obrasci i pristupačnost.', duration: 20, qs: [
        ['mcq','Koji element predstavlja glavnu navigaciju?','["<nav>","<main>","<aside>","<menu>"]','<nav>',2],
        ['short','Koji atribut slike sadrži zamjenski tekst?',null,'alt',2],
        ['mcq','Koji element označava najvažniji naslov stranice?','["<h1>","<title>","<header>","<strong>"]','<h1>',2],
        ['mcq','Koji CSS svojstvo mijenja boju teksta?','["font-color","text-color","color","foreground"]','color',2],
        ['short','Koja HTML oznaka stvara poveznicu?',null,'a',2],
      ]},
    ] as const;
    for (const spec of specs) {
      const result = await env.DB.prepare('INSERT INTO tests (title,subject,description,duration_minutes,published,teacher_id) VALUES (?,?,?,?,1,?)').bind(spec.title, spec.subject, spec.desc, spec.duration, profesor.id).run();
      const testId = Number(result.meta.last_row_id);
      await env.DB.batch(spec.qs.map((q, i) => env.DB.prepare('INSERT INTO questions (test_id,type,prompt,options_json,correct_answer,points,position) VALUES (?,?,?,?,?,?,?)').bind(testId, q[0], q[1], q[2], q[3], q[4], i + 1)));
    }
  }
}

async function currentUser(request: Request): Promise<UserRow | null> {
  const token = cookieValue(request, 'zp_session');
  if (!token) return null;
  return env.DB.prepare("SELECT u.id,u.name,u.email,u.role,u.study FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>?").bind(token, new Date().toISOString()).first<UserRow>();
}

async function loadData(user: UserRow) {
  const tests = (await env.DB.prepare(`SELECT t.*, u.name AS teacher_name,
    (SELECT COUNT(*) FROM questions q WHERE q.test_id=t.id) AS question_count,
    (SELECT COALESCE(SUM(points),0) FROM questions q WHERE q.test_id=t.id) AS max_points,
    (SELECT COUNT(*) FROM attempts a WHERE a.test_id=t.id) AS attempt_count
    FROM tests t JOIN users u ON u.id=t.teacher_id ${user.role === 'student' ? 'WHERE t.published=1' : ''} ORDER BY t.id`).all()).results;
  const questionRows = user.role === 'profesor'
    ? (await env.DB.prepare('SELECT id,test_id,type,prompt,options_json,correct_answer,points,position FROM questions ORDER BY test_id,position').all()).results
    : (await env.DB.prepare('SELECT id,test_id,type,prompt,options_json,points,position FROM questions ORDER BY test_id,position').all()).results;
  const attempts = (await env.DB.prepare(`SELECT a.id,a.test_id,a.student_id,a.score,a.max_score,a.submitted_at,t.title,t.subject,u.name AS student_name
    FROM attempts a JOIN tests t ON t.id=a.test_id JOIN users u ON u.id=a.student_id ${user.role === 'student' ? 'WHERE a.student_id=?' : ''} ORDER BY a.submitted_at DESC`).bind(...(user.role === 'student' ? [user.id] : [])).all()).results;
  const users = user.role === 'profesor' ? (await env.DB.prepare('SELECT id,name,email,role,study,created_at FROM users ORDER BY name').all()).results : [];
  return { user, tests, questions: questionRows, attempts, users };
}

export async function GET(request: Request) {
  await ensureSeed();
  const user = await currentUser(request);
  if (!user) return json({ authenticated: false }, 401);
  const url = new URL(request.url);
  if (url.searchParams.get('action') === 'attempt') {
    const id = Number(url.searchParams.get('id'));
    const attempt = await env.DB.prepare('SELECT a.*,t.title,t.subject,u.name AS student_name FROM attempts a JOIN tests t ON t.id=a.test_id JOIN users u ON u.id=a.student_id WHERE a.id=?').bind(id).first<Record<string, unknown>>();
    if (!attempt || (user.role === 'student' && attempt.student_id !== user.id)) return json({ error: 'Pokušaj nije pronađen.' }, 404);
    const answers = (await env.DB.prepare('SELECT an.answer,an.awarded_points,an.is_correct,q.prompt,q.correct_answer,q.points FROM answers an JOIN questions q ON q.id=an.question_id WHERE an.attempt_id=? ORDER BY q.position').bind(id).all()).results;
    return json({ attempt, answers });
  }
  return json({ authenticated: true, ...(await loadData(user)) });
}

export async function POST(request: Request) {
  await ensureSeed();
  const body = await request.json<Record<string, unknown>>();
  if (body.action === 'register') {
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const study = String(body.study || 'Informatika').trim() || 'Informatika';
    if (name.length < 3) return json({ error: 'Unesite ime i prezime.' }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Unesite ispravnu email adresu.' }, 400);
    if (password.length < 8) return json({ error: 'Lozinka mora imati najmanje 8 znakova.' }, 400);
    const exists = await env.DB.prepare('SELECT id FROM users WHERE lower(email)=?').bind(email).first();
    if (exists) return json({ error: 'Korisnik s tim emailom već postoji.' }, 409);
    const salt = crypto.randomUUID();
    const created = await env.DB.prepare('INSERT INTO users (name,email,password_hash,password_salt,role,study,created_at) VALUES (?,?,?,?,?,?,?)').bind(name,email,await hashPassword(password,salt),salt,'student',study,new Date().toISOString()).run();
    const token = crypto.randomUUID() + crypto.randomUUID();
    const expires = new Date(Date.now() + 7 * 86400000).toISOString();
    await env.DB.prepare('INSERT INTO sessions (token,user_id,expires_at) VALUES (?,?,?)').bind(token,Number(created.meta.last_row_id),expires).run();
    const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
    return json({ ok: true }, 201, { 'Set-Cookie': `zp_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}` });
  }
  if (body.action === 'login') {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const found = await env.DB.prepare('SELECT id,name,email,role,study,password_hash,password_salt FROM users WHERE lower(email)=?').bind(email).first<UserRow & { password_hash: string; password_salt: string }>();
    if (!found || found.password_hash !== await hashPassword(password, found.password_salt)) return json({ error: 'Pogrešan email ili lozinka.' }, 401);
    const token = crypto.randomUUID() + crypto.randomUUID();
    const expires = new Date(Date.now() + 7 * 86400000).toISOString();
    await env.DB.prepare('INSERT INTO sessions (token,user_id,expires_at) VALUES (?,?,?)').bind(token, found.id, expires).run();
    const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
    return json({ ok: true }, 200, { 'Set-Cookie': `zp_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}` });
  }
  if (body.action === 'logout') {
    const token = cookieValue(request, 'zp_session');
    if (token) await env.DB.prepare('DELETE FROM sessions WHERE token=?').bind(token).run();
    const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
    return json({ ok: true }, 200, { 'Set-Cookie': `zp_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}` });
  }
  const user = await currentUser(request);
  if (!user) return json({ error: 'Potrebna je prijava.' }, 401);

  if (body.action === 'grade' && user.role === 'student') {
    const testId = Number(body.testId);
    const submitted = (body.answers || {}) as Record<string, string>;
    const qs = (await env.DB.prepare('SELECT id,type,correct_answer,points FROM questions WHERE test_id=? ORDER BY position').bind(testId).all<{ id:number; type:string; correct_answer:string; points:number }>()).results;
    if (!qs.length) return json({ error: 'Test nema pitanja.' }, 400);
    const normalizeText = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('hr').trim().replace(/[<>()\[\]{};:'"`]/g, '').replace(/\s+/g, ' ');
    const normalizeCode = (v: string) => v.toLocaleLowerCase('hr').replace(/[\s;]/g, '');
    const equivalents: Record<string,string[]> = { 'primarni kljuc': ['primary key'], 'primary key': ['primarni kljuc'] };
    const graded = qs.map((q) => {
      const raw = String(submitted[q.id] || '');
      const given = normalizeText(raw), expected = normalizeText(q.correct_answer);
      const accepted = [expected, ...(equivalents[expected] || [])];
      const correct = q.type === 'code' ? normalizeCode(raw).includes(normalizeCode(q.correct_answer)) : accepted.includes(given);
      return { ...q, answer: raw, correct, awarded: correct ? q.points : 0 };
    });
    const score = graded.reduce((s,q)=>s+q.awarded,0), maxScore = graded.reduce((s,q)=>s+q.points,0);
    const result = await env.DB.prepare('INSERT INTO attempts (test_id,student_id,score,max_score,submitted_at) VALUES (?,?,?,?,?)').bind(testId,user.id,score,maxScore,new Date().toISOString()).run();
    const attemptId = Number(result.meta.last_row_id);
    await env.DB.batch(graded.map((q)=>env.DB.prepare('INSERT INTO answers (attempt_id,question_id,answer,awarded_points,is_correct) VALUES (?,?,?,?,?)').bind(attemptId,q.id,q.answer,q.awarded,q.correct?1:0)));
    return json({ attemptId, score, maxScore });
  }

  if (user.role !== 'profesor') return json({ error: 'Nemate ovlasti za ovu radnju.' }, 403);

  if (body.action === 'saveTest') {
    const test = body.test as { id?:number; title:string; subject:string; description:string; durationMinutes:number; published:boolean; questions:QuestionInput[] };
    if (!test.title?.trim() || !test.questions?.length) return json({ error: 'Naziv i barem jedno pitanje su obavezni.' }, 400);
    let testId = Number(test.id || 0);
    if (testId) {
      await env.DB.prepare('UPDATE tests SET title=?,subject=?,description=?,duration_minutes=?,published=? WHERE id=?').bind(test.title.trim(),test.subject,test.description.trim(),Number(test.durationMinutes),test.published?1:0,testId).run();
      const attemptIds = (await env.DB.prepare('SELECT id FROM attempts WHERE test_id=?').bind(testId).all<{id:number}>()).results.map(x=>x.id);
      if (attemptIds.length) await env.DB.batch(attemptIds.map(id=>env.DB.prepare('DELETE FROM answers WHERE attempt_id=?').bind(id)));
      await env.DB.batch([env.DB.prepare('DELETE FROM attempts WHERE test_id=?').bind(testId),env.DB.prepare('DELETE FROM questions WHERE test_id=?').bind(testId)]);
    } else {
      const created = await env.DB.prepare('INSERT INTO tests (title,subject,description,duration_minutes,published,teacher_id) VALUES (?,?,?,?,?,?)').bind(test.title.trim(),test.subject,test.description.trim(),Number(test.durationMinutes),test.published?1:0,user.id).run();
      testId = Number(created.meta.last_row_id);
    }
    await env.DB.batch(test.questions.map((q,i)=>env.DB.prepare('INSERT INTO questions (test_id,type,prompt,options_json,correct_answer,points,position) VALUES (?,?,?,?,?,?,?)').bind(testId,q.type,q.prompt.trim(),q.type==='mcq'?JSON.stringify(q.options||[]):null,q.correctAnswer.trim(),Number(q.points)||1,i+1)));
    return json({ ok:true,testId });
  }
  if (body.action === 'deleteTest') {
    const testId=Number(body.testId); const ids=(await env.DB.prepare('SELECT id FROM attempts WHERE test_id=?').bind(testId).all<{id:number}>()).results.map(x=>x.id);
    if(ids.length) await env.DB.batch(ids.map(id=>env.DB.prepare('DELETE FROM answers WHERE attempt_id=?').bind(id)));
    await env.DB.batch([env.DB.prepare('DELETE FROM attempts WHERE test_id=?').bind(testId),env.DB.prepare('DELETE FROM questions WHERE test_id=?').bind(testId),env.DB.prepare('DELETE FROM tests WHERE id=?').bind(testId)]);
    return json({ok:true});
  }
  if (body.action === 'updateUser') {
    const id=Number(body.userId); const role=body.role==='profesor'?'profesor':'student'; const study=String(body.study||'Informatika').trim(); const name=String(body.name||'').trim();
    await env.DB.prepare('UPDATE users SET name=?,role=?,study=? WHERE id=?').bind(name,role,study,id).run(); return json({ok:true});
  }
  if (body.action === 'deleteUser') {
    const id=Number(body.userId); if(id===user.id) return json({error:'Ne možete obrisati vlastiti račun.'},400);
    const ids=(await env.DB.prepare('SELECT id FROM attempts WHERE student_id=?').bind(id).all<{id:number}>()).results.map(x=>x.id);
    if(ids.length) await env.DB.batch(ids.map(x=>env.DB.prepare('DELETE FROM answers WHERE attempt_id=?').bind(x)));
    await env.DB.batch([env.DB.prepare('DELETE FROM attempts WHERE student_id=?').bind(id),env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(id),env.DB.prepare('DELETE FROM users WHERE id=?').bind(id)]); return json({ok:true});
  }
  return json({ error: 'Nepoznata radnja.' }, 400);
}
