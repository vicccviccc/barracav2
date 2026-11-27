"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// carrega o carrinho sem navegador ou acesso ao WhatsApp
function criarCarrinho() {
  const dados = new Map();
  const contexto = vm.createContext({
    sessionStorage: {
      getItem: chave => dados.get(chave) ?? null,
      setItem: (chave, valor) => dados.set(chave, valor)
    }
  });
  contexto.window = contexto;
  for (const arquivo of ["config.js", "cardapio.js", "carrinho.js"]) {
    const codigo = fs.readFileSync(path.join(__dirname, "../js", arquivo), "utf8");
    vm.runInContext(codigo, contexto);
  }
  return contexto.BB.carrinho;
}

test("calcula o preço pelo cardápio, não pelo valor recebido", () => {
  const c = criarCarrinho();
  assert.equal(c.adicionar({ produtoId: "x-baiano", qtd: 2, preco: 1, extras: ["ovo", "ovo", "inexistente"] }).ok, true);
  assert.equal(c.total(), 3400);
  assert.equal(c.quantidade(), 2);
});

test("valida as opções de produtos", () => {
  const c = criarCarrinho();
  assert.equal(c.adicionar({ produtoId: "batata-tradicional", opcaoId: "inexistente" }).ok, false);
  assert.equal(c.adicionar({ produtoId: "batata-tradicional", opcaoId: "g" }).ok, true);
  assert.equal(c.total(), 2000);
});

test("não aceita valores inválidos para o troco", () => {
  const c = criarCarrinho();
  for (const valor of [Infinity, -100, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    c.definirTrocoPara(valor);
    assert.equal(c.trocoPara, 0);
  }
  c.definirTrocoPara(5000);
  assert.equal(c.trocoPara, 5000);
});
