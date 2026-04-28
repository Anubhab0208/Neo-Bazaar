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

// Serve static frontend
app.use(express.static(__dirname));

/* =========================
   DATABASE CONNECTION
========================= */
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log("DB Error:", err));


/* =========================
   MODELS
========================= */

// Product Model
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  brand: String,
  image: String
}, { timestamps: true });

const Product = mongoose.model("Product", productSchema);


// User Model
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  password: String
}, { timestamps: true });

const User = mongoose.model("User", userSchema);


/* =========================
   ROUTES
========================= */

// Home route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});


/* ---------- AUTH ---------- */

// Register
app.post("/api/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      email,
      password: hashedPassword
    });

    await user.save();

    res.json({ success: true, message: "User registered" });

  } catch (err) {
    res.json({ success: false, message: "User already exists" });
  }
});


// Login
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    return res.json({ success: false, message: "User not found" });
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (isMatch) {
    res.json({ success: true, user: { email: user.email } });
  } else {
    res.json({ success: false, message: "Invalid password" });
  }
});


/* ---------- PRODUCTS ---------- */

// Get all products
app.get("/api/products", async (req, res) => {
  const products = await Product.find();
  res.json(products);
});


// Add product
app.post("/api/products", async (req, res) => {
  const { name, price, brand, image } = req.body;

  const product = new Product({
    name,
    price,
    brand,
    image
  });

  await product.save();

  res.json({ success: true, message: "Product added" });
});


/* =========================
   SERVER START
========================= */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});