/* V&L Landscape — season explorer, year-round plan builder, quote flow.
   No backend: a valid submit shows a review panel; the visitor sends the
   composed request from their own text app via an sms: link to V&L. */
(function () {
  "use strict";

  var SMS_NUMBER = "+18564343578";
  var STORE_KEY = "vlPlan";
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var SEASONS = [
    { id: "spring", name: "Spring", theme: "Growth Preparation",
      services: ["Property Clean-up", "Weed Control", "Aeration", "Seeding", "Debris Removal"] },
    { id: "summer", name: "Summer", theme: "Maintenance and Monitoring",
      services: ["Routine Mowing", "Edging", "Irrigation Monitoring", "Pest Control", "Storm Recovery"] },
    { id: "fall", name: "Fall", theme: "Root Recovery & Winterization",
      services: ["Root Recovery", "Winterization", "Leaf Removal", "Bush Trimming", "Gutter Cleaning"] },
    { id: "winter", name: "Winter", theme: "Hardscape & Preparation",
      services: ["Hardscape Protection", "Equipment Maintenance", "Planning for next year"] }
  ];
  var STRIPS = {
    spring: "This season: property clean-up, aeration, and seeding — while the ground is ready for them.",
    summer: "This season: routine mowing, edging, and irrigation monitoring — plus storm recovery when the weather turns.",
    fall: "This season: leaf removal, gutter cleaning, and winterization — before the first hard freeze.",
    winter: "This season: hardscape protection, equipment maintenance, and planning for next year."
  };
  var SEASON_OF = {};
  SEASONS.forEach(function (s) {
    s.services.forEach(function (name) { SEASON_OF[name] = s; });
  });

  function seasonNow() {
    var m = new Date().getMonth();
    if (m >= 2 && m <= 4) { return "spring"; }
    if (m >= 5 && m <= 7) { return "summer"; }
    if (m >= 8 && m <= 10) { return "fall"; }
    return "winter";
  }
  function scrollToEl(el) {
    el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }

  /* ---------- Plan state ---------- */
  var plan = [];
  try {
    var saved = JSON.parse(window.sessionStorage.getItem(STORE_KEY) || "[]");
    if (Array.isArray(saved)) {
      saved.forEach(function (name) {
        if (SEASON_OF[name] && plan.indexOf(name) === -1) { plan.push(name); }
      });
    }
  } catch (e) { plan = []; }

  var live = document.getElementById("plan-live");
  var lastAnnounced = "";
  function announce(text) {
    if (text === lastAnnounced) { text += " "; }
    lastAnnounced = text;
    live.textContent = text;
  }
  function persist() {
    try { window.sessionStorage.setItem(STORE_KEY, JSON.stringify(plan)); } catch (e) {}
  }
  function planGroups() {
    return SEASONS.map(function (s) {
      return { season: s, items: s.services.filter(function (n) { return plan.indexOf(n) !== -1; }) };
    }).filter(function (g) { return g.items.length > 0; });
  }

  /* ---------- Rendering: rows, groups, tray, steps, sticky ---------- */
  var rowByService = {};
  Array.prototype.forEach.call(document.querySelectorAll(".service-row"), function (row) {
    rowByService[row.getAttribute("data-service")] = row;
  });
  var groupHosts = [
    document.getElementById("plan-groups-panel"),
    document.getElementById("plan-groups-form")
  ];
  var emptyHosts = [
    document.getElementById("plan-empty-panel"),
    document.getElementById("plan-empty-form")
  ];

  function groupsHTML() {
    return planGroups().map(function (g) {
      var items = g.items.map(function (name) {
        return '<li><span>' + name + '</span>' +
          '<button type="button" class="remove-btn" data-remove="' + name +
          '" aria-label="Remove ' + name + '">×</button></li>';
      }).join("");
      return '<div class="plan-group"><p class="plan-group-label">' +
        '<span class="season-dot dot-' + g.season.id + '" aria-hidden="true"></span>' +
        g.season.name + " — " + g.season.theme + "</p><ul>" + items + "</ul></div>";
    }).join("");
  }

  var quoteInView = false;
  var reviewVisible = false;

  function renderPlan(changedService, added) {
    invalidateReview();
    Object.keys(rowByService).forEach(function (name) {
      var row = rowByService[name];
      var on = plan.indexOf(name) !== -1;
      row.setAttribute("aria-pressed", on ? "true" : "false");
      row.querySelector(".row-state").textContent = on ? "Added" : "Add";
    });
    var html = groupsHTML();
    groupHosts.forEach(function (host) { host.innerHTML = html; });
    var n = plan.length;
    emptyHosts.forEach(function (el) { el.hidden = n > 0; });
    var total = document.getElementById("plan-total-panel");
    var groups = planGroups().length;
    total.hidden = n === 0;
    if (n > 0) {
      total.textContent = n + (n === 1 ? " service · " : " services · ") +
        groups + (groups === 1 ? " season" : " seasons");
    }
    document.getElementById("plan-cta").hidden = n === 0;
    document.getElementById("plan-clear-panel").hidden = n === 0;
    var hint = document.getElementById("builder-hint");
    var count = document.getElementById("plan-count");
    hint.hidden = n > 0;
    count.hidden = n === 0;
    if (n > 0) {
      document.getElementById("plan-count-n").textContent =
        n + (n === 1 ? " service" : " services");
      count.classList.remove("bump");
      void count.offsetWidth;
      count.classList.add("bump");
    }
    if (changedService) {
      announce(changedService + (added ? " added — " : " removed — ") +
        n + (n === 1 ? " service" : " services") + " in your plan");
    }
    if (n > 0) { clearPlanError(); }
    renderSteps();
    renderSticky();
    persist();
  }

  function renderSteps() {
    var current = reviewVisible ? 3 : (plan.length > 0 ? 2 : 1);
    Array.prototype.forEach.call(document.querySelectorAll(".step"), function (li) {
      var s = parseInt(li.getAttribute("data-step"), 10);
      li.classList.toggle("is-done", s < current);
      if (s === current) { li.setAttribute("aria-current", "step"); }
      else { li.removeAttribute("aria-current"); }
    });
  }

  var stickyAction = document.getElementById("sticky-action");
  function renderSticky() {
    if (quoteInView) { stickyAction.textContent = "Review & Text"; }
    else if (plan.length > 0) { stickyAction.textContent = "My Plan (" + plan.length + ")"; }
    else { stickyAction.textContent = "Free Estimate"; }
  }
  stickyAction.addEventListener("click", function (event) {
    if (quoteInView) {
      event.preventDefault();
      scrollToEl(reviewVisible ? reviewPanel : submitBtn);
    } else if (plan.length > 0) {
      event.preventDefault();
      scrollToEl(document.getElementById("plan-card"));
    }
  });

  function toggleService(name) {
    var i = plan.indexOf(name);
    if (i === -1) { plan.push(name); renderPlan(name, true); }
    else { plan.splice(i, 1); renderPlan(name, false); }
  }
  Object.keys(rowByService).forEach(function (name) {
    rowByService[name].addEventListener("click", function () { toggleService(name); });
  });
  document.addEventListener("click", function (event) {
    var btn = event.target.closest ? event.target.closest("[data-remove]") : null;
    if (btn) { toggleService(btn.getAttribute("data-remove")); }
  });
  document.getElementById("plan-clear-panel").addEventListener("click", function () {
    plan = [];
    renderPlan();
    announce("Plan cleared — 0 services in your plan");
  });

  /* ---------- Season explorer tabs ---------- */
  var tabs = Array.prototype.slice.call(document.querySelectorAll(".season-tab"));
  var panels = {};
  SEASONS.forEach(function (s) { panels[s.id] = document.getElementById(s.id); });
  var currentSeason = seasonNow();
  tabs.forEach(function (tab) {
    if (tab.getAttribute("data-tab") === currentSeason) {
      var badge = document.createElement("span");
      badge.className = "now-badge";
      badge.textContent = "Now";
      tab.querySelector(".tab-label").appendChild(badge);
    }
  });
  document.getElementById("season-strip").textContent = STRIPS[currentSeason];

  function selectSeason(id, moveFocusToPanel) {
    tabs.forEach(function (tab) {
      var on = tab.getAttribute("data-tab") === id;
      tab.setAttribute("aria-selected", on ? "true" : "false");
      tab.tabIndex = on ? 0 : -1;
    });
    SEASONS.forEach(function (s) {
      var panel = panels[s.id];
      var on = s.id === id;
      panel.hidden = !on;
      panel.classList.remove("is-entering");
      if (on && !reduceMotion) { void panel.offsetWidth; panel.classList.add("is-entering"); }
    });
    if (moveFocusToPanel) {
      document.getElementById("panel-heading-" + id).focus({ preventScroll: true });
    }
  }
  tabs.forEach(function (tab, i) {
    tab.addEventListener("click", function () { selectSeason(tab.getAttribute("data-tab"), false); });
    tab.addEventListener("keydown", function (event) {
      var j = null;
      if (event.key === "ArrowRight") { j = (i + 1) % tabs.length; }
      else if (event.key === "ArrowLeft") { j = (i - 1 + tabs.length) % tabs.length; }
      else if (event.key === "Home") { j = 0; }
      else if (event.key === "End") { j = tabs.length - 1; }
      else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectSeason(tab.getAttribute("data-tab"), true);
        return;
      } else { return; }
      event.preventDefault();
      selectSeason(tabs[j].getAttribute("data-tab"), false);
      tabs[j].focus();
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll(".season-links a"), function (a) {
    a.addEventListener("click", function () {
      selectSeason(a.getAttribute("href").slice(1), false);
    });
  });
  var initial = currentSeason;
  if (window.location.hash && panels[window.location.hash.slice(1)]) {
    initial = window.location.hash.slice(1);
  }
  selectSeason(initial, false);

  /* ---------- Quote form ---------- */
  var form = document.getElementById("quote-form");
  var status = document.getElementById("form-status");
  var errorSummary = document.getElementById("form-errors");
  var reviewPanel = document.getElementById("review-panel");
  var reviewText = document.getElementById("review-text");
  var reviewOpen = document.getElementById("review-open");
  var submitBtn = document.getElementById("submit-btn");
  var nameEl = document.getElementById("field-name");
  var phoneEl = document.getElementById("field-phone");
  var townEl = document.getElementById("field-town");
  var messageEl = document.getElementById("field-message");
  var errPlan = document.getElementById("err-plan");

  function digits(v) { return v.replace(/\D/g, ""); }
  function setErr(input, errId, bad) {
    var err = document.getElementById(errId);
    if (bad) { input.setAttribute("aria-invalid", "true"); err.hidden = false; }
    else { input.removeAttribute("aria-invalid"); err.hidden = true; }
    return !bad;
  }
  function planSatisfied() { return plan.length > 0 || messageEl.value.trim() !== ""; }
  function clearPlanError() { errPlan.hidden = true; }
  function validateField(kind) {
    if (kind === "name") { return setErr(nameEl, "err-name", nameEl.value.trim() === ""); }
    if (kind === "phone") { return setErr(phoneEl, "err-phone", digits(phoneEl.value).length < 7); }
    if (kind === "town") { return setErr(townEl, "err-town", false); }
    return true;
  }
  /* The review panel is a snapshot of one submitted state. Any later change
     to the plan (renderPlan above routes every toggle / remove / clear
     through here) or to a field un-submits it: the panel closes and the
     progress steps fall back, so a visible panel can never describe a
     request the visitor has already changed (QA defect Q-1). */
  function invalidateReview() {
    if (!reviewVisible) { return; }
    reviewVisible = false;
    reviewPanel.hidden = true;
    renderSteps();
    renderSticky();
  }

  [["name", nameEl], ["phone", phoneEl], ["town", townEl]].forEach(function (pair) {
    var kind = pair[0], el = pair[1];
    el.addEventListener("blur", function () { validateField(kind); });
    el.addEventListener("input", function () {
      invalidateReview();
      if (el.getAttribute("aria-invalid") === "true") { validateField(kind); }
    });
  });
  messageEl.addEventListener("input", function () {
    invalidateReview();
    if (planSatisfied()) { clearPlanError(); }
  });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      quoteInView = entries[0].isIntersecting;
      renderSticky();
    }, { threshold: 0.05 }).observe(document.getElementById("quote"));
  }

  function composeBody() {
    var lines = [
      "Free quote request from the V&L Landscape website:",
      "Name: " + nameEl.value.trim(),
      "Phone: " + phoneEl.value.trim()
    ];
    if (townEl.value.trim() !== "") { lines.push("Town/Address: " + townEl.value.trim()); }
    if (plan.length === 1) {
      lines.push("Service: " + plan[0]);
    } else if (plan.length > 1) {
      lines.push("Year-round plan request:");
      planGroups().forEach(function (g) {
        lines.push(g.season.name + " — " + g.season.theme + ":");
        g.items.forEach(function (name) { lines.push("- " + name); });
      });
    }
    if (messageEl.value.trim() !== "") { lines.push("Message: " + messageEl.value.trim()); }
    return lines.join("\n");
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    status.textContent = "";
    errorSummary.hidden = true;
    errorSummary.textContent = "";

    var problems = [];
    if (!validateField("name")) { problems.push("your name"); }
    if (!validateField("phone")) { problems.push("a phone number V&L can reach"); }
    validateField("town");
    if (!planSatisfied()) {
      errPlan.hidden = false;
      problems.push("the services for your plan — or a note in “Anything else?”");
    } else { clearPlanError(); }

    if (problems.length > 0) {
      errorSummary.textContent =
        "Almost there — the form still needs " + problems.join(", ") +
        ". Your entries are saved below. Rather call? Call 856-434-3578.";
      errorSummary.hidden = false;
      errorSummary.focus();
      return;
    }

    var body = composeBody();
    reviewText.textContent = body;
    reviewOpen.setAttribute("href", "sms:" + SMS_NUMBER + "?&body=" + encodeURIComponent(body));
    reviewVisible = true;
    reviewPanel.hidden = false;
    renderSteps();
    renderSticky();
    reviewPanel.focus({ preventScroll: true });
    scrollToEl(reviewPanel);
  });

  /* ---------- Copy fallback (IX-5) ---------- */
  var copyStatus = document.getElementById("copy-status");
  document.getElementById("review-copy").addEventListener("click", function () {
    var text = reviewText.textContent;
    function fallback() {
      var box = document.getElementById("copy-fallback");
      var area = document.getElementById("copy-area");
      area.value = text;
      box.hidden = false;
      area.focus();
      area.select();
      copyStatus.textContent = "Select the text above and copy it — then paste it into any message or read it on a call.";
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        copyStatus.textContent = "Copied — paste it into a text to 856-434-3578, or read it on a call.";
      }, fallback);
    } else { fallback(); }
  });

  /* ---------- Init ---------- */
  renderPlan();
  if (plan.length > 0) {
    announce(plan.length + (plan.length === 1 ? " service" : " services") + " in your plan");
  }
})();
