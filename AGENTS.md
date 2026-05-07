# SGE Psicologia - Informações do Projeto

Este projeto é um Sistema de Gestão Escolar (SGE) focado em Psicologia Escolar.

## Regras e Convenções do Projeto

### 1. Documentos e Registros
- Todos os documentos gerados devem seguir o padrão de layout com timbrado configurável.
- Tipos de documentos suportados:
  - Diagnóstico Escolar
  - Registro de Escuta Psicológica
  - Atendimento em Grupo (Novo)
  - Participação nas Atividades Pedagógicas (Novo)
  - Ficha de Evolução em Sala
  - Encaminhamento
  - Declaração de Comparecimento
  - Termo de Autorização

### 2. Planos de Assinatura (SaaS)
- **Plano Básico**: R$ 79,90/mês (40 atendimentos).
- **Plano Profissional**: R$ 199,90/mês (120 atendimentos).
- **Plano Premium**: R$ 499,90/mês (500 atendimentos).
- **Plano Personalizado**: Sob consulta (Ilimitado).

### 3. Identidade Visual
- Cores principais: `sesi-blue`, `sesi-green`, `pedagogic-blue`, `pedagogic-teal`.
- Tipografia: Inter (Sans) prioritariamente.
- Estilo: Design limpo, profissional, com bordas arredondadas e sombras suaves.

### 4. Funcionalidades Críticas
- **Portal do Aluno**: Acesso via QR Code por escola.
- **Denúncias Anônimas**: Canal seguro com criptografia e sigilo.
- **Análise com IA**: Utiliza Gemini para gerar insights pedagógicos nos diagnósticos e registros de escuta.
- **Integração WhatsApp**: Envio de notificações de agendamento.

### 5. Configurações Técnicas
- Porta: 3000 (Obrigatória).
- Backend: Express + Vite (Full-stack).
- Banco de Dados: Firestore (Database ID: `ai-studio-baf44dae-6a4e-4e12-b98c-7300427429fa`).
- Autenticação: Custom (E-mail/Senha).
  - Admin Padrão: `administrador` / `12345678`
  - Admin Secundário: `maykon.euro@gmail.com` / `12345678`
