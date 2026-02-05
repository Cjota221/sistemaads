# CJOTA Analytics - Dashboard Estratégico

Sistema moderno de análise de campanhas Meta/Facebook com arquitetura separada, usando Supabase e Netlify.

## 🚀 Tecnologias

- **Frontend**: HTML5, TailwindCSS, JavaScript ES6+ (Modules)
- **Backend**: Netlify Functions (Serverless)
- **Banco de Dados**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth + Meta OAuth
- **Charts**: Chart.js
- **Deploy**: Netlify

## 📁 Estrutura do Projeto

```
sistemaads/
├── sql/
│   └── schema.sql                 # Schema do banco de dados Supabase
├── src/
│   ├── js/
│   │   ├── config/
│   │   │   ├── supabase.js       # Configuração do Supabase
│   │   │   └── constants.js      # Constantes da aplicação
│   │   ├── services/
│   │   │   ├── authService.js    # Serviço de autenticação
│   │   │   ├── settingsService.js # Gerenciamento de configurações
│   │   │   ├── metaApiService.js # Comunicação com Meta API
│   │   │   └── dataProcessor.js  # Processamento de dados
│   │   ├── components/
│   │   │   ├── Toast.js          # Sistema de notificações
│   │   │   ├── Modal.js          # Modais reutilizáveis
│   │   │   ├── Loading.js        # Indicadores de carregamento
│   │   │   └── Router.js         # Roteamento SPA
│   │   ├── pages/
│   │   │   ├── dashboard.js      # Página Dashboard
│   │   │   ├── campaigns.js      # Página Campanhas
│   │   │   ├── creatives.js      # Página Criativos
│   │   │   └── analysis.js       # Página Análise
│   │   └── utils/
│   │       └── helpers.js        # Funções auxiliares
│   └── css/
│       └── main.css              # Estilos customizados
├── netlify/
│   └── functions/
│       ├── auth/
│       │   ├── login.js          # Login com Meta
│       │   ├── callback.js       # Callback OAuth
│       │   └── logout.js         # Logout
│       ├── meta-data/
│       │   ├── ads.js            # Buscar dados de anúncios
│       │   ├── historical.js     # Dados históricos
│       │   └── demographics.js   # Dados demográficos
│       ├── meta-actions/
│       │   ├── status.js         # Atualizar status de adset
│       │   └── budget.js         # Atualizar orçamento
│       └── analyze.js            # Análise inteligente
├── login.html                    # Página de login
├── app.html                      # Aplicação principal
├── package.json                  # Dependências
├── netlify.toml                  # Configuração Netlify
├── .env.example                  # Exemplo de variáveis de ambiente
└── README.md                     # Este arquivo
```

## ⚙️ Configuração

### 1. Clonar o Repositório

```bash
git clone https://github.com/seu-usuario/sistemaads.git
cd sistemaads
```

### 2. Instalar Dependências

```bash
npm install
```

### 3. Configurar Supabase

1. Crie um projeto no [Supabase](https://supabase.com)
2. Execute o arquivo `sql/schema.sql` no SQL Editor do Supabase
3. Copie a URL e as chaves do projeto

### 4. Configurar Meta/Facebook App

1. Crie um app em [Meta for Developers](https://developers.facebook.com)
2. Configure o produto "Facebook Login"
3. Adicione as permissões: `ads_read`, `read_insights`, `ads_management`
4. Configure as URLs de redirecionamento

### 5. Variáveis de Ambiente

Copie `.env.example` para `.env` e preencha:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Meta/Facebook
META_APP_ID=your-meta-app-id
META_APP_SECRET=your-meta-app-secret

# Opcional
AD_ACCOUNT_ID=act_your_ad_account_id
```

### 6. Configurar Netlify

1. Instale o Netlify CLI: `npm install -g netlify-cli`
2. Faça login: `netlify login`
3. Inicie o projeto: `netlify init`
4. Configure as variáveis de ambiente no dashboard do Netlify

### 7. Rodar Localmente

```bash
npm run dev
```

Acesse: `http://localhost:8888`

## 🚀 Deploy

### Deploy Manual

```bash
npm run deploy
```

### Deploy Automático

Conecte seu repositório GitHub ao Netlify para deploy automático a cada push.

## 📊 Funcionalidades

### Dashboard
- Visão geral de métricas (ROAS, ROI, Lucro Líquido)
- Painel de saúde financeira
- Gráficos de performance temporal
- Análise por dispositivo
- Top campanhas por lucro

### Campanhas
- Listagem hierárquica (Campanhas > Conjuntos > Anúncios)
- Métricas detalhadas por nível
- Filtros de data personalizados
- Ações diretas (pausar, ativar, ajustar orçamento)

### Criativos
- Análise de performance por criativo
- Top criativos (maiores lucros)
- Criativos para pausar (prejuízo)
- Thumbnails dos anúncios

### Análise Inteligente
- Sistema de regras baseado em performance
- Recomendações automáticas
- Categorização: Escalar, Otimizar, Pausar
- Detecção de fadiga de criativo
- Análise de página de destino

## 🔒 Segurança

- Row Level Security (RLS) no Supabase
- Tokens armazenados com segurança no banco
- Autenticação OAuth 2.0
- HTTPS obrigatório em produção
- Headers de segurança configurados

## 🛠️ Manutenção

### Limpar Cache

```javascript
// No console do navegador
metaApiService.clearCache();
```

### Resetar Configurações

```javascript
// No console do navegador
settingsService.resetSettings();
```

## 📝 Personalização

### Adicionar Nova Rota

1. Crie o arquivo em `src/js/pages/sua-pagina.js`
2. Registre no `app.html`:

```javascript
import { initSuaPagina } from './src/js/pages/sua-pagina.js';
router.register('sua-pagina', initSuaPagina);
```

3. Adicione link na sidebar

### Criar Nova Function

1. Crie o arquivo em `netlify/functions/sua-function.js`
2. Adicione timeout em `netlify.toml` se necessário

## 🐛 Troubleshooting

### Erro de Autenticação
- Verifique se as variáveis de ambiente estão configuradas
- Confirme que o app Meta está em modo público
- Verifique as URLs de redirecionamento

### Erro de Conexão com Supabase
- Confirme que o schema foi executado
- Verifique as políticas RLS
- Teste a conexão no Supabase Dashboard

### Dados não Aparecem
- Limpe o cache do navegador
- Verifique o console para erros
- Confirme que o token do Meta é válido

## 📄 Licença

MIT

## 👥 Suporte

Para suporte, abra uma issue no GitHub ou entre em contato com a equipe CJOTA.
