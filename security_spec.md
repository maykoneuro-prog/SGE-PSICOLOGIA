# Segurança e Isolamento de Dados - SGE Psicologia

## 1. Invariantes de Dados
- Toda entidade (Alunos, Agendamentos, Documentos, Escolas) deve possuir um campo `ownerId`.
- O `ownerId` deve ser obrigatoriamente igual ao UID do usuário autenticado no momento da criação.
- Leituras (get e list) são restritas a documentos onde `ownerId` coincide com o usuário logado.
- Atualizações e Exclusões são proibidas em registros de terceiros.

## 2. Payloads de Teste (The Dirty Dozen)
1. **Identidade Trocada**: Criar aluno com `ownerId` de outro usuário. (Deve falhar)
2. **Escrita sem Auth**: Criar registro sem estar logado. (Deve falhar)
3. **Leitura Cruzada**: Tentar ler documento de outro `ownerId`. (Deve falhar)
4. **Campo Fantasma**: Tentar injetar campo `isAdmin: true` no perfil. (Deve falhar)
5. **ID Gigante**: Tentar usar um ID de documento de 1MB. (Deve falhar)
6. **Data Currompida**: Tentar salvar agendamento sem campos obrigatórios. (Deve falhar)
7. **Burlar Filtro**: Tentar listar todos os alunos sem o filtro `where('ownerId', '==', uid)`. (Deve ser bloqueado pelas regras)
8. **Alterar Dono**: Tentar dar um `update` mudando o `ownerId`. (Deve ser imutável)

## 3. Matriz de Acesso
| Coleção | Create | Read (Own) | Update (Own) | Delete (Own) | Read (Others) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| users | Auth | Sim | Sim (Perfil) | Não | Não |
| students | Auth | Sim | Sim | Sim | Não |
| schools | Auth | Sim | Sim | Sim | Não |
| appointments | Auth | Sim | Sim | Sim | Não |
| documents | Auth | Sim | Sim | Sim | Não |
| scheduling_requests | Auth | Sim | Sim | Sim | Não |
| letterheads | Auth | Sim | Sim | Sim | Não |
