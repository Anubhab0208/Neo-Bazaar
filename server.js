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

/* =========================
   PRODUCTS
========================= */

// GET ALL PRODUCTS
app.get("/api/products", async (req, res) => {
  const products = await Product.find();
  res.json(products);
});

// ADMIN ADD PRODUCT
app.post(
  "/api/products",
  upload.single("image"),
  async(req,res)=>{
    try{
      const {name,brand,price} = req.body;

      let image = req.body.image || "";

      if(req.file){
        image = "/uploads/" + req.file.filename;
      }

      if(!name || !brand || !price || !image){
        return res.status(400).json({success:false});
      }

      await Product.create({
        name,
        brand,
        price:Number(price),
        image
      });

      res.json({success:true});

    }catch(err){
      res.status(500).json({success:false});
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
/* =========================
   SERVER START
========================= */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});