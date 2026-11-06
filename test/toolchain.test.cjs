/*
 * Testes da toolchain do pacote (slice S1 do plano node-cli-campos-v2).
 *
 * Eles leem os arquivos do repositório (package.json, lock, workflows) e o `dist`
 * gerado pelo build. Servem de rede de proteção para que o pacote não volte ao
 * tsc + gulp antigo e para que a publicação continue passando pelo "stage publish".
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');

// Raiz do repositório: a pasta acima de `test/`.
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const pkg = JSON.parse(read('package.json'));

// Compara duas versões "x.y.z" número a número (o lock só traz versões simples).
function atLeast(version, minimum) {
	const a = version.split('.').map(Number);
	const b = minimum.split('.').map(Number);
	for (let i = 0; i < 3; i++) {
		if (a[i] !== b[i]) return a[i] > b[i];
	}
	return true;
}

describe('toolchain do node-cli', () => {
	it('[C2] o build gera o node, a credencial e os ícones no dist', () => {
		for (const file of [
			'dist/nodes/Pacto/Pacto.node.js',
			'dist/credentials/PactoApi.credentials.js',
			'dist/nodes/Pacto/pacto.svg',
			'dist/nodes/Pacto/pacto.dark.svg',
			'dist/credentials/pacto.svg',
			'dist/credentials/pacto.dark.svg',
		]) {
			assert.ok(fs.existsSync(path.join(root, file)), `${file} deveria existir após o build`);
		}
	});

	it('[C3] o package.json usa n8n-node, strict, funding e não tem dependencies nem gulp', () => {
		assert.equal(pkg.scripts.build, 'n8n-node build');
		assert.equal(pkg.scripts.lint, 'n8n-node lint');
		assert.equal(pkg.n8n.strict, true);
		assert.equal(pkg.devDependencies['@n8n/node-cli'], '0.55.5');
		assert.equal(pkg.dependencies, undefined);
		assert.ok(!JSON.stringify(pkg).includes('gulp'), 'nenhuma referência a gulp');
		assert.deepEqual(pkg.funding, {
			type: 'individual',
			url: 'https://buymeacoffee.com/qTny0AzFXS',
		});
		assert.ok(pkg.scripts['update:catalog'], 'o script update:catalog continua');
	});

	it('[C4] n8n-workflow é ^2.46.5 em dev, * no peer e o lock resolve 2.46.5 ou mais nova', () => {
		assert.equal(pkg.devDependencies['n8n-workflow'], '^2.46.5');
		assert.equal(pkg.peerDependencies['n8n-workflow'], '*');
		const lock = JSON.parse(read('package-lock.json'));
		const resolved = lock.packages['node_modules/n8n-workflow'].version;
		assert.ok(atLeast(resolved, '2.46.5'), `o lock resolve ${resolved}`);
	});

	it('[C5] o CI roda em pull_request e push na master com npm ci, lint, test e build no Node 24', () => {
		const ci = read('.github/workflows/ci.yml');
		assert.match(ci, /pull_request/);
		assert.match(ci, /push:\s*\n\s*branches:\s*\n\s*- master/);
		for (const step of ['npm ci', 'npm run lint', 'npm test', 'npm run build']) {
			assert.ok(ci.includes(step), `o CI deveria rodar "${step}"`);
		}
		assert.match(ci, /node-version:\s*24/);
	});

	it('[C6] a publicação usa stage publish, valida a tag e usa o mesmo Node do CI', () => {
		const publish = read('.github/workflows/publish.yml');
		const ci = read('.github/workflows/ci.yml');
		assert.match(publish, /workflow_dispatch/);
		const nodeOf = (text) => text.match(/node-version:\s*(\S+)/)[1];
		assert.equal(nodeOf(publish), nodeOf(ci));
		assert.match(publish, /test "\$\{GITHUB_REF_NAME\}" = "v\$\{PACKAGE_VERSION\}"/);
		for (const step of ['npm run lint', 'npm test', 'npm run build']) {
			assert.ok(publish.includes(step), `a publicação deveria rodar "${step}"`);
		}
		assert.ok(
			publish.includes('npx -y npm@12.2.2 stage publish --provenance --access public'),
			'a publicação usa o stage publish do npm 12.2.2',
		);
		assert.match(publish, /RELEASE_MODE:\s*'true'/);
		assert.ok(!/npm publish/.test(publish.replace(/#.*$/gm, '')), 'sem npm publish direto');
	});

	it('[C7] npm test compila e roda node --test sobre test/*.test.cjs', () => {
		assert.match(pkg.scripts.test, /n8n-node build|npm run build/);
		assert.match(pkg.scripts.test, /node --test/);
		assert.match(pkg.scripts.test, /test\/\*\.test\.cjs/);
	});
});

describe('documentação e lançamento', () => {
	it('[C8] o README tem as seções do padrão, o selo, o índice e o número atual de operações', () => {
		const readme = read('README.md');
		// Título de seção sem o emoji do começo, para comparar só o texto.
		const headings = readme
			.split('\n')
			.filter((line) => line.startsWith('## '))
			.map((line) => line.replace(/^##\s+\p{Extended_Pictographic}\uFE0F?\s*/u, '').trim());
		for (const expected of [
			'Funcionalidades',
			'Instalação',
			'Credenciais',
			'Nós e Operações',
			'Usar como Tool de Agente de IA',
			'Exemplos',
			'Desenvolvimento',
			'Compatibilidade',
			'Recursos',
			'Publicação',
			'Versões',
			'Suporte',
			'Apoie o projeto',
			'Licença',
		]) {
			assert.ok(headings.includes(expected), `falta a seção "${expected}" (achei: ${headings})`);
		}
		// O node não tem gatilho, então o README não pode prometer uma seção Trigger.
		assert.ok(!headings.includes('Trigger'));
		assert.match(readme, /img\.shields\.io\/badge\/Buy_Me_a_Coffee/);
		assert.match(readme, /\[Instalação\]\(#[^)]+\)/, 'o índice liga às seções');
		// O número de operações vivas do catálogo atual aparece, com ponto de milhar (4.620).
		const { PACTO_OPERATIONS } = require('../dist/nodes/Pacto/helpers/catalog.generated');
		const live = PACTO_OPERATIONS.filter((operation) => !operation.legacy).length;
		const formatted = String(live).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
		assert.ok(readme.includes(formatted), `o README deveria citar ${formatted} operações`);
		assert.ok(!readme.includes('3.499'), 'o número velho do 1.0.3 saiu do README');
	});

	it('[C34] a versão é 1.1.0 e a seção Versões lista as mudanças', () => {
		assert.equal(pkg.version, '1.1.0');
		const versions = read('README.md').split(/^## .*Versões/m)[1] ?? '';
		const entry = versions.split(/^## /m)[0];
		assert.match(entry, /\*\*1\.1\.0\*\*/);
		for (const topic of ['node-cli', 'versão 2', 'IDs', 'Busca Rápida', '131 operações']) {
			assert.ok(entry.includes(topic), `a entrada 1.1.0 deveria citar "${topic}"`);
		}
	});
});
