/* ==========================================================
   Barraca do Baiano — pedido (carrinho) e mensagem do WhatsApp
   ----------------------------------------------------------
   Sem servidor: o pedido existe só neste navegador e só serve
   para montar a mensagem. Quem confirma preço, disponibilidade
   e total é a Barraca do Baiano, pelo WhatsApp.

   Segurança: cada item é revalidado contra o cardápio
   (BB.cardapio) e o preço é SEMPRE recalculado a partir dele.
   Nada que esteja guardado no navegador é confiado como preço.
   ========================================================== */
"use strict";
window.BB = window.BB || {};

(function () {
  const cfg = BB.config;
  const CHAVE = "bb-pedido-v1";
  const MAX_MENSAGEM = 2500; // caracteres; acima disso o link fica grande demais

  let itens = [];
  let obsPedido = "";
  let nomeCliente = "";
  let tipoEntrega = "";
  let enderecoEntrega = "";
  let pagamento = "";
  let tipoCartao = "";
  let precisaTroco = null;
  let trocoPara = 0; // centavos
  const ouvintes = [];
  let contador = 0;

  /* ---------- formatação ---------- */
  const formatador = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const moeda = (centavos) => formatador.format(centavos / 100);
  const moedaTexto = (centavos) => moeda(centavos).replace(/\u00a0/g, " ");

  /* Texto digitado pelo cliente → texto seguro para a mensagem:
     tira quebras de linha e caracteres de controle/invisíveis (que
     poderiam fingir linhas falsas), junta espaços e limita o tamanho. */
  function limpar(texto, max) {
    let t = String(texto == null ? "" : texto)
      .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2060-\u2069\uFEFF]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    t = semSurrogatosSoltos(t).slice(0, max);
    return semSurrogatosSoltos(t).trim(); // o corte pode ter partido um emoji ao meio
  }

  /* encodeURIComponent lança erro com "meio emoji"; isso evita. */
  function semSurrogatosSoltos(s) {
    let r = "";
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff) {
        const prox = s.charCodeAt(i + 1);
        if (prox >= 0xdc00 && prox <= 0xdfff) { r += s[i] + s[i + 1]; i++; }
      } else if (c < 0xdc00 || c > 0xdfff) {
        r += s[i];
      }
    }
    return r;
  }

  /* ---------- consulta ao cardápio ---------- */
  const produtos = new Map();
  BB.cardapio.categorias.forEach((cat) => cat.itens.forEach((p) => produtos.set(p.id, p)));

  const produto = (id) => produtos.get(id) || null;
  const opcaoDe = (p, id) => (p && p.opcoes ? p.opcoes.find((o) => o.id === id) || null : null);
  const removiveis = (p) => (p.ingredientes || []).filter((i) => !(p.fixos || []).includes(i));

  function precoUnitario(item) {
    const p = produto(item.produtoId);
    if (!p) return 0;
    const op = opcaoDe(p, item.opcaoId);
    let v = op ? op.preco : p.preco || 0;
    item.extras.forEach((id) => { if (BB.cardapio.extras[id]) v += BB.cardapio.extras[id].preco; });
    return v;
  }

  /* Valida um item vindo da tela (ou do armazenamento) contra o cardápio.
     Devolve um item limpo ou null se for inválido. */
  function normalizar(b) {
    if (!b || typeof b !== "object") return null;
    const p = produto(b.produtoId);
    if (!p) return null;

    let opcaoId = null;
    if (p.opcoes) {
      if (!opcaoDe(p, b.opcaoId)) return null;
      opcaoId = b.opcaoId;
    }

    const podeTirar = removiveis(p);
    const podeExtra = p.extras || [];
    const removidos = [...new Set(Array.isArray(b.removidos) ? b.removidos : [])]
      .filter((x) => podeTirar.includes(x))
      .sort((a, c) => podeTirar.indexOf(a) - podeTirar.indexOf(c));
    const extras = [...new Set(Array.isArray(b.extras) ? b.extras : [])]
      .filter((x) => podeExtra.includes(x))
      .sort((a, c) => podeExtra.indexOf(a) - podeExtra.indexOf(c));

    const qtd = Math.min(cfg.limiteQuantidade, Math.max(1, Math.floor(Number(b.qtd)) || 1));
    return { produtoId: p.id, opcaoId, removidos, extras, qtd, obs: limpar(b.obs, cfg.limiteObsItem) };
  }

  const chave = (i) => [i.produtoId, i.opcaoId || "", i.removidos.join("|"), i.extras.join("|"), i.obs].join("§");
  const novoId = () => "i" + Date.now().toString(36) + (contador++).toString(36);

  /* ---------- guardar / carregar (só nesta aba do navegador) ---------- */
  function guardar() {
    try {
      sessionStorage.setItem(CHAVE, JSON.stringify({
        itens: itens.map((i) => ({ produtoId: i.produtoId, opcaoId: i.opcaoId, removidos: i.removidos, extras: i.extras, qtd: i.qtd, obs: i.obs })),
        obsPedido,
        nomeCliente,
        tipoEntrega,
        enderecoEntrega,
        pagamento,
        tipoCartao,
        precisaTroco,
        trocoPara,
      }));
    } catch (e) { /* armazenamento indisponível: o pedido continua funcionando na memória */ }
  }

  function carregar() {
    try {
      const dados = JSON.parse(sessionStorage.getItem(CHAVE) || "null");
      if (!dados || !Array.isArray(dados.itens)) return;
      itens = dados.itens.slice(0, cfg.limiteLinhas).map(normalizar).filter(Boolean).map((i) => ({ ...i, id: novoId() }));
      obsPedido = limpar(dados.obsPedido, cfg.limiteObsPedido);
      nomeCliente = limpar(dados.nomeCliente, cfg.limiteNomeCliente);
      tipoEntrega = ["delivery", "retirada", "local"].includes(dados.tipoEntrega) ? dados.tipoEntrega : "";
      enderecoEntrega = limpar(dados.enderecoEntrega, cfg.limiteEndereco);
      pagamento = ["pix", "cartao", "dinheiro"].includes(dados.pagamento) ? dados.pagamento : "";
      tipoCartao = ["credito", "debito"].includes(dados.tipoCartao) ? dados.tipoCartao : "";
      precisaTroco = dados.precisaTroco === true ? true : dados.precisaTroco === false ? false : null;
      trocoPara = Math.max(0, Math.floor(Number(dados.trocoPara)) || 0);
      if (pagamento !== "cartao") tipoCartao = "";
      if (pagamento !== "dinheiro") { precisaTroco = null; trocoPara = 0; }
      if (precisaTroco !== true) trocoPara = 0;
    } catch (e) {
      itens = []; obsPedido = ""; nomeCliente = ""; tipoEntrega = ""; enderecoEntrega = ""; pagamento = ""; tipoCartao = ""; precisaTroco = null; trocoPara = 0;
    }
  }

  function mudou() { guardar(); ouvintes.forEach((fn) => fn()); }

  /* ---------- operações ---------- */
  function adicionar(bruto) {
    const n = normalizar(bruto);
    if (!n) return { ok: false, motivo: "invalido" };
    const igual = itens.find((i) => chave(i) === chave(n));
    if (igual) {
      igual.qtd = Math.min(cfg.limiteQuantidade, igual.qtd + n.qtd);
    } else {
      if (itens.length >= cfg.limiteLinhas) return { ok: false, motivo: "cheio" };
      n.id = novoId();
      itens.push(n);
    }
    mudou();
    return { ok: true };
  }

  function substituir(id, bruto) {
    const n = normalizar(bruto);
    const pos = itens.findIndex((i) => i.id === id);
    if (!n || pos < 0) return { ok: false, motivo: "invalido" };
    const outro = itens.find((i) => i.id !== id && chave(i) === chave(n));
    if (outro) {
      outro.qtd = Math.min(cfg.limiteQuantidade, outro.qtd + n.qtd);
      itens.splice(pos, 1);
    } else {
      n.id = id;
      itens[pos] = n;
    }
    mudou();
    return { ok: true };
  }

  function definirQtd(id, qtd) {
    const it = itens.find((i) => i.id === id);
    if (!it) return;
    it.qtd = Math.min(cfg.limiteQuantidade, Math.max(1, Math.floor(qtd) || 1));
    mudou();
  }

  function remover(id) {
    const pos = itens.findIndex((i) => i.id === id);
    if (pos < 0) return null;
    const [item] = itens.splice(pos, 1);
    mudou();
    return { item, pos };
  }

  function restaurar(item, pos) {
    if (itens.length >= cfg.limiteLinhas) return;
    itens.splice(Math.min(pos, itens.length), 0, item);
    mudou();
  }

  function limparTudo() {
    const copia = { itens: itens.slice(), obsPedido, nomeCliente, tipoEntrega, enderecoEntrega, pagamento, tipoCartao, precisaTroco, trocoPara };
    itens = [];
    obsPedido = "";
    nomeCliente = "";
    tipoEntrega = "";
    enderecoEntrega = "";
    pagamento = "";
    tipoCartao = "";
    precisaTroco = null;
    trocoPara = 0;
    mudou();
    return copia;
  }

  function restaurarTudo(copia) {
    itens = copia.itens;
    obsPedido = copia.obsPedido;
    nomeCliente = limpar(copia.nomeCliente, cfg.limiteNomeCliente);
    tipoEntrega = ["delivery", "retirada", "local"].includes(copia.tipoEntrega) ? copia.tipoEntrega : "";
    enderecoEntrega = copia.enderecoEntrega || "";
    pagamento = copia.pagamento || "";
    tipoCartao = copia.tipoCartao || "";
    precisaTroco = copia.precisaTroco === true ? true : copia.precisaTroco === false ? false : null;
    trocoPara = Math.max(0, Math.floor(Number(copia.trocoPara)) || 0);
    mudou();
  }

  /* A observação geral é guardada sem redesenhar a tela (não tira o foco). */
  function definirObsPedido(texto) {
    obsPedido = limpar(texto, cfg.limiteObsPedido);
    guardar();
  }

  function definirNomeCliente(texto) {
    nomeCliente = limpar(texto, cfg.limiteNomeCliente);
    guardar();
  }

  function definirTipoEntrega(valor) {
    tipoEntrega = ["delivery", "retirada", "local"].includes(valor) ? valor : "";
    guardar();
  }

  function definirEnderecoEntrega(texto) {
    enderecoEntrega = limpar(texto, cfg.limiteEndereco);
    guardar();
  }

  function definirPagamento(valor) {
    pagamento = ["pix", "cartao", "dinheiro"].includes(valor) ? valor : "";
    if (pagamento !== "cartao") tipoCartao = "";
    if (pagamento !== "dinheiro") {
      precisaTroco = null;
      trocoPara = 0;
    }
    guardar();
  }

  function definirTipoCartao(valor) {
    tipoCartao = ["credito", "debito"].includes(valor) ? valor : "";
    guardar();
  }

  function definirPrecisaTroco(valor) {
    precisaTroco = valor === true ? true : valor === false ? false : null;
    if (precisaTroco !== true) trocoPara = 0;
    guardar();
  }

  function definirTrocoPara(centavos) {
    trocoPara = Math.max(0, Math.floor(Number(centavos)) || 0);
    guardar();
  }

  /* ---------- totais ---------- */
  const subtotal = () => itens.reduce((s, i) => s + precoUnitario(i) * i.qtd, 0);
  const total = subtotal; // sem taxas: o total final é confirmado no WhatsApp
  const quantidade = () => itens.reduce((s, i) => s + i.qtd, 0);

  /* ---------- mensagem do WhatsApp ---------- */
  function mensagem() {
    const L = ["Olá! Gostaria de fazer um pedido:", ""];
    if (nomeCliente) L.push("Nome: " + nomeCliente, "");
    itens.forEach((it) => {
      const p = produto(it.produtoId);
      const op = opcaoDe(p, it.opcaoId);
      L.push(`${it.qtd}x ${p.nome}${op ? " (" + op.nome + ")" : ""}`);
      it.extras.forEach((id) => L.push("+ " + BB.cardapio.extras[id].nome.toLowerCase()));
      it.removidos.forEach((r) => L.push("- " + r));
      if (it.obs) L.push("Obs: " + it.obs);
      L.push("");
    });
    if (obsPedido) L.push("Observação:", obsPedido, "");
    L.push("Total: " + moedaTexto(total()), "");

    const rotulosEntrega = {
      delivery: "Delivery",
      retirada: "Retirar no local",
      local: "Comer no local",
    };
    if (tipoEntrega) L.push("Forma de recebimento: " + rotulosEntrega[tipoEntrega]);
    if (tipoEntrega === "delivery" && enderecoEntrega) L.push("Endereço para entrega:", enderecoEntrega, "");

    const rotulos = { pix: "Pix", cartao: "Cartão", dinheiro: "Dinheiro" };
    if (pagamento) L.push("Pagamento: " + rotulos[pagamento]);
    if (pagamento === "cartao" && tipoCartao) L.push("Tipo do cartão: " + (tipoCartao === "credito" ? "Crédito" : "Débito"));
    if (pagamento === "pix") L.push(tipoEntrega === "delivery" ? "Pagamento na entrega." : "Pagamento no local.");
    if (pagamento === "cartao") L.push(tipoEntrega === "delivery" ? "Pagamento na entrega (maquininha)." : "Pagamento no local (maquininha).");
    if (pagamento === "dinheiro") {
      if (precisaTroco === true) L.push("Troco para: " + moedaTexto(trocoPara));
      if (precisaTroco === false) L.push("Não precisa de troco.");
    }
    return L.join("\n");
  }

  /* Link oficial wa.me. Devolve { url } ou { erro }. */
  function linkWhatsApp() {
    if (!/^\d{10,15}$/.test(String(cfg.whatsapp))) return { erro: "numero" };
    if (!itens.length) return { erro: "vazio" };
    if (!nomeCliente) return { erro: "nome" };
    if (!tipoEntrega) return { erro: "entrega" };
    if (tipoEntrega === "delivery" && !enderecoEntrega) return { erro: "endereco" };
    if (!pagamento) return { erro: "pagamento" };
    if (pagamento === "cartao" && !tipoCartao) return { erro: "tipo-cartao" };
    if (pagamento === "dinheiro" && precisaTroco === null) return { erro: "troco-opcao" };
    if (pagamento === "dinheiro" && precisaTroco === true && trocoPara < total()) return { erro: "troco-valor" };
    const texto = mensagem();
    if (texto.length > MAX_MENSAGEM) return { erro: "grande" };
    return { url: "https://wa.me/" + cfg.whatsapp + "?text=" + encodeURIComponent(texto) };
  }

  carregar();

  BB.carrinho = {
    get itens() { return itens; },
    get obsPedido() { return obsPedido; },
    get nomeCliente() { return nomeCliente; },
    get tipoEntrega() { return tipoEntrega; },
    get enderecoEntrega() { return enderecoEntrega; },
    get pagamento() { return pagamento; },
    get tipoCartao() { return tipoCartao; },
    get precisaTroco() { return precisaTroco; },
    get trocoPara() { return trocoPara; },
    aoMudar: (fn) => ouvintes.push(fn),
    produto, opcaoDe, removiveis, precoUnitario,
    adicionar, substituir, definirQtd, remover, restaurar, limparTudo, restaurarTudo, definirObsPedido, definirNomeCliente, definirTipoEntrega, definirEnderecoEntrega,
    definirPagamento, definirTipoCartao, definirPrecisaTroco, definirTrocoPara,
    subtotal, total, quantidade, mensagem, linkWhatsApp,
  };
  BB.fmt = { moeda, moedaTexto, limpar };
})();
