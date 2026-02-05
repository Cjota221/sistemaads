# 🚀 Deploy Instructions - CJOTA Analytics

## ✅ Commit Criado com Sucesso!

Commit: `8020a8e - feat: Modernizar sistema CJOTA Analytics com arquitetura modular`

## 📋 Próximos Passos para Deploy

### 1️⃣ **Push para GitHub**

```bash
# Se ainda não tiver remote configurado
git remote add origin https://github.com/seu-usuario/sistemaads.git

# Push do código
git push -u origin main
```

### 2️⃣ **Configurar Supabase**

1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard)
2. Vá em **SQL Editor**
3. Cole o conteúdo de `sql/schema.sql`
4. Execute o script

**✅ Já configurado:**
- URL: `https://sruihmuoplwvfdsinime.supabase.co`
- Anon Key: Configurada no `.env`
- Service Role Key: Configurada no `.env`

### 3️⃣ **Configurar Meta/Facebook App**

1. Acesse [Meta for Developers](https://developers.facebook.com/)
2. Crie um novo App ou use existente
3. Adicione o produto **"Facebook Login"**
4. Configure as **Permissões**:
   - `ads_read`
   - `read_insights`
   - `ads_management`
5. Configure as **URLs de Redirecionamento**:
   ```
   https://seu-site.netlify.app/.netlify/functions/auth-callback
   http://localhost:8888/.netlify/functions/auth-callback (para dev)
   ```
6. Copie:
   - **App ID**
   - **App Secret**

### 4️⃣ **Configurar Netlify**

#### Opção A: Via Dashboard (Recomendado)

1. Acesse [Netlify](https://app.netlify.com/)
2. Clique em **"Add new site"** → **"Import an existing project"**
3. Conecte seu repositório GitHub
4. Configure:
   - **Build command**: `echo 'Build completed'`
   - **Publish directory**: `.`
5. Vá em **Site settings** → **Environment variables**
6. Adicione:
   ```
   SUPABASE_URL=https://sruihmuoplwvfdsinime.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   META_APP_ID=seu-meta-app-id
   META_APP_SECRET=seu-meta-app-secret
   AD_ACCOUNT_ID=act_seu_ad_account_id (opcional)
   ```

#### Opção B: Via CLI

```bash
# Instalar Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Inicializar
netlify init

# Configurar variáveis de ambiente
netlify env:set SUPABASE_URL "https://sruihmuoplwvfdsinime.supabase.co"
netlify env:set SUPABASE_ANON_KEY "sua-anon-key"
netlify env:set SUPABASE_SERVICE_ROLE_KEY "sua-service-key"
netlify env:set META_APP_ID "seu-app-id"
netlify env:set META_APP_SECRET "seu-app-secret"

# Deploy
netlify deploy --prod
```

### 5️⃣ **Testar Localmente Antes do Deploy**

```bash
# Instalar dependências
npm install

# Rodar localmente
npm run dev

# Acessar
http://localhost:8888
```

### 6️⃣ **Verificar Após Deploy**

- [ ] Login com Facebook funciona
- [ ] Dados são carregados da API do Meta
- [ ] Dashboard exibe métricas
- [ ] Configurações são salvas no Supabase
- [ ] Gráficos renderizam corretamente

## 🐛 Troubleshooting

### Erro de Autenticação
```bash
# Verificar se as variáveis estão configuradas
netlify env:list
```

### Erro de CORS
- Adicione a URL do Netlify nas configurações do Meta App
- Verifique as URLs de redirecionamento

### Erro de Permissões Supabase
- Execute o schema.sql completo
- Verifique as políticas RLS no dashboard

## 📁 Arquivos Criados

**Total: 27 arquivos novos/modificados**
- ✅ Schema SQL completo
- ✅ Serviços modulares (auth, meta, settings, data)
- ✅ Componentes reutilizáveis (toast, modal, loading, router)
- ✅ 4 páginas separadas (dashboard, campaigns, creatives, analysis)
- ✅ Netlify Functions organizadas
- ✅ CSS mantendo estilo original
- ✅ Configurações e documentação

## 🎯 Status

- [x] Git inicializado
- [x] Commit criado
- [ ] Push para GitHub
- [ ] Schema executado no Supabase
- [ ] Meta App configurado
- [ ] Deploy no Netlify
- [ ] Testes finais

---

**Pronto para fazer push?**
```bash
git push -u origin main
```
