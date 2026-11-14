const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const workspace = $("#workspace");
const errorBox = $("#dashboard-error");
const staticShowcase = document.documentElement.dataset.mode === "showcase";
let selectedGuildId = null;
let inviteUrl = "";

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("on");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove("on"), 4200);
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return response.status === 204 ? null : response.json();
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

function hideError() {
  errorBox.textContent = "";
  errorBox.classList.add("hidden");
}

function createServerCard(guild) {
  const card = document.createElement("article");
  card.className = "server-card";
  const icon = guild.icon ? document.createElement("img") : document.createElement("div");
  if (guild.icon) {
    icon.src = guild.icon;
    icon.alt = "";
  } else {
    icon.className = "server-placeholder";
    icon.textContent = guild.name.slice(0, 1).toUpperCase();
  }
  const details = document.createElement("div");
  const name = document.createElement("strong");
  name.textContent = guild.name;
  const hint = document.createElement("small");
  hint.textContent = guild.botPresent ? "Connected · Manage your tools" : "Add the bot to manage this server";
  details.append(name, hint);
  const action = document.createElement(guild.botPresent ? "button" : "a");
  action.className = "server-action";
  action.textContent = guild.botPresent ? "→" : "+";
  if (guild.botPresent) {
    action.type = "button";
    action.setAttribute("aria-label", `Configure ${guild.name}`);
    action.addEventListener("click", () => loadSettings(guild));
  } else {
    action.href = `${inviteUrl}&guild_id=${encodeURIComponent(guild.id)}&disable_guild_select=true`;
    action.target = "_blank";
    action.rel = "noreferrer";
    action.setAttribute("aria-label", `Add GuildPilot to ${guild.name}`);
  }
  card.append(icon, details, action);
  return card;
}

async function loadServers() {
  hideError();
  const list = $("#server-list");
  list.replaceChildren();
  try {
    const guilds = await request("/api/guilds");
    if (!guilds.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state mono";
      empty.textContent = "No servers with Manage Server permission found on this account.";
      list.append(empty);
      return;
    }
    guilds.forEach((guild) => list.append(createServerCard(guild)));
  } catch (error) {
    showError(error.message);
  }
}

async function loadSettings(guild) {
  hideError();
  try {
    const data = await request(`/api/guilds/${guild.id}/settings`);
    selectedGuildId = guild.id;
    $("#selected-server-name").textContent = guild.name;
    const select = $("#welcome-channel");
    select.replaceChildren();
    const defaultChannel = document.createElement("option");
    defaultChannel.value = "";
    defaultChannel.textContent = "Use #welcome (or server system channel)";
    select.append(defaultChannel);
    data.channels.forEach((channel) => {
      const option = document.createElement("option");
      option.value = channel.id;
      option.textContent = `#${channel.name}`;
      select.append(option);
    });
    select.value = data.settings.welcomeChannelId || "";
    $("#welcome-message").value = data.settings.welcomeMessage;
    $("#welcome-enabled").checked = data.settings.welcomeEnabled;
    $("#leveling-enabled").checked = data.settings.levelingEnabled;
    $("#antispam-enabled").checked = data.settings.antiSpamEnabled;
    $("#save-status").textContent = "";
    $("#settings-panel").classList.remove("hidden");
    $("#settings-panel").scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (error) {
    showError(error.message);
  }
}

async function saveSettings() {
  if (!selectedGuildId) return;
  const button = $("#save-settings");
  const status = $("#save-status");
  button.disabled = true;
  status.textContent = "Saving…";
  hideError();
  try {
    await request(`/api/guilds/${selectedGuildId}/settings`, {
      method: "PUT",
      body: JSON.stringify({
        welcomeChannelId: $("#welcome-channel").value || null,
        welcomeMessage: $("#welcome-message").value,
        welcomeEnabled: $("#welcome-enabled").checked,
        levelingEnabled: $("#leveling-enabled").checked,
        antiSpamEnabled: $("#antispam-enabled").checked,
      }),
    });
    status.textContent = "Saved";
    showToast("Server settings saved.");
  } catch (error) {
    status.textContent = "";
    showError(error.message);
  } finally {
    button.disabled = false;
  }
}

function setupInteractions() {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobile = window.matchMedia("(max-width: 768px)");
  if (reducedMotion) document.documentElement.classList.add("flat");

  const items = $$("#tree li");
  const pilot = $(".pilot");
  const count = $("#cnt");
  const setup = $("#setup");
  const pan = $("#pan");
  const track = $("#track");
  const cards = $$(".pc");
  const planes = $$(".pl");
  const background = $("#bg");
  let pointerX = 0;
  let pointerY = 0;
  let currentX = 0;
  let currentY = 0;
  window.addEventListener("pointermove", (event) => {
    pointerX = event.clientX / window.innerWidth - 0.5;
    pointerY = event.clientY / window.innerHeight - 0.5;
  }, { passive: true });

  const clamp = (value) => Math.max(0, Math.min(1, value));
  const progress = (element) => {
    const rect = element.getBoundingClientRect();
    return clamp(-rect.top / Math.max(1, rect.height - window.innerHeight));
  };
  function animate() {
    const progressValue = reducedMotion ? 1 : progress(setup);
    const total = items.length;
    let visibleCount = 0;
    let lastVisible = null;
    items.forEach((item, index) => {
      const visible = progressValue * (total + 0.6) > index;
      item.classList.toggle("on", visible);
      if (visible) {
        lastVisible = item;
        visibleCount++;
      }
    });
    if (lastVisible) {
      pilot.style.transform = `translateY(${lastVisible.offsetTop + lastVisible.offsetHeight / 2 - 5}px)`;
    }
    count.textContent = `Created ${visibleCount} of ${total}`;

    if (!reducedMotion) {
      background.style.setProperty("--k", (0.8 + 0.45 * Math.sin(progressValue * Math.PI)).toFixed(3));
      currentX += (pointerX - currentX) * 0.08;
      currentY += (pointerY - currentY) * 0.08;
      const scrollY = Math.min(window.scrollY, window.innerHeight);
      planes.forEach((plane) => {
        const depth = Number(plane.dataset.d);
        plane.style.transform = `translate3d(${currentX * depth * -44}px,${currentY * depth * -32 - scrollY * depth * 0.14}px,0)`;
      });
      if (!mobile.matches) {
        track.style.transform = `translateX(${-progress(pan) * Math.max(0, track.scrollWidth - window.innerWidth)}px)`;
        let nearest = 0;
        let nearestDistance = Infinity;
        cards.forEach((card, index) => {
          const rect = card.getBoundingClientRect();
          const distance = Math.abs(rect.left + rect.width / 2 - window.innerWidth / 2);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearest = index;
          }
        });
        cards.forEach((card, index) => card.classList.toggle("on", index === nearest));
      } else {
        track.style.transform = "";
      }
    }
    window.requestAnimationFrame(animate);
  }
  animate();
}

async function initialize() {
  if (staticShowcase) {
    const actionLinks = new Set([
      ...$$('a[href="/auth/login"]'),
      ...["#nav-invite", "#hero-invite", "#footer-invite"].map($),
    ]);
    actionLinks.forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        showToast(link.id.includes("invite")
          ? "This public showcase is visual only. Connect GuildPilot to Discord to invite the bot."
          : "The dashboard requires the GuildPilot app to be running with Discord credentials.");
      });
    });
    return;
  }

  try {
    const config = await request("/api/config");
    inviteUrl = config.inviteUrl;
    const inviteLinks = ["#nav-invite", "#hero-invite", "#footer-invite"].map($);
    if (config.demo) {
      inviteLinks.forEach((link) => {
        link.href = "#close";
        link.addEventListener("click", (event) => {
          event.preventDefault();
          showToast("Demo mode: add your Discord bot credentials to .env to invite GuildPilot.");
        });
      });
    } else {
      inviteLinks.forEach((link) => {
        link.href = inviteUrl;
        link.target = "_blank";
        link.rel = "noreferrer";
      });
    }
  } catch {
    if (window.location.protocol !== "file:") {
      showToast("Discord invite is available when GuildPilot is running.");
    }
  }

  if (window.location.protocol !== "file:") {
    try {
      const health = await request("/api/health");
      if ($("#bot-status")) $("#bot-status").textContent = health.botReady ? "Bot online" : "Bot connecting";
      const user = await request("/api/me");
      if (user.authenticated) {
        workspace.classList.remove("hidden");
        $("#dashboard-mode").textContent = user.demo
          ? "Local demo mode · Settings save on this computer; Discord is not connected."
          : "";
        await loadServers();
      }
    } catch (error) {
      showError(`Could not load your dashboard: ${error.message}`);
    }
  }
}

$("#refresh-servers").addEventListener("click", loadServers);
$("#save-settings").addEventListener("click", saveSettings);
setupInteractions();
initialize();
