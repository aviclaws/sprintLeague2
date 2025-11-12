// scripts/add-user.mjs
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";

const [,, username, password, role = "player", team] = process.argv;
if (!username || !password) {
  console.error("Usage: node scripts/add-user.mjs <username> <password> [role] [team]");
  process.exit(1);
}

const p = path.join(process.cwd(), "users.json");
const data = JSON.parse(fs.readFileSync(p, "utf8"));
if (data.users.find(u => u.username === username)) {
  console.error("User already exists");
  process.exit(1);
}
const password_hash = bcrypt.hashSync(password, 10);
const user = { username, password_hash, role };
if (team) user.team = team;
data.users.push(user);
fs.writeFileSync(p, JSON.stringify(data, null, 2));
console.log("Added:", user);
