/*
 * Cria (ou atualiza a senha de) um usuário de login.
 * Uso: npm run criar-usuario -- "Nome" email@dominio papel senha
 * Papéis: socio | funcionario | fornecedor
 */
import { randomBytes, scryptSync } from "node:crypto";
import postgres from "postgres";

const [nome, email, papel, senha] = process.argv.slice(2);
const papeis = ["socio", "funcionario", "fornecedor"];

if (!nome || !email || !senha || !papeis.includes(papel)) {
  console.error(
    'Uso: npm run criar-usuario -- "Nome" email@dominio socio|funcionario|fornecedor senha'
  );
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL ausente — preencha o .env");
  process.exit(1);
}

const salt = randomBytes(16).toString("hex");
const senhaHash = `${salt}:${scryptSync(senha, salt, 64).toString("hex")}`;

const sql = postgres(process.env.DATABASE_URL);
const [usuario] = await sql`
  insert into usuarios (nome, email, senha_hash, papel)
  values (${nome}, ${email.toLowerCase()}, ${senhaHash}, ${papel})
  on conflict (email) do update
    set nome = excluded.nome, senha_hash = excluded.senha_hash,
        papel = excluded.papel, ativo = true
  returning id, nome, email, papel
`;
console.log("Usuário pronto:", usuario);
await sql.end();
