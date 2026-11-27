/* ==========================================================
   Barraca do Baiano — dados de contato
   ----------------------------------------------------------
   ESTE É O ÚNICO LUGAR para trocar WhatsApp, link do mapa
   e horários. O resto do site lê daqui.
   ========================================================== */
"use strict";
window.BB = window.BB || {};

BB.config = Object.freeze({
  /* ⚠ NÚMERO PENDENTE DE CONFIRMAÇÃO — conferir com o responsável antes de publicar.
     Formato: só dígitos, com 55 (Brasil) + DDD + número.
     Atual: +55 84 9121-7386  →  558491217386 */
  whatsapp: "558491217386",

  /* Se trocar o WhatsApp acima, atualizar tambem o numero exibido aqui. */
  whatsappExibicao: "+55 84 9121-7386",

  /* Link oficial da localização (Google Maps) */
  mapsUrl: "https://maps.app.goo.gl/Zz4Qt9jeWU53BLaF8",

  /* Horário de funcionamento (como informado) */
  horarios: [
    { rotulo: "Seg, ter e qui a dom", valor: "18h às 00h" },
    { rotulo: "Quarta", valor: "Fechado" },
  ],

  /* Limites do pedido */
  limiteQuantidade: 20,
  limiteLinhas: 40,
  limiteObsItem: 200,
  limiteObsPedido: 300,
  limiteNomeCliente: 80,
  limiteEndereco: 220,
});
