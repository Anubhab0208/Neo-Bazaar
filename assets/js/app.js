document.addEventListener('DOMContentLoaded', () => {
  const productContainer = document.getElementById('productContainer');
  const loginBtn = document.getElementById('loginBtn');
  const modal = document.getElementById('modal');
  const closeModalBtn = document.getElementById('closeModal');
  const loginSubmit = document.getElementById('loginSubmit');
  const loginError = document.getElementById('loginError');
  const profileArea = document.getElementById('profileArea');
  const profileNameEl = document.getElementById('profileName');
  const logoutBtn = document.getElementById('logoutBtn');

  function openModal() {
    modal.classList.remove('hidden');
    loginError.classList.add('hidden');
    document.getElementById('email').focus();
  }
  function closeModal() {
    modal.classList.add('hidden');
  }

  function renderProduct(product) {
    const card = document.createElement('article');
    card.className = 'bg-white rounded-xl shadow-sm overflow-hidden group';
    const imgWrap = document.createElement('div');
    imgWrap.className = 'aspect-w-4 aspect-h-3 bg-gray-100 flex items-center justify-center text-gray-400';
    if (product.image) {
      const img = document.createElement('img');
      img.src = product.image;
      img.alt = product.name || 'product';
      img.className = 'object-cover w-full h-full';
      imgWrap.innerHTML = '';
      imgWrap.appendChild(img);
    } else {
      imgWrap.textContent = 'No image';
    }
    const body = document.createElement('div');
    body.className = 'p-4';
    const title = document.createElement('h3');
    title.className = 'font-medium text-gray-800';
    title.textContent = product.name || 'Unnamed product';
    const brand = document.createElement('p');
    brand.className = 'text-sm text-gray-500 mt-1';
    brand.textContent = product.brand || '';
    const row = document.createElement('div');
    row.className = 'mt-3 flex items-center justify-between';
    const price = document.createElement('div');
    price.className = 'text-lg font-semibold text-indigo-600';
    price.textContent = product.price != null ? `₹${product.price}` : '—';
    const addBtn = document.createElement('button');
    addBtn.className = 'px-3 py-1.5 bg-white border border-gray-200 rounded-md text-sm hover:bg-indigo-50';
    addBtn.textContent = 'Add';
    addBtn.addEventListener('click', () => {
      const key = 'neo_cart_count';
      const current = parseInt(localStorage.getItem(key) || '0', 10);
      localStorage.setItem(key, String(current + 1));
      addBtn.textContent = 'Added';
      setTimeout(() => addBtn.textContent = 'Add', 800);
    });
    row.appendChild(price);
    row.appendChild(addBtn);
    body.appendChild(title);
    body.appendChild(brand);
    body.appendChild(row);
    card.appendChild(imgWrap);
    card.appendChild(body);
    return card;
  }

  async function loadProducts() {
    productContainer.innerHTML = '<div class="col-span-full text-center text-gray-500">Loading products…</div>';
    try {
      const res = await fetch('/api/products');
      if (!res.ok) throw new Error('Network response not ok');
      const products = await res.json();
      productContainer.innerHTML = '';
      if (!Array.isArray(products) || products.length === 0) {
        productContainer.innerHTML = '<div class="col-span-full text-center text-gray-500">No products found.</div>';
        return;
      }
      products.forEach(p => productContainer.appendChild(renderProduct(p)));
    } catch (err) {
      console.error('Failed to load products', err);
      productContainer.innerHTML = '<div class="col-span-full text-center text-red-600">Failed to load products.</div>';
    }
  }

  function setUser(email) {
    localStorage.setItem('neo_user', JSON.stringify({ email }));
    updateAuthUI();
  }
  function clearUser() {
    localStorage.removeItem('neo_user');
    updateAuthUI();
  }
  function getUser() {
    try {
      return JSON.parse(localStorage.getItem('neo_user'));
    } catch {
      return null;
    }
  }

  function updateAuthUI() {
    const user = getUser();
    if (user && user.email) {
      profileNameEl.textContent = user.email;
      profileArea.classList.remove('hidden');
      loginBtn.classList.add('hidden');
    } else {
      profileArea.classList.add('hidden');
      loginBtn.classList.remove('hidden');
    }
  }

  async function submitLogin() {
    loginError.classList.add('hidden');
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    if (!email || !password) {
      loginError.textContent = 'Please enter email and password.';
      loginError.classList.remove('hidden');
      return;
    }
    try {
      const adminRes = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const adminData = await adminRes.json();
      if (adminData && adminData.success) {
        window.location.href = adminData.redirectUrl;
        return; 
      }
      const userRes = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const userData = await userRes.json();
      if (userData && userData.success) {
        setUser(userData.user.email || email);
        closeModal();
      } else {
        loginError.textContent = userData && userData.message ? userData.message : 'Invalid credentials';
        loginError.classList.remove('hidden');
      }
    } catch (err) {
      console.error('Login error', err);
      loginError.textContent = 'Network error during login';
      loginError.classList.remove('hidden');
    }
  }

  loginBtn.addEventListener('click', openModal);
  closeModalBtn.addEventListener('click', closeModal);
  loginSubmit.addEventListener('click', submitLogin);
  logoutBtn.addEventListener('click', clearUser);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  updateAuthUI();
  loadProducts();
});