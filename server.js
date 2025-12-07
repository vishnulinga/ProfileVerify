
const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const bodyParser = require('body-parser');
const multer = require('multer');
const flash = require('connect-flash');

const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret-key',
    resave: false,
    saveUninitialized: false
  })
);

app.use(flash());

// Set locals for flash + user
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
});

// Multer setup for file uploads
const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix =
      Date.now() + '-' + Math.round(Math.random() * 1e9).toString();
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});
const upload = multer({ storage: storage });

// Auth helpers
function requireAuth(role) {
  return function (req, res, next) {
    if (!req.session.user) {
      return res.redirect('/login');
    }
    if (role && req.session.user.role !== role) {
      return res.status(403).send('Forbidden');
    }
    next();
  };
}

// Routes
app.get('/', (req, res) => {
  res.render('home');
});

// Candidate registration
app.get('/register', (req, res) => {
  res.render('register');
});

app.post('/register', (req, res) => {
  const { email, password, confirmPassword } = req.body;
  if (!email || !password || password !== confirmPassword) {
    req.flash('error', 'Invalid registration data or passwords do not match.');
    return res.redirect('/register');
  }

  const now = new Date().toISOString();
  const passwordHash = bcrypt.hashSync(password, 10);

  db.get('SELECT id FROM users WHERE email = ?', [email], (err, row) => {
    if (err) {
      console.error(err);
      req.flash('error', 'Database error.');
      return res.redirect('/register');
    }
    if (row) {
      req.flash('error', 'Email already registered.');
      return res.redirect('/register');
    }

    db.run(
      `INSERT INTO users (email, password_hash, role, created_at, updated_at)
       VALUES (?, ?, 'candidate', ?, ?)`,
      [email, passwordHash, now, now],
      function (err2) {
        if (err2) {
          console.error(err2);
          req.flash('error', 'Error creating user.');
          return res.redirect('/register');
        }

        const userId = this.lastID;
        db.run(
          `INSERT INTO candidate_profiles (user_id, verification_status, verification_level, risk_score, created_at, updated_at)
           VALUES (?, 'unsubmitted', 'none', 0, ?, ?)`,
          [userId, now, now],
          function (err3) {
            if (err3) {
              console.error(err3);
              req.flash('error', 'Error creating candidate profile.');
              return res.redirect('/register');
            }
            req.flash('success', 'Registration successful. Please log in.');
            res.redirect('/login');
          }
        );
      }
    );
  });
});

// Employer registration
app.get('/employer/register', (req, res) => {
  res.render('employer_register');
});

app.post('/employer/register', (req, res) => {
  const { email, password, confirmPassword, company_name } = req.body;
  if (!email || !password || password !== confirmPassword) {
    req.flash('error', 'Invalid registration data or passwords do not match.');
    return res.redirect('/employer/register');
  }

  const now = new Date().toISOString();
  const passwordHash = bcrypt.hashSync(password, 10);

  db.get('SELECT id FROM users WHERE email = ?', [email], (err, row) => {
    if (err) {
      console.error(err);
      req.flash('error', 'Database error.');
      return res.redirect('/employer/register');
    }
    if (row) {
      req.flash('error', 'Email already registered.');
      return res.redirect('/employer/register');
    }

    db.run(
      `INSERT INTO users (email, password_hash, role, created_at, updated_at)
       VALUES (?, ?, 'employer', ?, ?)`,
      [email, passwordHash, now, now],
      function (err2) {
        if (err2) {
          console.error(err2);
          req.flash('error', 'Error creating employer user.');
          return res.redirect('/employer/register');
        }
        req.flash('success', 'Employer registration successful. Please log in.');
        res.redirect('/login');
      }
    );
  });
});

// Login/logout
app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err) {
      console.error(err);
      req.flash('error', 'Database error.');
      return res.redirect('/login');
    }
    if (!user) {
      req.flash('error', 'Invalid email or password.');
      return res.redirect('/login');
    }

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      req.flash('error', 'Invalid email or password.');
      return res.redirect('/login');
    }

    req.session.user = { id: user.id, email: user.email, role: user.role };

    if (user.role === 'admin') {
      return res.redirect('/admin/candidates');
    } else if (user.role === 'candidate') {
      return res.redirect('/candidate/profile');
    } else if (user.role === 'employer') {
      return res.redirect('/employer/candidates');
    } else {
      return res.redirect('/');
    }
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Candidate routes
app.get('/candidate/profile', requireAuth('candidate'), (req, res) => {
  const userId = req.session.user.id;
  db.get(
    'SELECT * FROM candidate_profiles WHERE user_id = ?',
    [userId],
    (err, profile) => {
      if (err) {
        console.error(err);
        req.flash('error', 'Database error.');
        return res.redirect('/');
      }
      res.render('candidate_profile', { profile });
    }
  );
});

app.post('/candidate/profile', requireAuth('candidate'), (req, res) => {
  const userId = req.session.user.id;
  const {
    full_name,
    dob,
    phone,
    location,
    headline,
    total_experience_years,
    primary_skills,
    linkedin_url,
    github_url
  } = req.body;
  const now = new Date().toISOString();

  db.run(
    `UPDATE candidate_profiles
     SET full_name = ?, dob = ?, phone = ?, location = ?, headline = ?,
         total_experience_years = ?, primary_skills = ?, linkedin_url = ?, github_url = ?, updated_at = ?
     WHERE user_id = ?`,
    [
      full_name || null,
      dob || null,
      phone || null,
      location || null,
      headline || null,
      total_experience_years || null,
      primary_skills || null,
      linkedin_url || null,
      github_url || null,
      now,
      userId
    ],
    function (err) {
      if (err) {
        console.error(err);
        req.flash('error', 'Error updating profile.');
        return res.redirect('/candidate/profile');
      }
      req.flash('success', 'Profile updated.');
      res.redirect('/candidate/profile');
    }
  );
});

app.get('/candidate/documents', requireAuth('candidate'), (req, res) => {
  const userId = req.session.user.id;

  db.get(
    'SELECT id FROM candidate_profiles WHERE user_id = ?',
    [userId],
    (err, profile) => {
      if (err || !profile) {
        console.error(err);
        req.flash('error', 'Profile not found.');
        return res.redirect('/candidate/profile');
      }

      db.all(
        'SELECT * FROM documents WHERE candidate_id = ? ORDER BY uploaded_at DESC',
        [profile.id],
        (err2, docs) => {
          if (err2) {
            console.error(err2);
            req.flash('error', 'Error loading documents.');
            return res.redirect('/candidate/profile');
          }
          res.render('candidate_documents', { documents: docs });
        }
      );
    }
  );
});

app.post(
  '/candidate/documents',
  requireAuth('candidate'),
  upload.single('document'),
  (req, res) => {
    const userId = req.session.user.id;
    if (!req.file) {
      req.flash('error', 'No file uploaded.');
      return res.redirect('/candidate/documents');
    }

    const { doc_type } = req.body;
    const now = new Date().toISOString();

    db.get(
      'SELECT id FROM candidate_profiles WHERE user_id = ?',
      [userId],
      (err, profile) => {
        if (err || !profile) {
          console.error(err);
          req.flash('error', 'Profile not found.');
          return res.redirect('/candidate/documents');
        }

        db.run(
          `INSERT INTO documents
           (candidate_id, type, original_filename, stored_filename, mime_type, size, uploaded_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            profile.id,
            doc_type,
            req.file.originalname,
            req.file.filename,
            req.file.mimetype,
            req.file.size,
            now
          ],
          function (err2) {
            if (err2) {
              console.error(err2);
              req.flash('error', 'Error saving document.');
              return res.redirect('/candidate/documents');
            }
            req.flash('success', 'Document uploaded.');
            res.redirect('/candidate/documents');
          }
        );
      }
    );
  }
);

// Admin routes
app.get('/admin/candidates', requireAuth('admin'), (req, res) => {
  const sql = `
    SELECT cp.*, u.email
    FROM candidate_profiles cp
    JOIN users u ON cp.user_id = u.id
    ORDER BY cp.created_at DESC
  `;
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error(err);
      req.flash('error', 'Error loading candidates.');
      return res.redirect('/');
    }
    res.render('admin_candidates', { candidates: rows });
  });
});

app.get('/admin/candidates/:id', requireAuth('admin'), (req, res) => {
  const candidateId = req.params.id;

  db.get(
    `
    SELECT cp.*, u.email
    FROM candidate_profiles cp
    JOIN users u ON cp.user_id = u.id
    WHERE cp.id = ?
  `,
    [candidateId],
    (err, profile) => {
      if (err || !profile) {
        console.error(err);
        req.flash('error', 'Candidate not found.');
        return res.redirect('/admin/candidates');
      }

      db.all(
        'SELECT * FROM documents WHERE candidate_id = ? ORDER BY uploaded_at DESC',
        [candidateId],
        (err2, docs) => {
          if (err2) {
            console.error(err2);
            req.flash('error', 'Error loading documents.');
            return res.redirect('/admin/candidates');
          }
          res.render('admin_candidate_detail', {
            profile,
            documents: docs
          });
        }
      );
    }
  );
});

app.post('/admin/candidates/:id/verification', requireAuth('admin'), (req, res) => {
  const candidateId = req.params.id;
  const {
    verification_status,
    verification_level,
    risk_score,
    admin_notes
  } = req.body;
  const now = new Date().toISOString();

  db.run(
    `
    UPDATE candidate_profiles
    SET verification_status = ?, verification_level = ?, risk_score = ?, admin_notes = ?, last_reviewed_at = ?, updated_at = ?
    WHERE id = ?
  `,
    [
      verification_status,
      verification_level,
      parseInt(risk_score || '0', 10),
      admin_notes || null,
      now,
      now,
      candidateId
    ],
    function (err) {
      if (err) {
        console.error(err);
        req.flash('error', 'Error updating verification.');
        return res.redirect('/admin/candidates/' + candidateId);
      }
      req.flash('success', 'Verification updated.');
      res.redirect('/admin/candidates/' + candidateId);
    }
  );
});

// Employer routes (read-only view of verified candidates)
app.get('/employer/candidates', requireAuth('employer'), (req, res) => {
  const sql = `
    SELECT cp.id, cp.full_name, cp.headline, cp.primary_skills, cp.location,
           cp.total_experience_years, cp.verification_level, cp.risk_score
    FROM candidate_profiles cp
    WHERE cp.verification_status = 'verified'
    ORDER BY cp.verification_level DESC, cp.risk_score ASC
  `;
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error(err);
      req.flash('error', 'Error loading candidates.');
      return res.redirect('/');
    }
    res.render('employer_candidates', { candidates: rows });
  });
});

app.get('/employer/candidates/:id', requireAuth('employer'), (req, res) => {
  const candidateId = req.params.id;

  db.get(
    `
    SELECT cp.*, u.email
    FROM candidate_profiles cp
    JOIN users u ON cp.user_id = u.id
    WHERE cp.id = ? AND cp.verification_status = 'verified'
  `,
    [candidateId],
    (err, profile) => {
      if (err || !profile) {
        console.error(err);
        req.flash('error', 'Candidate not found or not verified.');
        return res.redirect('/employer/candidates');
      }

      // Employer sees profile, but not raw documents (privacy)
      res.render('employer_candidate_detail', { profile });
    }
  );
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
