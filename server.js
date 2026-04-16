import express from 'express';
import session from 'express-session';
import multer from 'multer';
import path from 'path';
import { sqlQuery } from './mysql.js';

const app = express();

// Multer pro nahrávání souborů
const storage = multer.diskStorage({
  destination: 'public/uploads/',
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({ secret: 'tajnyheslo', resave: false, saveUninitialized: false }));

// Middleware - ochrana tras
function requireLogin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Nepřihlášen' });
  next();
}

// ===== AUTH =====

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  sqlQuery('SELECT * FROM uzivatele WHERE username = ? AND password = ?', [username, password], (err, rows) => {
    if (err || rows.length === 0) return res.json({ ok: false });
    req.session.user = rows[0];
    res.json({ ok: true });
  });
});

app.post('/api/register', upload.single('foto'), (req, res) => {
  const { jmeno, prijmeni, vek, pohlavi, username, password } = req.body;
  const foto = req.file ? '/uploads/' + req.file.filename : null;
  sqlQuery(
    'INSERT INTO uzivatele (jmeno, prijmeni, vek, pohlavi, username, password, foto) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [jmeno, prijmeni, vek, pohlavi, username, password, foto],
    (err) => {
      if (err) return res.json({ ok: false, error: err.message });
      res.json({ ok: true });
    }
  );
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  res.json(req.session.user || null);
});

// ===== ZEĎ =====

app.get('/api/prispevky', requireLogin, (req, res) => {
  sqlQuery(`
    SELECT p.*, u.jmeno, u.prijmeni, u.foto as autor_foto,
      (SELECT COUNT(*) FROM lajky l WHERE l.prispevek_id = p.id) as pocet_lajku
    FROM prispevky p
    JOIN uzivatele u ON p.autor_id = u.id
    ORDER BY p.vytvoreno DESC
  `, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/prispevky', requireLogin, upload.single('obrazek'), (req, res) => {
  const { nadpis, text } = req.body;
  const obrazek = req.file ? '/uploads/' + req.file.filename : null;
  sqlQuery(
    'INSERT INTO prispevky (autor_id, nadpis, text, obrazek) VALUES (?, ?, ?, ?)',
    [req.session.user.id, nadpis, text, obrazek],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true });
    }
  );
});

// ===== KOMENTÁŘE =====

app.get('/api/komentare/:prispevek_id', requireLogin, (req, res) => {
  sqlQuery(`
    SELECT k.*, u.jmeno, u.prijmeni
    FROM komentare k
    JOIN uzivatele u ON k.autor_id = u.id
    WHERE k.prispevek_id = ?
    ORDER BY k.vytvoreno DESC
  `, [req.params.prispevek_id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/komentare', requireLogin, (req, res) => {
  const { prispevek_id, text } = req.body;
  sqlQuery(
    'INSERT INTO komentare (autor_id, prispevek_id, text) VALUES (?, ?, ?)',
    [req.session.user.id, prispevek_id, text],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true });
    }
  );
});

// ===== LAJKY =====

app.post('/api/lajky', requireLogin, (req, res) => {
  const { prispevek_id } = req.body;
  // Zkusíme vložit, pokud už existuje, smažeme (toggle)
  sqlQuery('SELECT * FROM lajky WHERE uzivatel_id = ? AND prispevek_id = ?',
    [req.session.user.id, prispevek_id], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length > 0) {
        sqlQuery('DELETE FROM lajky WHERE uzivatel_id = ? AND prispevek_id = ?',
          [req.session.user.id, prispevek_id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ ok: true, akce: 'odebrano' });
          });
      } else {
        sqlQuery('INSERT INTO lajky (uzivatel_id, prispevek_id) VALUES (?, ?)',
          [req.session.user.id, prispevek_id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ ok: true, akce: 'pridano' });
          });
      }
    });
});

app.get('/api/lajky/:prispevek_id', requireLogin, (req, res) => {
  sqlQuery(`
    SELECT u.jmeno, u.prijmeni, l.vytvoreno
    FROM lajky l
    JOIN uzivatele u ON l.uzivatel_id = u.id
    WHERE l.prispevek_id = ?
  `, [req.params.prispevek_id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ===== UŽIVATELÉ =====

app.get('/api/uzivatele', requireLogin, (req, res) => {
  sqlQuery('SELECT id, jmeno, prijmeni, foto FROM uzivatele ORDER BY prijmeni ASC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/uzivatele/:id', requireLogin, (req, res) => {
  sqlQuery('SELECT id, jmeno, prijmeni, vek, pohlavi, foto FROM uzivatele WHERE id = ?',
    [req.params.id], (err, rows) => {
      if (err || rows.length === 0) return res.status(404).json({ error: 'Nenalezen' });
      res.json(rows[0]);
    });
});

app.get('/api/uzivatele/:id/prispevky', requireLogin, (req, res) => {
  sqlQuery(`
    SELECT p.*, u.jmeno, u.prijmeni, u.foto as autor_foto,
      (SELECT COUNT(*) FROM lajky l WHERE l.prispevek_id = p.id) as pocet_lajku
    FROM prispevky p
    JOIN uzivatele u ON p.autor_id = u.id
    WHERE p.autor_id = ?
    ORDER BY p.vytvoreno DESC
  `, [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/uzivatele/:id/aktivita', requireLogin, (req, res) => {
  // Příspěvky, které uživatel lajkoval nebo komentoval (cizí)
  sqlQuery(`
    SELECT DISTINCT p.*, u.jmeno, u.prijmeni, u.foto as autor_foto,
      (SELECT COUNT(*) FROM lajky l WHERE l.prispevek_id = p.id) as pocet_lajku
    FROM prispevky p
    JOIN uzivatele u ON p.autor_id = u.id
    WHERE p.autor_id != ?
      AND (
        EXISTS (SELECT 1 FROM lajky l WHERE l.prispevek_id = p.id AND l.uzivatel_id = ?)
        OR EXISTS (SELECT 1 FROM komentare k WHERE k.prispevek_id = p.id AND k.autor_id = ?)
      )
    ORDER BY p.vytvoreno DESC
  `, [req.params.id, req.params.id, req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.listen(3000, () => console.log('Server běží na http://localhost:3000'));
