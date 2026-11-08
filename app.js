(function () {
  "use strict";
  var SB_URL = "https://vsbpaiqdvxqyfydlkuso.supabase.co";
  var SB_KEY = "sb_publishable_zcgFjDusNOXiDlUawMJ4aA_fFJ2sbs3"; // public key; data is protected by row-level security
  var LOCAL_KEY = "todo-v5";
  var MIGRATED_KEY = "todo-migrated-v1";

  var sb = window.supabase.createClient(SB_URL, SB_KEY);
  var items = [];
  var calm = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (id) { return document.getElementById(id); };

  function say(id, text) { $(id).textContent = text || ""; }

  function showApp(on) {
    $("appwrap").hidden = !on;
    $("auth").hidden = on;
  }

  // ---- data ----
  async function load() {
    var r = await sb.from("todo_items").select("id,title,done,created_at").order("created_at", { ascending: true });
    if (r.error) { say("msg", "Couldn't load your list. Check your connection."); return; }
    items = r.data.map(function (x) { return { id: x.id, t: x.title, d: x.done }; });
    say("msg", "");
    if (items.length === 0) await migrateLocal();
    render();
  }

  // One-time: copy the list that used to live only in this browser into the account.
  async function migrateLocal() {
    var done = false;
    try { done = !!localStorage.getItem(MIGRATED_KEY); } catch (e) {}
    if (done) return;
    var old = [];
    try { old = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]"); } catch (e) {}
    old = (Array.isArray(old) ? old : []).filter(function (x) { return x && typeof x.t === "string" && x.t.trim(); }).slice(0, 100);
    if (old.length) {
      var rows = old.map(function (x) { return { title: x.t.trim().slice(0, 200), done: !!x.d }; });
      var r = await sb.from("todo_items").insert(rows).select("id,title,done,created_at").order("created_at", { ascending: true });
      if (r.error) return;
      items = r.data.map(function (x) { return { id: x.id, t: x.title, d: x.done }; });
    }
    try { localStorage.setItem(MIGRATED_KEY, "1"); } catch (e) {}
  }

  async function setDone(it, want) {
    var prev = it.d;
    it.d = want; render();
    var r = await sb.from("todo_items").update({ done: want }).eq("id", it.id);
    if (r.error) { it.d = prev; render(); say("msg", "Couldn't save that. Try again."); }
    else say("msg", "");
  }

  function toggle(it, li) {
    if (li.dataset.busy) return;
    if (!it.d && !calm) {
      li.dataset.busy = "1";
      li.classList.add("sweep");
      li.setAttribute("aria-checked", "true");
      setTimeout(function () { setDone(it, true); }, 560);
    } else {
      setDone(it, !it.d);
    }
  }

  function row(it, ul) {
    var li = document.createElement("li");
    li.className = it.d ? "done" : "";
    li.tabIndex = 0;
    li.setAttribute("role", "checkbox");
    li.setAttribute("aria-checked", it.d ? "true" : "false");
    var box = document.createElement("span"); box.className = "box";
    var t = document.createElement("span"); t.className = "t"; t.textContent = it.t;
    li.appendChild(box); li.appendChild(t);
    li.onclick = function () { toggle(it, li); };
    li.onkeydown = function (e) { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(it, li); } };
    ul.appendChild(li);
  }

  function render() {
    var a = $("todo"), b = $("done");
    a.textContent = ""; b.textContent = "";
    var left = 0, done = 0;
    items.forEach(function (it) { if (it.d) { row(it, b); done++; } else { row(it, a); left++; } });
    $("count").textContent = left > 0 ? left + " to go" : "Nothing left. Add the next job below.";
    $("doneHead").hidden = done === 0;
  }

  $("add").onsubmit = async function (e) {
    e.preventDefault();
    var inp = $("new"), v = inp.value.trim().slice(0, 200);
    if (!v) return;
    var r = await sb.from("todo_items").insert({ title: v }).select("id,title,done").single();
    if (r.error) { say("msg", "Couldn't add that. Try again."); return; }
    items.push({ id: r.data.id, t: r.data.title, d: r.data.done });
    inp.value = ""; say("msg", ""); render();
  };

  $("clear").onclick = async function () {
    var r = await sb.from("todo_items").delete().eq("done", true);
    if (r.error) { say("msg", "Couldn't clear those. Try again."); return; }
    items = items.filter(function (x) { return !x.d; }); render();
  };

  // ---- sign in ----
  function creds() { return { email: $("email").value.trim(), password: $("pw").value }; }

  $("login").onsubmit = async function (e) {
    e.preventDefault();
    say("authmsg", "Signing in…");
    var r = await sb.auth.signInWithPassword(creds());
    if (r.error) { say("authmsg", "Couldn't sign in. Check your email and password."); return; }
    $("pw").value = ""; say("authmsg", "");
  };

  $("signup").onclick = async function () {
    var c = creds();
    if (!c.email || c.password.length < 8) { say("authmsg", "Enter your email and a password of at least 8 characters."); return; }
    say("authmsg", "Creating account…");
    var r = await sb.auth.signUp(c);
    if (r.error) { say("authmsg", "Couldn't create the account."); return; }
    $("pw").value = "";
    say("authmsg", "Account created. Check your email to confirm it, then sign in.");
  };

  $("signout").onclick = async function () { await sb.auth.signOut(); };

  sb.auth.onAuthStateChange(function (event, session) {
    if (session) { showApp(true); setTimeout(load, 0); }
    else { items = []; render(); showApp(false); }
  });

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && !$("appwrap").hidden) load();
  });

  sb.auth.getSession().then(function (r) { if (!r.data.session) showApp(false); });
})();
