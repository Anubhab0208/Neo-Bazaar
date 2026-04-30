require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const bcrypt = require("bcrypt");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const https = require("https");

const app = express();
app.use(express.static(__dirname));

/* =========================
   MIDDLEWARE
========================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Log all requests for debugging (BEFORE static middleware)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

/* Serve frontend */
app.use(express.static(__dirname));
app.use('/uploads', express.static('uploads'));

/* =========================
   FILE UPLOAD
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
   DATABASE
========================= */
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log("DB Error:", err));

/* =========================
   MODELS
========================= */

// PRODUCT
const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  brand: String,
  image: String
}, { timestamps: true });

const Product = mongoose.model("Product", productSchema);

// USER
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  password: String
}, { timestamps: true });

const User = mongoose.model("User", userSchema);

// ADMIN
const adminSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  password: String
}, { timestamps: true });

const Admin = mongoose.model("Admin", adminSchema);

// COMPLAINT
const complaintSchema = new mongoose.Schema({
  email: String,
  message: String
}, { timestamps: true });

const Complaint = mongoose.model("Complaint", complaintSchema);

/* =========================
   MIDDLEWARE
========================= */

// Admin authentication middleware
const adminAuth = (req, res, next) => {
  const adminKey = req.headers['admin-key'] || req.body.adminKey;
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  next();
};

/* =========================
   ROUTES
========================= */

// HOME
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "pages", "admin.html"));
});

/* =========================
   AUTH
========================= */

// REGISTER
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

// LOGIN
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
   ADMIN AUTH
========================= */

// ADMIN REGISTER (run once manually if needed)
app.post("/api/admin/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    const exists = await Admin.findOne({ email });

    if (exists) {
      return res.json({
        success: false,
        message: "Admin already exists"
      });
    }

    const hashed = await bcrypt.hash(password, 10);

    await Admin.create({
      email,
      password: hashed
    });

    res.json({
      success: true,
      message: "Admin created"
    });

  } catch {
    res.json({
      success: false,
      message: "Admin creation failed"
    });
  }
});

// ADMIN LOGIN
app.post("/api/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email });

    if (!admin) {
      return res.json({
        success: false,
        message: "Admin not found"
      });
    }

    const match = await bcrypt.compare(password, admin.password);

    if (!match) {
      return res.json({
        success: false,
        message: "Wrong password"
      });
    }

    res.json({
      success: true,
      admin: { email: admin.email }
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Login failed"
    });
  }
});

/* =========================
   PRODUCTS
========================= */

// GET ALL PRODUCTS
app.get("/api/products", async (req, res) => {
  const products = await Product.find();
  res.json(products);
});

// ADMIN ADD PRODUCT
app.post("/api/products", async(req,res)=>{
  console.log("POST /api/products received");
  console.log("Body:", req.body);
  try{
    const {name,brand,price,image} = req.body;

    if(!name || !brand || !price || !image){
      console.log("Missing fields - name:", name, "brand:", brand, "price:", price, "image:", image);
      return res.status(400).json({success:false, message: "Missing required fields"});
    }

    const product = await Product.create({
      name,
      brand,
      price:Number(price),
      image
    });
    
    console.log("Product created:", product._id);
    res.json({success:true});

  }catch(err){
    console.error("Add product error:", err);
    res.status(500).json({success:false, message: "Server error"});
  }
});

// ADMIN DELETE PRODUCT
app.delete("/api/products/:id", async(req,res)=>{
  try{
    await Product.findByIdAndDelete(req.params.id);
    res.json({success:true});
  }catch{
    res.status(500).json({success:false});
  }
});
/* =========================
   COMPLAINTS
========================= */
//View complaints
app.get("/api/complaints", async(req,res)=>{
  try{
    const data = await Complaint.find().sort({createdAt:-1});
    res.json(data);
  }catch{
    res.status(500).json([]);
  }
});


// ADD COMPLAINT
app.post("/api/complaints", async(req,res)=>{
  try{
    const {email,message} = req.body;

    if(!email || !message){
      return res.status(400).json({success:false});
    }

    await Complaint.create({email,message});

    res.json({success:true});
  }catch{
    res.status(500).json({success:false});
  }
});
// Resolve complaint
app.put("/api/complaints/:id/resolve", async (req, res) => {
  try {
    await Complaint.findByIdAndUpdate(req.params.id, {
      resolved: true
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// Delete complaint
app.delete("/api/complaints/:id", async (req, res) => {
  try {
    await Complaint.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});
/* =========================
   ORDERS (UPDATED)
========================= */
const orderSchema = new mongoose.Schema({
  user: mongoose.Schema.Types.Mixed,
  items: mongoose.Schema.Types.Mixed,
  subtotal: Number,
  discount: Number,
  gst: Number,
  total: Number,
  paymentMethod: String,
  status: { type: String, default: "Placed" }
}, { timestamps: true, strict: false }); // strict: false allows extra fields

const Order = mongoose.model("Order", orderSchema);

app.post("/api/orders", async (req, res) => {
  console.log("📦 Order Received:", req.body); // Check your terminal for this!
  try {
    const order = await Order.create(req.body);
    console.log("✅ Order Saved ID:", order._id);
    res.json({ success: true, orderId: order._id });
  } catch (err) {
    console.error("❌ MongoDB Save Error:", err);
    res.status(500).json({ 
      success: false, 
      error: "Order failed", 
      details: err.message 
    });
  }
});
/* =========================
   GOOGLE DRIVE
========================= */

// Get Google Drive configuration
app.get("/api/drive-config", (req, res) => {
  res.json({
    accessToken: process.env.GOOGLE_DRIVE_TOKEN || "",
    message: process.env.GOOGLE_DRIVE_TOKEN ? "Ready" : "Google Drive not configured"
  });
});

// Download file from Google Drive and save locally
app.post("/api/drive-upload", async (req, res) => {
  try {
    const { fileId, fileName } = req.body;

    if (!fileId || !fileName) {
      return res.status(400).json({ success: false, message: "Missing fileId or fileName" });
    }

    const driveToken = process.env.GOOGLE_DRIVE_TOKEN;
    if (!driveToken) {
      return res.status(400).json({ success: false, message: "Google Drive not configured" });
    }

    // Download file from Google Drive
    const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&access_token=${driveToken}`;
    
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(fileName) || '.jpg';
    const localFileName = uniqueSuffix + ext;
    const filePath = path.join('uploads', localFileName);

    // Ensure uploads directory exists
    if (!fs.existsSync('uploads')) {
      fs.mkdirSync('uploads', { recursive: true });
    }

    // Download and save the file
    const file = fs.createWriteStream(filePath);
    
    https.get(driveUrl, (response) => {
      if (response.statusCode !== 200) {
        fs.unlink(filePath, () => {}); // Delete empty file
        return res.status(400).json({ success: false, message: "Failed to download from Google Drive" });
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        const imageUrl = `/uploads/${localFileName}`;
        res.json({ success: true, imageUrl });
      });

      file.on('error', (err) => {
        file.close();
        fs.unlink(filePath, () => {}); // Delete file on error
        res.status(500).json({ success: false, message: "File download error" });
      });
    }).on('error', (err) => {
      fs.unlink(filePath, () => {}); // Delete file on error
      res.status(500).json({ success: false, message: "Network error" });
    });

  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* =========================
   ERROR HANDLER
========================= */
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ success: false, message: 'Server error' });
});

/* =========================
   SERVER START
========================= */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});