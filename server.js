require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const bcrypt = require("bcrypt");
const cors = require("cors");
const multer = require("multer");

const app = express();

/* =========================
   MIDDLEWARE
========================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

/* Serve frontend files from the root directory */
app.use(express.static(__dirname));
app.use('/uploads', express.static('uploads'));

/* =========================
   FILE UPLOAD SETUP
========================= */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

/* =========================
   DATABASE CONNECTION
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

// ADMIN MODEL
const adminSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  password: String
}, { timestamps: true });

const Admin = mongoose.model("Admin", adminSchema);

// COMPLAINT MODEL
const complaintSchema = new mongoose.Schema({
  email: String,
  message: String
}, { timestamps: true });

const Complaint = mongoose.model("Complaint", complaintSchema);

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

// ADMIN LOGIN (Using .env credentials)
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
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json([]);
  }
});

// ADMIN ADD PRODUCT (Supports File Upload or URL)
app.post("/api/products", upload.single("image"), async (req, res) => {
  try {
    const { name, brand, price } = req.body;
    let image = req.body.image || "";

    if (req.file) {
      image = "/uploads/" + req.file.filename;
    }

    if (!name || !brand || !price || !image) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    await Product.create({
      name,
      brand,
      price: Number(price),
      image
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Error adding product:", err);
    res.status(500).json({ success: false });
  }
});

// ADMIN DELETE PRODUCT
app.delete("/api/products/:id", async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

/* =========================
   COMPLAINTS API
========================= */

// VIEW COMPLAINTS
app.get("/api/complaints", async (req, res) => {
  try {
    const data = await Complaint.find().sort({ createdAt: -1 });
    res.json(data);
  } catch (err) {
    res.status(500).json([]);
  }
});

// ADD COMPLAINT
app.post("/api/complaints", async (req, res) => {
  try {
    const { email, message } = req.body;
    if (!email || !message) {
      return res.status(400).json({ success: false });
    }
    await Complaint.create({ email, message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

/* =========================
   SERVER START
========================= */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});