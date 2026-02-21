// server.js — MediCare+ Full Backend
const express = require("express");
const mysql   = require("mysql2");
const app     = express();

app.use(express.json());
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// ── DATABASE ──
const db = mysql.createConnection({
  host:     "localhost",
  user:     "root",
  password: "@xBJQVDLW45KJ",   // ← your password, keep as is
  database: "medicare"
});

db.connect(err => {
  if (err) { console.error("❌ DB Connection Failed:", err.message); return; }
  console.log("✅ MySQL Connected!");
});

// ══════════════════════════════════════
//  BEDS
// ══════════════════════════════════════
app.get("/api/beds", (req, res) => {
  db.query("SELECT * FROM beds", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const result = {};
    rows.forEach(r => {
      result[r.ward_type] = { total: r.total, available: r.available, occupied: r.occupied };
    });
    res.json(result);
  });
});

app.put("/api/beds/:ward", (req, res) => {
  const { ward } = req.params;
  const { total, available, occupied } = req.body;
  db.query(
    "UPDATE beds SET total=?, available=?, occupied=? WHERE ward_type=?",
    [total, available, occupied, ward],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

// ══════════════════════════════════════
//  APPOINTMENTS
//  Booking auto-issues a per-department
//  queue token and returns it
// ══════════════════════════════════════
app.get("/api/appointments", (req, res) => {
  db.query("SELECT * FROM appointments ORDER BY date, time", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post("/api/appointments", (req, res) => {
  const { id, name, email, phone, department, doctor, date, time, reason } = req.body;

  // 1 — Save appointment
  db.query(
    "INSERT INTO appointments (id,name,email,phone,department,doctor,date,time,reason) VALUES (?,?,?,?,?,?,?,?,?)",
    [id, name, email, phone, department, doctor, date, time, reason],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });

      // 2 — Issue per-department token (each dept counts from 1 independently)
      db.query(
        "SELECT MAX(token_number) AS max_token FROM queue_tokens WHERE department=? AND DATE(created_at)=CURDATE()",
        [department],
        (err2, rows) => {
          if (err2) return res.json({ success: true, token_number: null });

          const nextToken = (rows[0].max_token || 0) + 1;
          db.query(
            "INSERT INTO queue_tokens (token_number, patient_name, department) VALUES (?,?,?)",
            [nextToken, name, department],
            (err3) => {
              if (err3) return res.json({ success: true, token_number: null });
              // Return token so frontend can show confirmation popup
              res.json({ success: true, token_number: nextToken, department });
            }
          );
        }
      );
    }
  );
});

app.put("/api/appointments/:id/status", (req, res) => {
  const { status } = req.body;
  db.query(
    "UPDATE appointments SET status=? WHERE id=?",
    [status, req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

app.delete("/api/appointments/:id", (req, res) => {
  db.query(
    "UPDATE appointments SET status='cancelled' WHERE id=?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

// ══════════════════════════════════════
//  QUEUE
//  GET /api/queue?department=X  → dept queue
//  GET /api/queue               → all (doctor panel)
//  GET /api/queue/summary       → per-dept stats
// ══════════════════════════════════════
app.get("/api/queue/summary", (req, res) => {
  db.query(
    `SELECT
       department,
       MAX(CASE WHEN status='serving' THEN token_number END) AS now_serving,
       COUNT(CASE WHEN status='waiting' THEN 1 END)           AS waiting_count,
       COUNT(CASE WHEN status='done'    THEN 1 END)           AS done_count,
       COUNT(*)                                               AS total_count
     FROM queue_tokens
     WHERE DATE(created_at)=CURDATE()
     GROUP BY department`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.get("/api/queue", (req, res) => {
  const { department } = req.query;
  if (department) {
    db.query(
      "SELECT * FROM queue_tokens WHERE department=? AND DATE(created_at)=CURDATE() ORDER BY token_number",
      [department],
      (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
      }
    );
  } else {
    db.query(
      "SELECT * FROM queue_tokens WHERE DATE(created_at)=CURDATE() ORDER BY department, token_number",
      (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
      }
    );
  }
});

// Manual token issue (doctor panel)
app.post("/api/queue", (req, res) => {
  const { patient_name, department } = req.body;
  db.query(
    "SELECT MAX(token_number) AS max_token FROM queue_tokens WHERE department=? AND DATE(created_at)=CURDATE()",
    [department],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const nextToken = (rows[0].max_token || 0) + 1;
      db.query(
        "INSERT INTO queue_tokens (token_number, patient_name, department) VALUES (?,?,?)",
        [nextToken, patient_name, department],
        (err2) => {
          if (err2) return res.status(500).json({ error: err2.message });
          res.json({ success: true, token_number: nextToken });
        }
      );
    }
  );
});

// Doctor calls token to serve — scoped to department
app.put("/api/queue/serve/:token", (req, res) => {
  const t    = req.params.token;
  const dept = req.body.department;
  if (dept) {
    db.query("UPDATE queue_tokens SET status='done'    WHERE token_number<? AND department=? AND DATE(created_at)=CURDATE()", [t, dept]);
    db.query("UPDATE queue_tokens SET status='serving' WHERE token_number=? AND department=? AND DATE(created_at)=CURDATE()", [t, dept],
      (err) => { if (err) return res.status(500).json({ error: err.message }); res.json({ success: true }); });
  } else {
    db.query("UPDATE queue_tokens SET status='done'    WHERE token_number<? AND DATE(created_at)=CURDATE()", [t]);
    db.query("UPDATE queue_tokens SET status='serving' WHERE token_number=? AND DATE(created_at)=CURDATE()", [t],
      (err) => { if (err) return res.status(500).json({ error: err.message }); res.json({ success: true }); });
  }
});

app.put("/api/queue/done/:token", (req, res) => {
  const t    = req.params.token;
  const dept = req.body.department;
  const sql  = dept
    ? "UPDATE queue_tokens SET status='done' WHERE token_number=? AND department=? AND DATE(created_at)=CURDATE()"
    : "UPDATE queue_tokens SET status='done' WHERE token_number=? AND DATE(created_at)=CURDATE()";
  db.query(sql, dept ? [t, dept] : [t], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ══════════════════════════════════════
//  MEDICINES
// ══════════════════════════════════════
app.get("/api/medicines", (req, res) => {
  db.query("SELECT * FROM medicines", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post("/api/medicines", (req, res) => {
  const { disease, medicine, purpose, stock_status, hindi_info } = req.body;
  db.query(
    "INSERT INTO medicines (disease, medicine, purpose, stock_status, hindi_info) VALUES (?,?,?,?,?)",
    [disease, medicine, purpose, stock_status, hindi_info],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: result.insertId });
    }
  );
});

app.put("/api/medicines/:id", (req, res) => {
  const { disease, medicine, purpose, stock_status, hindi_info } = req.body;
  db.query(
    "UPDATE medicines SET disease=?, medicine=?, purpose=?, stock_status=?, hindi_info=? WHERE id=?",
    [disease, medicine, purpose, stock_status, hindi_info, req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

app.delete("/api/medicines/:id", (req, res) => {
  db.query("DELETE FROM medicines WHERE id=?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ══════════════════════════════════════
//  START
// ══════════════════════════════════════
app.listen(3000, () => {
  console.log("🚀 MediCare+ Server running at http://localhost:3000");
});
