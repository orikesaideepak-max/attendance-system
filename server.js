const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// ===== MongoDB Atlas Connection =====
const mongoURI = process.env.MONGO_URI || 
  "mongodb+srv://orikesaideepak_db_user:9154391829@cluster0.osh906u.mongodb.net/attendanceDB?retryWrites=true&w=majority";

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log("✅ Connected to MongoDB Atlas"))
  .catch(err => console.error("❌ MongoDB Atlas connection error:", err));

// ===== Schemas =====
const AttendanceSchema = new mongoose.Schema({
  date: Date,
  status: String,
  studentName: String,
  rollNumber: String,
});

const StudentSchema = new mongoose.Schema({
  rollNumber: String,
  name: String,
  phone: String,
  parent: String,
  address: String,
  attendance: [AttendanceSchema],
});

const ClassSchema = new mongoose.Schema({
  name: String,
  password: String,
  students: [StudentSchema],
});

// Explicit collection name
const ClassModel = mongoose.model("Class", ClassSchema, "classes");

// ===== Serve home.html at root =====
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/home.html"));
});

// ===== Initialize Classes =====
app.post("/api/init-classes", async (req, res) => {
  try {
    const classNames = [
      "Nursery", "LKG", "UKG",
      "1st", "2nd", "3rd", "4th", "5th",
      "6th", "7th", "8th", "9th", "10th"
    ];

    // Check existing classes
    const existingClasses = await ClassModel.find({}, "name");
    const existingNames = existingClasses.map(cls => cls.name);

    let inserted = 0;
    for (const name of classNames) {
      if (!existingNames.includes(name)) {
        await new ClassModel({
          name,
          password: "default123",
          students: []
        }).save();
        inserted++;
      }
    }

    if (inserted === 0) {
      return res.json({ message: "✅ Classes already initialized" });
    }

    res.json({ message: `✅ ${inserted} classes initialized successfully` });
  } catch (err) {
    console.error("❌ Error initializing classes:", err);
    res.status(500).json({ error: err.message || "Failed to initialize classes" });
  }
});

// ===== Get All Classes =====
app.get("/api/classes", async (req, res) => {
  try {
    const classes = await ClassModel.find();
    const classOrder = [
      "Nursery", "LKG", "UKG",
      "1st", "2nd", "3rd", "4th", "5th",
      "6th", "7th", "8th", "9th", "10th"
    ];
    classes.sort((a, b) => classOrder.indexOf(a.name) - classOrder.indexOf(b.name));

    res.json(classes);
  } catch (err) {
    console.error("❌ Error fetching classes:", err);
    res.status(500).json({ error: "Failed to fetch classes" });
  }
});

// ===== Reset Password =====
app.post("/api/classes/:className/reset-password", async (req, res) => {
  try {
    const { className } = req.params;
    const { newPassword } = req.body;

    const updatedClass = await ClassModel.findOneAndUpdate(
      { name: className },
      { password: newPassword },
      { new: true }
    );

    if (!updatedClass) {
      return res.status(404).json({ error: "Class not found" });
    }

    res.json({ message: `Password for ${className} updated ✅` });
  } catch (err) {
    console.error("❌ Error resetting password:", err);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

// ===== Teacher Login =====
app.post("/api/class-login", async (req, res) => {
  try {
    const { className, password } = req.body;
    const classData = await ClassModel.findOne({ name: className });

    if (!classData) return res.status(404).json({ error: "Class not found" });
    if (classData.password !== password) return res.status(401).json({ error: "Wrong password" });

    res.json({ message: "Login successful", class: classData });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// ===== Add Student =====
app.post("/api/classes/:className/add-student", async (req, res) => {
  try {
    const { className } = req.params;
    const { rollNumber, name, phone, parent, address } = req.body;

    const updatedClass = await ClassModel.findOneAndUpdate(
      { name: className },
      { $push: { students: { rollNumber, name, phone, parent, address, attendance: [] } } },
      { new: true }
    );

    res.json(updatedClass);
  } catch (err) {
    console.error("❌ Error adding student:", err);
    res.status(500).json({ error: "Failed to add student" });
  }
});

// ===== Mark Attendance =====
app.post("/api/classes/:className/mark-attendance", async (req, res) => {
  try {
    const { className } = req.params;
    const { rollNumber, status } = req.body;
    const today = new Date();

    const cls = await ClassModel.findOne({ name: className });
    if (!cls) return res.status(404).json({ error: "Class not found" });

    const student = cls.students.find(s => s.rollNumber === rollNumber);
    if (!student) return res.status(404).json({ error: "Student not found" });

    const todayStr = today.toISOString().split("T")[0];
    const existing = student.attendance.find(a => a.date.toISOString().split("T")[0] === todayStr);

    if (existing) existing.status = status;
    else student.attendance.push({ date: today, status, studentName: student.name, rollNumber });

    await cls.save();
    res.json(cls);
  } catch (err) {
    console.error("❌ Error marking attendance:", err);
    res.status(500).json({ error: "Failed to mark attendance" });
  }
});

// ===== Edit Attendance =====
app.put("/api/classes/:className/edit-attendance", async (req, res) => {
  try {
    const { className } = req.params;
    const { rollNumber, status } = req.body;
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    const cls = await ClassModel.findOne({ name: className });
    if (!cls) return res.status(404).json({ error: "Class not found" });

    const student = cls.students.find(s => s.rollNumber === rollNumber);
    if (!student) return res.status(404).json({ error: "Student not found" });

    const existing = student.attendance.find(a => a.date.toISOString().split("T")[0] === todayStr);
    if (existing) existing.status = status;
    else student.attendance.push({ date: today, status, studentName: student.name, rollNumber });

    await cls.save();
    res.json(cls);
  } catch (err) {
    console.error("❌ Error editing attendance:", err);
    res.status(500).json({ error: "Failed to edit attendance" });
  }
});

// ===== Delete Student =====
app.delete("/api/classes/:className/delete-student", async (req, res) => {
  try {
    const { className } = req.params;
    const { rollNumber } = req.body;

    const updatedClass = await ClassModel.findOneAndUpdate(
      { name: className },
      { $pull: { students: { rollNumber } } },
      { new: true }
    );

    res.json(updatedClass);
  } catch (err) {
    console.error("❌ Error deleting student:", err);
    res.status(500).json({ error: "Failed to delete student" });
  }
});

// ===== Start Server =====
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
