require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const bcrypt = require("bcrypt");
const cors = require("cors");

const app = express();

/* =========================
   MIDDLEWARE
========================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

/* Serve frontend files from the root directory */
app.use(express.static(__dirname));

/* =========================
   DATABASE
========================= */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("❌ DB Error:", err));

/* =========================
   MODELS
========================= */

// PRODUCT MODEL
const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  brand: String,
  image: String
}, { timestamps: true });

const Product = mongoose.model("Product", productSchema);

// USER MODEL (For regular customers)
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  password: String
}, { timestamps: true });

const User = mongoose.model("User", userSchema);

/* =========================
   PAGE ROUTES
========================= */

// Home/Login Page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Admin Dashboard Page
app.get("/admin-dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "admin-dashboard.html"));
});

/* =========================
   AUTHENTICATION API
========================= */

/**
 * NEW: ADMIN LOGIN
 * This route checks credentials against your .env file
 */
app.post("/api/admin/login", (req, res) => {
  const { email, password } = req.body;

  const envAdminEmail = process.env.ADMIN_EMAIL;
  const envAdminPassword = process.env.ADMIN_PASSWORD;

  if (email === envAdminEmail && password === envAdminPassword) {
    console.log("Admin logged in successfully");
    res.json({ 
      success: true, 
      message: "Admin Access Granted",
      redirectUrl: "/admin-dashboard" 
    });
  } else {
    res.status(401).json({ 
      success: false, 
      message: "Invalid Admin Credentials" 
    });
  }
});

// REGULAR USER REGISTER
app.post("/api/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashed });
    await user.save();
    res.json({ success: true, message: "User created" });
  } catch (err) {
    res.json({ success: false, message: "User exists or error" });
  }
});

// REGULAR USER LOGIN
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (!user) {
    return res.json({ success: false, message: "User not found" });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.json({ success: false, message: "Wrong password" });
  }

  res.json({
    success: true,
    user: { email: user.email }
  });
});

/* =========================
   PRODUCTS API
========================= */

// GET ALL PRODUCTS
app.get("/api/products", async (req, res) => {
  const products = await Product.find();
  res.json(products);
});

// ADD PRODUCT
app.post("/api/products", async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.json({ success: true, message: "Product added" });
  } catch (err) {
    res.json({ success: false });
  }
});

/* =========================
   SERVER START
========================= */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});