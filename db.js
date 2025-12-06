
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('candidate', 'admin', 'employer')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // Candidate profiles table
  db.run(`
    CREATE TABLE IF NOT EXISTS candidate_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      full_name TEXT,
      dob TEXT,
      phone TEXT,
      location TEXT,
      headline TEXT,
      total_experience_years INTEGER,
      primary_skills TEXT,
      linkedin_url TEXT,
      github_url TEXT,
      verification_status TEXT NOT NULL DEFAULT 'unsubmitted',
      verification_level TEXT NOT NULL DEFAULT 'none',
      risk_score INTEGER NOT NULL DEFAULT 0,
      admin_notes TEXT,
      last_reviewed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // Documents table
  db.run(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      candidate_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      stored_filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      uploaded_at TEXT NOT NULL,
      FOREIGN KEY(candidate_id) REFERENCES candidate_profiles(id)
    )
  `);

  // Seed an admin user if none exists
  const bcrypt = require('bcryptjs');
  const now = new Date().toISOString();

  db.get("SELECT COUNT(*) as count FROM users WHERE role = 'admin'", [], (err, row) => {
    if (err) {
      console.error('Error checking admin user:', err);
      return;
    }
    if (row.count === 0) {
      const passwordHash = bcrypt.hashSync('admin123', 10);
      db.run(
        `INSERT INTO users (email, password_hash, role, created_at, updated_at)
         VALUES (?, ?, 'admin', ?, ?)`,
        ['admin@example.com', passwordHash, now, now],
        function (err2) {
          if (err2) {
            console.error('Error seeding admin user:', err2);
          } else {
            console.log('Seeded admin user: admin@example.com / admin123');
          }
        }
      );
    }
  });
});

module.exports = db;
