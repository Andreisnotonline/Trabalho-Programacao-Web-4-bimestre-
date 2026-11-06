/* Legacy Exoticus — comportamento das páginas */
(function () {
  "use strict";

  /* ---------- Imagens: se o arquivo existir em img/, ele substitui o placeholder ---------- */
  var EXTS = ["jpg", "png", "webp", "svg", "jpeg"];

  function tryLoad(box, base, i) {
    if (i >= EXTS.length) return;
    var img = new Image();
    img.alt = box.getAttribute("data-alt") || "";
    img.onload = function () {
      var label = box.querySelector(".ph-label");
      if (label) label.remove();
      box.classList.add("has-img");
      box.insertBefore(img, box.firstChild);
    };
    img.onerror = function () { tryLoad(box, base, i + 1); };
    img.src = base + "." + EXTS[i];
  }

  document.querySelectorAll("[data-img]").forEach(function (box) {
    tryLoad(box, "img/" + box.getAttribute("data-img"), 0);
  });

  /* ---------- Filtros por categoria (chips) ---------- */
  document.querySelectorAll("[data-filter-group]").forEach(function (group) {
    var chips = group.querySelectorAll(".chip");
    var items = document.querySelectorAll(group.getAttribute("data-filter-group"));
    var moreBtn = document.getElementById("ver-mais");
    var expanded = false;

    function apply(cat) {
      items.forEach(function (el) {
        var matches = cat === "todos" || el.getAttribute("data-cat") === cat;
        var extra = el.hasAttribute("data-extra");
        // Em "Todos", os itens extras só aparecem depois de "Ver mais animais"
        var show = matches && (cat !== "todos" || !extra || expanded);
        el.hidden = !show;
      });
      if (moreBtn) moreBtn.hidden = expanded || cat !== "todos";
    }

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        chips.forEach(function (c) { c.classList.remove("active"); });
        chip.classList.add("active");
        apply(chip.getAttribute("data-cat"));
      });
    });

    if (moreBtn) {
      moreBtn.addEventListener("click", function () {
        expanded = true;
        apply("todos");
      });
    }
    apply("todos");
  });

  /* ---------- Formulários de conta ---------- */
  function post(url, data) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(data)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (body) {
        return { ok: r.ok, body: body };
      });
    });
  }

  function bindForm(id, handler) {
    var form = document.getElementById(id);
    if (!form) return;
    var msg = form.querySelector(".form-msg");
    var btn = form.querySelector("button[type=submit]");
    function show(text, kind) { msg.textContent = text; msg.className = "form-msg " + kind; }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      show("", "");
      btn.disabled = true;
      handler(form, show).catch(function () {
        show("Não foi possível conectar ao servidor. Tente novamente.", "error");
      }).then(function () { btn.disabled = false; });
    });
  }

  bindForm("form-cadastro", function (form, show) {
    var nome = form.nome.value.trim();
    var email = form.email.value.trim();
    var senha = form.senha.value;
    if (!nome) { show("Informe seu nome completo.", "error"); return Promise.resolve(); }
    if (senha.length < 8) { show("A senha deve ter pelo menos 8 caracteres.", "error"); return Promise.resolve(); }
    if (senha !== form.confirmar.value) { show("As senhas não conferem.", "error"); return Promise.resolve(); }
    if (!form.termos.checked) { show("É preciso aceitar os Termos de uso.", "error"); return Promise.resolve(); }
    return post("/api/cadastro", { nome: nome, email: email, senha: senha, termos: true }).then(function (res) {
      if (!res.ok) { show(res.body.erro || "Não foi possível criar a conta.", "error"); return; }
      show("Conta criada com sucesso!", "ok");
      setTimeout(function () { window.location.href = "index.html"; }, 900);
    });
  });

  bindForm("form-login", function (form, show) {
    return post("/api/login", {
      email: form.email.value.trim(),
      senha: form.senha.value,
      lembrar: form.lembrar.checked
    }).then(function (res) {
      if (!res.ok) { show(res.body.erro || "E-mail ou senha incorretos.", "error"); return; }
      window.location.href = "index.html";
    });
  });
})();
