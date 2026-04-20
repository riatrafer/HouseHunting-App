const app = document.getElementById("app");
const dashboardBtn = document.getElementById("dashboardBtn");
const heatmapBtn = document.getElementById("heatmapBtn");

const state = {
  houses: [],
  currentScreen: "login",
  selectedHouseId: null,
  isLoggedIn: false,
  appointmentRequests: [],
  chats: {},
};

const STARS_OUT_OF_5 = 5;

const toStars = (value) => {
  const rounded = Math.round(value);
  return "★".repeat(rounded) + "☆".repeat(STARS_OUT_OF_5 - rounded);
};

const getHouseById = (houseId) => state.houses.find((h) => h.id === houseId);

const safeText = (text) => (text ?? "").toString().trim();

const setScreen = (screen, houseId = null) => {
  state.currentScreen = screen;
  state.selectedHouseId = houseId;
  render();
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
        <p class="muted">Login is mocked for demo judges. You can skip directly into the app.</p>
        <form id="loginForm">
          <label>
            Full name
            <input type="text" name="name" placeholder="Jane Doe" />
          </label>
          <label>
            Email
            <input type="email" name="email" placeholder="jane@email.com" />
          </label>
          <label style="display:flex; align-items:center; gap:.5rem;">
            <input type="checkbox" name="hasId" />
            I have an ID.
          </label>
          <div class="row">
            <button class="primary-btn" type="submit">Login (Demo)</button>
            <button class="ghost-btn" id="skipBtn" type="button">Skip</button>
          </div>
        </form>
      </div>
    </section>
  `;

  document.getElementById("loginForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const hasId = !!formData.get("hasId");
    state.houses.forEach((house) => {
      if (hasId) {
        house.landlord.verified = true;
      }
    });
    state.isLoggedIn = true;
    setScreen("houseList");
  });

  document.getElementById("skipBtn").addEventListener("click", () => {
    state.isLoggedIn = true;
    setScreen("houseList");
  });
};

const renderHouseList = () => {
  const availableHouses = state.houses.filter((house) => !house.isRented);
  const cards = availableHouses
    .map(
      (house) => `
        <article class="card">
          <img class="house-image" src="${house.photo}" alt="${house.name}" />
          <div class="house-content">
            <h3>${house.name}</h3>
            <p>${house.location}</p>
            <p><strong>${house.priceText}</strong></p>
            <p class="muted">Purpose: ${house.purpose}</p>
            ${house.landlord.verified ? `<span class="badge-verified">Verified Landlord</span>` : ""}
            <p style="margin-top:.55rem;">
              <span class="stars">${toStars(house.averageStars)}</span>
              (${house.averageStars})
            </p>
            <button class="primary-btn" data-open-house="${house.id}" type="button">View details</button>
          </div>
        </article>
      `
    )
    .join("");

  app.innerHTML = `
    <section class="screen">
      <div class="banner">New house matches your search.</div>
      <h2>Screen 1 – House List</h2>
      <div class="house-grid">${cards || "<p>No houses available right now.</p>"}</div>
    </section>
  `;

  document.querySelectorAll("[data-open-house]").forEach((button) => {
    button.addEventListener("click", () => {
      setScreen("houseDetails", Number(button.dataset.openHouse));
    });
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
      <button id="backToList" class="ghost-btn" type="button">← Back to house list</button>
      <h2>Screen 2 – House Details + Ratings</h2>
      <div class="split">
        <div>
          <img class="details-photo" src="${house.photo}" alt="${house.name}" />
        </div>
        <div class="card house-content">
          <h3>${house.name}</h3>
          <p>${house.fullAddress}</p>
          <p><strong>${house.priceText}</strong> • ${house.purpose}</p>
          <p>
            Landlord: <strong>${house.landlord.name}</strong>
            ${house.landlord.verified ? `<span class="badge-verified">Verified</span>` : ""}
          </p>
          <p>
            <span class="stars">${toStars(house.averageStars)}</span>
            (${house.averageStars})
          </p>
          <button id="bookBtn" class="primary-btn" type="button">Book appointment to see the house</button>
          <button id="addRatingBtn" class="ghost-btn" style="margin-top:.5rem;" type="button">Add rating</button>
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

  document.getElementById("backToList").addEventListener("click", () => setScreen("houseList"));
  document.getElementById("bookBtn").addEventListener("click", () => setScreen("bookAppointment", house.id));
  document.getElementById("addRatingBtn").addEventListener("click", () => setScreen("addRating", house.id));
};

const renderBookAppointment = (house) => {
  if (!house) {
    app.innerHTML = `<p>House not found.</p>`;
    return;
  }

  app.innerHTML = `
    <section class="screen">
      <button id="backToDetails" class="ghost-btn" type="button">← Back to details</button>
      <h2>Screen 3 – Book Appointment</h2>
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

    setScreen("chat", house.id);
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
      <h2>Screen 4 – Chat</h2>
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
          <p class="muted">Views: ${house.fakeViews}</p>
          <p class="muted">Messages: ${house.fakeMessages + (state.chats[house.id]?.length || 0)}</p>
          <button class="danger-btn" data-rent-house="${house.id}" type="button">
            Mark as rented
          </button>
        </article>
      `
    )
    .join("");

  app.innerHTML = `
    <section class="screen">
      <h2>Screen 5 – Landlord Dashboard</h2>
      <p class="muted">Marking a house as rented removes it from the house list.</p>
      <div class="house-grid">${items}</div>
    </section>
  `;

  document.querySelectorAll("[data-rent-house]").forEach((button) => {
    button.addEventListener("click", () => {
      const houseId = Number(button.dataset.rentHouse);
      const house = getHouseById(houseId);
      if (!house) return;
      house.isRented = true;
      renderLandlordDashboard();
    });
  });
};

const renderAddRating = (house) => {
  if (!house) {
    app.innerHTML = `<p>House not found.</p>`;
    return;
  }

  app.innerHTML = `
    <section class="screen">
      <button id="backToDetailsFromRating" class="ghost-btn" type="button">← Back to details</button>
      <h2>Screen 6 – Add Rating</h2>
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
  dashboardBtn.style.visibility = state.isLoggedIn ? "visible" : "hidden";
  heatmapBtn.style.visibility = state.isLoggedIn ? "visible" : "hidden";

  if (state.currentScreen === "login") return renderLogin();
  if (state.currentScreen === "houseList") return renderHouseList();
  if (state.currentScreen === "houseDetails") return renderHouseDetails(getHouseById(state.selectedHouseId));
  if (state.currentScreen === "bookAppointment") return renderBookAppointment(getHouseById(state.selectedHouseId));
  if (state.currentScreen === "chat") return renderChat(getHouseById(state.selectedHouseId));
  if (state.currentScreen === "dashboard") return renderLandlordDashboard();
  if (state.currentScreen === "addRating") return renderAddRating(getHouseById(state.selectedHouseId));
  return renderHouseList();
};

dashboardBtn.addEventListener("click", () => setScreen("dashboard"));

heatmapBtn.addEventListener("click", () => {
  const mapsUrl =
    "https://www.google.com/maps/dir/?api=1&origin=Kilimani,Nairobi&destination=Karen,Nairobi&waypoints=Westlands,Nairobi|Ruaka,Nairobi|Kileleshwa,Nairobi";
  window.open(mapsUrl, "_blank");
});

const bootstrap = async () => {
  const response = await fetch("data/houses.json");
  const data = await response.json();
  state.houses = data.houses;
  render();
};

bootstrap();
