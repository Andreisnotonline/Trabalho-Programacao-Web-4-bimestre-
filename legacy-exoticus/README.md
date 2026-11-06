# Legacy Exoticus — site

Site em HTML/CSS/JS com um pequeno servidor Node.js para **cadastro e login** reais.
Não usa nenhuma biblioteca externa.

## Estrutura

```
legacy-exoticus/
├── server.js          servidor (API de cadastro/login + entrega das páginas)
├── package.json
├── data/              criado automaticamente; guarda o banco legacy.db
└── public/
    ├── index.html  servicos.html  agendamento.html  loja.html
    ├── animais.html  sobre.html  cadastro.html  entrar.html
    ├── style.css  main.js
    └── img/           coloque aqui as imagens (veja abaixo)
```

## Passo a passo: rodar no seu computador

1. Instale o **Node.js versão 22.5 ou superior** em https://nodejs.org (baixe a versão LTS mais recente).
2. Confirme a instalação abrindo o terminal (Prompt de Comando / Terminal) e digitando `node --version`. Deve aparecer `v22.5` ou maior.
3. No terminal, entre na pasta do projeto:
   ```
   cd caminho/para/legacy-exoticus
   ```
4. Inicie o servidor:
   ```
   node server.js
   ```
   (Um aviso "ExperimentalWarning: SQLite" é normal.)
5. Abra no navegador: **http://localhost:3000**
6. Para parar o servidor, volte ao terminal e pressione `Ctrl + C`.

> Não abra os arquivos `.html` com duplo clique: o cadastro e o login só funcionam pelo servidor (passo 4).

## Passo a passo: colocar as imagens

As imagens do PDF não puderam ser extraídas, então o site mostra caixas "foto". Para trocar por imagens reais, **salve os arquivos na pasta `public/img/` com os nomes abaixo** (formatos aceitos: `.jpg`, `.png`, `.webp`, `.svg`). Não precisa mexer em código: o site detecta o arquivo sozinho.

| Onde aparece | Nome do arquivo |
|---|---|
| Logo (todas as páginas) | `logo` |
| Imagem de destaque (Home e Entrar) | `home-destaque` |
| Arara-azul | `arara-azul` |
| Tucano-toco | `tucano-toco` |
| Ornitorrinco | `ornitorrinco` |
| Cobra-rei albina | `cobra-rei-albina` |
| Dragão de Komodo | `dragao-de-komodo` |
| Iguana-verde | `iguana-verde` |
| Sagui-de-tufo | `sagui-de-tufo` |
| Dragão-barbudo | `dragao-barbudo` |
| Camaleão-pantera | `camaleao-pantera` |
| Píton-bola | `piton-bola` |
| Cacatua-de-crista | `cacatua-de-crista` |
| Pantera Negra | `pantera-negra` |
| Axolote | `axolote` |
| Furão | `furao` |
| Tartaruga-estrelada | `tartaruga-estrelada` |

Exemplo: a foto da arara vira `public/img/arara-azul.jpg`.

Produtos da loja: `produto-` + nome do produto sem acento e com hífens, por exemplo `produto-lampada-uvb.jpg`, `produto-racao-para-aves.png`, `produto-kit-viveiro-completo.webp`.

## Passo a passo: colocar o site na internet

Você precisa de um servidor que rode Node.js 22.5+ (uma VPS ou um serviço como Render, Railway ou Fly.io). Em qualquer um deles:

1. Envie a pasta do projeto (sem a pasta `data/`) para o serviço, ou para um repositório no GitHub conectado a ele.
2. Defina o comando de início como `node server.js`.
3. Defina a variável de ambiente `NODE_ENV=production` (ativa cookie seguro; exige HTTPS, que esses serviços já oferecem).
4. **Persistência do banco:** o arquivo `data/legacy.db` guarda as contas. Configure um disco/volume persistente montado na pasta `data/` (ou aponte outro caminho com a variável `DB_FILE`). Sem isso, as contas se perdem a cada novo deploy.
5. Aponte seu domínio para o serviço seguindo as instruções do provedor.
6. Faça cópias de segurança periódicas do arquivo `legacy.db`.

Variáveis opcionais: `PORT` (padrão 3000), `DB_FILE` (caminho do banco), `NODE_ENV`.

## Como funciona a conta

- **Cadastro** (`/api/cadastro`): valida nome, e-mail, senha (mínimo 8 caracteres), confirmação de senha e aceite dos Termos; a senha é guardada com hash (scrypt), nunca em texto puro.
- **Login** (`/api/login`): "Lembrar de mim" marcado mantém a sessão por 30 dias; desmarcado, a sessão dura até fechar o navegador (máximo 24 h).
- Há limite de tentativas por IP contra tentativas repetidas.

## Pontos que o PDF não define

Estes itens ficaram simples de propósito, por não aparecerem no PDF:

- **Esqueci minha senha**: o link existe, mas não leva a lugar nenhum.
- **Termos de uso**: aparece como texto, sem página própria.
- **Depois de entrar ou cadastrar**: o usuário vai para a Home; o cabeçalho continua igual (o PDF não mostra um estado "logado").
- **Ver mais itens** (Loja) abre o WhatsApp Business.
- **Chamar no WhatsApp / WhatsApp Business**: usam `https://wa.me/5511900000000`, ou seja, o número (11) 90000-0000 do PDF com o código do Brasil (55).
