require("dotenv").config();

const jwt = require("jsonwebtoken");
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const bcrypt = require("bcrypt");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const https = require("https");
const dns = require('dns');

dns.setServers(['1.1.1.1','8.8.8.8']);

const app = express();
app.use(express.static(__dirname, {
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
}));

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
.then(async () => {
  console.log("MongoDB Connected");
  
  // Initialize admin if it doesn't exist
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const existingAdmin = await Admin.findOne({ email: process.env.ADMIN_EMAIL });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
      const admin = new Admin({ 
        email: process.env.ADMIN_EMAIL, 
        password: hashedPassword 
      });
      await admin.save();
      console.log("✅ Admin account created:", process.env.ADMIN_EMAIL);
    } else {
      console.log("✅ Admin account already exists");
    }
  }
})
.catch(err => console.log("DB Error:", err));

/* =========================
   MODELS
========================= */

// PRODUCT
const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  originalPrice: Number,
  discount: Number,
  brand: String,
  image: String,
  categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
  selectedSubcategories: [{ type: String }]  // Stores selected subcategory names per product
}, { timestamps: true });

const Product = mongoose.model("Product", productSchema);

// FEATURED PRODUCT
const featuredProductSchema = new mongoose.Schema({
  name: String,
  price: Number,
  originalPrice: Number,
  discount: Number,
  brand: String,
  image: String
}, { timestamps: true });

const FeaturedProduct = mongoose.model("FeaturedProduct", featuredProductSchema);

// CATEGORY
const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  subcategories: [{ type: String, trim: true }]
}, { timestamps: true });

const Category = mongoose.model("Category", categorySchema);

// USER
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  password: String,
  username: String   // ← add this
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
  message: String,
  resolved: { type: Boolean, default: false }
}, { timestamps: true });

const Complaint = mongoose.model("Complaint", complaintSchema);

/* =========================
   MIDDLEWARE
========================= */

// Admin authentication middleware
const adminAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ success: false, message: "No token" });
    }

    const parts = authHeader.split(" ");

if (parts.length !== 2 || parts[0] !== "Bearer") {
  return res.status(401).json({ 
    success: false, 
    message: "Invalid authorization format" 
  });
}

const token = parts[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "admin") {
      return res.status(403).json({ success: false, message: "Admins only" });
    }

    // Verify admin still exists in database
    const admin = await Admin.findById(decoded.id);
    if (!admin) {
      return res.status(403).json({ success: false, message: "Admin no longer exists" });
    }

    req.admin = decoded;
    next();

  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

/* =========================
   ROUTES
========================= */

// HOME
app.get("/", (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.sendFile(path.join(__dirname, "index.html"));
});
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "pages", "admin.html"));
});
app.get("/pages/:page", (req, res) => {
  const page = req.params.page;
  const validPages = ['admin', 'products', 'complaints', 'orders'];
  if (validPages.includes(page)) {
    res.sendFile(path.join(__dirname, "pages", page + ".html"));
  } else {
    res.status(404).send("Page not found");
  }
});

/* =========================
   AUTH
========================= */

// REGISTER
app.post("/api/register", async (req, res) => {
  try {
    const { email, password, username } = req.body;

    if (!email || !password || !username) {
      return res.status(400).json({ success: false, message: "All fields required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be 6+ characters" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = new User({ email, password: hashed, username });

    await user.save();

    res.json({ success: true, message: "User created", user: { email, username, id: user._id } });

  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }
    res.status(500).json({ success: false, message: "Registration failed" });
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
    user: { email: user.email, username: user.username, id: user._id }
  });
});
/* =========================
   ADMIN AUTH
========================= */
// ADMIN LOGIN ENDPOINT
app.post("/api/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.json({ success: false, message: "Admin not found" });
    }

    const match = await bcrypt.compare(password, admin.password);
    if (!match) {
      return res.json({ success: false, message: "Invalid password" });
    }

    const token = jwt.sign(
      { id: admin._id, email: admin.email, role: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({ success: true, token, redirectUrl: '/admin' });
  } catch (err) {
    console.error("Admin login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ADMIN VERIFY ENDPOINT (for checking if user is admin)
app.get("/api/admin/verify", adminAuth, async (req, res) => {
  res.json({ success: true, admin: req.admin });
});

/* =========================
   PRODUCTS
========================= */

// GET ALL PRODUCTS
app.get("/api/products", async (req, res) => {
  const products = await Product.find().populate('categories', 'name subcategories');
  res.json(products);
});

// ADMIN ADD PRODUCT
app.post("/api/products", adminAuth, async(req,res)=>{
  try{
    const {name,brand,price,image,originalPrice,discount,categories} = req.body;

    if(!name || !brand || !price || !image){
      return res.status(400).json({success:false, message: "Missing required fields"});
    }

    const product = await Product.create({
      name,
      brand,
      price:Number(price),
      image,
      originalPrice: originalPrice ? Number(originalPrice) : undefined,
      discount: discount ? Number(discount) : undefined,
      categories: categories || []
    });
    
    res.json({success:true, productId: product._id});

  }catch(err){
    console.error("Add product error:", err);
    res.status(500).json({success:false, message: "Server error"});
  }
});

// ADMIN DELETE PRODUCT
app.delete("/api/products/:id", adminAuth, async(req,res)=>{
  try{
    await Product.findByIdAndDelete(req.params.id);
    res.json({success:true});
  }catch{
    res.status(500).json({success:false});
  }
});

// GET FLASH PRODUCTS (discount >= 50%, from both regular and featured collections)
app.get("/api/products/flash", async (req, res) => {
  try {
    const [regular, featured] = await Promise.all([
      Product.find({ discount: { $gte: 50 } }).populate('categories', 'name subcategories'),
      FeaturedProduct.find({ discount: { $gte: 50 } })
    ]);
    const featuredTagged = featured.map(p => ({ ...p.toObject(), _isFeatured: true }));
    const all = [...featuredTagged, ...regular].sort((a, b) => (b.discount || 0) - (a.discount || 0));
    res.json(all);
  } catch (err) {
    res.status(500).json([]);
  }
});

// GET NEWEST PRODUCTS (latest 8 by createdAt)
app.get("/api/products/newest", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 }).limit(8);
    res.json(products);
  } catch {
    res.status(500).json([]);
  }
});

// UPDATE PRODUCT CATEGORIES (Admin only)
app.put("/api/products/:id/categories", adminAuth, async (req, res) => {
  try {
    const { categories, selectedSubcategories } = req.body;
    const updateData = { categories: categories || [] };
    if (selectedSubcategories !== undefined) {
      updateData.selectedSubcategories = selectedSubcategories;
    }
    await Product.findByIdAndUpdate(req.params.id, updateData);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================
   FEATURED PRODUCTS
========================= */

// GET ALL FEATURED PRODUCTS
app.get("/api/featured-products", async (req, res) => {
  try {
    const products = await FeaturedProduct.find().sort({ createdAt: -1 });
    res.json(products);
  } catch {
    res.status(500).json([]);
  }
});

// ADMIN ADD FEATURED PRODUCT
app.post("/api/featured-products", adminAuth, async (req, res) => {
  try {
    const { name, brand, price, image, originalPrice, discount } = req.body;
    if (!name || !brand || !price || !image) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Build the document; only include optional pricing fields when provided
    const doc = { name, brand, price: Number(price), image };
    if (originalPrice !== undefined && originalPrice !== '') doc.originalPrice = Number(originalPrice);
    if (discount      !== undefined && discount      !== '') doc.discount      = Math.max(0, Math.min(100, Number(discount)));

    await FeaturedProduct.create(doc);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ADMIN DELETE FEATURED PRODUCT
app.delete("/api/featured-products/:id", adminAuth, async (req, res) => {
  try {
    await FeaturedProduct.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false });
  }
});

/* =========================
   CATEGORIES
========================= */

// GET ALL CATEGORIES with their subcategories
app.get("/api/categories", async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE NEW CATEGORY (Admin only)
app.post("/api/categories", adminAuth, async (req, res) => {
  try {
    const { name, subcategories = [] } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: "Category name is required" });
    }
    
    const category = await Category.create({
      name: name.trim(),
      subcategories: subcategories.filter(s => s && s.trim()).map(s => s.trim())
    });
    
    res.json({ success: true, category });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: "Category already exists" });
    }
    res.status(500).json({ error: err.message });
  }
});

// ADD SUBCATEGORY TO EXISTING CATEGORY (Admin only)
app.post("/api/categories/:id/subcategories", adminAuth, async (req, res) => {
  try {
    const { subcategory } = req.body;
    
    if (!subcategory || subcategory.trim() === '') {
      return res.status(400).json({ error: "Subcategory name is required" });
    }
    
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { subcategories: subcategory.trim() } },
      { new: true }
    );
    
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }
    
    res.json({ success: true, category });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE CATEGORY (Admin only)
app.delete("/api/categories/:id", adminAuth, async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// REMOVE SUBCATEGORY FROM CATEGORY (Admin only)
app.delete("/api/categories/:id/subcategories/:subcategory", adminAuth, async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { $pull: { subcategories: req.params.subcategory } },
      { new: true }
    );
    
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }
    
    res.json({ success: true, category });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   COMPLAINTS
========================= */
//View complaints
app.get("/api/complaints", adminAuth, async(req,res)=>{
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
app.put("/api/complaints/:id/resolve", adminAuth, async (req, res) => {
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
app.delete("/api/complaints/:id", adminAuth, async (req, res) => {
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
  location: String,
  contactNumber: String,
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

// GET ALL ORDERS (ADMIN ONLY)
app.get("/api/orders", adminAuth, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// UPDATE ORDER STATUS (ADMIN ONLY)
app.put("/api/orders/:id/status", adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE ORDER (ADMIN ONLY)
app.delete("/api/orders/:id", adminAuth, async (req, res) => {
  try {
    await Order.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET ORDER BY ID (PUBLIC - for users to check status)
app.get("/api/orders/:id", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET ORDERS BY USER EMAIL (PUBLIC - for users to view their orders)
app.get("/api/orders/user/:email", async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);
    const orders = await Order.find({ "user.email": email }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
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