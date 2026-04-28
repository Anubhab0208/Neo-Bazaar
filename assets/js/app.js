
/* =========================
   AUTH
========================= */

const loginBtn = document.getElementById("loginBtn");
const profileArea = document.getElementById("profileArea");
const profileName = document.getElementById("profileName");

/* ---------- MODAL ---------- */
function openModal() {
  document.getElementById("modal").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
}

/* ---------- LOGIN ---------- */
async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();

  if (data.success) {
    loginBtn.classList.add("hidden");
    profileArea.classList.remove("hidden");
    profileName.innerText = data.user.email;

    closeModal();
  } else {
    alert(data.message);
  }
}

/* ---------- LOGOUT ---------- */
function logout() {
  loginBtn.classList.remove("hidden");
  profileArea.classList.add("hidden");
}


/* =========================
   PRODUCTS
========================= */

const container = document.getElementById("productContainer");

async function loadProducts() {
  const res = await fetch("/api/products");
  const products = await res.json();

  container.innerHTML = "";

  products.forEach(p => {
    container.innerHTML += `
      <div class="bg-white p-4 rounded shadow">
        <img src="${p.image}" class="h-40 w-full object-cover mb-2"/>
        <h3 class="font-semibold">${p.name}</h3>
        <p class="text-gray-500">${p.brand}</p>
        <div class="flex justify-between mt-2">
          <span class="text-indigo-600 font-bold">₹${p.price}</span>
          <button onclick="addToCart()" class="border px-2 py-1 rounded">
            Add
          </button>
        </div>
      </div>
    `;
  });
}


/* =========================
   CART (simple demo)
========================= */
let cart = 0;

function addToCart() {
  cart++;
  alert("Cart items: " + cart);
}


/* =========================
   INIT
========================= */
loadProducts();