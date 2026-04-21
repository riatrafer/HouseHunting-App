const app = document.getElementById("app");
const dashboardBtn = document.getElementById("dashboardBtn");


const state = {
  houses: [],
  landlordProperties: [],
  landlordNotifications: [],
  landlordNotificationFilter: "all",
  currentScreen: "login",
  selectedHouseId: null,
  selectedPurpose: null,
  selectedLocation: "all",
  isLoggedIn: false,
  role: null,
  authToken: null,
  landlordProfile: null,
  tenantProfile: null,
  isBusy: false,
  busyText: "",
  appointmentRequests: [],
  chats: {},
  browseOrigin: "menu",
  servicesSidebarHouseId: null,
  faqOpen: false,
  pendingLandlordRequests: [],
  landlordOnboarding: null,
};

const STARS_OUT_OF_5 = 5;
let toastTimer = null;
let feedbackTimer = null;
const landingImages = {
  manageProperty: "assets/landing/location.png",
  earnWithEase: "assets/landing/money.png",
  ecosystem: "assets/landing/laptop.png",
  process: "assets/landing/diamond.png",
};

const purposeLabelMap = {
  rent: "Rent",
  buy: "Buy",
  lease: "Lease",
  airbnb: "Airbnb",
};

const serviceProviders = [
  { type: "Groceries", name: "Fresh Basket Groceries", email: "hello@freshbasket.example", location: "Kilimani" },
  { type: "Gas Supply", name: "BlueFlame Gas Center", email: "orders@blueflame.example", location: "Westlands" },
  { type: "Furniture", name: "Urban Nest Furniture", email: "sales@urbannest.example", location: "Ruaka" },
  { type: "Hotels", name: "Luxe Stay Hotel", email: "desk@luxestay.example", location: "Kileleshwa" },
  { type: "Malls", name: "SunGate Mall", email: "support@sungate.example", location: "Karen" },
  { type: "Supermarkets", name: "DailyCart Supermarket", email: "care@dailycart.example", location: "Syokimau" },
  { type: "Drinking Water", name: "PureDrop Water", email: "orders@puredrop.example", location: "Juja" },
  { type: "Riders", name: "Swift Riders", email: "dispatch@swiftriders.example", location: "Airport North Road" },
];

const helpKnowledgeBase = [
  {
    keywords: ["login", "sign in", "otp", "code", "tenant code", "landlord code"],
    answer:
      "To login as landlord, enter email + password then verify OTP. To login as tenant, use the tenant code sent to your email by the landlord.",
  },
  {
    keywords: ["add property", "upload", "images", "photos", "location"],
    answer:
      "Landlords can add a property from the dashboard sidebar. Include a location/address and upload up to 6 images. The property will appear on guest/tenant listings with a photo carousel and Google Maps link.",
  },
  {
    keywords: ["complain", "complaint", "feedback", "request", "notify", "notifications"],
    answer:
      "Tenants can submit complaints/feedback/requests from Tenant Dashboard. Submissions show up on the landlord dashboard under Notifications (filter by label).",
  },
  {
    keywords: ["pay", "payment", "mpesa", "stk", "daraja"],
    answer:
      "Tenant Payment sends an M-Pesa STK Push using the Safaricom sandbox (Daraja). Ensure backend .env Daraja credentials are set and the backend is running.",
  },
  {
    keywords: ["rate", "rating", "stars"],
    answer:
      "To add a rating, you must enter the tenant code for that house. Ratings show breakdown stars (sewage, electricity, water, security, roads) plus comment in House Details.",
  },
];

const answerHelpQuery = (query) => {
  const q = safeText(query).toLowerCase();
  if (!q) return null;
  const hits = helpKnowledgeBase
    .map((entry) => {
      const score = entry.keywords.reduce((acc, k) => (q.includes(k) ? acc + 1 : acc), 0);
      return { entry, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!hits.length) {
    return "I couldn’t find an exact match. Try keywords like: login, tenant code, add property, mpesa, complaint, rating.";
  }
  return hits[0].entry.answer;
};

// API helper function
const API_BASE = "http://localhost:3000/api";
const AUTH_STORAGE_KEY = "truststayAuth";

const persistAuthState = () => {
  const payload = {
    token: state.authToken || null,
    role: state.role || null,
    landlordProfile: state.landlordProfile || null,
    tenantProfile: state.tenantProfile || null,
  };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
};

const clearPersistedAuthState = () => {
  localStorage.removeItem(AUTH_STORAGE_KEY);
};

const setBusy = (busy, text = "") => {
  state.isBusy = busy;
  state.busyText = text;
  const overlay = document.getElementById("busyOverlay");
  if (!overlay) return;
  overlay.classList.toggle("show", !!busy);
  const message = document.getElementById("busyText");
  if (message) message.textContent = text || "Working…";
};

const withTimeout = (ms) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return { controller, cancel: () => clearTimeout(id) };
};

const apiRequest = async (endpoint, method = "GET", data = null) => {
  try {
    setBusy(true, "Loading…");
    const headers = { "Content-Type": "application/json" };
    if (state.authToken) headers.Authorization = `Bearer ${state.authToken}`;

    const t = withTimeout(12000);
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers,
      body: data ? JSON.stringify(data) : null,
      signal: t.controller.signal,
    });
    t.cancel();

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = payload?.message || payload?.error || `Request failed (${res.status})`;
      throw new Error(message);
    }
    return payload;
  } catch (error) {
    console.error(error);
    const msg = error.name === "AbortError" ? "Request timed out. Please try again." : error.message || "Network error";
    showStatusToast(msg, "error");
    return null;
  } finally {
    setBusy(false);
  }
};

const apiUploadImages = async (files) => {
  try {
    setBusy(true, "Uploading images…");
    const formData = new FormData();
    files.slice(0, 6).forEach((file) => formData.append("images", file));
    const headers = {};
    if (state.authToken) headers.Authorization = `Bearer ${state.authToken}`;

    const res = await fetch(`${API_BASE}/uploads/images`, {
      method: "POST",
      headers,
      body: formData,
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = payload?.message || payload?.error || `Upload failed (${res.status})`;
      throw new Error(message);
    }
    return payload;
  } catch (error) {
    console.error(error);
    showStatusToast(error.message || "Upload failed", "error");
    return null;
  } finally {
    setBusy(false);
  }
};

const checkBackendHealth = async () => {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) return false;
    const data = await res.json();
    return !!data?.ok;
  } catch {
    return false;
  }
};

const formatPhone = (phone) => phone.replace(/^0/, "254");

const toStars = (value) => {
  const rounded = Math.round(value);
  return "★".repeat(rounded) + "☆".repeat(STARS_OUT_OF_5 - rounded);
};

const safeText = (text) => (text ?? "").toString().trim();
const getHouseById = (houseId) =>
  state.houses.find((house) => String(house.id) === String(houseId));
const createMapsUrl = (address) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(safeText(address))}`;

const matchesSelectedPurpose = (house) => {
  if (!state.selectedPurpose) return true;
  const purpose = house.purpose.toLowerCase();
  if (state.selectedPurpose === "rent") return purpose.includes("rent");
  if (state.selectedPurpose === "buy") return purpose.includes("buy");
  if (state.selectedPurpose === "lease") return purpose.includes("lease");
  if (state.selectedPurpose === "airbnb") return purpose.includes("airbnb");
  return true;
};

const getBackTarget = () => {
  if (state.browseOrigin === "tenantDashboard") return "tenantDashboard";
  if (state.browseOrigin === "tenantLogin") return "tenantLogin";
  return "menu";
};

const getBackLabel = () => {
  if (state.browseOrigin === "tenantDashboard") return "← Back to tenant dashboard";
  if (state.browseOrigin === "tenantLogin") return "← Back to tenant login";
  return "← Back to menu";
};

const getProvidersForHouse = (house) => {
  if (!house) return [];
  const locationToken = safeText(house.location).split(",")[0].toLowerCase();
  const matches = serviceProviders.filter((provider) => {
    const providerLocation = provider.location.toLowerCase();
    return providerLocation.includes(locationToken) || locationToken.includes(providerLocation);
  });
  return matches.length ? matches : serviceProviders.slice(0, 4);
};

const renderProviderCard = (provider, house) => {
  return `
    <article class="service-item">
      <p><strong>${provider.type}</strong></p>
      <p>${provider.name}</p>
      <p class="muted">${provider.email}</p>
      <p class="muted">${provider.location}</p>
      <button class="primary-btn" data-order-service="${provider.name}" type="button">Order & Pay on delivery</button>
    </article>
  `;
};

const showStatusToast = (message, type = "success") => {
  let toast = document.getElementById("statusToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "statusToast";
    toast.className = "status-toast";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.className = `status-toast ${type} show`;

  if (toastTimer) {
    clearTimeout(toastTimer);
  }

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
};

const hardLogout = async () => {
  try {
    if (state.authToken) {
      await apiRequest("/auth/logout", "POST");
    }
  } catch {
    // ignore
  }
  state.authToken = null;
  state.isLoggedIn = false;
  state.role = null;
  state.landlordProfile = null;
  state.tenantProfile = null;
  state.landlordProperties = [];
  state.landlordNotifications = [];
  state.landlordNotificationFilter = "all";
  state._notificationsPrimed = false;
  state.chats = {};
  clearPersistedAuthState();
  showStatusToast("Logged out", "success");
  setScreen("login");
};

const setScreen = (screen, houseId = null) => {
  state.currentScreen = screen;
  state.selectedHouseId = houseId;
  render();
};

const openHouseList = (purpose = null, origin = "menu") => {
  state.selectedPurpose = purpose;
  state.selectedLocation = "all";
  state.servicesSidebarHouseId = null;
  state.faqOpen = false;
  state.browseOrigin = origin;
  setScreen("houseList");
};

const updateAverageRating = (house) => {
  if (!house.ratings || house.ratings.length === 0) return;
  const sum = house.ratings.reduce((acc, rating) => acc + rating.overall, 0);
  house.averageStars = Number((sum / house.ratings.length).toFixed(1));
};

const normalizeHouse = (house) => {
  const normalized = { ...house };
  normalized.id = String(house.id);
  normalized.photos = Array.isArray(house.photos) ? house.photos : [];
  normalized.photo = safeText(house.photo) || safeText(normalized.photos[0]) || "";
  normalized.name = safeText(house.name) || "Untitled property";
  normalized.location = safeText(house.location) || "Unknown location";
  normalized.fullAddress = safeText(house.fullAddress) || normalized.location;
  normalized.purpose = safeText(house.purpose) || "Rent (pay monthly)";
  normalized.priceText = safeText(house.priceText) || "Price on request";
  normalized.managerName = safeText(house.managerName) || "Property manager";
  normalized.landlordPhone = safeText(house.landlordPhone);
  normalized.caretakerPhone = safeText(house.caretakerPhone);
  normalized.fakeViews = Number(house.fakeViews ?? 0) || 0;
  normalized.fakeMessages = Number(house.fakeMessages ?? 0) || 0;
  normalized.occupancyStatus =
    house.occupancyStatus || (house.isRented ? "occupied" : "vacant");
  normalized.isRented = normalized.occupancyStatus === "occupied";
  normalized.landlord = house.landlord || { name: "Landlord", verified: false };
  if (!normalized.landlord.name) normalized.landlord.name = "Landlord";
  normalized.ratings = Array.isArray(house.ratings) ? house.ratings : [];
  normalized.ratingBreakdown = Array.isArray(house.ratingBreakdown)
    ? house.ratingBreakdown
    : [];
  normalized.averageStars = Number(house.averageStars ?? 0) || 0;
  normalized.pastTenantComment =
    house.pastTenantComment || { text: "", author: "" };
  return normalized;
};

const renderPhotoCarousel = (house) => {
  const photos = house.photos?.length ? house.photos : [house.photo].filter(Boolean);
  if (!photos.length) {
    return `<div class="carousel empty-carousel"><div class="muted">No image uploaded yet</div></div>`;
  }
  const safePhotos = photos.filter(Boolean);
  const items = safePhotos
    .map(
      (src, idx) =>
        `<img class="carousel-photo" src="${src}" alt="${safeText(house.name)} photo ${idx + 1}" loading="lazy" />`
    )
    .join("");
  return `
    <div class="carousel">
      <button class="carousel-btn" data-carousel-left type="button">‹</button>
      <div class="carousel-track">${items}</div>
      <button class="carousel-btn" data-carousel-right type="button">›</button>
    </div>
  `;
};

const renderLogin = () => {
  if (feedbackTimer) {
    clearInterval(feedbackTimer);
    feedbackTimer = null;
  }

  const testimonials = [
    {
      quote:
        "TrustStay makes it simple to manage units, occupancy, and tenant onboarding from one dashboard.",
      author: "Grace N.",
      role: "Landlord, Nairobi",
    },
    {
      quote:
        "As a tenant, I can quickly login with my code, submit requests, and still browse better homes easily.",
      author: "Kevin M.",
      role: "Tenant, Westlands",
    },
    {
      quote:
        "The listing workflow is clean. I upload property photos once and my units are live in minutes.",
      author: "Aisha K.",
      role: "Property Manager, Kilimani",
    },
  ];

  app.innerHTML = `
    <section class="screen landing-screen">
      <div class="landing-hero card">
        <p class="pill">TrustStay Platform</p>
        <form id="roleSelectForm" class="auth-form centered-auth-form">
          <label>
            Continue as
            <select name="role" id="roleSelect">
              <option value="landlord">Landlord</option>
              <option value="tenant">Tenant</option>
              <option value="guest">Guest</option>
            </select>
          </label>

          <div class="row auth-actions">
            <button class="primary-btn" type="submit">Continue</button>
            <button class="ghost-btn" id="registerLandlordBtn" type="button">Register landlord</button>
          </div>
        </form>
      </div>

      <div class="card landing-section">
        <h3>Benefits</h3>
        <div class="benefits-grid">
          <article class="benefit-item">
            <img class="benefit-icon-image" src="${landingImages.manageProperty}" alt="Manage Property icon" />
            <h4>1. Manage Property</h4>
            <p class="muted">List units, update occupancy, and run landlord actions from one organized dashboard.</p>
          </article>
          <article class="benefit-item">
            <img class="benefit-icon-image" src="${landingImages.ecosystem}" alt="Earn with Ease icon" />
            <h4>2. Earn with Ease</h4>
            <p class="muted">Keep listings active, connect with tenants faster, and streamline payment workflows.</p>
          </article>
          <article class="benefit-item">
            <img class="benefit-icon-image" src="${landingImages.earnWithEase}" alt="Smart ecosystem icon" />
            <h4>3. Smart Connected Ecosystem</h4>
            <p class="muted">Bring listings, services, tenant requests, and communication into one trusted platform.</p>
          </article>
        </div>
      </div>

      <div class="card landing-section">
        <h3>How TrustStay Works</h3>
        <div class="process-grid">
          <article class="process-step"><img class="process-icon-image" src="${landingImages.process}" alt="Process icon" /><p>Choose your role and sign in as landlord, tenant, or guest.</p></article>
          <article class="process-step"><img class="process-icon-image" src="${landingImages.process}" alt="Process icon" /><p>Browse available listings with location, photos, and verified contact details.</p></article>
          <article class="process-step"><img class="process-icon-image" src="${landingImages.process}" alt="Process icon" /><p>Landlords publish and manage properties while tenants connect using secure access codes.</p></article>
          <article class="process-step"><img class="process-icon-image" src="${landingImages.process}" alt="Process icon" /><p>Everyone benefits from one connected system for requests, feedback, services, and follow-up.</p></article>
        </div>
      </div>

      <div class="card landing-section testimonial-section">
        <div class="row">
          <h3>What Users Say</h3>
          <div class="inline-actions">
            <button class="ghost-btn" id="prevFeedbackBtn" type="button">←</button>
            <button class="ghost-btn" id="nextFeedbackBtn" type="button">→</button>
          </div>
        </div>
        <div id="feedbackSlides" class="feedback-slides">
          ${testimonials
            .map(
              (item, idx) => `
                <article class="feedback-item ${idx === 0 ? "active" : ""}">
                  <p class="feedback-quote">"${item.quote}"</p>
                  <p><strong>${item.author}</strong></p>
                  <p class="muted tiny">${item.role}</p>
                </article>
              `
            )
            .join("")}
        </div>
      </div>
    </section>
  `;

  document.getElementById("registerLandlordBtn").addEventListener("click", () => {
  setScreen("landlordRegister");
});

  const toggleRegisterBtn = () => {
    const role = document.getElementById("roleSelect").value;
    document.getElementById("registerLandlordBtn").style.display = role === "landlord" ? "inline-flex" : "none";
  };
  toggleRegisterBtn();
  document.getElementById("roleSelect").addEventListener("change", toggleRegisterBtn);

  document.getElementById("roleSelectForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const role = document.getElementById("roleSelect").value;
    if (role === "landlord") return setScreen("landlordLogin");
    if (role === "tenant") return setScreen("tenantLogin");
    state.role = "guest";
    state.isLoggedIn = true;
    setScreen("menu");
  });

  const slides = Array.from(document.querySelectorAll(".feedback-item"));
  let activeSlide = 0;
  const renderSlide = () => {
    slides.forEach((slide, idx) => {
      slide.classList.toggle("active", idx === activeSlide);
    });
  };

  document.getElementById("prevFeedbackBtn").addEventListener("click", () => {
    activeSlide = (activeSlide - 1 + slides.length) % slides.length;
    renderSlide();
  });

  document.getElementById("nextFeedbackBtn").addEventListener("click", () => {
    activeSlide = (activeSlide + 1) % slides.length;
    renderSlide();
  });

  feedbackTimer = setInterval(() => {
    activeSlide = (activeSlide + 1) % slides.length;
    renderSlide();
  }, 4500);
};

// Landlord Registration
const renderLandlordRegister = () => {
  let pendingRegistration = null;
  app.innerHTML = `
    <section class="screen">
      <button onclick="setScreen('login')" class="ghost-btn">← Back</button>

      <div class="card house-content">
        <h2>Register Landlord</h2>

        <form id="registerForm">
          <input placeholder="Full Name" name="name" required />
          <input placeholder="National ID" name="id" required />
          <input type="email" placeholder="Email Address" name="email" required />
          <input placeholder="Land Reference Number" name="landRef" required />
          <input placeholder="Occupation Certificate (OC) Number" name="ocNumber" required />
          <input type="password" placeholder="Password" name="password" required />
          <input type="password" placeholder="Confirm password" name="confirmPassword" required />

          <button class="primary-btn">Verify & Send OTP</button>
        </form>

        <form id="otpForm" style="display:none;">
          <input name="otp" placeholder="Enter OTP" required />
          <button class="primary-btn">Complete Registration</button>
        </form>
      </div>
    </section>
  `;

  document.getElementById("registerForm").onsubmit = (e) => {
    e.preventDefault();
    showStatusToast("Verifying land via Ardhisasa (simulated)");
    const formData = new FormData(e.target);
    const password = safeText(formData.get("password"));
    const confirmPassword = safeText(formData.get("confirmPassword"));
    if (!password || password !== confirmPassword) {
      showStatusToast("Passwords do not match", "error");
      return;
    }
    pendingRegistration = {
      name: safeText(formData.get("name")),
      email: safeText(formData.get("email")).toLowerCase(),
      idNumber: safeText(formData.get("id")),
      lrNumber: safeText(formData.get("landRef")),
      ocNumber: safeText(formData.get("ocNumber")) || "demo-oc",
      password,
    };
    requestRegistrationOtp(pendingRegistration);
  };

  document.getElementById("otpForm").onsubmit = async (e) => {
    e.preventDefault();
    if (!pendingRegistration) {
      showStatusToast("Please submit registration details first.", "error");
      return;
    }
    const formData = new FormData(e.target);
    const otp = safeText(formData.get("otp"));
    if (!otp) return;
    const res = await apiRequest("/landlord/register/verify-otp", "POST", {
      requestId: pendingRegistration.requestId,
      otp,
    });
    if (!res) return;
    showStatusToast("Registered successfully. Please login.", "success");
    setScreen("landlordLogin");
  };
};

const renderLandlordLogin = () => {
  app.innerHTML = `
    <section class="screen">
      <button id="backToRoleLogin" class="ghost-btn">← Back</button>

      <div class="card house-content">
        <h2>Landlord Login</h2>

        <form id="landlordLoginForm">
          <label>
            Email Address
            <input type="email" name="email" placeholder="landlord@example.com" required />
          </label>

          <label>
            Password
            <input type="password" name="password" required />
          </label>

          <button class="primary-btn" type="submit">Send OTP</button>
        </form>

        <form id="otpForm" style="display:none;">
          <label>
            Enter OTP
            <input type="text" name="otp" required />
          </label>
          <button class="primary-btn">Verify & Login</button>
        </form>

        <p class="muted tiny">Don’t have an account? <button class="ghost-btn" id="goRegister" type="button">Register</button></p>
      </div>
    </section>
  `;

  document.getElementById("backToRoleLogin").onclick = () => setScreen("login");
  document.getElementById("goRegister").onclick = () => setScreen("landlordRegister");

  document.getElementById("landlordLoginForm").onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    state.pendingLogin = {
      email: safeText(formData.get("email")).toLowerCase(),
      password: safeText(formData.get("password")),
    };
    const res = await apiRequest("/auth/landlord/request-otp", "POST", state.pendingLogin);
    if (!res) return;
    state.pendingLogin.requestId = res.requestId;
    const msg = "OTP sent (check your email).";
    showStatusToast(msg, "success");
    document.getElementById("otpForm").style.display = "block";
  };

  document.getElementById("otpForm").onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const otp = safeText(formData.get("otp"));
    const loginRes = await apiRequest("/auth/landlord/verify-otp", "POST", {
      requestId: state.pendingLogin?.requestId,
      otp,
    });
    if (!loginRes) return;
    state.authToken = loginRes.token;
    state.landlordProfile = loginRes.landlord;
    state.role = "landlord";
    state.isLoggedIn = true;
    persistAuthState();
    await refreshLandlordProperties();
    await refreshLandlordNotifications();
    setScreen("dashboard");
  };
};

const requestRegistrationOtp = async (registrationPayload) => {
  const res = await apiRequest("/landlord/register/request-otp", "POST", registrationPayload);
  if (!res) return;
  registrationPayload.requestId = res.requestId;
  const msg = "OTP sent (check your email).";
  showStatusToast(msg, "success");
  document.getElementById("otpForm").style.display = "block";
};

const renderTenantLogin = () => {
  app.innerHTML = `
    <section class="screen">
      <button onclick="setScreen('login')" class="ghost-btn">← Back</button>

      <div class="card house-content">
        <h2>Tenant Login</h2>

        <form id="tenantLoginForm">
          <input name="email" type="email" placeholder="Email Address" required />
          <input name="code" placeholder="Login Code from Landlord" required />

          <button class="primary-btn">Login</button>
        </form>
      </div>
    </section>
  `;

  document.getElementById("tenantLoginForm").onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const loginRes = await apiRequest("/auth/tenant/login", "POST", {
      email: safeText(formData.get("email")).toLowerCase(),
      code: safeText(formData.get("code")),
    });
    if (!loginRes) return;
    state.authToken = loginRes.token;
    state.tenantProfile = loginRes.tenant;
    state.role = "tenant";
    state.isLoggedIn = true;
    persistAuthState();
    setScreen("tenantDashboard");
  };
};

const renderTenantDashboard = () => {
  const actionCards = [
    {
      key: "payment",
      title: "Payment",
      description: "Pay rent, download receipts, and review payment history.",
      actionLabel: "Open payment",
    },
    {
      key: "complain",
      title: "Complain",
      description: "Report maintenance, service, or billing complaints.",
      actionLabel: "Create complaint",
    },
    {
      key: "feedback",
      title: "Feedback",
      description: "Share your stay experience with landlords and admin.",
      actionLabel: "Submit feedback",
    },
    {
      key: "request",
      title: "Request",
      description: "Send new service or support requests for your unit.",
      actionLabel: "New request",
    },
    {
      key: "houses",
      title: "Other Houses",
      description: "Browse other available homes while keeping tenant access.",
      actionLabel: "Browse houses",
    },
  ];

  app.innerHTML = `
    <section class="screen">
      <div class="card house-content">
        <div class="row">
          <h2>Tenant Dashboard</h2>
          <button id="tenantLogoutBtn" class="danger-btn" type="button">Logout</button>
        </div>
        <p class="muted">Tenant workspace for payment, complain, feedback, requests, and house browsing.</p>
      </div>
      <div class="action-grid">
        ${actionCards
          .map(
            (card) => `
              <article class="card action-card">
                <h3>${card.title}</h3>
                <p class="muted">${card.description}</p>
                <button class="primary-btn" data-tenant-action="${card.key}" type="button">${card.actionLabel}</button>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;

  document.querySelectorAll("[data-tenant-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.tenantAction;
      if (action === "houses") {
        openHouseList(null, "tenantDashboard");
        return;
      }

    if (action === "payment") {
      const phone = prompt("Enter phone number (+254...)");
      const amount = prompt("Enter rent amount");
      if (!phone || !amount) return;
      const res = await apiRequest("/payments/pay", "POST", {
        phone,
        amount,
      });
      if (res) showStatusToast("STK Push request sent. Check your phone.", "success");
}

      if (action === "complain") return setScreen("tenantTicket", "complain");
      if (action === "feedback") return setScreen("tenantTicket", "feedback");
      if (action === "request") return setScreen("tenantTicket", "request");

      const messageMap = {
        payment: "Payment module opened for tenant account.",
        complain: "Complain form opened. Please describe your issue.",
        feedback: "Feedback form opened for this tenant profile.",
        request: "Request form opened. Add your service request.",
      };
      showStatusToast(messageMap[action] || "Tenant action opened.", "success");
    });
  });

  document.getElementById("tenantLogoutBtn").addEventListener("click", async () => {
    await hardLogout();
  });
};

const renderTenantTicket = (type) => {
  const labelMap = { complain: "Complaint", feedback: "Feedback", request: "Request" };
  const typeLabel = labelMap[type] || "Message";
  app.innerHTML = `
    <section class="screen">
      <button class="ghost-btn" id="backToTenantDash">← Back</button>
      <div class="card house-content tenant-auth-card">
        <h2>${typeLabel}</h2>
        <p class="muted">Fill the form and your landlord will be notified.</p>
        <form id="tenantTicketForm">
          <label>
            Contact email
            <input name="contactEmail" type="email" placeholder="tenant@example.com" required />
          </label>
          <label>
            House name
            <input name="houseName" placeholder="e.g. 2 bedrooms in Kilimani" required />
          </label>
          <label>
            Room number
            <input name="roomNumber" placeholder="e.g. B12" required />
          </label>
          <label>
            Details
            <textarea name="details" placeholder="Describe your issue/request in detail" required></textarea>
          </label>
          <button class="primary-btn" type="submit">Submit</button>
        </form>
      </div>
    </section>
  `;

  document.getElementById("backToTenantDash").onclick = () => setScreen("tenantDashboard");
  document.getElementById("tenantTicketForm").onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const payload = {
      type,
      contactEmail: safeText(formData.get("contactEmail")).toLowerCase(),
      houseName: safeText(formData.get("houseName")),
      roomNumber: safeText(formData.get("roomNumber")),
      details: safeText(formData.get("details")),
      tenantEmail: state.tenantProfile?.email || null,
      propertyId: state.tenantProfile?.propertyId || null,
    };
    const res = await apiRequest("/tenant/tickets", "POST", payload);
    if (!res) return;
    showStatusToast(`${typeLabel} submitted`, "success");
    setScreen("tenantDashboard");
  };
};

const renderMenu = () => {
  app.innerHTML = `
    <section class="screen">
      <div class="card house-content">
        <div class="row">
          <h2>Units / Listings Menu</h2>
          <button id="menuLogoutBtn" class="danger-btn" type="button">Logout</button>
        </div>
        <p class="muted">All units appear first, then you can filter by category and exact location.</p>
        <div class="menu-grid">
          <button class="primary-btn" id="openAllListingsBtn" type="button">All Units / Listings</button>
          <button class="ghost-btn" data-purpose-menu="rent" type="button">Rent Listings</button>
          <button class="ghost-btn" data-purpose-menu="buy" type="button">Buy Listings</button>
          <button class="ghost-btn" data-purpose-menu="airbnb" type="button">Airbnb Listings</button>
          <button class="ghost-btn" data-purpose-menu="lease" type="button">Lease Listings</button>
        </div>
      </div>
    </section>
  `;

  document.getElementById("openAllListingsBtn").addEventListener("click", () => {
    openHouseList(null, "menu");
  });

  document.querySelectorAll("[data-purpose-menu]").forEach((button) => {
    button.addEventListener("click", () => {
      openHouseList(button.dataset.purposeMenu, "menu");
    });
  });

  document.getElementById("menuLogoutBtn").addEventListener("click", async () => {
    await hardLogout();
  });
};

const renderHouseList = () => {
  const purposeFilteredHouses = state.houses.filter(
    (house) => !house.isRented && house.occupancyStatus !== "occupied" && matchesSelectedPurpose(house)
  );
  const selectedPurposeLabel = purposeLabelMap[state.selectedPurpose] || "All listing types";

  const locations = [...new Set(purposeFilteredHouses.map((house) => house.location))].sort((a, b) => a.localeCompare(b));
  if (state.selectedLocation !== "all" && !locations.includes(state.selectedLocation)) {
    state.selectedLocation = "all";
  }

  const availableHouses = purposeFilteredHouses.filter((house) => {
    return state.selectedLocation === "all" || house.location === state.selectedLocation;
  });

  const selectedServiceHouse = getHouseById(state.servicesSidebarHouseId);
  const sidebarProviders = getProvidersForHouse(selectedServiceHouse);

  const cards = availableHouses
    .map((house) => {
      const mapsUrl = createMapsUrl(house.fullAddress || house.location);
      const requestSent = state.pendingLandlordRequests.includes(house.id);
      return `
        <article class="card">
          ${renderPhotoCarousel(house)}
          <div class="house-content">
            <div class="row listing-title-row">
              <h3>${house.name}</h3>
              <div class="property-menu-wrap">
                <button class="ghost-btn icon-only-btn" data-listing-menu-toggle="${house.id}" type="button" aria-label="Open listing actions">⋯</button>
                <div class="property-menu" data-listing-menu="${house.id}">
                  <button class="ghost-btn menu-item" data-open-services="${house.id}" type="button">Services</button>
                  <a class="ghost-btn link-btn menu-item" href="${mapsUrl}" target="_blank" rel="noopener noreferrer">Google Maps</a>
                  <button
                    class="${requestSent ? "ghost-btn" : "primary-btn"} menu-item"
                    data-request-landlord="${house.id}"
                    type="button"
                    ${requestSent ? "disabled" : ""}
                  >
                    ${requestSent ? "Request sent" : "Request landlord"}
                  </button>
                </div>
              </div>
            </div>
            <p>${house.location}</p>
            <p><strong>${house.priceText}</strong></p>
            <p class="muted">Purpose: ${house.purpose}</p>
            <p class="muted"><strong>Landlord:</strong> ${house.landlord.name}</p>
            <p class="muted"><strong>Contact person:</strong> ${house.managerName}</p>
            ${house.landlordPhone ? `<p class="muted"><strong>Landlord phone:</strong> ${house.landlordPhone}</p>` : ""}
            ${house.caretakerPhone ? `<p class="muted"><strong>Caretaker phone:</strong> ${house.caretakerPhone}</p>` : ""}
            ${house.landlord.verified ? `<span class="badge-verified">Verified Landlord</span>` : ""}
            <p style="margin-top:.55rem;">
              <span class="stars">${toStars(house.averageStars)}</span>
              (${house.averageStars})
            </p>
            <div class="unit-actions">
              <button class="primary-btn" data-open-house="${house.id}" type="button">View details</button>
            </div>
            ${requestSent ? `<p class="request-status">Request sent waiting for reply</p>` : ""}
          </div>
        </article>
      `;
    })
    .join("");

  app.innerHTML = `
    <section class="screen">
      <button id="backToOriginFromList" class="ghost-btn" type="button">${getBackLabel()}</button>
      <div class="card house-content">
        <h2>Units / Listings</h2>
        <p class="muted">Showing: ${selectedPurposeLabel}</p>
        <form id="locationSearchForm" class="filter-form">
          <label>
            Search by location
            <select name="location">
              <option value="all">All locations</option>
              ${locations
                .map(
                  (location) =>
                    `<option value="${location}" ${state.selectedLocation === location ? "selected" : ""}>${location}</option>`
                )
                .join("")}
            </select>
          </label>
          <button class="primary-btn" type="submit">Search location</button>
        </form>
      </div>

      <div class="list-layout ${selectedServiceHouse ? "with-sidebar" : ""}">
        <div class="house-grid">${cards || "<p>No houses available right now.</p>"}</div>

        ${
          selectedServiceHouse
            ? `
              <aside class="services-sidebar">
                <div class="row">
                  <h3>Services for ${selectedServiceHouse.name}</h3>
                  <button id="closeServicesSidebar" class="icon-btn" type="button">×</button>
                </div>
                <p class="muted">Location: ${selectedServiceHouse.location}</p>
                <a
                  class="primary-btn link-btn"
                  href="${createMapsUrl(selectedServiceHouse.fullAddress || selectedServiceHouse.location)}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open location in Google Maps
                </a>
                <div class="services-list">
                  ${sidebarProviders.map((provider) => renderProviderCard(provider, selectedServiceHouse)).join("")}
                </div>
              </aside>
            `
            : ""
        }
      </div>

      <button id="faqHelpFab" class="help-fab" type="button" aria-label="FAQ or help agent">?</button>
      <aside class="help-panel ${state.faqOpen ? "open" : ""}">
        <div class="row">
          <h3>FAQ / Help Agent</h3>
          <button id="closeFaqHelpPanel" class="icon-btn" type="button">×</button>
        </div>
        <ul>
          <li>Use the location dropdown to search exact areas.</li>
          <li>Use the Services button on any unit for nearby support.</li>
          <li>Use Request landlord to send your interest request.</li>
        </ul>
        <button id="contactHelpAgent" class="primary-btn" type="button">Contact help agent</button>
      </aside>
    </section>
  `;

  document.getElementById("backToOriginFromList").addEventListener("click", () => {
    const target = getBackTarget();
    if (target === "tenantDashboard") return setScreen("tenantDashboard");
    if (target === "tenantLogin") return setScreen("tenantLogin");
    return setScreen("menu");
  });

  document.getElementById("locationSearchForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    state.selectedLocation = safeText(formData.get("location")) || "all";
    renderHouseList();
  });

  document.querySelectorAll("[data-open-house]").forEach((button) => {
    button.addEventListener("click", () => {
      setScreen("houseDetails", String(button.dataset.openHouse));
    });
  });

  app.querySelectorAll(".carousel").forEach((carousel) => {
    const track = carousel.querySelector(".carousel-track");
    const left = carousel.querySelector("[data-carousel-left]");
    const right = carousel.querySelector("[data-carousel-right]");
    if (!track || !left || !right) return;
    left.addEventListener("click", () => track.scrollBy({ left: -260, behavior: "smooth" }));
    right.addEventListener("click", () => track.scrollBy({ left: 260, behavior: "smooth" }));
  });

  document.querySelectorAll("[data-open-services]").forEach((button) => {
    button.addEventListener("click", () => {
      state.servicesSidebarHouseId = String(button.dataset.openServices);
      renderHouseList();
    });
  });

  if (selectedServiceHouse) {
    document.getElementById("closeServicesSidebar").addEventListener("click", () => {
      state.servicesSidebarHouseId = null;
      renderHouseList();
    });
  }

  document.querySelectorAll("[data-order-service]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const providerName = btn.dataset.orderService;
      const phone = prompt("Your phone number for M-Pesa prompt (07.. or +2547..)");
      const amount = prompt("Order amount (KES)");
      const details = prompt("Order details (what you need, delivery notes)");
      if (!phone || !amount) return;
      await apiRequest("/payments/pay", "POST", {
        phone,
        amount,
      });
      showStatusToast(`Order placed with ${providerName}. Pay on delivery via M-Pesa prompt sent.`, "success");
      if (details) {
        // lightweight local confirmation
        console.log("Order details:", { providerName, details });
      }
    });
  });

  document.querySelectorAll("[data-request-landlord]").forEach((button) => {
    button.addEventListener("click", () => {
      const houseId = String(button.dataset.requestLandlord);
      const house = getHouseById(houseId);
      if (!house) return;
      if (state.pendingLandlordRequests.includes(houseId)) return;

      state.pendingLandlordRequests.push(houseId);

      if (!state.chats[houseId]) state.chats[houseId] = [];
      state.chats[houseId].push({
        from: "user",
        text: `Request to landlord ${house.landlord.name}: I am interested in this unit and waiting for your reply.`,
      });

      showStatusToast("Request sent waiting for reply", "success");
      renderHouseList();
    });
  });

  document.querySelectorAll("[data-listing-menu-toggle]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      const houseId = String(btn.dataset.listingMenuToggle);
      document.querySelectorAll("[data-listing-menu]").forEach((menu) => {
        if (menu.dataset.listingMenu === houseId) {
          menu.classList.toggle("open");
        } else {
          menu.classList.remove("open");
        }
      });
    });
  });

  document.addEventListener("click", () => {
    document.querySelectorAll("[data-listing-menu].open").forEach((menu) => menu.classList.remove("open"));
  });

  document.getElementById("faqHelpFab").addEventListener("click", () => {
    state.faqOpen = !state.faqOpen;
    renderHouseList();
  });

  document.getElementById("closeFaqHelpPanel").addEventListener("click", () => {
    state.faqOpen = false;
    renderHouseList();
  });

  document.getElementById("contactHelpAgent").addEventListener("click", () => {
    const question = prompt("Ask a question (e.g. 'How do I generate a tenant code?')");
    if (!question) return;
    const answer = answerHelpQuery(question);
    showStatusToast(answer || "No answer found.", "success");
  });
};

const renderHouseDetails = (house) => {
  if (!house) {
    app.innerHTML = `<p>House not found.</p>`;
    return;
  }

  const ratingsSummary = (house.ratings || [])
    .slice()
    .reverse()
    .slice(0, 5)
    .map((r) => {
      const breakdown = [
        { item: "Sewage", score: Number(r.sewage) || 0 },
        { item: "Electricity", score: Number(r.electricity) || 0 },
        { item: "Water", score: Number(r.water) || 0 },
        { item: "Security", score: Number(r.security) || 0 },
        { item: "Roads", score: Number(r.roads) || 0 },
      ];
      return `
        <div class="rating-item">
          <div class="row">
            <strong>${safeText(r.author) || "Tenant"}</strong>
            <span class="stars">${toStars(r.overall || 0)}</span>
          </div>
          <div class="ratings-list">
            ${breakdown
              .map(
                (b) => `
                  <div class="row">
                    <span class="muted">${b.item}</span>
                    <span class="stars">${toStars(b.score)}</span>
                  </div>
                `
              )
              .join("")}
          </div>
          <p class="muted">${safeText(r.comment)}</p>
        </div>
      `;
    })
    .join("");

  app.innerHTML = `
    <section class="screen">
      <button id="backToList" class="ghost-btn" type="button">← Back to units</button>
      <h2>House Details + Ratings</h2>
      <div class="split">
        <div>
          ${house.photo ? `<img class="details-photo" src="${house.photo}" alt="${house.name}" />` : `<div class="details-photo no-photo">No image uploaded yet</div>`}
        </div>
        <div class="card house-content">
          <h3>${house.name}</h3>
          <p>${house.fullAddress}</p>
          <p><strong>${house.priceText}</strong> • ${house.purpose}</p>
          <p><strong>Landlord:</strong> ${house.landlord.name} ${house.landlord.verified ? `<span class="badge-verified">Verified</span>` : ""}</p>
          <p><strong>Contact person:</strong> ${house.managerName}</p>
          ${house.landlordPhone ? `<p><strong>Landlord phone:</strong> ${house.landlordPhone}</p>` : ""}
          ${house.caretakerPhone ? `<p><strong>Caretaker phone:</strong> ${house.caretakerPhone}</p>` : ""}
          <p>
            <span class="stars">${toStars(house.averageStars)}</span>
            (${house.averageStars})
          </p>
          <div class="inline-actions">
            <button id="bookBtn" class="primary-btn" type="button">Book appointment</button>
            <button id="addRatingBtn" class="ghost-btn" type="button">Add rating</button>
            <a class="ghost-btn link-btn" href="${createMapsUrl(house.fullAddress || house.location)}" target="_blank" rel="noopener noreferrer">Google Maps</a>
          </div>
        </div>
      </div>
      <div class="card house-content">
        <h3>Ratings from past tenants</h3>
        <div class="ratings-list">${ratingsSummary || `<p class="muted">No ratings yet.</p>`}</div>
      </div>
      <div class="card house-content">
        <h3>Past tenant comment</h3>
        <p>"${house.pastTenantComment.text}" – ${house.pastTenantComment.author}</p>
      </div>
    </section>
  `;

  document.getElementById("backToList").addEventListener("click", () => {
    setScreen("houseList");
  });

  document.getElementById("bookBtn").addEventListener("click", () => {
    setScreen("bookAppointment", house.id);
  });

  document.getElementById("addRatingBtn").addEventListener("click", () => {
    setScreen("addRating", house.id);
  });
};

const renderBookAppointment = (house) => {
  if (!house) {
    app.innerHTML = `<p>House not found.</p>`;
    return;
  }

  app.innerHTML = `
    <section class="screen">
      <button id="backToDetails" class="ghost-btn" type="button">← Back to details</button>
      <h2>Book Appointment</h2>
      <form id="appointmentForm">
        <label>
          Your email
          <input type="email" name="guestEmail" required />
        </label>
        <label>
          Date
          <input type="date" name="date" required />
        </label>
        <label>
          Time
          <input type="time" name="time" required />
        </label>
        <label>
          Write your message
          <textarea name="message" placeholder="I want to see the 2BR unit" required></textarea>
        </label>
        <button class="primary-btn" type="submit">Send appointment request</button>
      </form>
    </section>
  `;

  document.getElementById("backToDetails").addEventListener("click", () => setScreen("houseDetails", house.id));

  document.getElementById("appointmentForm").addEventListener("submit", async(event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const request = {
      houseId: house.id,
      guestEmail: safeText(formData.get("guestEmail")).toLowerCase(),
      date: formData.get("date"),
      time: formData.get("time"),
      message: safeText(formData.get("message")),
    };
    await apiRequest("/appointments/book", "POST", request);
    showStatusToast("Appointment email sent");
    setScreen("houseDetails", house.id);
  });
};

const renderChat = (house) => {
  if (!house) {
    app.innerHTML = `<p>House not found.</p>`;
    return;
  }

  const messages = state.chats[house.id] || [
    { from: "manager", text: `Hello, I am ${house.managerName}. Ask me anything about this house.` },
  ];
  state.chats[house.id] = messages;

  app.innerHTML = `
    <section class="screen">
      <button id="backToDetailsFromChat" class="ghost-btn" type="button">← Back to details</button>
      <h2>Chat</h2>
      <div class="chat-box">
        ${messages
          .map(
            (message) =>
              `<div class="message ${message.from === "user" ? "from-user" : "from-manager"}">${message.text}</div>`
          )
          .join("")}
      </div>
      <form id="chatForm">
        <label>
          Type a message
          <input type="text" name="chatMessage" placeholder="Is water available every day?" required />
        </label>
        <button class="primary-btn" type="submit">Send</button>
      </form>
    </section>
  `;

  document.getElementById("backToDetailsFromChat").addEventListener("click", () => setScreen("houseDetails", house.id));
  document.getElementById("chatForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const text = safeText(formData.get("chatMessage"));
    if (!text) return;

    state.chats[house.id].push({ from: "user", text });
    state.chats[house.id].push({
      from: "manager",
      text: `Thanks for your message. This is ${house.managerName}; I will respond with full details shortly.`,
    });
    setScreen("chat", house.id);
  });
};

const renderLandlordDashboard = () => {
  if (!state._notificationsPrimed) {
    state._notificationsPrimed = true;
    refreshLandlordNotifications().then(() => {
      if (state.currentScreen === "dashboard") renderLandlordDashboard();
    });
  }
    
    
  const items = (state.landlordProperties || [])
    .map(
      (house) => `
        <article class="card house-content">
          <div class="row listing-title-row">
            <h3>${house.name}</h3>
            <div class="property-menu-wrap">
              <button class="ghost-btn icon-only-btn" data-property-menu-toggle="${house.id}" type="button" aria-label="Open property actions">⋯</button>
              <div class="property-menu" data-property-menu="${house.id}">
                <button class="menu-item danger-btn" data-delete-house="${house.id}" type="button">Delete Property</button>
                <button class="menu-item ghost-btn" data-generate-qr="${house.id}" type="button">Generate QR Code</button>
                <button class="menu-item ghost-btn" data-email-tenant-code="${house.id}" type="button">Email Tenant Code Card</button>
              </div>
            </div>
          </div>
          ${house.photo ? `<img class="details-photo" src="${house.photo}" alt="${house.name}" />` : `<div class="details-photo no-photo">No image uploaded yet</div>`}
          <p><strong>${house.priceText}</strong> • ${house.purpose}</p>
          <p class="muted">Status: <strong>${house.occupancyStatus === "occupied" ? "Occupied" : "Vacant"}</strong></p>
          <p class="muted">Views: ${house.fakeViews}</p>
          <p class="muted">Messages: ${house.fakeMessages + (state.chats[house.id]?.length || 0)}</p>
          <button class="${house.occupancyStatus === "occupied" ? "ghost-btn" : "danger-btn"}" data-toggle-occupancy="${house.id}" type="button">
            ${house.occupancyStatus === "occupied" ? "Mark as Vacant" : "Mark as Occupied"}
          </button>

        </article>
      `
    )
    .join("");

  const onboardingSummary = state.landlordOnboarding
    ? `
      <div class="card house-content security-summary">
        <h3>Security Onboarding Summary</h3>
        <p class="muted">Registration: ${state.landlordOnboarding.registrationNumber}</p>
        <p class="muted">Listing Type: ${state.landlordOnboarding.listingType}</p>
        <p class="muted">Unit Category: ${state.landlordOnboarding.unitCategory}</p>
        <p class="muted">Uploaded File: ${state.landlordOnboarding.registrationFileName}</p>
      </div>
    `
    : "";

  const profile = state.landlordProfile || {};
  const profileCard = `
    <aside class="dashboard-sidebar">
      <div class="card house-content profile-card">
        <h3>Profile</h3>
        <p><strong>${safeText(profile.name) || "Landlord"}</strong></p>
        <p class="muted">${safeText(profile.email) || "—"}</p>
        ${profile.verified ? `<span class="badge-verified">Verified</span>` : `<span class="pill">Unverified</span>`}
        <div class="sidebar-actions">
          <button id="refreshLandlordBtn" class="ghost-btn" type="button">Refresh</button>
          <button id="logoutBtn" class="danger-btn" type="button">Logout</button>
        </div>
        <div class="divider"></div>
        <p class="muted tiny"><strong>Properties:</strong> ${(state.landlordProperties || []).length}</p>
      </div>
      <div class="card house-content">
        <div class="row">
          <h3>Notifications</h3>
          <select id="notificationFilter" aria-label="Filter notifications">
            <option value="all">All</option>
            <option value="complain">Complain</option>
            <option value="feedback">Feedback</option>
            <option value="request">Request</option>
          </select>
        </div>
        <div id="notificationList" class="notification-list">
          ${renderNotificationsHtml()}
        </div>
      </div>
      <div class="card house-content">
        <h3>Quick actions</h3>
        <button id="addHouseBtn" class="primary-btn" type="button">Add Property</button>
        <div id="qrContainer"></div>
      </div>
    </aside>
  `;

  app.innerHTML = `
    <section class="screen">
      <h2>Landlord Dashboard</h2>
      <p class="muted">Use the button to switch each property between vacant and occupied.</p>
      ${onboardingSummary}
      <div class="dashboard-layout">
        ${profileCard}
        <div class="dashboard-main">
          <div class="house-grid">${items}</div>
        </div>
      </div>
    </section>
  `;

    document.getElementById("addHouseBtn").addEventListener("click", () => {
    setScreen("addHouse");
    });
    document.getElementById("refreshLandlordBtn").addEventListener("click", async () => {
      await refreshLandlordProperties();
      await refreshPublicProperties();
      await refreshLandlordNotifications();
      renderLandlordDashboard();
    });

    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await hardLogout();
    });

    const filterEl = document.getElementById("notificationFilter");
    if (filterEl) {
      filterEl.value = state.landlordNotificationFilter || "all";
      filterEl.addEventListener("change", async () => {
        state.landlordNotificationFilter = filterEl.value;
        await refreshLandlordNotifications();
        renderLandlordDashboard();
      });
    }
    // Toggle occupancy status
    document.querySelectorAll("[data-toggle-occupancy]").forEach((button) => {
    button.addEventListener("click", () => {
      const houseId = String(button.dataset.toggleOccupancy);
      toggleLandlordProperty(houseId);
    });
    });
    // Delete house
    document.querySelectorAll("[data-delete-house]").forEach((btn) => {
      btn.addEventListener("click", () => {
      const houseId = String(btn.dataset.deleteHouse);

      const confirmDelete = confirm("Are you sure you want to delete this property?");
      if (!confirmDelete) return;
      deleteLandlordProperty(houseId);
    });
  });
    //Generate QR code for tenant onboarding
  document.querySelectorAll("[data-generate-qr]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const houseId = btn.dataset.generateQr;

    const landlordId = state.landlordProfile?.id || "unknown";
    const isFile = window.location.origin === "null" || window.location.protocol === "file:";
    const base = isFile
      ? window.location.href.split("?")[0].split("#")[0]
      : window.location.origin +
        (window.location.pathname.endsWith("/")
          ? window.location.pathname
          : window.location.pathname.replace(/\/[^/]*$/, "/")) +
        "index.html";
    const url = `${base}?providerOnboard=1&houseId=${encodeURIComponent(houseId)}&landlordId=${encodeURIComponent(
      landlordId
    )}`;
    if (isFile) {
      showStatusToast("QR works best when the app is hosted (not file://).", "error");
    }

    const container = document.getElementById("qrContainer");
    container.innerHTML = "";

    QRCode.toCanvas(url, { width: 180 }, (err, canvas) => {
      if (err) return console.error(err);

      container.appendChild(canvas);

      const actions = document.createElement("div");
      actions.className = "inline-actions";

      const printBtn = document.createElement("button");
      printBtn.textContent = "Print QR only";
      printBtn.className = "primary-btn";
      printBtn.onclick = () => printQrCanvas(canvas);

      const downloadBtn = document.createElement("button");
      downloadBtn.textContent = "Download PNG";
      downloadBtn.className = "ghost-btn";
      downloadBtn.onclick = () => downloadQrCanvas(canvas, `truststay-qr-${houseId}.png`);

      actions.appendChild(printBtn);
      actions.appendChild(downloadBtn);
      container.appendChild(actions);
    });
  });
});

  document.querySelectorAll("[data-email-tenant-code]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const propertyId = String(btn.dataset.emailTenantCode);
      const tenantName = prompt("Tenant name");
      const tenantEmail = prompt("Tenant email address");
      if (!tenantEmail) return;
      const res = await apiRequest("/landlord/tenant-codes", "POST", { tenantName, tenantEmail, propertyId });
      if (!res) return;
      showStatusToast("Tenant code card sent to email.", "success");
    });
  });

  document.querySelectorAll("[data-property-menu-toggle]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      const houseId = String(btn.dataset.propertyMenuToggle);
      document.querySelectorAll(".property-menu").forEach((menu) => {
        if (menu.dataset.propertyMenu === houseId) {
          menu.classList.toggle("open");
        } else {
          menu.classList.remove("open");
        }
      });
    });
  });

  document.addEventListener("click", () => {
    document.querySelectorAll(".property-menu.open").forEach((menu) => menu.classList.remove("open"));
  });
};

const printQrCanvas = (canvas) => {
  try {
    const dataUrl = canvas.toDataURL("image/png");
    const w = window.open("", "_blank");
    if (!w) return showStatusToast("Popup blocked. Allow popups to print.", "error");
    w.document.open();
    w.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Print QR</title>
          <style>
            body { margin: 0; display: grid; place-items: center; height: 100vh; }
            img { width: 320px; height: 320px; object-fit: contain; }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" alt="QR Code" />
          <script>
            window.onload = () => { window.print(); setTimeout(() => window.close(), 300); };
          </script>
        </body>
      </html>
    `);
    w.document.close();
  } catch (e) {
    console.error(e);
    showStatusToast("Unable to print QR.", "error");
  }
};

const downloadQrCanvas = (canvas, filename) => {
  try {
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (e) {
    console.error(e);
    showStatusToast("Unable to download QR.", "error");
  }
};

const renderNotificationsHtml = () => {
  const items = state.landlordNotifications || [];
  if (!items.length) return `<p class="muted tiny">No notifications yet.</p>`;
  return items
    .slice(0, 20)
    .map((n) => {
      const tag = (n.type || "message").toString();
      const titleMap = { complain: "Complaint", feedback: "Feedback", request: "Request" };
      const title = titleMap[tag] || "Message";
      const time = n.createdAt?._seconds ? new Date(n.createdAt._seconds * 1000).toLocaleString() : "";
      return `
        <article class="notification-item">
          <div class="row">
            <span class="pill">${title}</span>
            <span class="muted tiny">${time}</span>
          </div>
          <p><strong>${safeText(n.houseName)}</strong> • Room ${safeText(n.roomNumber)}</p>
          <p class="muted">${safeText(n.details)}</p>
          <p class="muted tiny">Contact: ${safeText(n.contactEmail || n.contactNumber)}</p>
        </article>
      `;
    })
    .join("");
};

const refreshLandlordNotifications = async () => {
  if (!state.authToken || state.role !== "landlord") return false;
  const label = state.landlordNotificationFilter && state.landlordNotificationFilter !== "all"
    ? `?label=${encodeURIComponent(state.landlordNotificationFilter)}`
    : "";
  const res = await apiRequest(`/landlord/notifications${label}`, "GET");
  if (!res?.notifications) return false;
  state.landlordNotifications = res.notifications;
  return true;
};
  const renderAddHouse = () => {
  app.innerHTML = `
    <section class="screen">
      <button onclick="setScreen('dashboard')" class="ghost-btn">← Back</button>

      <div class="card house-content">
        <h2>Add Property</h2>

        <form id="houseForm">
          <input name="name" placeholder="Apartment Name" required />
          
          <label>Unit Category</label>
          <select name="unitCategory">
            <option>Studio</option>
            <option>Bedsitter</option>
            <option>1 Bedroom</option>
          </select>

          <input name="units" type="number" placeholder="Number of Units" required />
          <input placeholder="Occupation Certificate Number" name="ocNumber" required />
          <input name="ncaProjectId" placeholder="NCA Project ID" />
          <input placeholder="Location (e.g. Kilimani, Nairobi)" name="location" required />
          <input placeholder="Full Address (optional)" name="fullAddress" />
          <input name="price" type="number" placeholder="Price (KES)" min="0" required />
          <label>Purpose</label>
          <select name="purpose">
            <option value="Buy">Buy</option>
            <option value="Lease">Lease</option>
            <option value="Rent">Rent</option>
            <option value="Airbnb">Airbnb</option>
          </select>
          <input name="landlordPhone" placeholder="Landlord phone number" />
          <input name="caretakerPhone" placeholder="Caretaker phone number" />
          <label>
            Upload images (max 6)
            <input type="file" id="propertyImages" accept="image/*" multiple />
          </label>

          <button class="primary-btn">Save Property</button>
        </form>
      </div>
    </section>
  `;

  document.getElementById("houseForm").onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const files = Array.from(document.getElementById("propertyImages")?.files || []).slice(0, 6);
    let photos = [];
    if (files.length) {
      const uploaded = await apiUploadImages(files);
      if (!uploaded?.urls) return;
      photos = uploaded.urls;
    }
    const fd = new FormData(form);
    const payload = {
      name: safeText(fd.get("name")),
      unitCategory: safeText(fd.get("unitCategory")),
      units: Number(fd.get("units")),
      ocNumber: safeText(fd.get("ocNumber")),
      ncaProjectId: safeText(fd.get("ncaProjectId")),
      location: safeText(fd.get("location")),
      fullAddress: safeText(fd.get("fullAddress")),
      price: Number(fd.get("price")),
      priceText: fd.get("price") ? `KES ${safeText(fd.get("price"))}` : "",
      purpose: safeText(fd.get("purpose")),
      landlordPhone: safeText(fd.get("landlordPhone")),
      caretakerPhone: safeText(fd.get("caretakerPhone")),
      photos,
      photo: photos[0] || "",
      managerName: safeText(fd.get("caretakerPhone")) || "Caretaker",
      landlord: {
        name: safeText(state.landlordProfile?.name) || "Landlord",
        verified: !!state.landlordProfile?.verified,
      },
    };
    const res = await apiRequest("/landlord/properties", "POST", payload);
    if (!res) return;
    await refreshLandlordProperties();
    await refreshPublicProperties();
    showStatusToast("Property added successfully", "success");
    setScreen("dashboard");
  };
};

const renderAddRating = (house) => {
  if (!house) {
    app.innerHTML = `<p>House not found.</p>`;                                                                      
    return;
  }

  app.innerHTML = `
    <section class="screen">
      <button id="backToDetailsFromRating" class="ghost-btn" type="button">← Back to details</button>
      <h2>Add Rating</h2>
      <p class="muted">Enter the tenant code issued by the landlord for this house to submit a rating.</p>
      <form id="ratingForm">
        <label>
          Tenant code
          <input type="text" name="tenantCode" placeholder="E.g. A1B2C3" required />
        </label>
        <label>
          Your name
          <input type="text" name="author" placeholder="Mary" required />
        </label>
        <div class="inline-group">
          <label>Sewage (1-5)<input type="number" min="1" max="5" name="sewage" required /></label>
          <label>Electricity (1-5)<input type="number" min="1" max="5" name="electricity" required /></label>
          <label>Water (1-5)<input type="number" min="1" max="5" name="water" required /></label>
          <label>Security (1-5)<input type="number" min="1" max="5" name="security" required /></label>
          <label>Roads (1-5)<input type="number" min="1" max="5" name="roads" required /></label>
        </div>
        <label>
          Comment
          <textarea name="comment" placeholder="Water is great but the road is bad." required></textarea>
        </label>
        <button class="primary-btn" type="submit">Submit rating</button>
      </form>
    </section>
  `;

  document.getElementById("backToDetailsFromRating").addEventListener("click", () => setScreen("houseDetails", house.id));

  document.getElementById("ratingForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const tenantCode = safeText(formData.get("tenantCode"));
    const newRating = {
      author: safeText(formData.get("author")),
      sewage: Number(formData.get("sewage")),
      electricity: Number(formData.get("electricity")),
      water: Number(formData.get("water")),
      security: Number(formData.get("security")),
      roads: Number(formData.get("roads")),
      comment: safeText(formData.get("comment")),
    };
    newRating.overall = Number(
      ((newRating.sewage + newRating.electricity + newRating.water + newRating.security + newRating.roads) / 5).toFixed(1)
    );
    submitRatingWithTenantCode(house.id, tenantCode, newRating);
  });
};

const refreshPublicProperties = async () => {
  const res = await apiRequest("/properties/public", "GET");
  if (!res?.properties) return false;
  state.houses = res.properties.map(normalizeHouse);
  return true;
};

const refreshLandlordProperties = async () => {
  if (!state.authToken || state.role !== "landlord") return false;
  const res = await apiRequest("/landlord/properties", "GET");
  if (!res?.properties) return false;
  state.landlordProperties = res.properties.map(normalizeHouse);
  return true;
};

const toggleLandlordProperty = async (propertyId) => {
  const res = await apiRequest(`/landlord/properties/${propertyId}/toggle`, "PATCH");
  if (!res) return;
  await refreshLandlordProperties();
  await refreshPublicProperties();
  renderLandlordDashboard();
};

const deleteLandlordProperty = async (propertyId) => {
  const res = await apiRequest(`/landlord/properties/${propertyId}`, "DELETE");
  if (!res) return;
  await refreshLandlordProperties();
  await refreshPublicProperties();
  showStatusToast("Property deleted", "success");
  renderLandlordDashboard();
};

const submitRatingWithTenantCode = async (propertyId, tenantCode, rating) => {
  const res = await apiRequest(`/properties/${propertyId}/ratings`, "POST", { tenantCode, rating });
  if (res?.property) {
    const idx = state.houses.findIndex((h) => String(h.id) === String(propertyId));
    if (idx >= 0) state.houses[idx] = normalizeHouse(res.property);
  }
  setScreen("houseDetails", propertyId);
};

// Service provider
const renderProviderOnboard = () => {
  const houseId = state.providerContext?.houseId;
  const landlordId = state.providerContext?.landlordId;
  app.innerHTML = `
    <section class="screen">
      <h2>Service Provider Registration</h2>

      <form id="providerForm">
        <input name="name" placeholder="Business Name" required />
        <input name="email" type="email" placeholder="provider@example.com" required />

        <select name="serviceType">
          <option>Groceries</option>
          <option>Gas Supply</option>
          <option>Furniture</option>
          <option>Hotels</option>
          <option>Malls</option>
          <option>Supermarkets</option>
          <option>Drinking Water</option>
          <option>Riders</option>
        </select>

        <input name="paymentMethod" placeholder="M-Pesa Till / Paybill" required />
        <input name="url" placeholder="Website or WhatsApp link" />

        <button class="primary-btn">Proceed to Payment (KES 100)</button>
      </form>
    </section>
  `;

  document.getElementById("providerForm").onsubmit = async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);

    const payload = {
      name: formData.get("name"),
      email: formData.get("email"),
      serviceType: formData.get("serviceType"),
      paymentMethod: formData.get("paymentMethod"),
      url: formData.get("url"),
      houseId,
      landlordId,
    };

    // Step 1: Save provider
    const res = await apiRequest("/providers/register", "POST", payload);

    showStatusToast("Registration submitted. Check email for next steps.");
  };
};

const render = () => {
  const canOpenDashboard = state.isLoggedIn && (state.role === "landlord" || state.role === "tenant");
  dashboardBtn.style.visibility = canOpenDashboard ? "visible" : "hidden";
  dashboardBtn.textContent = state.role === "tenant" ? "Tenant Dashboard" : "Landlord Dashboard";

  if (state.currentScreen === "login") return renderLogin();
  if (state.currentScreen === "landlordLogin") return renderLandlordLogin();
  if (state.currentScreen === "landlordRegister") return renderLandlordRegister();
  if (state.currentScreen === "tenantLogin") return renderTenantLogin();
  if (state.currentScreen === "tenantDashboard") return renderTenantDashboard();
  if (state.currentScreen === "tenantTicket") return renderTenantTicket(state.selectedHouseId);
  if (state.currentScreen === "menu") return renderMenu();
  if (state.currentScreen === "houseList") return renderHouseList();
  if (state.currentScreen === "houseDetails") return renderHouseDetails(getHouseById(state.selectedHouseId));
  if (state.currentScreen === "bookAppointment") return renderBookAppointment(getHouseById(state.selectedHouseId));
  if (state.currentScreen === "chat") return renderChat(getHouseById(state.selectedHouseId));
  if (state.currentScreen === "dashboard") return renderLandlordDashboard();
  if (state.currentScreen === "addHouse") return renderAddHouse();
  if (state.currentScreen === "addRating") return renderAddRating(getHouseById(state.selectedHouseId));
  if (state.currentScreen === "providerOnboard") return renderProviderOnboard();
  return renderLogin();
};

dashboardBtn.addEventListener("click", () => {
  if (state.role === "landlord") {
    setScreen("dashboard");
    return;
  }
  if (state.role === "tenant") {
    setScreen("tenantDashboard");
  }
});

const handleRouteFromURL = () => {
  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);

  if (path.includes("provider-onboard") || params.get("providerOnboard") === "1") {
    state.currentScreen = "providerOnboard";

    state.providerContext = {
      houseId: params.get("houseId"),
      landlordId: params.get("landlordId"),
    };
  }
};

const bootstrap = async () => {
  try {
    if (!document.getElementById("busyOverlay")) {
      const overlay = document.createElement("div");
      overlay.id = "busyOverlay";
      overlay.className = "busy-overlay";
      overlay.innerHTML = `<div class="busy-card"><div class="busy-spinner"></div><p id="busyText">Loading…</p></div>`;
      document.body.appendChild(overlay);
    }
    const persistedAuthRaw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (persistedAuthRaw) {
      try {
        const persistedAuth = JSON.parse(persistedAuthRaw);
        state.authToken = persistedAuth?.token || null;
        state.role = persistedAuth?.role || null;
        state.landlordProfile = persistedAuth?.landlordProfile || null;
        state.tenantProfile = persistedAuth?.tenantProfile || null;
        state.isLoggedIn = !!state.authToken && !!state.role;
      } catch {
        clearPersistedAuthState();
      }
    }

    const ok = await refreshPublicProperties();
    const healthy = await checkBackendHealth();
    if (!healthy) {
      showStatusToast("Backend not reachable or outdated. Restart backend on port 3000.", "error");
    }
    if (!ok) {
      state.houses = [];
      showStatusToast("Could not load property listings from backend.", "error");
    }
    if (state.isLoggedIn && state.role === "landlord") {
      await refreshLandlordProperties();
      await refreshLandlordNotifications();
      state.currentScreen = "dashboard";
    } else if (state.isLoggedIn && state.role === "tenant") {
      state.currentScreen = "tenantDashboard";
    }
    handleRouteFromURL();
    render();
  } catch (error) {
    app.innerHTML = `<p>Unable to load house data. Please refresh.</p>`;
  }
};

bootstrap();
