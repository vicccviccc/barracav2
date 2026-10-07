/* ==========================================================
   Barraca do Baiano — interface
   ----------------------------------------------------------
   Desenha o cardápio, a janela de escolha do produto e o
   painel do pedido. Não usa innerHTML: tudo é criado com
   createElement/textContent, então nada digitado pelo cliente
   é interpretado como HTML.
   ========================================================== */
"use strict";

(function () {
  const cfg = BB.config;
  const card = BB.cardapio;
  const cart = BB.carrinho;
  const moeda = BB.fmt.moeda;

  function centavosDigitados(valor) {
    let t = String(valor == null ? "" : valor).trim().replace(/\s/g, "").replace(/^R\$/i, "");
    if (!t) return 0;
    t = t.replace(/[^0-9,.-]/g, "");
    if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
    const n = Number(t);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
  }

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const SVGNS = "http://www.w3.org/2000/svg";

  /* ---------- pequenos ajudantes ---------- */
  function h(tag, attrs, ...filhos) {
    const el = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k === "on") Object.entries(v).forEach(([ev, fn]) => el.addEventListener(ev, fn));
      else el.setAttribute(k, v === true ? "" : v);
    });
    filhos.flat().forEach((f) => {
      if (f == null || f === false) return;
      el.append(f.nodeType ? f : document.createTextNode(String(f)));
    });
    return el;
  }

  function icone(id, extra) {
    const svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("class", "icon" + (extra ? " " + extra : ""));
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const uso = document.createElementNS(SVGNS, "use");
    uso.setAttribute("href", "#" + id);
    svg.append(uso);
    return svg;
  }

  /* foto do produto: `foto` é o nome-base; existem <base>-640.webp e <base>-960.webp */
  function fotoProduto(p, sizes, lazy) {
    return h("img", {
      src: p.foto + "-640.webp",
      srcset: p.foto + "-640.webp 640w, " + p.foto + "-960.webp 960w",
      sizes, width: "960", height: "640", alt: "Foto do " + p.nome,
      loading: lazy ? "lazy" : null, decoding: "async",
    });
  }

  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const listaTexto = (a) => (a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " e " + a[a.length - 1]);
  const httpsOk = (u) => /^https:\/\//i.test(String(u));
  const numeroOk = () => /^\d{10,15}$/.test(String(cfg.whatsapp));
  const descricao = (p) => p.descricao || (p.ingredientes && p.ingredientes.length ? cap(listaTexto(p.ingredientes)) + "." : "");
  const rotuloItens = (n) => n + (n === 1 ? " item" : " itens");

  /* ---------- janelas (dialog) ---------- */
  function pedidoNaoModalNoMobile(d) {
    return d && d.id === "dlg-pedido" && window.matchMedia && window.matchMedia("(max-width: 699px)").matches;
  }

  function abrir(d) {
    if (!d || d.open) return;

    // No mobile, o painel do pedido funciona como uma camada fixa normal.
    // Isso evita o estado "inerte" do showModal() ficar preso em alguns navegadores.
    if (pedidoNaoModalNoMobile(d)) {
      d.dataset.modoAbertura = "nao-modal";
      d.setAttribute("open", "");
    } else if (typeof d.showModal === "function") {
      d.dataset.modoAbertura = "modal";
      d.showModal();
    } else {
      d.dataset.modoAbertura = "nao-modal";
      d.setAttribute("open", "");
    }

    document.documentElement.classList.add("travado");
  }

  function fechar(d) {
    if (!d) return;

    try {
      if (d.open && d.dataset.modoAbertura === "modal" && typeof d.close === "function") d.close();
      else d.removeAttribute("open");
    } catch (e) {
      d.removeAttribute("open");
    }

    d.removeAttribute("data-modo-abertura");
    aoFechar();
  }

  function aoFechar() {
    const aviso = $("#aviso");
    if (aviso) {
      if (aviso.parentNode !== document.body) document.body.append(aviso);
      aviso.classList.remove("aviso--dentro", "aviso--topo");
    }

    // Espera o navegador terminar de remover o dialog da camada ativa antes
    // de liberar a página. Ajuda especialmente no Safari/iOS.
    requestAnimationFrame(() => {
      if (!$("dialog[open]")) document.documentElement.classList.remove("travado");
    });
  }

  /* ---------- aviso (toast) ---------- */
  let timerAviso;
  function avisar(texto, opcoes) {
    const o = opcoes || {};
    const caixa = h("div", { class: "aviso__caixa" }, h("span", { text: texto }));
    if (o.acao) {
      caixa.append(h("button", {
        class: "aviso__acao", type: "button", text: o.acao.rotulo,
        on: { click: () => { limparAviso(); o.acao.fn(); } },
      }));
    }
    // Se houver uma janela aberta, mostra o aviso dentro da área rolável
    // dela, logo abaixo do cabeçalho. Isso evita cobrir o botão de fechar
    // e impede o toast de ficar enorme em tablet/desktop.
    const janela = $("dialog[open]");
    const alvo = janela
      ? (janela.id === "dlg-pedido" ? $("#pedido-aviso") : ($(".folha__corpo", janela) || janela))
      : document.body;

    const el = $("#aviso");
    if (!el || !alvo) return;

    if (el.parentNode !== alvo) {
      alvo.append(el);
    }

    el.classList.toggle("aviso--dentro", !!janela);
    el.classList.remove("aviso--topo");
    el.replaceChildren(caixa);

    const sr = $("#aviso-sr");
    sr.textContent = "";
    setTimeout(() => { sr.textContent = texto; }, 40);

    clearTimeout(timerAviso);
    timerAviso = setTimeout(limparAviso, o.acao ? 6500 : 3200);
  }
  function limparAviso() {
    const el = $("#aviso");
    if (el) el.replaceChildren();
  }

  /* ---------- teclado no mobile ---------- */
  function fecharTeclado() {
    const ativo = document.activeElement;
    if (ativo && /^(INPUT|TEXTAREA|SELECT)$/.test(ativo.tagName)) ativo.blur();
  }

  function acaoTeclado(campo, rotulo = "Concluir") {
    const btn = h("button", { class: "teclado-fechar", type: "button", text: rotulo, "aria-label": rotulo + " e fechar teclado" });
    btn.addEventListener("pointerdown", (e) => e.preventDefault());
    btn.addEventListener("click", () => fecharTeclado());
    return btn;
  }

  function fecharTecladoAoTocarFora(container) {
    if (!container || container.dataset.tecladoFora === "1") return;
    container.dataset.tecladoFora = "1";
    container.addEventListener("pointerdown", (e) => {
      const ativo = document.activeElement;
      if (!ativo || !/^(INPUT|TEXTAREA|SELECT)$/.test(ativo.tagName)) return;
      if (e.target.closest("input, textarea, select, button, a, label, [role='button']")) return;
      fecharTeclado();
    });
  }

  /* ---------- dados de contato (vêm de config.js) ---------- */
  function preencherContato() {
    $$("[data-link-maps]").forEach((a) => {
      if (!httpsOk(cfg.mapsUrl)) return;
      a.href = cfg.mapsUrl;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.append(h("span", { class: "sr", text: " (abre em nova aba)" }));
    });
    $$("[data-link-whats]").forEach((a) => {
      if (!numeroOk()) return;
      a.href = "https://wa.me/" + cfg.whatsapp;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.append(h("span", { class: "sr", text: " (abre em nova aba)" }));
    });

    $("#telefone").textContent = cfg.whatsappExibicao;

    const faixa = $("#faixa-horario");
    cfg.horarios.forEach((hr) => faixa.append(h("span", { text: hr.rotulo + ": " + hr.valor })));

    const listaHorarios = $("#lista-horarios");
    cfg.horarios.forEach((hr) => {
      listaHorarios.append(h("li", null, h("span", { text: hr.rotulo }), h("span", { text: hr.valor })));
    });
  }

  /* o que TODO hambúrguer leva = interseção das listas do cardápio */
  function preencherIngredientesComuns() {
    const cat = card.categorias.find((c) => c.id === "hamburgueres");
    const [primeiro, ...resto] = cat.itens.map((i) => i.ingredientes);
    const comuns = primeiro.filter((ing) => resto.every((l) => l.includes(ing)));
    const ul = $("#ingredientes-comuns");
    comuns.forEach((ing) => ul.append(h("li", { text: cap(ing) })));
  }

  /* ---------- cardápio ---------- */
  function precoTag(p) {
    if (p.opcoes) {
      return h("div", { class: "precos" }, p.opcoes.map((o) =>
        h("span", { class: "preco" }, h("small", { text: o.nome }), moeda(o.preco))));
    }
    return h("span", { class: "preco", text: moeda(p.preco) });
  }

  function cartao(p) {
    const botao = h("button", { class: "btn btn--escuro btn--bloco", type: "button", "data-produto": p.id },
      icone("i-plus"), "Adicionar ao pedido", h("span", { class: "sr", text: ": " + p.nome }));
    botao.addEventListener("click", () => abrirProduto(p.id));

    return h("article", { class: "cartao" },
      p.foto ? h("div", { class: "cartao__foto", on: { click: () => abrirProduto(p.id) } },
        fotoProduto(p, "(min-width: 1000px) 350px, (min-width: 700px) 46vw, 92vw", true)) : null,
      h("div", { class: "cartao__corpo" },
        h("div", { class: "cartao__topo" }, h("h4", { class: "cartao__nome", text: p.nome }), precoTag(p)),
        h("p", { class: "cartao__desc", text: descricao(p) }),
        botao));
  }

  function linhaBebida(p) {
    const info = h("div", { class: "linha__info" + (p.opcoes ? " linha__info--opcoes" : "") }, p.nome);
    if (p.opcoes) {
      info.append(h("span", { class: "linha__opcoes", text: p.opcoes.map((o) => o.nome + " " + moeda(o.preco)).join(" · ") }));
    }
    const botao = h("button", { class: "btn-mais", type: "button", "aria-label": "Adicionar " + p.nome + " ao pedido" }, icone("i-plus"));
    botao.addEventListener("click", () => (p.opcoes ? abrirProduto(p.id) : adicionarDireto(p, botao)));
    return h("li", { class: "linha" }, info,
      p.opcoes ? null : h("span", { class: "linha__pontos", "aria-hidden": "true" }),
      p.opcoes ? null : h("span", { class: "preco", text: moeda(p.preco) }),
      botao);
  }

  function renderCardapio() {
    const lista = $("#cardapio-lista");
    const abas = $("#abas");
    card.categorias.forEach((cat) => {
      abas.append(h("a", { class: "aba", href: "#" + cat.id, "data-aba": cat.id, text: cat.nome }));

      const conteudo = cat.layout === "lista"
        ? h("ul", { class: "lista" }, cat.itens.map(linhaBebida))
        : h("div", { class: "grade" + (cat.itens.length <= 2 ? " grade--2" : "") }, cat.itens.map(cartao));

      lista.append(h("section", { class: "categoria", id: cat.id, "aria-labelledby": "t-" + cat.id },
        h("h3", { class: "categoria__titulo", id: "t-" + cat.id, text: cat.nome }), conteudo));
    });
    observarCategorias();
  }

  /* destaca a aba da categoria que está na tela */
  function observarCategorias() {
    if (!("IntersectionObserver" in window)) return;
    const abas = $("#abas");
    const io = new IntersectionObserver((entradas) => {
      entradas.forEach((e) => {
        if (!e.isIntersecting) return;
        $$(".aba", abas).forEach((a) => {
          const ativa = a.dataset.aba === e.target.id;
          if (ativa) { a.setAttribute("aria-current", "true"); abas.scrollTo({ left: a.offsetLeft - 20, behavior: "smooth" }); }
          else a.removeAttribute("aria-current");
        });
      });
    }, { rootMargin: "-150px 0px -60% 0px" });
    $$(".categoria").forEach((c) => io.observe(c));
  }

  function adicionarDireto(p, origem) {
    const r = cart.adicionar({ produtoId: p.id, qtd: 1 });
    if (!r.ok) return avisar("O pedido chegou ao limite de itens. Envie este e faça outro em seguida.");
    animarAdicao(origem);
    avisar(p.nome + " adicionado ao pedido");
  }

  /* ---------- janela do produto ---------- */
  const dlgProduto = $("#dlg-produto");

  function botaoFechar() {
    return h("button", { class: "btn-icone", type: "button", "data-fechar": "", "aria-label": "Fechar" }, icone("i-close"));
  }

  function escolha(tipo, nome, valor, marcado, texto, preco, classe) {
    const input = h("input", { type: tipo, name: nome, value: valor });
    input.checked = marcado;
    return {
      input,
      el: h("label", { class: "escolha" + (classe ? " " + classe : "") },
        input, h("span", { class: "escolha__txt", text: texto }), preco != null ? h("span", { class: "escolha__preco", text: preco }) : null),
    };
  }

  function stepper(valor, min, max, aoMudar, rotulo) {
    const saida = h("output", { text: String(valor), "aria-label": rotulo });
    const menos = h("button", { type: "button", "aria-label": "Diminuir " + rotulo.toLowerCase() }, icone("i-minus"));
    const mais = h("button", { type: "button", "aria-label": "Aumentar " + rotulo.toLowerCase() }, icone("i-plus"));
    let v = valor;
    function por(novo) {
      v = Math.min(max, Math.max(min, novo));
      saida.textContent = String(v);
      menos.disabled = v <= min;
      mais.disabled = v >= max;
      aoMudar(v);
    }
    menos.addEventListener("click", () => por(v - 1));
    mais.addEventListener("click", () => por(v + 1));
    menos.disabled = v <= min;
    mais.disabled = v >= max;
    return h("div", { class: "qtd" }, menos, saida, mais);
  }

  function abrirProduto(id, editarId) {
    const p = cart.produto(id);
    if (!p) return;
    const base = editarId ? cart.itens.find((i) => i.id === editarId) : null;
    const st = {
      opcaoId: base ? base.opcaoId : null,
      removidos: new Set(base ? base.removidos : []),
      extras: new Set(base ? base.extras : []),
      qtd: base ? base.qtd : 1,
    };

    const totalEl = h("strong");
    const aviso = h("p", { class: "rodape-prod__aviso", text: "Escolha uma opção para continuar.", hidden: true });
    const ok = h("button", { class: "btn btn--amarelo btn--bloco", type: "button", text: base ? "Salvar alterações" : "Adicionar ao pedido" });

    function precoUnit() {
      const op = st.opcaoId ? cart.opcaoDe(p, st.opcaoId) : null;
      let v = op ? op.preco : p.preco || 0;
      st.extras.forEach((k) => { v += card.extras[k].preco; });
      return v;
    }
    function atualizar() {
      totalEl.textContent = moeda(precoUnit() * st.qtd);
      const falta = !!p.opcoes && !st.opcaoId;
      ok.disabled = falta;
      aviso.hidden = !falta;
    }

    const corpo = h("div", { class: "folha__corpo" },
      p.foto ? h("div", { class: "folha__foto" }, fotoProduto(p, "(min-width: 700px) 540px, 92vw", false)) : null,
      descricao(p) ? h("p", { class: "folha__desc", text: descricao(p) }) : null);

    // opção obrigatória (tamanho / sabor)
    if (p.opcoes) {
      const grupo = h("div", { class: "escolhas" });
      p.opcoes.forEach((o) => {
        const e = escolha("radio", "opcao", o.id, st.opcaoId === o.id, o.nome, moeda(o.preco));
        e.input.addEventListener("change", () => { st.opcaoId = o.id; atualizar(); });
        grupo.append(e.el);
      });
      corpo.append(h("fieldset", null, h("legend", { text: p.tituloOpcoes || "Opção" }), grupo));
    }

    // ingredientes que podem ser retirados
    const tirar = cart.removiveis(p);
    if (tirar.length) {
      const grupo = h("div", { class: "escolhas escolhas--duas" });
      tirar.forEach((ing) => {
        const e = escolha("checkbox", "ingrediente", ing, !st.removidos.has(ing), cap(ing), null, "escolha--ing");
        e.input.addEventListener("change", () => {
          if (e.input.checked) st.removidos.delete(ing); else st.removidos.add(ing);
        });
        grupo.append(e.el);
      });
      const fixos = (p.fixos || []).filter((f) => (p.ingredientes || []).includes(f));
      corpo.append(h("fieldset", null,
        h("legend", { text: "Ingredientes" }),
        h("p", { class: "dica", text: "Desmarque o que você não quer." }),
        grupo,
        fixos.length ? h("p", { class: "fixos", text: "Sempre leva: " + listaTexto(fixos) + "." }) : null));
    }

    // acréscimos
    if (p.extras && p.extras.length) {
      const grupo = h("div", { class: "escolhas" });
      p.extras.forEach((k) => {
        const ex = card.extras[k];
        const e = escolha("checkbox", "extra", k, st.extras.has(k), ex.nome, "+ " + moeda(ex.preco));
        e.input.addEventListener("change", () => {
          if (e.input.checked) st.extras.add(k); else st.extras.delete(k);
          atualizar();
        });
        grupo.append(e.el);
      });
      corpo.append(h("fieldset", null, h("legend", { text: "Acréscimos" }), grupo));
    }

    // quantidade
    corpo.append(h("div", { class: "qtd-linha" },
      h("span", { class: "campo-rotulo", text: "Quantidade" }),
      stepper(st.qtd, 1, cfg.limiteQuantidade, (v) => { st.qtd = v; atualizar(); }, "Quantidade")));

    // observação
    const obs = h("textarea", { class: "campo", id: "prod-obs", maxlength: String(cfg.limiteObsItem), rows: "3", placeholder: "Ex.: sem molho" });
    obs.value = base ? base.obs : "";
    const contagem = h("span", { class: "contagem", "aria-hidden": "true" });
    const contar = () => { contagem.textContent = obs.value.length + "/" + cfg.limiteObsItem; };
    obs.addEventListener("input", contar);
    contar();
    corpo.append(h("div", { class: "campo-com-teclado" },
      h("label", { class: "campo-rotulo", for: "prod-obs", text: "Observação (opcional)" }),
      obs,
      h("div", { class: "campo-com-teclado__rodape" }, contagem, acaoTeclado(obs))));

    const rodape = h("div", { class: "folha__rodape" },
      h("div", { class: "rodape-prod" },
        h("div", { class: "rodape-prod__total" }, h("span", { text: "Total" }), totalEl),
        ok, aviso));

    ok.addEventListener("click", () => {
      const dados = {
        produtoId: p.id, opcaoId: st.opcaoId,
        removidos: [...st.removidos], extras: [...st.extras], qtd: st.qtd, obs: obs.value,
      };
      const r = base ? cart.substituir(base.id, dados) : cart.adicionar(dados);
      if (!r.ok) return avisar("Não foi possível adicionar. O pedido pode ter chegado ao limite de itens.");
      if (base) {
        fechar(dlgProduto);
        return avisar("Item atualizado");
      }
      // Guarda o ponto exato do toque antes de fechar a janela.
      // Depois que o dialog fecha, o alvo é medido de novo e a mesma animação
      // usada nas bebidas parte desse ponto até "Meu pedido".
      const rOrigem = ok.getBoundingClientRect();
      const pontoOrigem = {
        x: rOrigem.left + rOrigem.width / 2,
        y: rOrigem.top + rOrigem.height / 2,
      };
      fechar(dlgProduto);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => animarAdicao(pontoOrigem));
      });
      avisar(p.nome + " adicionado ao pedido");
    });

    dlgProduto.replaceChildren(
      h("div", { class: "folha__cab" }, h("h2", { id: "dlg-produto-titulo", text: p.nome }), botaoFechar()),
      corpo, rodape);
    atualizar();
    fecharTecladoAoTocarFora(dlgProduto);
    abrir(dlgProduto);
  }

  /* ---------- painel do pedido ---------- */
  const dlgPedido = $("#dlg-pedido");
  let foco = null; // lembra qual botão estava em uso, para devolver o foco depois de redesenhar
  let renderPedidoRaf = 0;

  function abrirPedido() {
    // Remove qualquer aviso temporário antes de abrir o painel.
    // Isso também evita camadas antigas interferindo no toque em navegadores móveis.
    limparAviso();
    renderPedido();
    fecharTecladoAoTocarFora(dlgPedido);
    abrir(dlgPedido);
  }

  function acaoItem(id, acao, fn) {
    foco = { id, acao };
    fn();
  }

  function itemPedido(it) {
    const p = cart.produto(it.produtoId);
    const op = cart.opcaoDe(p, it.opcaoId);
    const det = h("ul", { class: "item__det" });
    it.extras.forEach((k) => det.append(h("li", { text: "Acréscimo: " + card.extras[k].nome.toLowerCase() })));
    it.removidos.forEach((r) => det.append(h("li", { text: "Sem " + r })));
    if (it.obs) det.append(h("li", { class: "obs", text: "Obs: " + it.obs }));

    const nome = p.nome + (op ? " (" + op.nome + ")" : "");
    const menos = h("button", { type: "button", "data-acao": "menos", "aria-label": "Diminuir quantidade de " + nome }, icone("i-minus"));
    const mais = h("button", { type: "button", "data-acao": "mais", "aria-label": "Aumentar quantidade de " + nome }, icone("i-plus"));
    menos.disabled = it.qtd <= 1;
    mais.disabled = it.qtd >= cfg.limiteQuantidade;
    menos.addEventListener("click", () => acaoItem(it.id, "menos", () => cart.definirQtd(it.id, it.qtd - 1)));
    mais.addEventListener("click", () => acaoItem(it.id, "mais", () => cart.definirQtd(it.id, it.qtd + 1)));
    const q = h("div", { class: "qtd" }, menos, h("output", { text: String(it.qtd), "aria-label": "Quantidade de " + nome }), mais);

    const editar = h("button", { class: "link-btn", type: "button", "data-acao": "editar", "aria-label": "Editar " + nome }, icone("i-edit"), "Editar");
    editar.addEventListener("click", () => abrirProduto(it.produtoId, it.id));

    const remover = h("button", { class: "link-btn", type: "button", "data-acao": "remover", "aria-label": "Remover " + nome }, icone("i-trash"), "Remover");
    remover.addEventListener("click", () => acaoItem(it.id, "remover", () => {
      const r = cart.remover(it.id);
      if (r) requestAnimationFrame(() => {
        avisar(nome + " removido", { acao: { rotulo: "Desfazer", fn: () => cart.restaurar(r.item, r.pos) } });
      });
    }));

    return h("li", { class: "item", "data-item": it.id },
      h("div", { class: "item__topo" },
        h("span", { class: "item__nome", text: nome }),
        h("span", { class: "item__preco", text: moeda(cart.precoUnitario(it) * it.qtd) })),
      det.children.length ? det : null,
      h("div", { class: "item__acoes" }, q, editar, remover));
  }

  function renderPedido() {
    const corpo = $("#pedido-corpo");
    const rodape = $("#pedido-rodape");
    corpo.replaceChildren();
    rodape.replaceChildren();

    if (!cart.itens.length) {
      foco = null;
      rodape.hidden = true;
      corpo.append(h("div", { class: "vazio" },
        icone("i-bag"),
        h("p", { text: "Seu pedido está vazio." }),
        h("button", {
          class: "btn btn--amarelo", type: "button", text: "Ver cardápio",
          on: { click: () => { fechar(dlgPedido); $("#cardapio").scrollIntoView(); } },
        })));
      return;
    }
    rodape.hidden = false;

    corpo.append(h("ul", null, cart.itens.map(itemPedido)));

    const nomeCliente = h("input", {
      class: "campo campo--linha", id: "nome-cliente", type: "text", maxlength: String(cfg.limiteNomeCliente),
      placeholder: "Seu nome", autocomplete: "name", enterkeyhint: "next", required: true,
    });
    nomeCliente.value = cart.nomeCliente;
    nomeCliente.addEventListener("input", () => { cart.definirNomeCliente(nomeCliente.value); atualizarLink(); });
    const nomeBox = h("div", { class: "pedido-cliente campo-com-teclado" },
      h("label", { class: "campo-rotulo", for: "nome-cliente", text: "Nome" }),
      nomeCliente,
      h("div", { class: "campo-com-teclado__rodape campo-com-teclado__rodape--fim" }, acaoTeclado(nomeCliente, "Fechar teclado")));
    corpo.append(nomeBox);

    const obs = h("textarea", {
      class: "campo", id: "obs-pedido", maxlength: String(cfg.limiteObsPedido), rows: "2",
      placeholder: "Ex.: tudo separado", enterkeyhint: "done",
    });
    obs.value = cart.obsPedido;
    obs.addEventListener("input", () => { cart.definirObsPedido(obs.value); atualizarLink(); });
    const obsBox = h("div", { class: "pedido-obs campo-com-teclado" },
      h("label", { class: "campo-rotulo", for: "obs-pedido", text: "Observação do pedido (opcional)" }),
      obs,
      h("div", { class: "campo-com-teclado__rodape campo-com-teclado__rodape--fim" }, acaoTeclado(obs)));
    corpo.append(obsBox);

    // No campo Nome, Enter/Próximo leva direto para a observação.
    nomeCliente.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      obs.focus();
    });

    /* Como o cliente vai receber o pedido. */
    const recebimentoBox = h("fieldset", { class: "recebimento" },
      h("legend", { text: "Como você quer receber o pedido?" }),
      h("p", { class: "dica", text: "Escolha uma opção para continuar." }));
    const opcoesRecebimento = h("div", { class: "escolhas recebimento__opcoes" });
    [
      ["delivery", "Delivery", "Entregar no endereço informado"],
      ["retirada", "Retirar no local", "Você busca o pedido na barraca"],
      ["local", "Comer no local", "Pedido para consumir na barraca"],
    ].forEach(([valor, rotulo, detalhe]) => {
      const input = h("input", { type: "radio", name: "tipo-entrega", value: valor, checked: cart.tipoEntrega === valor });
      input.addEventListener("change", () => {
        cart.definirTipoEntrega(valor);
        atualizarRecebimentoUi();
        atualizarPagamentoUi();
        atualizarLink();
      });
      opcoesRecebimento.append(h("label", { class: "escolha escolha--recebimento" }, input,
        h("span", { class: "escolha__txt" }, rotulo, h("small", { text: detalhe }))));
    });
    recebimentoBox.append(opcoesRecebimento);
    corpo.append(recebimentoBox);

    /* Endereço só aparece e é obrigatório quando a opção é Delivery. */
    const endereco = h("textarea", {
      class: "campo campo--endereco", id: "endereco-entrega", maxlength: String(cfg.limiteEndereco), rows: "3",
      placeholder: "Rua, número, bairro e ponto de referência", autocomplete: "street-address", enterkeyhint: "done",
      "aria-describedby": "endereco-ajuda",
    });
    endereco.value = cart.enderecoEntrega;
    endereco.addEventListener("input", () => { cart.definirEnderecoEntrega(endereco.value); atualizarLink(); });
    const enderecoBox = h("div", { class: "entrega campo-com-teclado", id: "endereco-box" },
      h("label", { class: "campo-rotulo", for: "endereco-entrega", text: "Endereço para entrega" }),
      endereco,
      h("div", { class: "campo-com-teclado__rodape campo-com-teclado__rodape--fim" }, acaoTeclado(endereco)),
      h("p", { class: "dica", id: "endereco-ajuda", text: "Informe rua, número, bairro e, se precisar, um ponto de referência." }));
    corpo.append(enderecoBox);

    function atualizarRecebimentoUi() {
      enderecoBox.hidden = cart.tipoEntrega !== "delivery";
      endereco.toggleAttribute("required", cart.tipoEntrega === "delivery");
      opcoesRecebimento.querySelectorAll("input").forEach((input) => {
        input.checked = cart.tipoEntrega === input.value;
      });
    }
    atualizarRecebimentoUi();

    /* Forma de pagamento: faz parte apenas da mensagem enviada ao WhatsApp. */
    const pagamentoBox = h("fieldset", { class: "pagamento" },
      h("legend", { text: "Forma de pagamento" }),
      h("p", { class: "dica", text: "Escolha como pretende pagar o pedido." }));
    const opcoesPagamento = h("div", { class: "escolhas pagamento__opcoes" });
    [
      ["pix", "Pix", ""],
      ["cartao", "Cartão", ""],
      ["dinheiro", "Dinheiro", ""],
    ].forEach(([valor, rotulo, detalhe]) => {
      const input = h("input", { type: "radio", name: "pagamento", value: valor, checked: cart.pagamento === valor });
      input.addEventListener("change", () => {
        cart.definirPagamento(valor);
        atualizarPagamentoUi();
        atualizarLink();
      });
      opcoesPagamento.append(h("label", { class: "escolha escolha--pagamento" }, input,
        h("span", { class: "escolha__txt" }, rotulo, detalhe ? h("small", { text: detalhe }) : null)));
    });
    pagamentoBox.append(opcoesPagamento);

    const cartaoBox = h("div", { class: "cartao-tipo", id: "cartao-tipo-box" });
    cartaoBox.append(h("p", { class: "campo-rotulo pagamento__subtitulo", text: "Crédito ou débito?" }));
    const cartaoEscolhas = h("div", { class: "escolhas escolhas--duas" });
    [["credito", "Crédito"], ["debito", "Débito"]].forEach(([valor, rotulo]) => {
      const input = h("input", { type: "radio", name: "tipo-cartao", value: valor, checked: cart.tipoCartao === valor });
      input.addEventListener("change", () => {
        cart.definirTipoCartao(valor);
        atualizarPagamentoUi();
        atualizarLink();
      });
      cartaoEscolhas.append(h("label", { class: "escolha" }, input, h("span", { class: "escolha__txt", text: rotulo })));
    });
    cartaoBox.append(cartaoEscolhas);
    pagamentoBox.append(cartaoBox);

    const trocoBox = h("div", { class: "troco", id: "troco-box" });
    trocoBox.append(h("p", { class: "campo-rotulo pagamento__subtitulo", text: "Precisa de troco?" }));
    const trocoEscolhas = h("div", { class: "escolhas escolhas--duas" });
    [[false, "Não"], [true, "Sim"]].forEach(([valor, rotulo]) => {
      const input = h("input", { type: "radio", name: "precisa-troco", value: valor ? "sim" : "nao", checked: cart.precisaTroco === valor });
      input.addEventListener("change", () => {
        cart.definirPrecisaTroco(valor);
        atualizarPagamentoUi();
        atualizarLink();
      });
      trocoEscolhas.append(h("label", { class: "escolha" }, input, h("span", { class: "escolha__txt", text: rotulo })));
    });
    trocoBox.append(trocoEscolhas);

    const trocoValorBox = h("div", { class: "troco__valor campo-com-teclado", id: "troco-valor-box" },
      h("label", { class: "campo-rotulo", for: "troco-valor", text: "Troco para quanto?" }));
    const trocoInput = h("input", {
      class: "campo campo--linha", id: "troco-valor", type: "text", inputmode: "decimal", autocomplete: "off",
      placeholder: "Ex.: 100,00", "aria-describedby": "troco-ajuda",
    });
    if (cart.trocoPara > 0) trocoInput.value = (cart.trocoPara / 100).toFixed(2).replace(".", ",");
    trocoInput.addEventListener("input", () => {
      cart.definirTrocoPara(centavosDigitados(trocoInput.value));
      atualizarLink();
    });
    trocoInput.addEventListener("blur", () => {
      if (cart.trocoPara > 0) trocoInput.value = (cart.trocoPara / 100).toFixed(2).replace(".", ",");
    });
    trocoValorBox.append(trocoInput,
      h("div", { class: "campo-com-teclado__rodape campo-com-teclado__rodape--fim" }, acaoTeclado(trocoInput)),
      h("p", { class: "dica", id: "troco-ajuda", text: "Informe o valor da nota. Ele precisa ser igual ou maior que o total do pedido." }));
    trocoBox.append(trocoValorBox);
    pagamentoBox.append(trocoBox);
    corpo.append(pagamentoBox);

    function atualizarPagamentoUi() {
      const detalhes = opcoesPagamento.querySelectorAll("small");
      detalhes.forEach((el) => el.remove());
      opcoesPagamento.querySelectorAll("label").forEach((label) => {
        const input = label.querySelector("input");
        const txt = label.querySelector(".escolha__txt");
        if (!input || !txt) return;
        let detalhe = "";
        if (input.value === "pix") detalhe = cart.tipoEntrega === "delivery" ? "Pagamento na entrega" : "Pagamento no local";
        if (input.value === "cartao") detalhe = cart.tipoEntrega === "delivery" ? "Maquininha na entrega" : "Maquininha no local";
        if (detalhe) txt.append(h("small", { text: detalhe }));
      });

      cartaoBox.hidden = cart.pagamento !== "cartao";
      cartaoEscolhas.querySelectorAll("input").forEach((input) => {
        input.checked = cart.tipoCartao === input.value;
      });
      trocoBox.hidden = cart.pagamento !== "dinheiro";
      trocoValorBox.hidden = cart.pagamento !== "dinheiro" || cart.precisaTroco !== true;
      trocoEscolhas.querySelectorAll("input").forEach((input) => {
        input.checked = cart.precisaTroco === (input.value === "sim");
      });
      trocoInput.value = cart.trocoPara > 0 ? (cart.trocoPara / 100).toFixed(2).replace(".", ",") : "";
    }
    atualizarPagamentoUi();

    const enviar = h("a", { class: "btn btn--amarelo btn--bloco", id: "enviar-whats", target: "_blank", rel: "noopener noreferrer" },
      icone("i-whatsapp", "icon--fill"), "Enviar pelo WhatsApp");
    enviar.addEventListener("click", (e) => {
      if (!enviar.href) return e.preventDefault();
      avisar("Confira a mensagem e toque em enviar no WhatsApp.");
    });

    const limpar = h("button", { class: "link-btn", type: "button", text: "Limpar pedido" });
    limpar.addEventListener("click", () => {
      const copia = cart.limparTudo();
      requestAnimationFrame(() => {
        avisar("Pedido limpo", { acao: { rotulo: "Desfazer", fn: () => cart.restaurarTudo(copia) } });
      });
    });
    corpo.append(h("div", { class: "pedido-limpar" }, limpar));

    rodape.append(
      h("div", { class: "linha-valor" }, h("span", { text: "Subtotal" }), h("span", { text: moeda(cart.subtotal()) })),
      h("div", { class: "linha-valor linha-valor--total" }, h("span", { text: "Total" }), h("span", { text: moeda(cart.total()) })),
      h("p", { class: "nota", text: "A Barraca do Baiano confirma preço, disponibilidade e total no WhatsApp." }),
      h("p", { class: "erro-msg", id: "erro-envio", role: "alert", hidden: true }),
      enviar);
    atualizarLink();

    // devolve o foco apenas se o mesmo controle ainda existe.
    // Ao remover um item, não força o foco para o X do painel no mobile.
    if (foco) {
      const alvo = corpo.querySelector('[data-item="' + foco.id + '"] [data-acao="' + foco.acao + '"]:not([disabled])');
      if (alvo) {
        try { alvo.focus({ preventScroll: true }); } catch (e) { alvo.focus(); }
      }
      foco = null;
    }
  }

  /* o link do WhatsApp é um <a> de verdade, atualizado a cada mudança */
  function atualizarLink() {
    const a = $("#enviar-whats");
    if (!a) return;
    const erro = $("#erro-envio");
    const r = cart.linkWhatsApp();
    const msgs = {
      numero: "O número de WhatsApp do site não está configurado corretamente.",
      nome: "Informe seu nome antes de enviar o pedido.",
      entrega: "Escolha se o pedido é para delivery, retirada ou consumo no local.",
      endereco: "Informe o endereço para entrega antes de enviar o pedido.",
      pagamento: "Escolha uma forma de pagamento antes de enviar o pedido.",
      "tipo-cartao": "Escolha se o cartão é crédito ou débito.",
      "troco-opcao": "Informe se precisa de troco.",
      "troco-valor": "Informe um valor para troco igual ou maior que o total do pedido.",
      grande: "O pedido ficou grande demais para enviar de uma vez. Remova alguns itens ou envie em dois pedidos.",
    };
    if (r.url) {
      a.href = r.url;
      a.removeAttribute("aria-disabled");
      erro.hidden = true;
    } else {
      a.removeAttribute("href");
      a.setAttribute("aria-disabled", "true");
      erro.hidden = !msgs[r.erro];
      erro.textContent = msgs[r.erro] || "";
    }
  }

  /* ---------- resumo + animação até "Meu pedido" ---------- */
  let timerChamadaPedido;
  let timerChegadaPedido;
  let animacaoPedidoEmCurso = false;

  function pulsar() {
    $$('[data-contador]').forEach((c) => {
      c.classList.remove('pulo');
      void c.offsetWidth;
      c.classList.add('pulo');
    });
  }

  function destacarPedido() {
    const botao = $('.btn-pedido');
    if (!botao) return;

    clearTimeout(timerChamadaPedido);
    clearTimeout(timerChegadaPedido);

    botao.classList.remove('btn-pedido--chegou');
    void botao.offsetWidth;
    botao.classList.add('btn-pedido--chegou', 'btn-pedido--chamada');
    pulsar();

    timerChegadaPedido = setTimeout(() => {
      botao.classList.remove('btn-pedido--chegou');
    }, 620);

    // No celular o botão se abre por um instante para ensinar onde o pedido fica.
    timerChamadaPedido = setTimeout(() => {
      botao.classList.remove('btn-pedido--chamada');
    }, 1900);
  }

  function animarAdicao(origem) {
    const alvo = $('.btn-pedido');
    if (!alvo) return pulsar();

    const reduzir = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduzir || typeof alvo.animate !== 'function') {
      destacarPedido();
      return;
    }

    const origemRect = origem && typeof origem.getBoundingClientRect === 'function'
      ? origem.getBoundingClientRect()
      : null;

    const inicioX = origemRect
      ? origemRect.left + origemRect.width / 2
      : (origem && Number.isFinite(origem.x) ? origem.x : innerWidth / 2);
    const inicioY = origemRect
      ? origemRect.top + origemRect.height / 2
      : (origem && Number.isFinite(origem.y) ? origem.y : innerHeight * 0.72);

    // O destino só é medido quando a animação realmente vai começar.
    // Isso evita erro depois que o popup do hambúrguer fecha e o viewport volta ao normal.
    const alvoRect = alvo.getBoundingClientRect();
    const fimX = alvoRect.left + alvoRect.width / 2;
    const fimY = alvoRect.top + alvoRect.height / 2;

    $('.pedido-voador')?.remove();
    animacaoPedidoEmCurso = true;

    const voador = h('div', { class: 'pedido-voador', 'aria-hidden': 'true' }, icone('i-bag'));
    voador.style.left = '0px';
    voador.style.top = '0px';
    document.body.append(voador);

    const arco = Math.max(38, Math.min(105, Math.abs(fimY - inicioY) * 0.18));
    const p1x = inicioX + (fimX - inicioX) * 0.22;
    const p1y = inicioY + (fimY - inicioY) * 0.18 - arco * 0.45;
    const p2x = inicioX + (fimX - inicioX) * 0.56;
    const p2y = inicioY + (fimY - inicioY) * 0.50 - arco;
    const p3x = inicioX + (fimX - inicioX) * 0.86;
    const p3y = inicioY + (fimY - inicioY) * 0.84 - arco * 0.25;

    const pos = (x, y, escala, rotacao) =>
      `translate3d(${x - 25}px, ${y - 25}px, 0) scale(${escala}) rotate(${rotacao}deg)`;

    const anim = voador.animate([
      { transform: pos(inicioX, inicioY, .55, -12), opacity: 0 },
      { offset: .10, transform: pos(inicioX, inicioY, 1.06, -7), opacity: 1 },
      { offset: .30, transform: pos(p1x, p1y, 1.02, -2), opacity: 1 },
      { offset: .58, transform: pos(p2x, p2y, .94, 7), opacity: 1 },
      { offset: .84, transform: pos(p3x, p3y, .72, 3), opacity: 1 },
      { transform: pos(fimX, fimY, .30, 0), opacity: .16 }
    ], {
      duration: 2000,
      easing: 'cubic-bezier(.22,.61,.36,1)',
      fill: 'forwards'
    });

    anim.finished.catch(() => {}).finally(() => {
      voador.remove();
      animacaoPedidoEmCurso = false;
      destacarPedido();
    });
  }

  function atualizarResumo() {
    const n = cart.quantidade();
    $$('[data-contador]').forEach((c) => { c.textContent = String(n); c.hidden = n === 0; });
    const botao = $('.btn-pedido');
    if (botao) botao.setAttribute('aria-label', n ? 'Meu pedido, ' + rotuloItens(n) : 'Meu pedido, vazio');

    // Não destrói/recria o botão tocado no meio do evento de toque.
    // O redesenho acontece no próximo frame, depois que o navegador encerra o clique.
    if (dlgPedido.open) {
      cancelAnimationFrame(renderPedidoRaf);
      renderPedidoRaf = requestAnimationFrame(() => {
        renderPedidoRaf = 0;
        if (dlgPedido.open) renderPedido();
      });
    }
  }

  /* ---------- início ---------- */
  function iniciar() {
    preencherContato();
    preencherIngredientesComuns();
    renderCardapio();

    $$('[data-abrir-pedido]').forEach((b) => b.addEventListener('click', abrirPedido));

    document.addEventListener("click", (e) => {
      const b = e.target.closest("[data-fechar]");
      if (b) fechar(b.closest("dialog"));
    });
    $$("dialog").forEach((d) => {
      d.addEventListener("click", (e) => { if (e.target === d) fechar(d); }); // clique fora fecha
      d.addEventListener("close", aoFechar);
    });

    cart.aoMudar(atualizarResumo);
    atualizarResumo();
  }

  iniciar();
})();
