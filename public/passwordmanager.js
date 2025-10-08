// ==============================
// Principal credentials
// ==============================
const PRINCIPAL_USER = "principal";
const PRINCIPAL_PASS = "915439182997";

// ==============================
// Principal login
// ==============================
function loginPrincipal() {
  const user = document.getElementById("principalUser").value;
  const pass = document.getElementById("principalPass").value;
  const msg = document.getElementById("loginMsg");

  if (user === PRINCIPAL_USER && pass === PRINCIPAL_PASS) {
    msg.textContent = "Login successful ✅";
    document.getElementById("login-section").style.display = "none";
    document.getElementById("dashboard").style.display = "block";
    loadClasses(); // Load classes after successful login
  } else {
    msg.textContent = "Wrong username or password ❌";
  }
}

// ==============================
// Load classes into table
// ==============================
async function loadClasses() {
  try {
    const res = await fetch("/api/classes"); // Fetch all classes from server
    const classes = await res.json();
    const tbody = document.querySelector("#classTable tbody");
    tbody.innerHTML = ""; // Clear existing rows

    // Sort classes in school order: Nursery → LKG → UKG → 1st → ... → 10th
    const classOrder = ["Nursery","LKG","UKG","1st","2nd","3rd","4th","5th","6th","7th","8th","9th","10th"];
    classes.sort((a, b) => classOrder.indexOf(a.name) - classOrder.indexOf(b.name));

    // Create table rows for each class
    classes.forEach(cls => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${cls.name}</td>
        <td>${cls.password}</td>
        <td><input type="text" placeholder="New Password" id="new-${cls.name}"></td>
        <td><button onclick="resetPassword('${cls.name}')">Reset</button></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Failed to fetch classes", err);
    alert("Error loading classes. Check server.");
  }
}

// ==============================
// Reset password for a class
// ==============================
async function resetPassword(className) {
  const newPass = document.getElementById(`new-${className}`).value.trim();
  if (!newPass) return alert("Enter a new password!");

  try {
    const res = await fetch(`/api/classes/${className}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword: newPass })
    });

    const data = await res.json();
    if (data.error) return alert(`Error: ${data.error}`);
    alert(data.message);

    // Refresh the table to show updated password
    loadClasses();
  } catch (err) {
    console.error("Failed to reset password", err);
    alert("Error resetting password. Check server.");
  }
}
