/* ==========================================================
   Barraca do Baiano — cardápio
   ----------------------------------------------------------
   Transcrito do cardápio oficial. Preços em CENTAVOS
   (1400 = R$ 14,00).

   Para mudar um preço: altere o número `preco`.
   Foto de produto: coloque dois arquivos em assets/produtos/
   chamados  <id>-640.webp  e  <id>-960.webp  e escreva o nome-base
   em `foto`, ex.: foto: "assets/produtos/x-baiano"
   ========================================================== */
"use strict";
window.BB = window.BB || {};

(function () {
  /* Acréscimos (cardápio: "Ovo ou carne de hambúrguer — R$ 3,00") */
  const extras = {
    ovo: { id: "ovo", nome: "Ovo", preco: 300 },
    carne: { id: "carne", nome: "Carne de hambúrguer", preco: 300 },
  };
  const ACRESCIMOS = ["ovo", "carne"];

  /* Ingredientes que acompanham todos os hambúrgueres */
  const BASE = ["ovo", "queijo", "presunto", "tomate", "alface", "milho", "ervilha", "batata palha"];

  /* `ingredientes` = lista real do cardápio.
     `fixos` = o que NÃO pode ser retirado no pedido (o que define o
     lanche). O resto o cliente pode desmarcar ao montar o pedido. */
  const FOTOS = "assets/produtos/";
  function sanduiche(id, nome, preco, ingredientes, fixos, foto) {
    return { id, nome, preco, ingredientes, fixos, extras: ACRESCIMOS, foto: foto ? FOTOS + foto : null };
  }
  const PAO_HAMB = ["pão", "hambúrguer"];

  const hamburgueres = [
    sanduiche("x-baiano", "X-Baiano", 1400, ["pão", "hambúrguer", ...BASE], PAO_HAMB, "x-baiano"),
    sanduiche("x-frango", "X-Frango", 1900, ["pão", "hambúrguer", "frango", ...BASE], [...PAO_HAMB, "frango"], "x-frango"),
    sanduiche("x-calabresa", "X-Calabresa", 1900, ["pão", "hambúrguer", "calabresa", ...BASE], [...PAO_HAMB, "calabresa"], "x-calabresa"),
    sanduiche("x-bacon", "X-Bacon", 1900, ["pão", "hambúrguer", "bacon", ...BASE], [...PAO_HAMB, "bacon"], "x-bacon"),
    sanduiche(
      "x-tudo", "X-Tudo", 2200,
      ["pão", "hambúrguer", "frango", "calabresa", "bacon", ...BASE],
      [...PAO_HAMB, "frango", "calabresa", "bacon"],
      "x-tudo"
    ),
  ];

  const especiais = [
    sanduiche("baiano-kids", "Baiano Kids", 900, ["carne", "queijo", "presunto", "batata palha"], ["carne"]),
    sanduiche("misto", "Misto", 900, ["queijo", "presunto"], ["queijo", "presunto"]),
  ];

  const batata = [
    {
      id: "batata-tradicional",
      nome: "Batata Frita Tradicional",
      descricao: "Tamanho P ou G.",
      opcoes: [
        { id: "p", nome: "P", preco: 1500 },
        { id: "g", nome: "G", preco: 2000 },
      ],
      tituloOpcoes: "Tamanho",
      foto: null,
    },
  ];

  /* Bebidas: sem foto, listadas em linhas. */
  const bebidas = [
    { id: "agua-500", nome: "Água mineral 500ml", preco: 300 },
    { id: "agua-gas-500", nome: "Água mineral c/ gás 500ml", preco: 400 },
    { id: "refri-200", nome: "Refrigerante 200ml", preco: 300 },
    { id: "refri-ks-200", nome: "Refrigerante KS 200ml", preco: 400 },
    { id: "refri-ks-290", nome: "Refrigerante KS 290ml", preco: 500 },
    { id: "refri-lata-350", nome: "Refrigerante lata 350ml", preco: 600 },
    { id: "refri-600", nome: "Refrigerante 600ml", preco: 700 },
    {
      id: "refri-1l",
      nome: "Refrigerante 1L",
      tituloOpcoes: "Sabor",
      opcoes: [
        { id: "coca", nome: "Coca-Cola", preco: 900 },
        { id: "pepsi", nome: "Pepsi", preco: 700 },
        { id: "guarana", nome: "Guaraná", preco: 700 },
      ],
    },
    { id: "refri-2l", nome: "Refrigerante 2L", preco: 1600 },
    { id: "suco-extra", nome: "Suco extra", preco: 300 },
  ];

  BB.cardapio = {
    extras,
    categorias: [
      { id: "hamburgueres", nome: "Hambúrgueres", layout: "cartoes", itens: hamburgueres },
      { id: "especiais", nome: "Lanches especiais", layout: "cartoes", itens: especiais },
      { id: "batata", nome: "Batata frita", layout: "cartoes", itens: batata },
      { id: "bebidas", nome: "Bebidas", layout: "lista", itens: bebidas },
    ],
  };
})();
