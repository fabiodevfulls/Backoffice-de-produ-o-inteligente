# Recuperação Cloudflare — referência para comparação

Esta pasta guarda 44 arquivos JavaScript e manifestos extraídos da implantação do Cloudflare. São arquivos compilados e não substituem os fontes da aplicação.

O código que já existia foi mantido. A fonte recebeu uma implementação adicional de “Minhas pausas”, baseada na variante recuperada que corresponde às capturas: três pausas de 10, 20 e 10 minutos, configuração diária por atendente, contagem regressiva e avisos dois minutos antes do início e do fim. O gerador de scripts existente também foi mantido. A variante recuperada mostra o rótulo “Scripts Inteligentes”, mas não contém uma lógica diferente do gerador de troca de titularidade já presente no código-fonte.

## Limites desta cópia

O conjunto recuperado não representa uma cópia completa do deploy atualmente ativo. Não foram encontrados o arquivo compilado ativo `dashboard-DzKpLMlF.js`, a imagem `particle-sphere.png` nem os áudios usados pelo sistema:

- `audio/aviso-fim-da-pausa.wav`
- `audio/aviso-pausa-nordestino.wav`
- `audio/inicio-pausa-10-minutos-v2.wav`
- `audio/inicio-pausa-10-minutos.wav`
- `audio/inicio-pausa-20-minutos-v2.wav`
- `audio/inicio-pausa-20-minutos.wav`
- `audio/pausa-1-10-minutos.wav`
- `audio/pausa-2-20-minutos.wav`
- `audio/pausa-3-10-minutos.wav`

A tela usa esses arquivos se estiverem disponíveis; como não vieram nesta recuperação, há uma alternativa que fala o aviso usando a voz em português disponível no navegador. Essa fala pode não ser a mesma voz do Cloudflare.

O sistema em produção continua sendo a referência da versão funcionando. Este material e as alterações de fonte são para recuperação e revisão; não constituem uma cópia exata pronta para substituir a implantação atual.
