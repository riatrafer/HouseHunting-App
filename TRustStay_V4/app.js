const app = document.getElementById("app");
const dashboardBtn = document.getElementById("dashboardBtn");
const heatmapBtn = document.getElementById("heatmapBtn");


const state = {
  houses: [],
  currentScreen: "login",
  selectedHouseId: null,
  selectedPurpose: null,
  selectedLocation: "all",
  isLoggedIn: false,
  role: null,
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

const purposeLabelMap = {
  rent: "Rent",
  buy: "Buy",
  lease: "Lease",
  airbnb: "Airbnb",
};

const serviceProviders = [
  { type: "Groceries", name: "Fresh Basket Groceries", phone: "+254 700 100 201", location: "Kilimani" },
  { type: "Gas Supply", name: "BlueFlame Gas Center", phone: "+254 700 100 202", location: "Westlands" },
  { type: "Furniture", name: "Urban Nest Furniture", phone: "+254 700 100 203", location: "Ruaka" },
  { type: "Hotels", name: "Luxe Stay Hotel", phone: "+254 700 100 204", location: "Kileleshwa" },
  { type: "Malls", name: "SunGate Mall", phone: "+254 700 100 205", location: "Karen" },
  { type: "Supermarkets", name: "DailyCart Supermarket", phone: "+254 700 100 206", location: "Syokimau" },
  { type: "Drinking Water", name: "PureDrop Water", phone: "+254 700 100 207", location: "Juja" },
  { type: "Riders", name: "Swift Riders", phone: "+254 700 100 208", location: "Airport North Road" },
];

const toStars = (value) => {
  const rounded = Math.round(value);
  return "★".repeat(rounded) + "☆".repeat(STARS_OUT_OF_5 - rounded);
};

const safeText = (text) => (text ?? "").toString().trim();
const getHouseById = (houseId) => state.houses.find((house) => house.id === houseId);
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

const renderLogin = () => {
  app.innerHTML = `
    <section class="screen">
      <div class="card house-content">
        <h2>Welcome</h2>
        <p class="muted">Choose how you want to enter the app.</p>
        <div class="menu-grid">
        <button class="primary-btn" id="landlordLoginBtn">Login as Landlord</button>
        <button class="ghost-btn" id="registerLandlordBtn">Register Landlord</button>
        <button class="ghost-btn" id="tenantLoginBtn">Login as Tenant</button>
        <button class="ghost-btn" id="guestLoginBtn">Login as Guest</button>

        </div>
      </div>
    </section>
  `;

  document.getElementById("landlordLoginBtn").addEventListener("click", () => {
    setScreen("landlordLogin");
  });
  document.getElementById("registerLandlordBtn").addEventListener("click", () => {
  setScreen("landlordRegister");
});

  document.getElementById("tenantLoginBtn").addEventListener("click", () => {
    setScreen("tenantLogin");
  });

  document.getElementById("guestLoginBtn").addEventListener("click", () => {
    state.role = "guest";
    state.isLoggedIn = true;
    setScreen("menu");
  });
};

// Landlord Registration
const renderLandlordRegister = () => {
  app.innerHTML = `
    <section class="screen">
      <button onclick="setScreen('login')" class="ghost-btn">← Back</button>

      <div class="card house-content">
        <h2>Register Landlord</h2>

        <form id="registerForm">
          <input placeholder="Full Name" name="name" required />
          <input placeholder="National ID" name="id" required />
          <input placeholder="Phone Number" name="phone" required />
          <input placeholder="Land Reference Number" name="landRef" required />
          <input type="password" placeholder="Password" name="password" required />

          <button class="primary-btn">Verify & Send OTP</button>
        </form>

        <form id="otpForm" style="display:none;">
          <input placeholder="Enter OTP" required />
          <button class="primary-btn">Complete Registration</button>
        </form>
      </div>
    </section>
  `;

  document.getElementById("registerForm").onsubmit = (e) => {
    e.preventDefault();
    showStatusToast("Verifying land via Ardhisasa (simulated)");
    document.getElementById("otpForm").style.display = "block";
  };

  document.getElementById("otpForm").onsubmit = (e) => {
    e.preventDefault();
    showStatusToast("Registration complete");
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
            Phone Number
            <input type="text" name="phone" placeholder="+2547XXXXXXXX" required />
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
      </div>
    </section>
  `;

  document.getElementById("backToRoleLogin").onclick = () => setScreen("login");

  document.getElementById("landlordLoginForm").onsubmit = (e) => {
    e.preventDefault();
    showStatusToast("OTP sent to phone (simulated)");
    document.getElementById("otpForm").style.display = "block";
  };

  document.getElementById("otpForm").onsubmit = (e) => {
    e.preventDefault();
    state.role = "landlord";
    state.isLoggedIn = true;
    setScreen("dashboard");
  };
};

const renderTenantLogin = () => {
  app.innerHTML = `
    <section class="screen">
      <button onclick="setScreen('login')" class="ghost-btn">← Back</button>

      <div class="card house-content">
        <h2>Tenant Login</h2>

        <form id="tenantLoginForm">
          <input placeholder="Phone Number" required />
          <input placeholder="Login Code from Landlord" required />

          <button class="primary-btn">Login</button>
        </form>
      </div>
    </section>
  `;

  document.getElementById("tenantLoginForm").onsubmit = (e) => {
    e.preventDefault();
    state.role = "tenant";
    state.isLoggedIn = true;
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
        <h2>Tenant Dashboard</h2>
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
    button.addEventListener("click", () => {
      const action = button.dataset.tenantAction;
      if (action === "houses") {
        openHouseList(null, "tenantDashboard");
        return;
      }

      const messageMap = {
        payment: "Payment module opened for tenant account.",
        complain: "Complain form opened. Please describe your issue.",
        feedback: "Feedback form opened for this tenant profile.",
        request: "Request form opened. Add your service request.",
      };
      showStatusToast(messageMap[action] || "Tenant action opened.", "success");
    });
  });
};

const renderMenu = () => {
  app.innerHTML = `
    <section class="screen">
      <div class="banner">New house matches your search.</div>
      <div class="card house-content">
        <h2>Units / Listings Menu</h2>
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
          <img class="house-image" src="${house.photo}" alt="${house.name}" />
          <div class="house-content">
            <h3>${house.name}</h3>
            <p>${house.location}</p>
            <p><strong>${house.priceText}</strong></p>
            <p class="muted">Purpose: ${house.purpose}</p>
            <p class="muted"><strong>Landlord:</strong> ${house.landlord.name}</p>
            <p class="muted"><strong>Contact person:</strong> ${house.managerName}</p>
            ${house.landlord.verified ? `<span class="badge-verified">Verified Landlord</span>` : ""}
            <p style="margin-top:.55rem;">
              <span class="stars">${toStars(house.averageStars)}</span>
              (${house.averageStars})
            </p>
            <div class="unit-actions">
              <button class="primary-btn" data-open-house="${house.id}" type="button">View details</button>
              <button class="ghost-btn" data-open-services="${house.id}" type="button">Services</button>
              <a class="ghost-btn link-btn" href="${mapsUrl}" target="_blank" rel="noopener noreferrer">Google Maps</a>
            </div>
            <button
              class="${requestSent ? "ghost-btn" : "primary-btn"}"
              data-request-landlord="${house.id}"
              type="button"
              ${requestSent ? "disabled" : ""}
            >
              ${requestSent ? "Request sent" : "Request landlord"}
            </button>
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
                  ${sidebarProviders
                    .map(
                      (provider) => `
                        <article class="service-item">
                          <p><strong>${provider.type}</strong></p>
                          <p>${provider.name}</p>
                          <p class="muted">${provider.phone}</p>
                          <p class="muted">${provider.location}</p>
                        </article>
                      `
                    )
                    .join("")}
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
      setScreen("houseDetails", Number(button.dataset.openHouse));
    });
  });

  document.querySelectorAll("[data-open-services]").forEach((button) => {
    button.addEventListener("click", () => {
      state.servicesSidebarHouseId = Number(button.dataset.openServices);
      renderHouseList();
    });
  });

  if (selectedServiceHouse) {
    document.getElementById("closeServicesSidebar").addEventListener("click", () => {
      state.servicesSidebarHouseId = null;
      renderHouseList();
    });
  }

  document.querySelectorAll("[data-request-landlord]").forEach((button) => {
    button.addEventListener("click", () => {
      const houseId = Number(button.dataset.requestLandlord);
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

  document.getElementById("faqHelpFab").addEventListener("click", () => {
    state.faqOpen = !state.faqOpen;
    renderHouseList();
  });

  document.getElementById("closeFaqHelpPanel").addEventListener("click", () => {
    state.faqOpen = false;
    renderHouseList();
  });

  document.getElementById("contactHelpAgent").addEventListener("click", () => {
    showStatusToast("Help request sent. Agent will reply shortly.", "success");
  });
};

const renderHouseDetails = (house) => {
  if (!house) {
    app.innerHTML = `<p>House not found.</p>`;
    return;
  }

  const ratingsSummary = house.ratingBreakdown
    .map(
      (item) => `
        <div class="rating-item">
          <div class="row">
            <strong>${item.item}</strong>
            <span class="stars">${toStars(item.score)}</span>
          </div>
          <p class="muted">${item.comment}</p>
        </div>
      `
    )
    .join("");

  app.innerHTML = `
    <section class="screen">
      <button id="backToList" class="ghost-btn" type="button">← Back to units</button>
      <h2>House Details + Ratings</h2>
      <div class="split">
        <div>
          <img class="details-photo" src="${house.photo}" alt="${house.name}" />
        </div>
        <div class="card house-content">
          <h3>${house.name}</h3>
          <p>${house.fullAddress}</p>
          <p><strong>${house.priceText}</strong> • ${house.purpose}</p>
          <p><strong>Landlord:</strong> ${house.landlord.name} ${house.landlord.verified ? `<span class="badge-verified">Verified</span>` : ""}</p>
          <p><strong>Contact person:</strong> ${house.managerName}</p>
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
        <h3>5 Ratings from past tenants</h3>
        <div class="ratings-list">${ratingsSummary}</div>
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

  document.getElementById("appointmentForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const request = {
      houseId: house.id,
      date: formData.get("date"),
      time: formData.get("time"),
      message: safeText(formData.get("message")),
      to: house.managerName,
      createdAt: new Date().toISOString(),
    };
    state.appointmentRequests.push(request);

    if (!state.chats[house.id]) state.chats[house.id] = [];
    state.chats[house.id].push({
      from: "user",
      text: `Appointment request: ${request.date} at ${request.time}. ${request.message}`,
    });
    state.chats[house.id].push({
      from: "manager",
      text: `Hi, I am ${house.managerName}. I received your request and can host you at the chosen time.`,
    });

    showStatusToast("SMS sent to landlord and manager (simulated)");
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
    
    
  const items = state.houses
    .map(
      (house) => `
        <article class="card house-content">
          <h3>${house.name}</h3>
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

  app.innerHTML = `
    <section class="screen">
      <h2>Landlord Dashboard</h2>
      <p class="muted">Use the button to switch each property between vacant and occupied.</p>
      ${onboardingSummary}
      <button id="addHouseBtn" class="primary-btn">Add Property</button>
      <button id="generateCodeBtn" class="ghost-btn">Generate Tenant Code</button>
      <div class="house-grid">${items}</div>
    </section>
  `;
    document.getElementById("addHouseBtn").addEventListener("click", () => {
    setScreen("addHouse");
    });
    document.getElementById("generateCodeBtn").addEventListener("click", () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    showStatusToast("Tenant Code: " + code);
    });

  document.querySelectorAll("[data-toggle-occupancy]").forEach((button) => {
    button.addEventListener("click", () => {
      const houseId = Number(button.dataset.toggleOccupancy);
      const house = getHouseById(houseId);
      if (!house) return;
      house.occupancyStatus = house.occupancyStatus === "occupied" ? "vacant" : "occupied";
      house.isRented = house.occupancyStatus === "occupied";
      renderLandlordDashboard();
    });
  });
    document.getElementById("generateCodeBtn").onclick = () => {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  showStatusToast("Tenant Code: " + code);
};
};
  const renderAddHouse = () => {
  app.innerHTML = `
    <section class="screen">
      <button onclick="setScreen('dashboard')" class="ghost-btn">← Back</button>

      <div class="card house-content">
        <h2>Add Property</h2>

        <form id="houseForm">
          <input placeholder="Apartment Name" required />
          
          <label>Unit Category</label>
          <select>
            <option>Studio</option>
            <option>Bedsitter</option>
            <option>1 Bedroom</option>
          </select>

          <input type="number" placeholder="Number of Units" required />

          <input placeholder="Occupation Certificate Number" />
          <input placeholder="NCA Project ID" />

          <button class="primary-btn">Save Property</button>
        </form>
      </div>
    </section>
  `;

  document.getElementById("houseForm").onsubmit = (e) => {
    e.preventDefault();
    showStatusToast("Property added successfully");
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
      <p class="muted">Two fake ratings are already in data for demo. Add one more as a past tenant.</p>
      <form id="ratingForm">
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
    house.ratings.push(newRating);
    updateAverageRating(house);
    house.pastTenantComment = {
      text: newRating.comment,
      author: `${newRating.author}, former tenant`,
    };
    setScreen("houseDetails", house.id);
  });
};

const render = () => {
  const canOpenDashboard = state.isLoggedIn && (state.role === "landlord" || state.role === "tenant");
  dashboardBtn.style.visibility = canOpenDashboard ? "visible" : "hidden";
  dashboardBtn.textContent = state.role === "tenant" ? "Tenant Dashboard" : "Landlord Dashboard";
  heatmapBtn.style.visibility = state.isLoggedIn ? "visible" : "hidden";

  if (state.currentScreen === "login") return renderLogin();
  if (state.currentScreen === "landlordLogin") return renderLandlordLogin();
  if (state.currentScreen === "landlordRegister") return renderLandlordRegister();
  if (state.currentScreen === "tenantLogin") return renderTenantLogin();
  if (state.currentScreen === "tenantDashboard") return renderTenantDashboard();
  if (state.currentScreen === "menu") return renderMenu();
  if (state.currentScreen === "houseList") return renderHouseList();
  if (state.currentScreen === "houseDetails") return renderHouseDetails(getHouseById(state.selectedHouseId));
  if (state.currentScreen === "bookAppointment") return renderBookAppointment(getHouseById(state.selectedHouseId));
  if (state.currentScreen === "chat") return renderChat(getHouseById(state.selectedHouseId));
  if (state.currentScreen === "dashboard") return renderLandlordDashboard();
  if (state.currentScreen === "addHouse") return renderAddHouse();
  if (state.currentScreen === "addRating") return renderAddRating(getHouseById(state.selectedHouseId));
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

heatmapBtn.addEventListener("click", () => {
  const mapsUrl =
    "https://www.google.com/maps/dir/?api=1&origin=Kilimani,Nairobi&destination=Karen,Nairobi&waypoints=Westlands,Nairobi|Ruaka,Nairobi|Kileleshwa,Nairobi";
  window.open(mapsUrl, "_blank");
});

const bootstrap = async () => {
  try {
    const response = await fetch("data/houses.json");
    const data = await response.json();
    state.houses = data.houses.map((house) => ({
      ...house,
      occupancyStatus: house.occupancyStatus || (house.isRented ? "occupied" : "vacant"),
    }));
    render();
  } catch (error) {
    app.innerHTML = `<p>Unable to load house data. Please refresh.</p>`;
  }
};

bootstrap();
