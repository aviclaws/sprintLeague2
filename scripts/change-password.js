// scripts/change-password.js
// Usage: node scripts/change-password.js <username> <newPassword>
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

(async () => {
  try {
    const [, , usernameArg, newPass] = process.argv;
    if (!usernameArg || !newPass) {
      console.error("Usage: node scripts/change-password.js <username> <newPassword>");
      process.exit(1);
    }

    const username = String(usernameArg).trim();
    if (!username) {
      console.error("Username cannot be empty.");
      process.exit(1);
    }
    if (newPass.length < 1) {
      console.error("Password cannot be empty.");
      process.exit(1);
    }

    const usersPath = path.join(process.cwd(), "users.json");
    if (!fs.existsSync(usersPath)) {
      console.error(`users.json not found at: ${usersPath}`);
      process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(usersPath, "utf8"));
    if (!data || !Array.isArray(data.users)) {
      console.error("Invalid users.json format. Expected { \"users\": [...] }");
      process.exit(1);
    }

    const idx = data.users.findIndex(
      (u) => (u.username || "").toLowerCase() === username.toLowerCase()
    );
    if (idx < 0) {
      console.error(`User "${username}" not found. Existing users:`);
      console.error(data.users.map((u) => u.username).join(", "));
      process.exit(1);
    }

    const saltRounds = 10;
    const password_hash = await bcrypt.hash(newPass, saltRounds);

    // Update the user record
    const user = { ...data.users[idx] };
    delete user.password; // ensure no plaintext remains
    user.password_hash = password_hash;

    data.users[idx] = user;
    fs.writeFileSync(usersPath, JSON.stringify(data, null, 2));
    console.log(`Password updated for "${user.username}".`);
  } catch (err) {
    console.error("Error:", err?.message || err);
    process.exit(1);
  }
})();
