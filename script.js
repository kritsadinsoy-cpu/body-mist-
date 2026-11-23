/* ==========================================================================
   Body Scent — script.js (shared by every page)
   Each feature runs only if its elements exist on the current page.
   - product.html : #filter-bar, #product-list
   - order.html   : #orderForm, #customerName, #contact, #items, #total, #note
   - admin.html   : #ordersTable tbody
   ========================================================================== */

(function () {
  "use strict";

  /* ---------- Config ---------- */
  var ORDER_ENDPOINT =
    "https://script.google.com/macros/s/AKfycbyW_pGX6JSZZhVN8bfPnjp6X7ujlzHJOzJK582pnMp_uuwHFQRDovgWbYns81Zy02uA/exec";

  var ORDERS_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQhKg3zBSArtIttwiuztNoRKAcQSxJN1hdx4dF6FcZeYUyD4d5P4TgtbtHbSfn4sjVA6hC9HQf_KrvJ/pub?gid=0&single=true&output=csv";

  var MOODS = [
    { key: "all", label: "ทั้งหมด" },
    { key: "fresh", label: "Fresh" },
    { key: "sweet", label: "Sweet" },
    { key: "confident", label: "Confident" },
    { key: "romance", label: "Romance" }
  ];

  var MOOD_LABELS = {
    fresh: "Fresh",
    sweet: "Sweet",
    confident: "Confident",
    romance: "Romance"
  };

  /* ---------- Helpers ---------- */
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function formatPrice(n) {
    return Number(n).toLocaleString("th-TH") + " บาท";
  }

  /* ======================================================================
     1) product.html — product cards + mood filter
     ====================================================================== */
  function initProductPage() {
    var filterBar = document.getElementById("filter-bar");
    var list = document.getElementById("product-list");
    if (!filterBar || !list) return;

    var products = [];
    var currentMood = "all";

    function validMood(m) {
      return MOODS.some(function (x) {
        return x.key === m;
      });
    }

    function buildCard(p) {
      var card = el("article", "product-card");
      card.setAttribute("data-mood", p.mood);

      var media = el("div", "product-card__media");
      var img = el("img");
      img.src = p.image;
      img.alt = p.name;
      img.loading = "lazy";
      media.appendChild(img);

      var body = el("div", "product-card__body");

      var moodRow = el("div", "product-card__mood");
      moodRow.appendChild(el("span", "mood-dot"));
      moodRow.appendChild(document.createTextNode(MOOD_LABELS[p.mood] || p.mood));

      var title = el("h3", "product-card__title", p.name);

      var meta = el("div", "product-card__meta");
      meta.appendChild(el("span", "size", p.size ? p.size : ""));
      meta.appendChild(el("span", "price", formatPrice(p.price)));

      // Item name sent to the order page (name + size when available)
      var itemName = p.size ? p.name + " " + p.size : p.name;
      var href =
        "order.html?item=" +
        encodeURIComponent(itemName) +
        "&price=" +
        encodeURIComponent(p.price);

      var btn = el("a", "btn btn-bronze btn-block", "สั่งซื้อ");
      btn.href = href;

      body.appendChild(moodRow);
      body.appendChild(title);
      body.appendChild(meta);
      body.appendChild(btn);

      card.appendChild(media);
      card.appendChild(body);
      return card;
    }

    function render() {
      list.innerHTML = "";
      var shown = products.filter(function (p) {
        return currentMood === "all" || p.mood === currentMood;
      });

      if (!shown.length) {
        list.appendChild(el("p", "notice", "ไม่พบสินค้าในหมวดนี้"));
        return;
      }
      shown.forEach(function (p) {
        list.appendChild(buildCard(p));
      });
    }

    function updateButtons() {
      var buttons = filterBar.querySelectorAll(".filter-btn");
      Array.prototype.forEach.call(buttons, function (b) {
        var active = b.getAttribute("data-filter") === currentMood;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-pressed", active ? "true" : "false");
      });
    }

    function setMood(mood) {
      currentMood = validMood(mood) ? mood : "all";
      updateButtons();
      render();
      // keep the URL in sync so the filtered view can be shared
      if (window.history && history.replaceState) {
        var url = new URL(window.location.href);
        if (currentMood === "all") url.searchParams.delete("mood");
        else url.searchParams.set("mood", currentMood);
        history.replaceState(null, "", url.toString());
      }
    }

    function buildFilterBar() {
      filterBar.innerHTML = "";
      MOODS.forEach(function (m) {
        var b = el("button", "filter-btn");
        b.type = "button";
        b.setAttribute("data-filter", m.key);
        if (m.key !== "all") {
          b.setAttribute("data-mood", m.key);
          b.appendChild(el("span", "mood-dot"));
        }
        b.appendChild(document.createTextNode(m.label));
        b.addEventListener("click", function () {
          setMood(m.key);
        });
        filterBar.appendChild(b);
      });
    }

    buildFilterBar();

    var initial = new URLSearchParams(window.location.search).get("mood");
    currentMood = initial && validMood(initial.toLowerCase()) ? initial.toLowerCase() : "all";
    updateButtons();

    fetch("products.json")
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        products = data;
        render();
      })
      .catch(function (err) {
        console.error(err);
        list.innerHTML = "";
        list.appendChild(el("p", "notice notice-error", "ไม่สามารถโหลดรายการสินค้าได้ กรุณาลองใหม่อีกครั้ง"));
      });
  }

  /* ======================================================================
     2) order.html — prefill from URL + submit order
     ====================================================================== */
  function initOrderPage() {
    var form = document.getElementById("orderForm");
    if (!form) return;

    var itemsInput = document.getElementById("items");
    var totalInput = document.getElementById("total");

    // Prefill item + price from URL parameters
    var params = new URLSearchParams(window.location.search);
    var item = params.get("item");
    var price = params.get("price");
    if (itemsInput && item) itemsInput.value = item;
    if (totalInput && price) totalInput.value = price;

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      if (typeof form.reportValidity === "function" && !form.reportValidity()) return;

      var payload = {
        customerName: document.getElementById("customerName").value,
        contact: document.getElementById("contact").value,
        items: document.getElementById("items").value,
        total: document.getElementById("total").value,
        note: document.getElementById("note").value
      };

      fetch(ORDER_ENDPOINT, {
        method: "POST",
        body: JSON.stringify(payload)
      })
        .then(function () {
          window.location.href = "thankyou.html";
        })
        .catch(function (error) {
          console.error(error);
          alert("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
        });
    });
  }

  /* ======================================================================
     3) admin.html — read orders from the published Google Sheet (CSV)
     ====================================================================== */

  // Minimal CSV parser: handles quoted fields, escaped quotes ("") and
  // line breaks inside quotes. Returns an array of rows (arrays of strings).
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;

    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM

    for (var i = 0; i < text.length; i++) {
      var c = text[i];

      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += c;
      }
    }

    // last field / row (file without trailing newline)
    if (field !== "" || row.length) {
      row.push(field);
      rows.push(row);
    }

    return rows.filter(function (r) {
      return r.some(function (cell) {
        return cell.trim() !== "";
      });
    });
  }

  function initAdminPage() {
    var tbody = document.querySelector("#ordersTable tbody");
    if (!tbody) return;

    function showMessage(text) {
      tbody.innerHTML = "";
      var tr = document.createElement("tr");
      var td = document.createElement("td");
      td.colSpan = 6;
      td.textContent = text;
      tr.appendChild(td);
      tbody.appendChild(tr);
    }

    showMessage("กำลังโหลดข้อมูล...");

    // timestamp param avoids a stale cached copy of the sheet
    var sep = ORDERS_CSV_URL.indexOf("?") === -1 ? "?" : "&";
    fetch(ORDERS_CSV_URL + sep + "t=" + Date.now())
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (text) {
        var rows = parseCSV(text);

        // Row 0 is the header row of the sheet; skip it.
        // Columns: A timestamp, B customerName, C contact, D items, E total, F note.
        var data = rows.slice(1);

        if (!data.length) {
          showMessage("ยังไม่มีรายการสั่งซื้อ");
          return;
        }

        // New orders are appended at the bottom of the sheet → newest first
        data.reverse();

        tbody.innerHTML = "";
        data.forEach(function (r) {
          var tr = document.createElement("tr");
          for (var i = 0; i < 6; i++) {
            var td = document.createElement("td");
            td.textContent = r[i] !== undefined ? r[i] : "";
            tr.appendChild(td);
          }
          tbody.appendChild(tr);
        });
      })
      .catch(function (err) {
        console.error(err);
        showMessage("ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
      });
  }

  /* ---------- Init ---------- */
  function init() {
    initProductPage();
    initOrderPage();
    initAdminPage();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
