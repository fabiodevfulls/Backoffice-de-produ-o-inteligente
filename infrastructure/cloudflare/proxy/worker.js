export default {
  async fetch(request) {
    const original = new URL(request.url);
    const destino = new URL(
      "https://controle-backoffice-arii.fabio-boy-2010-fs.chatgpt.site",
    );

    destino.pathname = original.pathname;
    destino.search = original.search;

    const resposta = await fetch(new Request(destino, request));
    const headers = new Headers(resposta.headers);

    const redirecionamento = headers.get("location");
    if (redirecionamento) {
      headers.set(
        "location",
        redirecionamento.replace(destino.origin, original.origin),
      );
    }

    return new Response(resposta.body, {
      status: resposta.status,
      statusText: resposta.statusText,
      headers,
    });
  },
};
