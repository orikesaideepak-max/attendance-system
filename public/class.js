let currentClass = null;

// ===== Load class options (Teacher login dropdown) =====
async function loadClassOptions() {
  try {
    const res = await fetch("/api/classes");
    const data = await res.json();

    // Ensure we always have an array
    const classes = Array.isArray(data) ? data : data.classes || [];
    
    const select = document.getElementById("classSelect");
    select.innerHTML = "";

    if (classes.length === 0) {
      select.innerHTML = `<option disabled>No classes found</option>`;
      console.warn("No classes returned from API.");
      return;
    }

    classes.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.name;
      opt.textContent = c.name;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error("Failed to load classes", err);
    const select = document.getElementById("classSelect");
    select.innerHTML = `<option disabled>Error loading classes</option>`;
  }
}

// Call after DOM is loaded
document.addEventListener("DOMContentLoaded", loadClassOptions);

// ===== Teacher login =====
async function loginTeacher() {
  const className = document.getElementById("classSelect").value;
  const password = document.getElementById("classPass").value;
  const loginMsg = document.getElementById("loginMsg");

  try {
    const res = await fetch("/api/class-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ className, password }),
    });
    const data = await res.json();
    if (data.error) return (loginMsg.textContent = data.error);

    currentClass = data.class;
    document.getElementById("login-section").style.display = "none";
    document.getElementById("dashboard").style.display = "block";
    renderStudents();
  } catch (err) {
    console.error("Login failed", err);
    loginMsg.textContent = "Login failed. Check server.";
  }
}

// ===== Helper: format date as YYYY-MM-DD =====
function formatDate(date) {
  return date.toISOString().split("T")[0];
}

// ===== Render students table =====
function renderStudents() {
  const tbody = document.querySelector("#studentsTable tbody");
  tbody.innerHTML = "";
  const todayStr = formatDate(new Date());

  if (!currentClass?.students) return;

  currentClass.students.forEach((s) => {
    const totalDays = s.attendance ? s.attendance.length : 0;
    const presentDays = s.attendance
      ? s.attendance.filter((a) => a.status === "Present").length
      : 0;
    const percentage =
      totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(1) : "0";

    const todayAttendance = s.attendance?.find(
      (a) => formatDate(new Date(a.date)) === todayStr
    );

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${s.rollNumber}</td>
      <td>${s.name}</td>
      <td>${s.phone}</td>
      <td>${s.parent || "-"}</td>
      <td>${s.address || "-"}</td>
      <td>${percentage}%</td>
      <td>
        ${
          todayAttendance
            ? `<span>${todayAttendance.status}</span>
               <button onclick="editAttendance('${s.rollNumber}', this)">✏️ Edit</button>`
            : `<button onclick="markAttendance('${s.rollNumber}','Present')">✅ P</button>
               <button onclick="markAttendance('${s.rollNumber}','Absent')">❌ A</button>`
        }
        <button onclick="showHistory('${s.rollNumber}')">📖 History</button>
        <button onclick="deleteStudent('${s.rollNumber}')">🗑️ Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ===== Add student =====
async function addStudent() {
  const rollNumber = document.getElementById("studentRoll").value.trim();
  const name = document.getElementById("studentName").value.trim();
  let phone = document.getElementById("studentPhone").value.trim();
  const parent = document.getElementById("studentParent").value.trim();
  const address = document.getElementById("studentAddress").value.trim();

  if (!rollNumber || !name || !phone) {
    return alert("Roll Number, Name, and Phone are required!");
  }

  phone = phone.replace(/\D/g, "");
  if (!phone.startsWith("91")) phone = "91" + phone;

  try {
    const res = await fetch(`/api/classes/${currentClass.name}/add-student`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rollNumber, name, phone, parent, address }),
    });
    currentClass = await res.json();
    renderStudents();

    // Clear input fields
    document.getElementById("studentRoll").value = "";
    document.getElementById("studentName").value = "";
    document.getElementById("studentPhone").value = "";
    document.getElementById("studentParent").value = "";
    document.getElementById("studentAddress").value = "";
  } catch (err) {
    console.error("Failed to add student", err);
  }
}

// ===== Mark attendance =====
async function markAttendance(roll, status) {
  try {
    const todayStr = formatDate(new Date());
    const student = currentClass.students.find((s) => s.rollNumber === roll);

    if (student.attendance?.some((a) => formatDate(new Date(a.date)) === todayStr)) {
      return alert("Attendance already marked today! Use Edit if needed.");
    }

    const res = await fetch(`/api/classes/${currentClass.name}/mark-attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rollNumber: roll, status }),
    });
    currentClass = await res.json();
    renderStudents();

    if (status === "Absent") sendAbsentWhatsApp(student, todayStr);
  } catch (err) {
    console.error("Failed to mark attendance", err);
  }
}

// ===== Edit attendance =====
function editAttendance(roll, btn) {
  const td = btn.parentElement;
  td.innerHTML = `
    <button onclick="updateAttendance('${roll}', 'Present')">✅ P</button>
    <button onclick="updateAttendance('${roll}', 'Absent')">❌ A</button>
  `;
}

// ===== Update attendance =====
async function updateAttendance(roll, status) {
  try {
    const student = currentClass.students.find((s) => s.rollNumber === roll);
    const res = await fetch(`/api/classes/${currentClass.name}/edit-attendance`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rollNumber: roll, status }),
    });
    currentClass = await res.json();
    renderStudents();

    if (status === "Absent") sendAbsentWhatsApp(student, formatDate(new Date()));
  } catch (err) {
    console.error("Failed to update attendance", err);
  }
}

// ===== WhatsApp message for absence =====
function sendAbsentWhatsApp(student, date) {
  const message = `Dear Parent,

This is to inform you that your child ${student.name} (Roll No: ${student.rollNumber}) was marked ABSENT on ${date}.

Regards,
Vision School`;

  let phone = student.phone.replace(/\D/g, "");
  if (!phone.startsWith("91")) phone = "91" + phone;

  const waLink = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  window.open(waLink, "_blank");
}

// ===== Show Attendance History =====
function showHistory(roll) {
  const student = currentClass.students.find((s) => s.rollNumber === roll);
  if (!student) return;

  const historyBody = document.getElementById("historyBody");
  historyBody.innerHTML = "";

  if (student.attendance && student.attendance.length > 0) {
    student.attendance.forEach((a) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td style="color:black">${new Date(a.date).toLocaleDateString()}</td><td>${a.status}</td>`;
      historyBody.appendChild(tr);
    });
  } else {
    historyBody.innerHTML = `<tr><td colspan="2">No records</td></tr>`;
  }

  document.getElementById("historyTitle").textContent = `Attendance History - ${student.name}`;
  document.getElementById("historyModal").style.display = "block";
}

// ===== Close modal =====
function closeHistory() {
  document.getElementById("historyModal").style.display = "none";
}

// ===== Delete student =====
async function deleteStudent(roll) {
  if (!confirm("Are you sure you want to delete this student?")) return;

  try {
    const res = await fetch(`/api/classes/${currentClass.name}/delete-student`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rollNumber: roll }),
    });
    currentClass = await res.json();
    renderStudents();
  } catch (err) {
    console.error("Failed to delete student", err);
  }
}
