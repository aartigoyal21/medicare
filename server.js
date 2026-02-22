// ===============================
// MediCare+ FULL BACKEND (MERGED)
// ===============================

const express = require("express");
const mysql   = require("mysql2");
const cors    = require("cors");

const app = express();

// ───────── MIDDLEWARE ─────────
app.use(express.json());
app.use(cors());

// ───────── DATABASE ─────────
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "@xBJQVDLW45KJ",
  database: "medicare"
});

db.connect(err => {
  if (err) {
    console.error("❌ DB Connection Failed:", err.message);
    return;
  }
  console.log("✅ MySQL Connected!");
});


// ═════════════════════════════
// 🚨 EMERGENCY SYSTEM (YOUR)
// ═════════════════════════════

app.post("/emergency", (req, res) => {
  const { name, location } = req.body;

  db.query(
    "INSERT INTO emergency_requests (name, location) VALUES (?, ?)",
    [name, location],
    err => {
      if (err) return res.status(500).json({ message: "Error" });

      res.json({
        message: "🚑 Emergency request sent! Ambulance coming."
      });
    }
  );
});

app.get("/emergencies", (req, res) => {
  db.query(
    "SELECT * FROM emergency_requests ORDER BY id DESC",
    (err, result) => {
      if (err) return res.status(500).send("Error");
      res.json(result);
    }
  );
});


// ═════════════════════════════
// 🛏️ BEDS
// ═════════════════════════════

app.get("/api/beds", (req, res) => {
  db.query("SELECT * FROM beds", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const result = {};
    rows.forEach(r => {
      result[r.ward_type] = {
        total: r.total,
        available: r.available,
        occupied: r.occupied
      };
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
    err => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});


// ═════════════════════════════
// 📅 APPOINTMENTS
// ═════════════════════════════

app.get("/api/appointments", (req, res) => {
  db.query(
    "SELECT * FROM appointments ORDER BY date, time",
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.post("/api/appointments", (req, res) => {

  const { id, name, email, phone, department, doctor, date, time, reason } = req.body;

  db.query(
    "INSERT INTO appointments (id,name,email,phone,department,doctor,date,time,reason) VALUES (?,?,?,?,?,?,?,?,?)",
    [id, name, email, phone, department, doctor, date, time, reason],
    err => {

      if (err) return res.status(500).json({ error: err.message });

      db.query(
        "SELECT MAX(token_number) AS max_token FROM queue_tokens WHERE department=? AND DATE(created_at)=CURDATE()",
        [department],
        (err2, rows) => {

          const nextToken = (rows[0].max_token || 0) + 1;

          db.query(
            "INSERT INTO queue_tokens (token_number, patient_name, department) VALUES (?,?,?)",
            [nextToken, name, department]
          );

          res.json({ success: true, token_number: nextToken });
        }
      );
    }
  );
});

app.put("/api/appointments/:id/status", (req, res) => {
  db.query(
    "UPDATE appointments SET status=? WHERE id=?",
    [req.body.status, req.params.id],
    err => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});


// ═════════════════════════════
// 🔢 QUEUE
// ═════════════════════════════

app.get("/api/queue", (req, res) => {
  db.query(
    "SELECT * FROM queue_tokens WHERE DATE(created_at)=CURDATE() ORDER BY department, token_number",
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.put("/api/queue/serve/:token", (req, res) => {
  const t = req.params.token;

  db.query(
    "UPDATE queue_tokens SET status='done' WHERE token_number<?",
    [t]
  );

  db.query(
    "UPDATE queue_tokens SET status='serving' WHERE token_number=?",
    [t],
    err => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});


// ═════════════════════════════
// 💊 MEDICINES
// ═════════════════════════════

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

app.delete("/api/medicines/:id", (req, res) => {
  db.query(
    "DELETE FROM medicines WHERE id=?",
    [req.params.id],
    err => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});


// ═════════════════════════════
// 👨‍⚕️ DOCTORS (FRIEND FEATURE)
// ═════════════════════════════

app.get("/api/doctors", (req, res) => {
  db.query("SELECT * FROM doctors ORDER BY department,name",
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
});

app.post("/api/doctors", (req, res) => {

  const { name, department, specialization, qualification,
          phone, email, experience, availability, status } = req.body;

  db.query(
    `INSERT INTO doctors
     (name,department,specialization,qualification,phone,email,experience,availability,status)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [name, department, specialization, qualification, phone, email,
     experience || 0, availability, status || "active"],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: result.insertId });
    }
  );
});

app.delete("/api/doctors/:id", (req, res) => {
  db.query("DELETE FROM doctors WHERE id=?", [req.params.id],
    err => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
});


// ═════════════════════════════
// 🚀 SERVER START
// ═════════════════════════════

app.listen(3000, () => {
  console.log("🚀 MediCare+ Server running at http://localhost:3000");
});