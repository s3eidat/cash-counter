/* Cash Counter — all money is kept as whole minor units (fils, cents), so totals never pick up float errors. */
(function () {
  "use strict";
  var $ = S3.$, $$ = S3.$$;
  var KEY = "cash.v1";

  // Denominations are in minor units. n = notes, c = coins. [value, English label, Arabic label]
  var CURRENCIES = {
    JOD: { name: "Jordanian dinar", ar: "دينار أردني", sym: "JD", dec: 3,
      n: [[50000, "50 JD", "٥٠ ديناراً"], [20000, "20 JD", "٢٠ ديناراً"], [10000, "10 JD", "١٠ دنانير"], [5000, "5 JD", "٥ دنانير"], [1000, "1 JD", "دينار"]],
      c: [[500, "½ dinar", "نصف دينار"], [250, "¼ dinar", "ربع دينار"], [100, "10 piasters", "١٠ قروش"], [50, "5 piasters", "٥ قروش"], [10, "1 piaster", "قرش"]] },
    USD: { name: "US dollar", ar: "دولار أمريكي", sym: "$", dec: 2,
      n: [[10000, "$100"], [5000, "$50"], [2000, "$20"], [1000, "$10"], [500, "$5"], [200, "$2"], [100, "$1"]],
      c: [[50, "50¢"], [25, "25¢"], [10, "10¢"], [5, "5¢"], [1, "1¢"]] },
    EUR: { name: "Euro", ar: "يورو", sym: "€", dec: 2,
      n: [[50000, "€500"], [20000, "€200"], [10000, "€100"], [5000, "€50"], [2000, "€20"], [1000, "€10"], [500, "€5"]],
      c: [[200, "€2"], [100, "€1"], [50, "50 cent"], [20, "20 cent"], [10, "10 cent"], [5, "5 cent"], [2, "2 cent"], [1, "1 cent"]] },
    SAR: { name: "Saudi riyal", ar: "ريال سعودي", sym: "SAR", dec: 2,
      n: [[50000, "500 SAR", "٥٠٠ ريال"], [20000, "200 SAR", "٢٠٠ ريال"], [10000, "100 SAR", "١٠٠ ريال"], [5000, "50 SAR", "٥٠ ريالاً"], [1000, "10 SAR", "١٠ ريالات"], [500, "5 SAR", "٥ ريالات"], [100, "1 SAR note", "ريال (ورقي)"]],
      c: [[200, "2 SAR", "ريالان"], [100, "1 SAR coin", "ريال (معدني)"], [50, "50 halala", "٥٠ هللة"], [25, "25 halala", "٢٥ هللة"], [10, "10 halala", "١٠ هللات"], [5, "5 halala", "٥ هللات"], [1, "1 halala", "هللة"]] },
    AED: { name: "UAE dirham", ar: "درهم إماراتي", sym: "AED", dec: 2,
      n: [[100000, "1000 AED", "١٠٠٠ درهم"], [50000, "500 AED", "٥٠٠ درهم"], [20000, "200 AED", "٢٠٠ درهم"], [10000, "100 AED", "١٠٠ درهم"], [5000, "50 AED", "٥٠ درهماً"], [2000, "20 AED", "٢٠ درهماً"], [1000, "10 AED", "١٠ دراهم"], [500, "5 AED", "٥ دراهم"]],
      c: [[100, "1 AED", "درهم"], [50, "50 fils", "٥٠ فلساً"], [25, "25 fils", "٢٥ فلساً"]] },
    GBP: { name: "Pound sterling", ar: "جنيه إسترليني", sym: "£", dec: 2,
      n: [[5000, "£50"], [2000, "£20"], [1000, "£10"], [500, "£5"]],
      c: [[200, "£2"], [100, "£1"], [50, "50p"], [20, "20p"], [10, "10p"], [5, "5p"], [2, "2p"], [1, "1p"]] },
    KWD: { name: "Kuwaiti dinar", ar: "دينار كويتي", sym: "KD", dec: 3,
      n: [[20000, "20 KD", "٢٠ ديناراً"], [10000, "10 KD", "١٠ دنانير"], [5000, "5 KD", "٥ دنانير"], [1000, "1 KD", "دينار"], [500, "½ KD", "نصف دينار"], [250, "¼ KD", "ربع دينار"]],
      c: [[100, "100 fils", "١٠٠ فلس"], [50, "50 fils", "٥٠ فلساً"], [20, "20 fils", "٢٠ فلساً"], [10, "10 fils", "١٠ فلوس"], [5, "5 fils", "٥ فلوس"]] },
    EGP: { name: "Egyptian pound", ar: "جنيه مصري", sym: "EGP", dec: 2,
      n: [[20000, "200 EGP", "٢٠٠ جنيه"], [10000, "100 EGP", "١٠٠ جنيه"], [5000, "50 EGP", "٥٠ جنيهاً"], [2000, "20 EGP", "٢٠ جنيهاً"], [1000, "10 EGP", "١٠ جنيهات"], [500, "5 EGP", "٥ جنيهات"]],
      c: [[100, "1 EGP", "جنيه"], [50, "50 piasters", "٥٠ قرشاً"], [25, "25 piasters", "٢٥ قرشاً"]] }
  };
  var MAX_QTY = 9999999;

  // ---------- exact money maths ----------
  function toAscii(s) {
    return String(s == null ? "" : s).replace(/[٠-٩]/g, function (d) { return d.charCodeAt(0) - 0x660; })
      .replace(/[۰-۹]/g, function (d) { return d.charCodeAt(0) - 0x6F0; }).replace(/٫/g, ".").replace(/[٬,\s_']/g, "");
  }
  // "151.35" with 3 decimals -> 151350 (integer). null if not a plain amount or too many decimals.
  function parseMoney(s, dec) {
    var t = toAscii(s), neg = false;
    if (/^-/.test(t)) { neg = true; t = t.slice(1); }
    var m = /^(\d*)(?:\.(\d*))?$/.exec(t);
    if (!m || (!m[1] && !m[2]) || (m[2] || "").length > dec || (m[1] || "").length > 12) return null;
    var v = parseInt(m[1] || "0", 10) * Math.pow(10, dec) + parseInt(((m[2] || "") + "000").slice(0, dec) || "0", 10);
    return neg ? -v : v;
  }
  function parseQty(s) { var t = toAscii(s); return /^\d{1,7}$/.test(t) ? Math.min(MAX_QTY, parseInt(t, 10)) : t === "" ? 0 : null; }
  function fmt(minor, dec) {
    var neg = minor < 0, a = Math.abs(minor), p = Math.pow(10, dec), whole = Math.floor(a / p), frac = a - whole * p;
    var s = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (dec ? "." + String(frac).padStart(dec, "0") : "");
    return (neg ? "−" : "") + s;
  }
  function sum(denoms, qty) {
    var total = 0, notes = 0, coins = 0;
    denoms.forEach(function (d) { var q = qty[d.key] || 0; total += q * d.v; if (d.coin) coins += q; else notes += q; });
    return { total: total, notes: notes, coins: coins };
  }
  function listFor(cur) {
    return cur.n.map(function (d) { return { key: "n" + d[0], v: d[0], en: d[1], ar: d[2] || "", coin: false }; })
      .concat(cur.c.map(function (d) { return { key: "c" + d[0], v: d[0], en: d[1], ar: d[2] || "", coin: true }; }));
  }

  // ---------- state ----------
  var sv = S3.store(KEY) || {};
  var st = { cur: CURRENCIES[sv.cur] || sv.cur === "CUSTOM" ? sv.cur : "JOD", qty: sv.qty || {}, exp: sv.exp || {}, notes: sv.notes || {},
    custom: sv.custom || { name: "Custom", dec: 2, notes: "100, 50, 20, 10, 5", coins: "1, 0.5, 0.25, 0.1" } };
  var save = S3.debounce(function () { S3.store(KEY, st); }, 250);

  function customCur() {
    var c = st.custom, dec = [0, 2, 3].indexOf(+c.dec) >= 0 ? +c.dec : 2;
    function list(s, coin) {
      var seen = {};
      return String(s || "").split(/[,،;\s]+/).map(function (x) { return parseMoney(x, dec); })
        .filter(function (v) { if (!(v > 0) || seen[v]) return false; seen[v] = 1; return true; })
        .sort(function (a, b) { return b - a; }).slice(0, 20).map(function (v) { return [v, fmt(v, dec) + (coin ? " coin" : "")]; });
    }
    return { name: c.name || "Custom", ar: "عملة مخصّصة", sym: (c.name || "").slice(0, 8), dec: dec, n: list(c.notes, false), c: list(c.coins, true) };
  }
  function current() { return st.cur === "CUSTOM" ? customCur() : CURRENCIES[st.cur]; }
  function qtyMap() { return st.qty[st.cur] || (st.qty[st.cur] = {}); }

  // ---------- render ----------
  var curSel = $("#cur");
  Object.keys(CURRENCIES).forEach(function (k) { var c = CURRENCIES[k]; curSel.appendChild(S3.h("option", { value: k, text: k + " · " + c.name + " · " + c.ar })); });
  curSel.appendChild(S3.h("option", { value: "CUSTOM", text: "Custom · عملة مخصّصة" }));

  function buildRows() {
    var cur = current(), q = qtyMap(), box = $("#rows");
    box.innerHTML = "";
    [["Notes", "الأوراق النقدية", false], ["Coins", "العملات المعدنية", true]].forEach(function (grp) {
      var ds = listFor(cur).filter(function (d) { return d.coin === grp[2]; });
      if (!ds.length) return;
      box.appendChild(S3.h("div", { "class": "cc-group" }, [S3.h("span", { text: grp[0] }), S3.h("span", { lang: "ar", text: grp[1] })]));
      ds.forEach(function (d) {
        var id = "q-" + d.key;
        box.appendChild(S3.h("div", { "class": "cc-row", "data-key": d.key }, [
          S3.h("label", { "class": "cc-den", "for": id }, [
            S3.h("span", { "class": "cc-chip " + (d.coin ? "coin" : "note"), text: d.en }),
            d.ar ? S3.h("span", { "class": "cc-den-ar", lang: "ar", dir: "rtl", text: d.ar }) : null
          ]),
          S3.h("div", { "class": "cc-step" }, [
            S3.h("button", { "class": "btn icon ghost", type: "button", "data-step": "-1", "aria-label": "One less " + d.en, text: "−" }),
            S3.h("input", { "class": "input cc-q", id: id, inputmode: "numeric", autocomplete: "off", value: q[d.key] ? String(q[d.key]) : "", placeholder: "0", "aria-label": "How many " + d.en }),
            S3.h("button", { "class": "btn icon ghost", type: "button", "data-step": "1", "aria-label": "One more " + d.en, text: "+" })
          ]),
          S3.h("output", { "class": "cc-sum mono", "for": id })
        ]));
      });
    });
    if (!box.children.length) box.appendChild(S3.h("div", { "class": "empty", text: "Add note or coin values for your currency above." }));
    $("#custom").hidden = st.cur !== "CUSTOM";
    $("#expected").value = st.exp[st.cur] || "";
    $("#notes").value = st.notes[st.cur] || "";
    totals();
  }

  function totals() {
    var cur = current(), q = qtyMap(), ds = listFor(cur), s = sum(ds, q);
    $$(".cc-row").forEach(function (r) {
      var d = ds.filter(function (x) { return x.key === r.dataset.key; })[0], n = q[r.dataset.key] || 0;
      if (!d) return;
      var o = $(".cc-sum", r); o.textContent = n ? fmt(n * d.v, cur.dec) : "—"; r.classList.toggle("has", !!n);
    });
    $("#total").textContent = fmt(s.total, cur.dec) + " " + cur.sym;
    $("#pieces").textContent = s.notes.toLocaleString() + " notes · " + s.coins.toLocaleString() + " coins";
    var diffEl = $("#diff"), raw = st.exp[st.cur] || "", e = raw.trim() ? parseMoney(raw, cur.dec) : null;
    diffEl.className = "cc-diff"; diffEl.textContent = "";
    if (raw.trim() && e === null) { diffEl.className = "cc-diff bad"; diffEl.textContent = "Use a plain amount with up to " + cur.dec + " decimals"; }
    else if (e !== null) {
      var d = s.total - e;
      diffEl.className = "cc-diff " + (d === 0 ? "ok" : d > 0 ? "over" : "bad");
      diffEl.appendChild(S3.h("b", { text: d === 0 ? "Exact" : (d > 0 ? "Over by " : "Short by ") + fmt(Math.abs(d), cur.dec) + " " + cur.sym }));
      diffEl.appendChild(S3.h("span", { lang: "ar", dir: "rtl", text: d === 0 ? "مطابق تماماً" : d > 0 ? "زيادة" : "نقص" }));
    }
    renderSheet(s);
    return s;
  }

  function summary() {
    var cur = current(), q = qtyMap(), ds = listFor(cur), s = sum(ds, q), lines = [];
    lines.push("Cash count · " + cur.name + (st.cur !== "CUSTOM" ? " (" + st.cur + ")" : ""));
    lines.push(new Date().toLocaleString());
    lines.push("");
    ds.forEach(function (d) { var n = q[d.key] || 0; if (n) lines.push(d.en + " × " + n + " = " + fmt(n * d.v, cur.dec)); });
    lines.push("");
    lines.push("Total: " + fmt(s.total, cur.dec) + " " + cur.sym + " (" + s.notes + " notes, " + s.coins + " coins)");
    var e = parseMoney(st.exp[st.cur] || "", cur.dec);
    if ((st.exp[st.cur] || "").trim() && e !== null) {
      var d = s.total - e;
      lines.push("Expected: " + fmt(e, cur.dec) + " " + cur.sym + " · " + (d === 0 ? "exact" : (d > 0 ? "over by " : "short by ") + fmt(Math.abs(d), cur.dec)));
    }
    var n = (st.notes[st.cur] || "").trim();
    if (n) { lines.push(""); lines.push("Notes: " + n); }
    return lines.join("\n");
  }

  function renderSheet(s) {
    var cur = current(), q = qtyMap(), sheet = $("#sheet");
    sheet.innerHTML = "";
    sheet.appendChild(S3.h("h2", { text: "Cash count · " + cur.name }));
    sheet.appendChild(S3.h("p", { text: new Date().toLocaleString() }));
    var tb = S3.h("tbody");
    listFor(cur).forEach(function (d) {
      var n = q[d.key] || 0;
      if (n) tb.appendChild(S3.h("tr", {}, [S3.h("td", { text: d.en }), S3.h("td", { text: String(n) }), S3.h("td", { text: fmt(n * d.v, cur.dec) })]));
    });
    tb.appendChild(S3.h("tr", { "class": "tot" }, [S3.h("td", { text: "Total" }), S3.h("td", { text: (s.notes + s.coins) + " pcs" }), S3.h("td", { text: fmt(s.total, cur.dec) + " " + cur.sym })]));
    sheet.appendChild(S3.h("table", {}, [S3.h("thead", {}, [S3.h("tr", {}, [S3.h("th", { text: "Denomination" }), S3.h("th", { text: "Count" }), S3.h("th", { text: "Amount" })])]), tb]));
    var diff = $("#diff").textContent;
    if (diff) sheet.appendChild(S3.h("p", { text: "Expected " + (st.exp[st.cur] || "") + " · " + diff }));
    var n = (st.notes[st.cur] || "").trim();
    if (n) sheet.appendChild(S3.h("p", { "class": "cc-pnotes", dir: "auto", text: n }));
  }

  // ---------- wiring ----------
  curSel.value = st.cur;
  curSel.addEventListener("change", function () { st.cur = this.value; save(); syncCustom(); buildRows(); });
  function syncCustom() { $("#c-name").value = st.custom.name || ""; $("#c-dec").value = String(st.custom.dec); $("#c-notes").value = st.custom.notes || ""; $("#c-coins").value = st.custom.coins || ""; }
  ["c-name", "c-notes", "c-coins"].forEach(function (id) {
    $("#" + id).addEventListener("input", S3.debounce(function () { st.custom[{ "c-name": "name", "c-notes": "notes", "c-coins": "coins" }[id]] = $("#" + id).value; save(); buildRows(); }, 300));
  });
  $("#c-dec").addEventListener("change", function () { st.custom.dec = +this.value; st.qty.CUSTOM = {}; save(); buildRows(); });

  var rows = $("#rows");
  rows.addEventListener("input", function (e) {
    if (!e.target.classList.contains("cc-q")) return;
    var key = e.target.closest(".cc-row").dataset.key, n = parseQty(e.target.value);
    e.target.classList.toggle("bad", n === null);
    if (n === null) return;
    if (n) qtyMap()[key] = n; else delete qtyMap()[key];
    totals(); save();
  });
  rows.addEventListener("click", function (e) {
    var b = e.target.closest("[data-step]"); if (!b) return;
    var row = b.closest(".cc-row"), key = row.dataset.key, q = qtyMap(), n = Math.max(0, Math.min(MAX_QTY, (q[key] || 0) + +b.dataset.step));
    if (n) q[key] = n; else delete q[key];
    $(".cc-q", row).value = n ? String(n) : ""; $(".cc-q", row).classList.remove("bad");
    totals(); save();
  });
  rows.addEventListener("keydown", function (e) {
    if (!e.target.classList.contains("cc-q")) return;
    if (e.key === "Enter" || e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      var all = $$(".cc-q"), i = all.indexOf(e.target) + (e.key === "ArrowUp" ? -1 : 1);
      if (all[i]) { all[i].focus(); all[i].select(); }
    }
  });
  rows.addEventListener("focusin", function (e) { if (e.target.classList.contains("cc-q")) e.target.select(); });
  $("#expected").addEventListener("input", function () { st.exp[st.cur] = this.value; totals(); save(); });
  $("#notes").addEventListener("input", function () { st.notes[st.cur] = this.value; renderSheet(sum(listFor(current()), qtyMap())); save(); });

  var clearT = null;
  $("#clear").addEventListener("click", function () {
    var btn = this, l = $("#clear-l");
    if (!clearT) { l.textContent = "Click again to clear"; btn.classList.add("danger"); clearT = setTimeout(function () { clearT = null; l.textContent = "Clear counts"; btn.classList.remove("danger"); }, 3000); return; }
    clearTimeout(clearT); clearT = null; l.textContent = "Clear counts"; btn.classList.remove("danger");
    st.qty[st.cur] = {}; st.exp[st.cur] = ""; save(); buildRows();
  });
  $("#copy").addEventListener("click", function () { S3.copy(summary()); S3.done(); });
  $("#print").addEventListener("click", function () { renderSheet(sum(listFor(current()), qtyMap())); window.print(); S3.done(); });
  $("#csv").addEventListener("click", function () {
    var cur = current(), q = qtyMap(), rowsOut = [["denomination", "count", "amount"]], s = sum(listFor(cur), q);
    listFor(cur).forEach(function (d) { rowsOut.push([d.en, q[d.key] || 0, fmt((q[d.key] || 0) * d.v, cur.dec).replace(/,/g, "")]); });
    rowsOut.push(["total", s.notes + s.coins, fmt(s.total, cur.dec).replace(/,/g, "")]);
    S3.download(rowsOut.map(function (r) { return r.map(function (x) { return '"' + String(x).replace(/"/g, '""') + '"'; }).join(","); }).join("\n"), "cash-count-" + st.cur.toLowerCase() + ".csv", "text/csv;charset=utf-8");
    S3.done();
  });

  syncCustom();
  buildRows();

  window.S3_DEMO = function () {
    st.cur = "JOD"; curSel.value = "JOD";
    st.qty.JOD = { n50000: 3, n20000: 4, n10000: 6, n5000: 9, n1000: 17, c500: 2, c250: 3, c100: 12, c50: 7 };
    st.exp.JOD = "355.500"; st.notes.JOD = "Evening shift · drawer 2"; buildRows();
  };

  // Returns true, or a list of failed checks.
  window.S3_SELFTEST = function () {
    var fails = [];
    function eq(a, b, what) { if (a !== b) fails.push(what + ": got " + a); }
    var jod = listFor(CURRENCIES.JOD), s = sum(jod, { n50000: 3, c500: 2, c50: 7 });
    eq(s.total, 151350, "JOD 3x50 + 2x0.5 + 7x0.05 in fils");
    eq(fmt(s.total, 3), "151.350", "JOD shows 3 decimals");
    eq(s.notes + "/" + s.coins, "3/9", "notes and coins counted");
    // float-safe: the same amounts in floating point drift, in integers they don't
    var usd = listFor(CURRENCIES.USD), t = sum(usd, { c10: 3, c1: 7 });
    eq(fmt(t.total, 2), "0.37", "USD 3 dimes + 7 pennies");
    eq(fmt(sum(listFor(CURRENCIES.JOD), { c100: 3 }).total, 3), "0.300", "3 x 0.100 JD is exactly 0.300");
    var big = sum(listFor(CURRENCIES.EUR), { c1: 9999999, c2: 9999999, n50000: 1000 });
    eq(fmt(big.total, 2), "799,999.97", "large counts stay exact");
    eq(parseMoney("151.35", 3), 151350, "parse 151.35");
    eq(parseMoney("١٥١٫٣٥", 3), 151350, "parse Arabic digits");
    eq(parseMoney("1,234.5", 3), 1234500, "parse with thousands separator");
    eq(parseMoney("1.2345", 3), null, "too many decimals rejected");
    eq(parseMoney("abc", 2), null, "text rejected");
    eq(parseMoney(".5", 2), 50, "parse .5");
    eq(parseMoney("-2", 2), -200, "negative");
    eq(fmt(-50, 3), "−0.050", "negative format");
    eq(fmt(123456789, 0), "123,456,789", "zero decimals");
    eq(parseQty("٧"), 7, "Arabic digit quantity");
    eq(parseQty("2.5"), null, "fractional quantity rejected");
    var diff = s.total - parseMoney("151.400", 3);
    eq(fmt(diff, 3), "−0.050", "short by 0.050");
    // every preset denomination list is strictly descending within notes and coins, no duplicates
    Object.keys(CURRENCIES).forEach(function (k) {
      ["n", "c"].forEach(function (g) {
        var v = CURRENCIES[k][g].map(function (d) { return d[0]; });
        for (var i = 1; i < v.length; i++) if (!(v[i] < v[i - 1])) fails.push(k + " " + g + " not descending");
      });
    });
    var keep = st.custom; st.custom = { name: "X", dec: 2, notes: "20, 100, 20, abc", coins: "0.5, 0.25" };
    var cc = customCur(); st.custom = keep;
    eq(cc.n.map(function (d) { return d[0]; }).join(","), "10000,2000", "custom notes parsed, sorted, deduped");
    eq(cc.c.map(function (d) { return d[0]; }).join(","), "50,25", "custom coins");
    return fails.length ? fails.slice(0, 6) : true;
  };
})();
